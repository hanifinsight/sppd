-- Fix published-trip edit: use a RECORD target for the multi-column
-- participant-cost query. The previous JSONB loop variable caused UUID
-- values to be parsed as JSON ("invalid input syntax for type json").
DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('app_private.sppd_perbarui_perjalanan_terbit(jsonb,uuid)'::regprocedure)
    INTO v_definition;

  IF position('v_peserta record;' in v_definition) = 0 THEN
    v_definition := replace(v_definition, '  v_item jsonb;', '  v_item jsonb;' || E'\n' || '  v_peserta record;');
  END IF;

  v_definition := replace(
    v_definition,
    '  for v_item in' || E'\n' || '    select pp.id peserta_id,pg.status_kepegawaian,pg.pangkat_golongan',
    '  for v_peserta in' || E'\n' || '    select pp.id peserta_id,pg.status_kepegawaian,pg.pangkat_golongan'
  );
  v_definition := replace(v_definition, 'v_item.status_kepegawaian', 'v_peserta.status_kepegawaian');
  v_definition := replace(v_definition, 'v_item.pangkat_golongan', 'v_peserta.pangkat_golongan');
  v_definition := replace(v_definition, 'v_item.peserta_id', 'v_peserta.peserta_id');

  IF position('for v_peserta in' in v_definition) = 0 THEN
    RAISE EXCEPTION 'Pola loop peserta tidak ditemukan; fungsi tidak diubah';
  END IF;

  EXECUTE v_definition;
END
$migration$;
