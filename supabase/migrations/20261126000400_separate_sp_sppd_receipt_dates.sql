CREATE OR REPLACE FUNCTION public.sppd_terbitkan_dengan_tanggal(
  p_perjalanan_id uuid,
  p_nomor_sp text,
  p_nomor_sppd text,
  p_tanggal_sp date,
  p_tanggal_sppd date,
  p_tanggal_penerimaan date,
  p_penandatangan_sp_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.current_user_is_active() THEN
    RAISE EXCEPTION 'Autentikasi aktif diperlukan';
  END IF;

  IF NOT app_private.can_access_perjalanan(p_perjalanan_id) THEN
    RAISE EXCEPTION 'Akses perjalanan ditolak';
  END IF;

  IF p_tanggal_sp IS NULL OR p_tanggal_sppd IS NULL THEN
    RAISE EXCEPTION 'Tanggal SP dan tanggal SPPD wajib diisi';
  END IF;

  v_result := public.sppd_terbitkan(
    p_perjalanan_id,
    p_nomor_sp,
    p_nomor_sppd,
    p_tanggal_sp,
    p_penandatangan_sp_id
  );

  UPDATE public.dokumen_sppd
  SET tanggal_terbit = p_tanggal_sppd
  WHERE perjalanan_id = p_perjalanan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dokumen SPPD hasil penerbitan tidak ditemukan';
  END IF;

  UPDATE public.perjalanan_dinas
  SET tanggal_penerimaan = p_tanggal_penerimaan,
      updated_at = now()
  WHERE id = p_perjalanan_id;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.sppd_terbitkan_dengan_tanggal(uuid,text,text,date,date,date,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sppd_terbitkan_dengan_tanggal(uuid,text,text,date,date,date,uuid) TO authenticated;
