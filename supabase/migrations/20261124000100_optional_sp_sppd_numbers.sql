-- Nomor SP dan SPPD boleh NULL/kosong untuk ditulis tangan setelah dokumen dicetak.
ALTER TABLE public.dokumen_sp
  DROP CONSTRAINT IF EXISTS dokumen_sp_nomor_nonempty,
  ALTER COLUMN nomor_sp DROP NOT NULL;
ALTER TABLE public.dokumen_sppd
  DROP CONSTRAINT IF EXISTS dokumen_sppd_nomor_nonempty,
  ALTER COLUMN nomor_sppd DROP NOT NULL;
DROP INDEX IF EXISTS public.dokumen_sp_nomor_tahun_unique_idx;
CREATE UNIQUE INDEX dokumen_sp_nomor_tahun_unique_idx
  ON public.dokumen_sp ((EXTRACT(YEAR FROM tanggal_terbit)::integer), UPPER(BTRIM(nomor_sp)))
  WHERE NULLIF(BTRIM(nomor_sp), '') IS NOT NULL;
DROP INDEX IF EXISTS public.dokumen_sppd_nomor_tahun_unique_idx;
CREATE UNIQUE INDEX dokumen_sppd_nomor_tahun_unique_idx
  ON public.dokumen_sppd ((EXTRACT(YEAR FROM tanggal_terbit)::integer), UPPER(BTRIM(nomor_sppd)))
  WHERE NULLIF(BTRIM(nomor_sppd), '') IS NOT NULL;
