-- Satu subkegiatan hanya boleh ditangani satu Staf Admin,
-- sedangkan satu Staf Admin dapat menangani beberapa subkegiatan.
alter table public.operator_kegiatan
  drop constraint if exists operator_kegiatan_user_id_key;

alter table public.operator_kegiatan
  add constraint operator_kegiatan_kegiatan_id_key unique (kegiatan_id);
