-- Prevent an employee from being assigned to overlapping official travel dates.
-- Draft and published trips reserve the employee; cancelled trips do not.
CREATE OR REPLACE FUNCTION app_private.sppd_simpan_draft(p_payload jsonb, p_perjalanan_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_uid uuid := auth.uid();
 v_user public.user_akun%rowtype;
 v_bagian uuid;
 v_kegiatan uuid;
 v_anggaran uuid;
 v_id uuid;
 v_p jsonb := p_payload->'perjalanan';
 v_item jsonb;
 v_pegawai uuid;
 v_status text;
 v_nama text;
 v_nip text;
 v_pangkat text;
 v_jabatan text;
 v_conflict_maksud text;
 v_conflict_mulai date;
 v_conflict_selesai date;
 v_bbm numeric(18,2) := coalesce((p_payload->'biaya'->>'bbm')::numeric,0);
 v_tol numeric(18,2) := coalesce((p_payload->'biaya'->>'tol')::numeric,0);
begin
 if v_uid is null or not app_private.current_user_is_active() then
  raise exception 'Autentikasi aktif diperlukan';
 end if;
 select * into v_user from public.user_akun where id=v_uid and aktif=true;
 if not found then raise exception 'Akun tidak aktif atau belum terdaftar'; end if;

 v_kegiatan := (v_p->>'kegiatan_id')::uuid;
 v_anggaran := (v_p->>'anggaran_id')::uuid;
 if not app_private.can_access_kegiatan(v_kegiatan) then
  raise exception 'Tidak berhak mengakses kegiatan ini';
 end if;
 select k.bagian_id into v_bagian
 from public.kegiatan k
 where k.id=v_kegiatan and k.aktif=true;
 if not found or v_bagian is null then
  raise exception 'Kegiatan tidak aktif atau belum memiliki Bagian';
 end if;
 if v_user.role='operator' then
  if not exists(select 1 from public.pegawai pg
    where pg.id=v_user.pegawai_id and pg.aktif=true and pg.bagian_id=v_bagian) then
   raise exception 'Bagian akun Operator tidak sesuai dengan kegiatan';
  end if;
 end if;
 if not exists(select 1 from public.anggaran a
  where a.id=v_anggaran and a.kegiatan_id=v_kegiatan and a.aktif=true) then
  raise exception 'Anggaran tidak sesuai dengan kegiatan atau tidak aktif';
 end if;
 if v_bbm<0 or v_tol<0 then raise exception 'Biaya BBM dan tol tidak boleh negatif'; end if;
 if (v_p->>'tanggal_berangkat')::date > (v_p->>'tanggal_kembali')::date then
  raise exception 'Tanggal kembali tidak boleh sebelum tanggal berangkat';
 end if;

 if p_perjalanan_id is null then
  insert into public.perjalanan_dinas(
   kegiatan_id,anggaran_id,jenis_perjalanan,nomor_undangan,tanggal_undangan,
   tanggal_acara_mulai,tanggal_acara_selesai,lokasi_acara,maksud_perjalanan,
   tempat_berangkat,tempat_tujuan,provinsi_tujuan,tanggal_berangkat,
   tanggal_kembali,alat_angkut,status,dibuat_oleh
  ) values (
   v_kegiatan,v_anggaran,v_p->>'jenis_perjalanan',nullif(v_p->>'nomor_undangan',''),
   nullif(v_p->>'tanggal_undangan','')::date,(v_p->>'tanggal_acara_mulai')::date,
   (v_p->>'tanggal_acara_selesai')::date,v_p->>'lokasi_acara',v_p->>'maksud_perjalanan',
   v_p->>'tempat_berangkat',v_p->>'tempat_tujuan',v_p->>'provinsi_tujuan',
   (v_p->>'tanggal_berangkat')::date,(v_p->>'tanggal_kembali')::date,
   nullif(v_p->>'alat_angkut',''),'draft',v_uid
  ) returning id into v_id;
 else
  v_id:=p_perjalanan_id;
  perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));
  select p.status into v_status
  from public.perjalanan_dinas p
  where p.id=v_id and app_private.can_access_kegiatan(p.kegiatan_id)
  for update;
  if not found or v_status<>'draft' then
   raise exception 'Draft tidak ditemukan atau tidak dapat diubah';
  end if;
  update public.perjalanan_dinas
  set kegiatan_id=v_kegiatan,anggaran_id=v_anggaran,
   jenis_perjalanan=v_p->>'jenis_perjalanan',
   nomor_undangan=nullif(v_p->>'nomor_undangan',''),
   tanggal_undangan=nullif(v_p->>'tanggal_undangan','')::date,
   tanggal_acara_mulai=(v_p->>'tanggal_acara_mulai')::date,
   tanggal_acara_selesai=(v_p->>'tanggal_acara_selesai')::date,
   lokasi_acara=v_p->>'lokasi_acara',maksud_perjalanan=v_p->>'maksud_perjalanan',
   tempat_berangkat=v_p->>'tempat_berangkat',tempat_tujuan=v_p->>'tempat_tujuan',
   provinsi_tujuan=v_p->>'provinsi_tujuan',
   tanggal_berangkat=(v_p->>'tanggal_berangkat')::date,
   tanggal_kembali=(v_p->>'tanggal_kembali')::date,
   alat_angkut=nullif(v_p->>'alat_angkut',''),updated_at=now()
  where id=v_id;
  delete from public.perjalanan_peserta where perjalanan_id=v_id;
  delete from public.perjalanan_pengikut where perjalanan_id=v_id;
  delete from public.perjalanan_biaya_lain where perjalanan_id=v_id;
 end if;

 -- Serialize participant scheduling checks so simultaneous submissions
 -- cannot assign the same employee to overlapping date ranges.
 perform pg_advisory_xact_lock(hashtextextended('sppd_pegawai_schedule',0));

 for v_item in select value from jsonb_array_elements(coalesce(p_payload->'peserta','[]'::jsonb)) loop
  v_pegawai := (v_item->>'pegawai_id')::uuid;
  select pg.status_kepegawaian,pg.nama,pg.nip,pg.pangkat_golongan,pg.jabatan
   into v_status,v_nama,v_nip,v_pangkat,v_jabatan
  from public.pegawai pg
  where pg.id=v_pegawai and pg.aktif=true and pg.bagian_id=v_bagian;
  if not found then
   raise exception 'Pegawai peserta tidak aktif atau bukan dari Bagian kegiatan';
  end if;

  select p.maksud_perjalanan,p.tanggal_berangkat,p.tanggal_kembali
   into v_conflict_maksud,v_conflict_mulai,v_conflict_selesai
  from public.perjalanan_peserta pp
  join public.perjalanan_dinas p on p.id=pp.perjalanan_id
  where pp.pegawai_id=v_pegawai
    and p.id<>v_id
    and p.status<>'cancelled'
    and p.tanggal_berangkat <= (v_p->>'tanggal_kembali')::date
    and p.tanggal_kembali >= (v_p->>'tanggal_berangkat')::date
  order by p.tanggal_berangkat
  limit 1;
  if found then
   raise exception 'Pegawai % sudah ditugaskan pada perjalanan dinas "%" tanggal % s.d. %. Pegawai tidak dapat ditugaskan pada rentang tanggal yang bertumpang tindih.',
    v_nama,coalesce(v_conflict_maksud,'Perjalanan dinas'),v_conflict_mulai,v_conflict_selesai;
  end if;

  if v_user.role='operator' and v_pegawai is distinct from v_user.pegawai_id then
   null;
  end if;
  insert into public.perjalanan_peserta(
   perjalanan_id,pegawai_id,nama_snapshot,nip_snapshot,pangkat_snapshot,jabatan_snapshot
  ) values(v_id,v_pegawai,v_nama,v_nip,v_pangkat,v_jabatan);
 end loop;

 for v_item in select value from jsonb_array_elements(coalesce(p_payload->'pengikut','[]'::jsonb)) loop
  insert into public.perjalanan_pengikut(perjalanan_id,nama,tanggal_lahir,keterangan)
  values(v_id,v_item->>'nama',nullif(v_item->>'tanggal_lahir','')::date,
   nullif(v_item->>'keterangan',''));
 end loop;

 insert into public.perjalanan_biaya_lain(perjalanan_id,jenis_biaya,nominal)
 values(v_id,'bbm',v_bbm),(v_id,'tol',v_tol);

 insert into public.log_aktivitas(user_id,aktivitas,tabel_referensi,referensi_id,keterangan)
 values(v_uid,case when p_perjalanan_id is null then 'buat_draft' else 'ubah_draft' end,
  'perjalanan_dinas',v_id,jsonb_build_object('kegiatan_id',v_kegiatan,'bagian_id',v_bagian));
 return v_id;
end;
$function$;