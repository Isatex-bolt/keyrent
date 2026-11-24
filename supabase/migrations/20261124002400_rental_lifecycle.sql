-- 0024 · Ciclo del noleggio dal pannello del noleggiatore: consegnato, rientrato, non presentato.
-- Ponti per il server (solo service role): il server verifica la sessione e passa l'utente come attore;
-- qui si controlla che sia titolare, manager o staff dell'attività della prenotazione.
create or replace function public.svc_mark_picked_up(p_booking uuid, p_actor uuid)
returns void language sql security invoker set search_path = public as $$
  select private.mark_picked_up(p_booking, p_actor);
$$;

create or replace function public.svc_mark_returned(p_booking uuid, p_actor uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from bookings where id = p_booking;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  perform private.assert_member(v_org, p_actor, array['owner', 'manager', 'staff']::org_role[]);
  perform private.mark_completed(p_booking);
end $$;

create or replace function public.svc_mark_no_show(p_booking uuid, p_actor uuid)
returns void language sql security invoker set search_path = public as $$
  select private.mark_no_show(p_booking, p_actor);
$$;

revoke execute on function public.svc_mark_picked_up(uuid, uuid), public.svc_mark_returned(uuid, uuid),
  public.svc_mark_no_show(uuid, uuid) from public, anon, authenticated;
grant execute on function public.svc_mark_picked_up(uuid, uuid), public.svc_mark_returned(uuid, uuid),
  public.svc_mark_no_show(uuid, uuid) to service_role;
