-- Make the budget account the single source of truth for trip classification.
CREATE OR REPLACE FUNCTION app_private.sppd_sinkronkan_jenis_perjalanan_rekening()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_kode_rekening text;
BEGIN
  SELECT rb.kode_rekening
    INTO v_kode_rekening
  FROM public.anggaran a
  JOIN public.rekening_belanja rb ON rb.id = a.rekening_id
  WHERE a.id = NEW.anggaran_id
    AND a.kegiatan_id = NEW.kegiatan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rekening anggaran tidak ditemukan atau tidak sesuai dengan subkegiatan';
  END IF;

  NEW.jenis_perjalanan := CASE
    WHEN v_kode_rekening = '5.1.02.04.001.00003' THEN 'dalam_kota'
    ELSE 'luar_kota'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sppd_sinkronkan_jenis_perjalanan_rekening
ON public.perjalanan_dinas;

CREATE TRIGGER trg_sppd_sinkronkan_jenis_perjalanan_rekening
BEFORE INSERT OR UPDATE OF anggaran_id, kegiatan_id
ON public.perjalanan_dinas
FOR EACH ROW
EXECUTE FUNCTION app_private.sppd_sinkronkan_jenis_perjalanan_rekening();

-- Repair existing labels from their actual budget account.
UPDATE public.perjalanan_dinas p
SET jenis_perjalanan = CASE
  WHEN rb.kode_rekening = '5.1.02.04.001.00003' THEN 'dalam_kota'
  ELSE 'luar_kota'
END
FROM public.anggaran a
JOIN public.rekening_belanja rb ON rb.id = a.rekening_id
WHERE a.id = p.anggaran_id
  AND a.kegiatan_id = p.kegiatan_id
  AND p.jenis_perjalanan IS DISTINCT FROM CASE
    WHEN rb.kode_rekening = '5.1.02.04.001.00003' THEN 'dalam_kota'
    ELSE 'luar_kota'
  END;
