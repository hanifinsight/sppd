-- Gunakan tarif khusus Dalam Kota untuk perjalanan dalam kota.
-- Perjalanan luar kota tetap menggunakan tarif berdasarkan provinsi tujuan.
CREATE OR REPLACE FUNCTION app_private.resolve_lokasi_tarif(p_jenis_perjalanan text, p_provinsi_tujuan text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_jenis_perjalanan = 'dalam_kota' THEN 'Dalam Kota'
    ELSE NULLIF(BTRIM(p_provinsi_tujuan), '')
  END;
$function$;

DO $migration$
DECLARE
  v_def text;
  v_updated text;
  v_count integer := 0;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='app_private' AND p.proname='hitung_biaya_perjalanan';
  v_updated := replace(v_def, 'LOWER(TRIM(v_p.provinsi_tujuan))',
    'LOWER(TRIM(app_private.resolve_lokasi_tarif(v_p.jenis_perjalanan, v_p.provinsi_tujuan)))');
  IF v_updated = v_def THEN RAISE EXCEPTION 'Pola tarif pada hitung_biaya_perjalanan tidak ditemukan'; END IF;
  EXECUTE v_updated; v_count := v_count + 1;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='app_private' AND p.proname='sppd_validasi_draft';
  v_updated := replace(v_def, 'lower(trim(v_p.provinsi_tujuan))',
    'lower(trim(app_private.resolve_lokasi_tarif(v_p.jenis_perjalanan, v_p.provinsi_tujuan)))');
  IF v_updated = v_def THEN RAISE EXCEPTION 'Pola tarif pada sppd_validasi_draft tidak ditemukan'; END IF;
  EXECUTE v_updated; v_count := v_count + 1;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='app_private' AND p.proname='sppd_pratinjau_biaya';
  v_updated := replace(v_def,
    'LOWER(TRIM((SELECT p.provinsi_tujuan FROM public.perjalanan_dinas p WHERE p.id = p_perjalanan_id)))',
    'LOWER(TRIM(app_private.resolve_lokasi_tarif((SELECT p.jenis_perjalanan FROM public.perjalanan_dinas p WHERE p.id = p_perjalanan_id), (SELECT p.provinsi_tujuan FROM public.perjalanan_dinas p WHERE p.id = p_perjalanan_id))))');
  IF v_updated = v_def THEN RAISE EXCEPTION 'Pola tarif pada sppd_pratinjau_biaya tidak ditemukan'; END IF;
  EXECUTE v_updated; v_count := v_count + 1;

  IF v_count <> 3 THEN RAISE EXCEPTION 'Migrasi tarif tidak lengkap'; END IF;
END;
$migration$;

COMMENT ON FUNCTION app_private.resolve_lokasi_tarif(text,text) IS
'Memetakan perjalanan dalam kota ke kelompok tarif Dalam Kota; perjalanan luar kota memakai provinsi tujuan.';
