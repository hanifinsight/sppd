CREATE OR REPLACE FUNCTION public.sppd_perbarui_perjalanan_terbit(p_payload jsonb, p_perjalanan_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result uuid;
  v_sp_date date;
  v_sppd_date date;
  v_receipt_date date;
BEGIN
  v_result := app_private.sppd_perbarui_perjalanan_terbit(p_payload, p_perjalanan_id);

  v_sp_date := nullif(p_payload->'perjalanan'->>'tanggal_sp', '')::date;
  v_sppd_date := nullif(p_payload->'perjalanan'->>'tanggal_sppd', '')::date;
  v_receipt_date := nullif(p_payload->'perjalanan'->>'tanggal_penerimaan', '')::date;

  IF v_sp_date IS NULL OR v_sppd_date IS NULL THEN
    RAISE EXCEPTION 'Tanggal SP dan SPPD wajib diisi';
  END IF;

  UPDATE public.dokumen_sp
     SET tanggal_terbit = v_sp_date
   WHERE perjalanan_id = p_perjalanan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dokumen SP untuk perjalanan ini tidak ditemukan';
  END IF;

  UPDATE public.dokumen_sppd
     SET tanggal_terbit = v_sppd_date
   WHERE perjalanan_id = p_perjalanan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dokumen SPPD untuk perjalanan ini tidak ditemukan';
  END IF;

  UPDATE public.perjalanan_dinas
     SET tanggal_penerimaan = v_receipt_date,
         updated_at = now()
   WHERE id = p_perjalanan_id;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.sppd_perbarui_perjalanan_terbit(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sppd_perbarui_perjalanan_terbit(jsonb, uuid) TO authenticated;
