-- Include lodging in cost totals and the published-trip cost preview.
CREATE OR REPLACE FUNCTION app_private.hitung_biaya_perjalanan(p_perjalanan_id uuid)
RETURNS TABLE(total_uh numeric, total_bbm numeric, total_tol numeric, total_biaya numeric, jumlah_hari integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_p public.perjalanan_dinas%rowtype;
  v_hari integer;
  v_uh numeric(18,2) := 0;
  v_bbm numeric(18,2) := 0;
  v_tol numeric(18,2) := 0;
  v_penginapan numeric(18,2) := 0;
  v_count integer := 0;
  r record;
  v_kelompok text;
  v_tarif public.tarif_uang_harian%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.can_access_perjalanan(p_perjalanan_id) THEN
    RAISE EXCEPTION 'Akses perjalanan ditolak';
  END IF;
  SELECT * INTO v_p FROM public.perjalanan_dinas WHERE id = p_perjalanan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perjalanan tidak ditemukan'; END IF;
  v_hari := (v_p.tanggal_kembali - v_p.tanggal_berangkat) + 1;
  IF v_hari < 1 THEN RAISE EXCEPTION 'Rentang tanggal perjalanan tidak valid'; END IF;

  FOR r IN
    SELECT pp.id peserta_id, pg.status_kepegawaian, pg.pangkat_golongan
    FROM public.perjalanan_peserta pp
    JOIN public.pegawai pg ON pg.id = pp.pegawai_id
    WHERE pp.perjalanan_id = p_perjalanan_id
  LOOP
    v_count := v_count + 1;
    v_kelompok := app_private.resolve_kelompok_tarif(r.status_kepegawaian, r.pangkat_golongan);
    SELECT * INTO v_tarif
    FROM public.tarif_uang_harian t
    WHERE t.tahun_anggaran = EXTRACT(YEAR FROM v_p.tanggal_berangkat)::integer
      AND UPPER(t.kelompok_pegawai) = UPPER(v_kelompok)
      AND LOWER(TRIM(t.provinsi)) = LOWER(TRIM(v_p.provinsi_tujuan))
      AND t.aktif = true LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tarif UH belum tersedia: tahun %, kelompok %, provinsi %',
        EXTRACT(YEAR FROM v_p.tanggal_berangkat)::integer, v_kelompok, v_p.provinsi_tujuan;
    END IF;
    v_uh := v_uh + (v_tarif.nominal * v_hari);
  END LOOP;
  IF v_count = 0 THEN RAISE EXCEPTION 'Perjalanan harus memiliki minimal satu peserta pegawai'; END IF;

  SELECT
    COALESCE(SUM(nominal) FILTER (WHERE jenis_biaya = 'bbm'), 0),
    COALESCE(SUM(nominal) FILTER (WHERE jenis_biaya = 'tol'), 0),
    COALESCE(SUM(nominal) FILTER (WHERE jenis_biaya = 'penginapan'), 0)
  INTO v_bbm, v_tol, v_penginapan
  FROM public.perjalanan_biaya_lain
  WHERE perjalanan_id = p_perjalanan_id;

  RETURN QUERY SELECT v_uh, v_bbm, v_tol, v_uh + v_bbm + v_tol + v_penginapan, v_hari;
END;
$function$;

CREATE OR REPLACE FUNCTION app_private.sppd_pratinjau_biaya(p_perjalanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_validation jsonb;
  v_totals record;
  v_participants jsonb;
  v_other jsonb;
  v_penginapan numeric(18,2) := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.current_user_is_active() THEN
    RAISE EXCEPTION 'Autentikasi aktif diperlukan';
  END IF;
  IF NOT app_private.can_access_perjalanan(p_perjalanan_id) THEN
    RAISE EXCEPTION 'Tidak berhak mengakses perjalanan ini';
  END IF;
  v_validation := public.sppd_validasi_draft(p_perjalanan_id);
  IF COALESCE((v_validation->>'valid')::boolean, false) = false THEN
    RETURN jsonb_build_object('validasi', v_validation, 'biaya', null);
  END IF;

  SELECT * INTO v_totals FROM app_private.hitung_biaya_perjalanan(p_perjalanan_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nama', pp.nama_snapshot,
    'kelompok_pegawai', app_private.resolve_kelompok_tarif(pg.status_kepegawaian, pg.pangkat_golongan),
    'tarif_harian', t.nominal,
    'jumlah_hari', v_totals.jumlah_hari,
    'total_uang_harian', t.nominal * v_totals.jumlah_hari
  ) ORDER BY pp.nama_snapshot), '[]'::jsonb)
  INTO v_participants
  FROM public.perjalanan_peserta pp
  JOIN public.pegawai pg ON pg.id = pp.pegawai_id
  JOIN public.tarif_uang_harian t
    ON t.tahun_anggaran = (SELECT EXTRACT(YEAR FROM p.tanggal_berangkat)::integer FROM public.perjalanan_dinas p WHERE p.id = p_perjalanan_id)
   AND UPPER(t.kelompok_pegawai) = UPPER(app_private.resolve_kelompok_tarif(pg.status_kepegawaian, pg.pangkat_golongan))
   AND LOWER(TRIM(t.provinsi)) = LOWER(TRIM((SELECT p.provinsi_tujuan FROM public.perjalanan_dinas p WHERE p.id = p_perjalanan_id)))
   AND t.aktif = true
  WHERE pp.perjalanan_id = p_perjalanan_id;

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('jenis', jenis_biaya, 'nominal', nominal, 'keterangan', keterangan) ORDER BY jenis_biaya), '[]'::jsonb),
    COALESCE(SUM(nominal) FILTER (WHERE jenis_biaya = 'penginapan'), 0)
  INTO v_other, v_penginapan
  FROM public.perjalanan_biaya_lain
  WHERE perjalanan_id = p_perjalanan_id;

  RETURN jsonb_build_object(
    'validasi', v_validation,
    'biaya', jsonb_build_object(
      'peserta', v_participants,
      'rincian_biaya_lain', v_other,
      'total_uh', v_totals.total_uh,
      'total_bbm', v_totals.total_bbm,
      'total_tol', v_totals.total_tol,
      'total_penginapan', v_penginapan,
      'total_biaya', v_totals.total_biaya,
      'jumlah_hari', v_totals.jumlah_hari
    ),
    'catatan', 'Pratinjau bersifat informatif; tidak membuat komitmen anggaran dan tidak menyimpan snapshot penerbitan.'
  );
END;
$function$;
