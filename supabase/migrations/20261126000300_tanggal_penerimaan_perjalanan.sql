ALTER TABLE public.perjalanan_dinas
  ADD COLUMN IF NOT EXISTS tanggal_penerimaan date NULL;

COMMENT ON COLUMN public.perjalanan_dinas.tanggal_penerimaan IS
  'Tanggal penerimaan yang diisi saat membuat atau mengedit perjalanan dinas; NULL berarti tanggal pada PDF penerimaan dikosongkan.';
