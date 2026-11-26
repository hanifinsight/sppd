alter table public.perjalanan_dinas
  add column if not exists alasan_pembatalan text,
  add column if not exists dibatalkan_pada timestamptz,
  add column if not exists dibatalkan_oleh uuid;

create or replace function public.sppd_batalkan_perjalanan(p_perjalanan_id uuid, p_alasan text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status text;
begin
  if auth.uid() is null or not app_private.current_user_is_active() then
    raise exception 'Autentikasi aktif diperlukan';
  end if;
  if not app_private.can_access_perjalanan(p_perjalanan_id) then
    raise exception 'Akses perjalanan ditolak';
  end if;
  if nullif(btrim(p_alasan), '') is null then raise exception 'Alasan pembatalan wajib diisi'; end if;
  if length(btrim(p_alasan)) > 1000 then raise exception 'Alasan pembatalan maksimal 1000 karakter'; end if;

  select status into v_status from public.perjalanan_dinas where id=p_perjalanan_id for update;
  if not found then raise exception 'Perjalanan dinas tidak ditemukan'; end if;
  if v_status='cancelled' then raise exception 'Perjalanan sudah dibatalkan'; end if;
  if v_status not in ('draft','published') then raise exception 'Status perjalanan tidak dapat dibatalkan'; end if;

  update public.perjalanan_dinas
  set status='cancelled', alasan_pembatalan=btrim(p_alasan),
      dibatalkan_pada=now(), dibatalkan_oleh=auth.uid(), updated_at=now()
  where id=p_perjalanan_id;

  update public.komitmen_anggaran
  set status='dilepas', dilepas_pada=now()
  where perjalanan_id=p_perjalanan_id and status='aktif';

  return p_perjalanan_id;
end;
$function$;

revoke all on function public.sppd_batalkan_perjalanan(uuid,text) from public;
grant execute on function public.sppd_batalkan_perjalanan(uuid,text) to authenticated;
