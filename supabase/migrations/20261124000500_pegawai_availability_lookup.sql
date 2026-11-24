-- Return only date availability for active employees in a subactivity's section.
-- The function intentionally does not reveal details of trips in other sections.
CREATE OR REPLACE FUNCTION app_private.sppd_cek_ketersediaan_pegawai(
 p_kegiatan_id uuid,
 p_tanggal_berangkat date,
 p_tanggal_kembali date,
 p_perjalanan_id uuid DEFAULT NULL
)
RETURNS TABLE(pegawai_id uuid, tanggal_berangkat date, tanggal_kembali date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_bagian uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.current_user_is_active() THEN
  RAISE EXCEPTION 'Autentikasi aktif diperlukan';
 END IF;
 IF NOT app_private.can_access_kegiatan(p_kegiatan_id) THEN
  RAISE EXCEPTION 'Tidak berhak mengakses subkegiatan ini';
 END IF;
 IF p_tanggal_berangkat IS NULL OR p_tanggal_kembali IS NULL
    OR p_tanggal_kembali < p_tanggal_berangkat THEN
  RAISE EXCEPTION 'Rentang tanggal perjalanan tidak valid';
 END IF;

 SELECT k.bagian_id INTO v_bagian
 FROM public.kegiatan k
 WHERE k.id=p_kegiatan_id AND k.aktif=true;
 IF NOT FOUND OR v_bagian IS NULL THEN
  RAISE EXCEPTION 'Subkegiatan tidak aktif atau belum memiliki Bagian';
 END IF;

 RETURN QUERY
 SELECT DISTINCT ON (pp.pegawai_id)
  pp.pegawai_id,p.tanggal_berangkat,p.tanggal_kembali
 FROM public.perjalanan_peserta pp
 JOIN public.perjalanan_dinas p ON p.id=pp.perjalanan_id
 JOIN public.pegawai pg ON pg.id=pp.pegawai_id
 WHERE pg.bagian_id=v_bagian
   AND pg.aktif=true
   AND p.id IS DISTINCT FROM p_perjalanan_id
   AND p.status<>'cancelled'
   AND p.tanggal_berangkat<=p_tanggal_kembali
   AND p.tanggal_kembali>=p_tanggal_berangkat
 ORDER BY pp.pegawai_id,p.tanggal_berangkat;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sppd_cek_ketersediaan_pegawai(
 p_kegiatan_id uuid,
 p_tanggal_berangkat date,
 p_tanggal_kembali date,
 p_perjalanan_id uuid DEFAULT NULL
)
RETURNS TABLE(pegawai_id uuid, tanggal_berangkat date, tanggal_kembali date)
LANGUAGE sql
SET search_path TO ''
AS $function$
 SELECT * FROM app_private.sppd_cek_ketersediaan_pegawai(
  p_kegiatan_id,p_tanggal_berangkat,p_tanggal_kembali,p_perjalanan_id
 );
$function$;

REVOKE ALL ON FUNCTION app_private.sppd_cek_ketersediaan_pegawai(uuid,date,date,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.sppd_cek_ketersediaan_pegawai(uuid,date,date,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.sppd_cek_ketersediaan_pegawai(uuid,date,date,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sppd_cek_ketersediaan_pegawai(uuid,date,date,uuid) TO authenticated;