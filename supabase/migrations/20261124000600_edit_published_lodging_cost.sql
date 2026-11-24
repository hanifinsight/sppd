-- Enable a post-publication correction for lodging costs while preserving issued documents.
ALTER TABLE public.perjalanan_biaya_lain
  DROP CONSTRAINT IF EXISTS biaya_lain_jenis_valid;
ALTER TABLE public.perjalanan_biaya_lain
  ADD CONSTRAINT biaya_lain_jenis_valid
  CHECK (jenis_biaya = ANY (ARRAY['bbm'::text, 'tol'::text, 'penginapan'::text]));

CREATE OR REPLACE FUNCTION app_private.sppd_perbarui_biaya_penginapan(
  p_perjalanan_id uuid,
  p_nominal_penginapan numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_p public.perjalanan_dinas%rowtype;
  v_pagu numeric(18,2);
  v_mutasi numeric(18,2);
  v_komitmen_lain numeric(18,2);
  v_tersedia numeric(18,2);
  v_uh numeric(18,2);
  v_bbm numeric(18,2);
  v_tol numeric(18,2);
  v_total numeric(18,2);
BEGIN
  IF v_uid IS NULL OR NOT app_private.current_user_is_active() THEN
    RAISE EXCEPTION 'Autentikasi aktif diperlukan';
  END IF;
  IF NOT app_private.can_access_perjalanan(p_perjalanan_id) THEN
    RAISE EXCEPTION 'Tidak berhak mengakses perjalanan ini';
  END IF;
  IF p_nominal_penginapan IS NULL OR p_nominal_penginapan < 0 THEN
    RAISE EXCEPTION 'Biaya penginapan tidak boleh negatif';
  END IF;

  SELECT * INTO v_p
  FROM public.perjalanan_dinas
  WHERE id = p_perjalanan_id
  FOR UPDATE;
  IF NOT FOUND OR v_p.status <> 'published' THEN
    RAISE EXCEPTION 'Perubahan biaya hanya dapat dilakukan pada perjalanan yang sudah diterbitkan';
  END IF;

  SELECT a.pagu_awal INTO v_pagu
  FROM public.anggaran a
  WHERE a.id = v_p.anggaran_id AND a.kegiatan_id = v_p.kegiatan_id AND a.aktif = true
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alokasi anggaran tidak aktif atau tidak ditemukan';
  END IF;

  SELECT COALESCE(SUM(CASE
    WHEN m.jenis_mutasi IN ('tambah', 'penyesuaian_tambah') THEN m.nominal
    ELSE -m.nominal END), 0)
  INTO v_mutasi
  FROM public.mutasi_anggaran m WHERE m.anggaran_id = v_p.anggaran_id;
  v_pagu := v_pagu + v_mutasi;

  SELECT COALESCE(SUM(k.nominal_terikat), 0)
  INTO v_komitmen_lain
  FROM public.komitmen_anggaran k
  JOIN public.perjalanan_dinas p ON p.id = k.perjalanan_id
  WHERE p.anggaran_id = v_p.anggaran_id
    AND k.status = 'aktif' AND k.perjalanan_id <> p_perjalanan_id;

  SELECT COALESCE(SUM(pb.total_uang_harian), 0)
  INTO v_uh
  FROM public.perjalanan_biaya_peserta pb
  JOIN public.perjalanan_peserta pp ON pp.id = pb.perjalanan_peserta_id
  WHERE pp.perjalanan_id = p_perjalanan_id;

  SELECT
    COALESCE(SUM(nominal) FILTER (WHERE jenis_biaya = 'bbm'), 0),
    COALESCE(SUM(nominal) FILTER (WHERE jenis_biaya = 'tol'), 0)
  INTO v_bbm, v_tol
  FROM public.perjalanan_biaya_lain
  WHERE perjalanan_id = p_perjalanan_id;

  v_total := v_uh + v_bbm + v_tol + p_nominal_penginapan;
  v_tersedia := v_pagu - v_komitmen_lain;
  IF v_total > v_tersedia THEN
    RAISE EXCEPTION 'Anggaran tidak cukup. Pagu tersedia untuk perjalanan ini %, kebutuhan baru %', v_tersedia, v_total;
  END IF;

  IF p_nominal_penginapan = 0 THEN
    DELETE FROM public.perjalanan_biaya_lain
    WHERE perjalanan_id = p_perjalanan_id AND jenis_biaya = 'penginapan';
  ELSE
    INSERT INTO public.perjalanan_biaya_lain(perjalanan_id, jenis_biaya, nominal, keterangan)
    VALUES (p_perjalanan_id, 'penginapan', p_nominal_penginapan, 'Biaya penginapan')
    ON CONFLICT (perjalanan_id, jenis_biaya)
    DO UPDATE SET nominal = EXCLUDED.nominal,
                  keterangan = EXCLUDED.keterangan,
                  updated_at = now();
  END IF;

  UPDATE public.komitmen_anggaran
  SET nominal_terikat = v_total
  WHERE perjalanan_id = p_perjalanan_id AND status = 'aktif';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Komitmen anggaran aktif tidak ditemukan untuk perjalanan ini';
  END IF;

  UPDATE public.perjalanan_dinas SET updated_at = now() WHERE id = p_perjalanan_id;

  INSERT INTO public.log_aktivitas(user_id, aktivitas, tabel_referensi, referensi_id, keterangan)
  VALUES (
    v_uid, 'ubah_biaya_penginapan', 'perjalanan_dinas', p_perjalanan_id,
    jsonb_build_object(
      'biaya_penginapan_baru', p_nominal_penginapan,
      'total_uh', v_uh, 'bbm', v_bbm, 'tol', v_tol,
      'total_komitmen_baru', v_total
    )
  );

  RETURN jsonb_build_object(
    'perjalanan_id', p_perjalanan_id,
    'biaya_penginapan', p_nominal_penginapan,
    'total_komitmen_baru', v_total
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.sppd_perbarui_biaya_penginapan(
  p_perjalanan_id uuid,
  p_nominal_penginapan numeric
)
RETURNS jsonb
LANGUAGE sql
SET search_path TO ''
AS $function$
  SELECT app_private.sppd_perbarui_biaya_penginapan(p_perjalanan_id, p_nominal_penginapan);
$function$;

REVOKE ALL ON FUNCTION app_private.sppd_perbarui_biaya_penginapan(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.sppd_perbarui_biaya_penginapan(uuid, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.sppd_perbarui_biaya_penginapan(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sppd_perbarui_biaya_penginapan(uuid, numeric) TO authenticated;