CREATE OR REPLACE FUNCTION app_private.sppd_terbitkan(p_perjalanan_id uuid, p_nomor_sp text, p_nomor_sppd text, p_tanggal_terbit date, p_penandatangan_sp_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_p public.perjalanan_dinas%rowtype;
  v_bagian_id uuid;
  v_sp public.pejabat_dokumen%rowtype;
  v_sp_pegawai public.pegawai%rowtype;
  v_kpa public.pejabat_pengelola%rowtype;
  v_kpa_pegawai public.pegawai%rowtype;
  v_kpa_count integer;
  v_days integer;
  v_total_uh numeric(18,2) := 0;
  v_bbm numeric(18,2) := 0;
  v_tol numeric(18,2) := 0;
  v_total numeric(18,2) := 0;
  v_kelompok text;
  v_tarif public.tarif_uang_harian%rowtype;
  v_pagu numeric(18,2);
  v_mutasi numeric(18,2);
  v_komitmen numeric(18,2);
  v_tersedia numeric(18,2);
  r record;
BEGIN
  -- Nomor surat boleh dikosongkan agar dapat ditulis tangan setelah dokumen dicetak.
  p_nomor_sp := NULLIF(BTRIM(p_nomor_sp), '');
  p_nomor_sppd := NULLIF(BTRIM(p_nomor_sppd), '');

  IF v_uid IS NULL OR NOT app_private.current_user_is_active() THEN
    RAISE EXCEPTION 'Autentikasi aktif diperlukan';
  END IF;
  IF NOT app_private.can_access_perjalanan(p_perjalanan_id) THEN
    RAISE EXCEPTION 'Akses perjalanan ditolak';
  END IF;

  SELECT *
    INTO v_p
  FROM public.perjalanan_dinas
  WHERE id = p_perjalanan_id
  FOR UPDATE;

  IF NOT FOUND OR v_p.status <> 'draft' THEN
    RAISE EXCEPTION 'Hanya draf yang dapat diterbitkan';
  END IF;

  SELECT k.bagian_id
    INTO v_bagian_id
  FROM public.kegiatan k
  WHERE k.id = v_p.kegiatan_id
    AND k.aktif = true;

  IF NOT FOUND OR v_bagian_id IS NULL THEN
    RAISE EXCEPTION 'Bagian kegiatan tidak valid atau tidak aktif';
  END IF;

  IF p_tanggal_terbit IS NULL THEN
    RAISE EXCEPTION 'Tanggal terbit wajib diisi';
  END IF;

  -- SP signer is selected in the draft from the Admin-maintained list.
  -- It is not restricted to the activity's own section (e.g. an Eselon II Asisten).
  SELECT *
    INTO v_sp
  FROM public.pejabat_dokumen
  WHERE id = p_penandatangan_sp_id
    AND jenis_peran = 'penandatangan_sp'
    AND aktif = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pejabat penandatangan SP tidak valid atau tidak aktif';
  END IF;

  SELECT *
    INTO v_sp_pegawai
  FROM public.pegawai
  WHERE id = v_sp.pegawai_id
    AND aktif = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pegawai penandatangan SP tidak aktif';
  END IF;

  -- SPPD signer is always the configured KPA for the activity's Bagian.
  SELECT count(*)
    INTO v_kpa_count
  FROM public.pejabat_pengelola
  WHERE jenis_peran = 'KPA'
    AND bagian_id = v_bagian_id
    AND aktif = true;

  IF v_kpa_count = 0 THEN
    RAISE EXCEPTION 'Pengaturan KPA aktif belum tersedia untuk Bagian kegiatan';
  ELSIF v_kpa_count > 1 THEN
    RAISE EXCEPTION 'Terdapat lebih dari satu KPA aktif untuk Bagian kegiatan. Periksa pengaturan pejabat.';
  END IF;

  SELECT *
    INTO v_kpa
  FROM public.pejabat_pengelola
  WHERE jenis_peran = 'KPA'
    AND bagian_id = v_bagian_id
    AND aktif = true;

  SELECT *
    INTO v_kpa_pegawai
  FROM public.pegawai
  WHERE id = v_kpa.pegawai_id
    AND aktif = true
    AND bagian_id = v_bagian_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pegawai KPA tidak aktif atau tidak sesuai dengan Bagian kegiatan';
  END IF;

  SELECT a.pagu_awal
    INTO v_pagu
  FROM public.anggaran a
  WHERE a.id = v_p.anggaran_id
    AND a.kegiatan_id = v_p.kegiatan_id
    AND a.aktif = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alokasi anggaran tidak aktif atau tidak sesuai subkegiatan';
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN m.jenis_mutasi IN ('tambah', 'penyesuaian_tambah') THEN m.nominal
      ELSE -m.nominal
    END
  ), 0)
  INTO v_mutasi
  FROM public.mutasi_anggaran m
  WHERE m.anggaran_id = v_p.anggaran_id;

  v_pagu := v_pagu + v_mutasi;

  SELECT COALESCE(SUM(k.nominal_terikat), 0)
    INTO v_komitmen
  FROM public.komitmen_anggaran k
  JOIN public.perjalanan_dinas p ON p.id = k.perjalanan_id
  WHERE p.anggaran_id = v_p.anggaran_id
    AND k.status = 'aktif';

  v_tersedia := v_pagu - v_komitmen;
  v_days := (v_p.tanggal_kembali - v_p.tanggal_berangkat) + 1;

  IF v_days < 1 THEN
    RAISE EXCEPTION 'Rentang tanggal perjalanan tidak valid';
  END IF;

  FOR r IN
    SELECT pp.id AS peserta_id, pg.status_kepegawaian, pg.pangkat_golongan
    FROM public.perjalanan_peserta pp
    JOIN public.pegawai pg ON pg.id = pp.pegawai_id
    WHERE pp.perjalanan_id = p_perjalanan_id
  LOOP
    v_kelompok := app_private.resolve_kelompok_tarif(r.status_kepegawaian, r.pangkat_golongan);

    SELECT *
      INTO v_tarif
    FROM public.tarif_uang_harian t
    WHERE t.tahun_anggaran = EXTRACT(YEAR FROM v_p.tanggal_berangkat)::integer
      AND UPPER(t.kelompok_pegawai) = UPPER(v_kelompok)
      AND LOWER(TRIM(t.provinsi)) = LOWER(TRIM(v_p.provinsi_tujuan))
      AND t.aktif = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tarif UH tidak ditemukan untuk kelompok % provinsi % tahun %',
        v_kelompok, v_p.provinsi_tujuan, EXTRACT(YEAR FROM v_p.tanggal_berangkat)::integer;
    END IF;

    INSERT INTO public.perjalanan_biaya_peserta(
      perjalanan_peserta_id, tarif_id, kelompok_pegawai_snapshot, provinsi_snapshot,
      tahun_tarif_snapshot, jumlah_hari, tarif_snapshot, total_uang_harian
    )
    VALUES (
      r.peserta_id, v_tarif.id, v_kelompok, v_p.provinsi_tujuan,
      EXTRACT(YEAR FROM v_p.tanggal_berangkat)::integer,
      v_days, v_tarif.nominal, v_days * v_tarif.nominal
    )
    ON CONFLICT (perjalanan_peserta_id) DO UPDATE SET
      tarif_id = EXCLUDED.tarif_id,
      kelompok_pegawai_snapshot = EXCLUDED.kelompok_pegawai_snapshot,
      provinsi_snapshot = EXCLUDED.provinsi_snapshot,
      tahun_tarif_snapshot = EXCLUDED.tahun_tarif_snapshot,
      jumlah_hari = EXCLUDED.jumlah_hari,
      tarif_snapshot = EXCLUDED.tarif_snapshot,
      total_uang_harian = EXCLUDED.total_uang_harian;

    v_total_uh := v_total_uh + (v_days * v_tarif.nominal);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.perjalanan_peserta
    WHERE perjalanan_id = p_perjalanan_id
  ) THEN
    RAISE EXCEPTION 'Minimal satu peserta pegawai diperlukan';
  END IF;

  SELECT
    COALESCE(SUM(nominal) FILTER (WHERE jenis_biaya = 'bbm'), 0),
    COALESCE(SUM(nominal) FILTER (WHERE jenis_biaya = 'tol'), 0)
  INTO v_bbm, v_tol
  FROM public.perjalanan_biaya_lain
  WHERE perjalanan_id = p_perjalanan_id;

  v_total := v_total_uh + v_bbm + v_tol;

  IF v_total > v_tersedia THEN
    RAISE EXCEPTION 'Anggaran tidak cukup. Tersedia %, kebutuhan %', v_tersedia, v_total;
  END IF;

  INSERT INTO public.dokumen_sp(
    perjalanan_id, nomor_sp, tanggal_terbit, penandatangan_id,
    nama_penandatangan_snapshot, jabatan_snapshot
  )
  VALUES (
    p_perjalanan_id, p_nomor_sp, p_tanggal_terbit, v_sp.id,
    v_sp_pegawai.nama, v_sp.jabatan_dokumen
  );

  INSERT INTO public.dokumen_sppd(
    perjalanan_id, nomor_sppd, tanggal_terbit, ppk_id,
    nama_ppk_snapshot, jabatan_ppk_snapshot
  )
  VALUES (
    p_perjalanan_id, p_nomor_sppd, p_tanggal_terbit, v_kpa.id,
    v_kpa_pegawai.nama,
    COALESCE(
      NULLIF(TRIM(v_kpa_pegawai.nomenklatur_jabatan), ''),
      NULLIF(TRIM(v_kpa_pegawai.jabatan), ''),
      'Kuasa Pengguna Anggaran'
    )
  );

  INSERT INTO public.komitmen_anggaran(perjalanan_id, nominal_terikat, status)
  VALUES (p_perjalanan_id, v_total, 'aktif');

  UPDATE public.perjalanan_dinas
  SET status = 'published',
      diterbitkan_pada = now(),
      penandatangan_sp_id = v_sp.id,
      penandatangan_sp_nama_snapshot = v_sp_pegawai.nama,
      penandatangan_sp_jabatan_snapshot = v_sp.jabatan_dokumen,
      kpa_sppd_id = v_kpa.id,
      updated_at = now()
  WHERE id = p_perjalanan_id;

  INSERT INTO public.log_aktivitas(
    user_id, aktivitas, tabel_referensi, referensi_id, keterangan
  )
  VALUES (
    v_uid, 'terbitkan_sp_sppd', 'perjalanan_dinas', p_perjalanan_id,
    jsonb_build_object(
      'nomor_sp', p_nomor_sp,
      'nomor_sppd', p_nomor_sppd,
      'total_biaya', v_total,
      'hari', v_days,
      'bagian_id', v_bagian_id,
      'kpa_id', v_kpa.id,
      'nama_kpa', v_kpa_pegawai.nama
    )
  );

  RETURN jsonb_build_object(
    'perjalanan_id', p_perjalanan_id,
    'total_uh', v_total_uh,
    'bbm', v_bbm,
    'tol', v_tol,
    'total_biaya', v_total,
    'jumlah_hari', v_days,
    'kpa_id', v_kpa.id,
    'nama_kpa', v_kpa_pegawai.nama,
    'jabatan_kpa', COALESCE(
      NULLIF(TRIM(v_kpa_pegawai.nomenklatur_jabatan), ''),
      NULLIF(TRIM(v_kpa_pegawai.jabatan), ''),
      'Kuasa Pengguna Anggaran'
    )
  );
END;
$function$
;