-- Enforce that a trip uses a subactivity from the same fiscal year as its travel dates.
-- This database trigger protects all write paths, including RPC calls and direct table updates.

CREATE OR REPLACE FUNCTION app_private.sppd_validasi_tahun_anggaran_perjalanan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_tahun_anggaran integer;
  v_tahun_berangkat integer;
  v_tahun_kembali integer;
BEGIN
  IF NEW.tanggal_berangkat IS NULL OR NEW.tanggal_kembali IS NULL THEN
    RAISE EXCEPTION 'Tanggal berangkat dan tanggal kembali wajib diisi untuk validasi tahun anggaran';
  END IF;

  SELECT k.tahun_anggaran
    INTO v_tahun_anggaran
  FROM public.kegiatan k
  WHERE k.id = NEW.kegiatan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subkegiatan tidak ditemukan untuk validasi tahun anggaran';
  END IF;

  v_tahun_berangkat := EXTRACT(YEAR FROM NEW.tanggal_berangkat)::integer;
  v_tahun_kembali := EXTRACT(YEAR FROM NEW.tanggal_kembali)::integer;

  IF v_tahun_berangkat <> v_tahun_kembali THEN
    RAISE EXCEPTION 'Perjalanan dinas tidak boleh melintasi tahun anggaran. Tahun berangkat % dan tahun kembali %', v_tahun_berangkat, v_tahun_kembali;
  END IF;

  IF v_tahun_berangkat <> v_tahun_anggaran THEN
    RAISE EXCEPTION 'Tahun perjalanan (%) tidak sesuai dengan tahun anggaran subkegiatan (%). Pilih subkegiatan pada tahun yang sama', v_tahun_berangkat, v_tahun_anggaran;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sppd_validasi_tahun_anggaran_perjalanan
ON public.perjalanan_dinas;

CREATE TRIGGER trg_sppd_validasi_tahun_anggaran_perjalanan
BEFORE INSERT OR UPDATE OF kegiatan_id, tanggal_berangkat, tanggal_kembali
ON public.perjalanan_dinas
FOR EACH ROW
EXECUTE FUNCTION app_private.sppd_validasi_tahun_anggaran_perjalanan();
