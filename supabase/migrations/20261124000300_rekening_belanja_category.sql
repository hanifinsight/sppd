-- Klasifikasi rekening belanja berdasarkan penetapan awal atau perubahan anggaran.
ALTER TABLE public.rekening_belanja
  ADD COLUMN IF NOT EXISTS kategori text NOT NULL DEFAULT 'penetapan',
  ADD COLUMN IF NOT EXISTS perubahan_ke integer;

ALTER TABLE public.rekening_belanja
  DROP CONSTRAINT IF EXISTS rekening_belanja_kategori_check,
  ADD CONSTRAINT rekening_belanja_kategori_check
    CHECK (kategori IN ('penetapan', 'perubahan'));

ALTER TABLE public.rekening_belanja
  DROP CONSTRAINT IF EXISTS rekening_belanja_perubahan_ke_check,
  ADD CONSTRAINT rekening_belanja_perubahan_ke_check
    CHECK (
      (kategori = 'penetapan' AND perubahan_ke IS NULL)
      OR
      (kategori = 'perubahan' AND perubahan_ke IS NOT NULL AND perubahan_ke >= 1)
    );

CREATE INDEX IF NOT EXISTS rekening_belanja_kategori_idx
  ON public.rekening_belanja (kategori, perubahan_ke);
