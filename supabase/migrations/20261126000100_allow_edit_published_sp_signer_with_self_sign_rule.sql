do $$
declare v_def text; v_anchor text; v_replacement text;
begin
 select pg_get_functiondef('app_private.sppd_perbarui_perjalanan_terbit(jsonb,uuid)'::regprocedure) into v_def;
 if position('v_sp_signer public.pejabat_dokumen%rowtype;' in v_def)=0 then
  v_def:=replace(v_def,'  v_peserta record;','  v_peserta record;'||E'\n'||'  v_sp_signer public.pejabat_dokumen%rowtype;'||E'\n'||'  v_sp_employee public.pegawai%rowtype;'||E'\n'||'  v_signer_id uuid := nullif(v_p->>''penandatangan_sp_id'','''')::uuid;');
 end if;
 v_anchor:='  update public.perjalanan_dinas set'||E'\n'||'    kegiatan_id=v_kegiatan, anggaran_id=v_anggaran,';
 v_replacement:='  if v_signer_id is null then raise exception ''Penandatangan SP wajib dipilih''; end if;'||E'\n'||
 '  select * into v_sp_signer from public.pejabat_dokumen where id=v_signer_id and jenis_peran=''penandatangan_sp'' and aktif=true;'||E'\n'||
 '  if not found then raise exception ''Penandatangan SP tidak valid atau tidak aktif''; end if;'||E'\n'||
 '  select * into v_sp_employee from public.pegawai where id=v_sp_signer.pegawai_id and aktif=true;'||E'\n'||
 '  if not found then raise exception ''Pegawai penandatangan SP tidak aktif''; end if;'||E'\n'||
 '  if exists (select 1 from jsonb_array_elements(coalesce(p_payload->''peserta'',''[]''::jsonb)) x where x->>''pegawai_id''=v_sp_signer.pegawai_id::text)'||E'\n'||
 '   and not (coalesce(v_sp_signer.jabatan_dokumen,'''') || '' '' || coalesce(v_sp_employee.nomenklatur_jabatan,'''') || '' '' || coalesce(v_sp_employee.jabatan,'''') ~* ''(eselon[[:space:]]*ii|jabatan pimpinan tinggi pratama|sekretaris daerah|asisten|kepala dinas|kepala badan|staf ahli)'') then'||E'\n'||
 '   raise exception ''Penandatangan SP tidak boleh menjadi peserta perjalanan dinas, kecuali pejabat Eselon II'';'||E'\n'||
 '  end if;'||E'\n'||v_anchor;
 if position(v_anchor in v_def)=0 then raise exception 'Anchor update perjalanan tidak ditemukan'; end if;
 v_def:=replace(v_def,v_anchor,v_replacement);
 v_anchor:='  where id=p_perjalanan_id;'||E'\n\n'||'  perform pg_advisory_xact_lock(hashtextextended(''sppd_pegawai_schedule'',0));';
 v_replacement:='  where id=p_perjalanan_id;'||E'\n'||
 '  update public.perjalanan_dinas set penandatangan_sp_id=v_sp_signer.id, penandatangan_sp_nama_snapshot=v_sp_employee.nama, penandatangan_sp_jabatan_snapshot=v_sp_signer.jabatan_dokumen where id=p_perjalanan_id;'||E'\n'||
 '  update public.dokumen_sp set penandatangan_id=v_sp_signer.id, nama_penandatangan_snapshot=v_sp_employee.nama, jabatan_snapshot=v_sp_signer.jabatan_dokumen where perjalanan_id=p_perjalanan_id;'||E'\n'||
 '  if not found then raise exception ''Dokumen SP untuk perjalanan ini tidak ditemukan''; end if;'||E'\n\n'||
 '  perform pg_advisory_xact_lock(hashtextextended(''sppd_pegawai_schedule'',0));';
 if position(v_anchor in v_def)=0 then raise exception 'Anchor update peserta tidak ditemukan'; end if;
 v_def:=replace(v_def,v_anchor,v_replacement);
 execute v_def;
end $$;