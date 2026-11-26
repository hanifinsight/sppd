do $$
declare v_def text; v_anchor text; v_replacement text;
begin
 select pg_get_functiondef('app_private.sppd_terbitkan(uuid,text,text,date,uuid)'::regprocedure) into v_def;
 v_anchor := '  IF NOT FOUND THEN' || E'\n' ||
   '    RAISE EXCEPTION ''Pegawai penandatangan SP tidak aktif'';' || E'\n' ||
   '  END IF;';
 v_replacement := v_anchor || E'\n\n' ||
   '  IF EXISTS (' || E'\n' ||
   '    SELECT 1 FROM public.perjalanan_peserta pp' || E'\n' ||
   '    WHERE pp.perjalanan_id = p_perjalanan_id AND pp.pegawai_id = v_sp_pegawai.id' || E'\n' ||
   '  ) AND NOT (' || E'\n' ||
   '    COALESCE(v_sp.jabatan_dokumen, '''') || '' '' || COALESCE(v_sp_pegawai.nomenklatur_jabatan, '''') || '' '' || COALESCE(v_sp_pegawai.jabatan, '''')' || E'\n' ||
   '    ~* ''(eselon[[:space:]]*ii|jabatan pimpinan tinggi pratama|sekretaris daerah|asisten|kepala dinas|kepala badan|staf ahli)''' || E'\n' ||
   '  ) THEN' || E'\n' ||
   '    RAISE EXCEPTION ''Penandatangan SP tidak boleh menjadi peserta perjalanan dinas, kecuali pejabat Eselon II'';' || E'\n' ||
   '  END IF;';
 if position(v_anchor in v_def)=0 then raise exception 'Validasi pegawai penandatangan tidak ditemukan'; end if;
 v_def:=replace(v_def,v_anchor,v_replacement);
 execute v_def;
end $$;