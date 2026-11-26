-- Use the selected budget account as the source of domestic vs ordinary travel tariff.
-- 5.1.02.04.001.00003 = Belanja Perjalanan Dinas Dalam Kota.
-- Other travel accounts continue to use the destination province tariff.

CREATE OR REPLACE FUNCTION app_private.resolve_lokasi_tarif_rekening(p_perjalanan_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN rb.kode_rekening = '5.1.02.04.001.00003' THEN 'Dalam Kota'
    ELSE NULLIF(BTRIM(p.provinsi_tujuan), '')
  END
  FROM public.perjalanan_dinas p
  JOIN public.anggaran a ON a.id = p.anggaran_id
  JOIN public.rekening_belanja rb ON rb.id = a.rekening_id
  WHERE p.id = p_perjalanan_id;
$function$;

DO $$
DECLARE
  v_oid oid;
  v_def text;
  v_new text;
  v_count integer := 0;
BEGIN
  FOR v_oid IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app_private'
      AND p.proname IN (
        'hitung_biaya_perjalanan',
        'sppd_validasi_draft',
        'sppd_pratinjau_biaya'
      )
  LOOP
    SELECT pg_get_functiondef(v_oid) INTO v_def;
    IF position('resolve_lokasi_tarif_rekening' IN v_def) > 0 THEN
      CONTINUE;
    END IF;

    v_new := v_def;
    v_new := replace(
      v_new,
      'app_private.resolve_lokasi_tarif(v_p.jenis_perjalanan, v_p.provinsi_tujuan)',
      'app_private.resolve_lokasi_tarif_rekening(p_perjalanan_id)'
    );
    v_new := replace(
      v_new,
      'app_private.resolve_lokasi_tarif(v_p.jenis_perjalanan,v_p.provinsi_tujuan)',
      'app_private.resolve_lokasi_tarif_rekening(p_perjalanan_id)'
    );
    v_new := replace(
      v_new,
      'app_private.resolve_lokasi_tarif((SELECT p.jenis_perjalanan FROM public.perjalanan_dinas p WHERE p.id = p_perjalanan_id), (SELECT p.provinsi_tujuan FROM public.perjalanan_dinas p WHERE p.id = p_perjalanan_id))',
      'app_private.resolve_lokasi_tarif_rekening(p_perjalanan_id)'
    );

    IF v_new = v_def THEN
      RAISE EXCEPTION 'Tariff mapping call not found in %', v_oid::regprocedure;
    END IF;

    EXECUTE v_new;
    v_count := v_count + 1;
  END LOOP;

  IF v_count NOT IN (0, 3) THEN
    RAISE EXCEPTION 'Unexpected number of updated functions: %', v_count;
  END IF;
END
$$;
