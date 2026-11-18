-- KeyRent · 0008 · Prenotazioni e messaggi per l'app (senza pagamento: Stripe si aggancia dopo)

-- Ponti per il server (solo service role). Il server verifica la sessione e passa l'utente come attore.
create or replace function public.svc_create_booking_request(p_customer uuid, p_listing uuid, p_pickup timestamptz,
                                                             p_return timestamptz, p_extras jsonb default '[]'::jsonb,
                                                             p_driver jsonb default '{}'::jsonb)
returns uuid language sql security invoker set search_path = public as $$
  select private.create_booking_request(p_customer, p_listing, p_pickup, p_return, p_extras, p_driver);
$$;

create or replace function public.svc_accept_booking(p_booking uuid, p_actor uuid)
returns void language sql security invoker set search_path = public as $$
  select private.accept_booking(p_booking, p_actor);
$$;

create or replace function public.svc_decline_booking(p_booking uuid, p_actor uuid, p_reason text default null)
returns void language sql security invoker set search_path = public as $$
  select private.decline_booking(p_booking, p_actor, p_reason);
$$;

create or replace function public.svc_cancel_booking(p_booking uuid, p_actor uuid, p_side text, p_reason text default null)
returns integer language sql security invoker set search_path = public as $$
  select private.cancel_booking(p_booking, p_actor, p_side, p_reason);
$$;

create or replace function public.svc_expire_stale_bookings()
returns setof uuid language sql security invoker set search_path = public as $$
  select * from private.expire_stale_bookings();
$$;

-- Riepilogo prenotazioni del cliente: titolo e città del mezzo, mai indirizzo o contatti.
create or replace function public.my_bookings(p_booking uuid default null)
returns table (
  id uuid, code text, status public.booking_status, pickup_at timestamptz, return_at timestamptz,
  total_cents integer, deposit_cents integer, quote jsonb, created_at timestamptz,
  provider_response_due_at timestamptz, customer_confirm_due_at timestamptz, cancelled_by text, cancel_reason text,
  listing_id uuid, listing_title text, listing_slug text, category_slug text, city text, province char(2)
) language sql stable security definer set search_path = public as $$
  select b.id, b.code, b.status, b.pickup_at, b.return_at, b.total_cents, b.deposit_cents, b.quote, b.created_at,
         b.provider_response_due_at, b.customer_confirm_due_at, b.cancelled_by, b.cancel_reason,
         l.id, l.title, l.slug, c.slug, loc.city, loc.province
  from bookings b
  join listings l on l.id = b.listing_id
  join categories c on c.id = l.category_id
  join locations loc on loc.id = b.location_id
  where b.customer_id = auth.uid() and (p_booking is null or b.id = p_booking)
  order by b.pickup_at desc
$$;

-- Elenco conversazioni dell'utente (lato cliente o lato noleggiatore) con l'etichetta dell'altra parte.
-- Prima della prenotazione confermata il noleggiatore resta "verificato + città" e il cliente "nome + iniziale".
create or replace function public.my_conversations(p_conversation uuid default null)
returns table (
  id uuid, listing_id uuid, listing_title text, my_side text, other_label text,
  last_message_at timestamptz, last_message text, booking_confirmed boolean
) language sql stable security definer set search_path = public as $$
  with mine as (
    select c.*, case when c.customer_id = auth.uid() then 'customer' else 'provider' end as side,
           exists (select 1 from bookings b where b.customer_id = c.customer_id and b.organization_id = c.organization_id
                    and (b.id = c.booking_id or b.listing_id = c.listing_id)
                    and b.status in ('confirmed', 'picked_up', 'completed')) as confirmed
    from conversations c
    where (c.customer_id = auth.uid()
           or exists (select 1 from organization_members m where m.organization_id = c.organization_id
                        and m.user_id = auth.uid() and m.status = 'active'))
      and (p_conversation is null or c.id = p_conversation)
  )
  select m.id, m.listing_id, l.title, m.side,
         case when m.side = 'customer' then
                case when m.confirmed then coalesce(o.trade_name, o.legal_name)
                     else 'Noleggiatore verificato · ' || loc.city end
              else trim(coalesce(p.first_name, 'Cliente') || ' ' || coalesce(left(p.last_name, 1) || '.', '')) end,
         m.last_message_at,
         (select ms.body_shown from messages ms where ms.conversation_id = m.id order by ms.created_at desc limit 1),
         m.confirmed
  from mine m
  join listings l on l.id = m.listing_id
  join locations loc on loc.id = l.location_id
  join organizations o on o.id = m.organization_id
  left join profiles p on p.id = m.customer_id
  order by m.last_message_at desc nulls last
$$;

revoke execute on function public.my_bookings(uuid), public.my_conversations(uuid) from public, anon;
grant execute on function public.my_bookings(uuid), public.my_conversations(uuid) to authenticated;

revoke execute on function public.svc_create_booking_request(uuid, uuid, timestamptz, timestamptz, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.svc_accept_booking(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.svc_decline_booking(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.svc_cancel_booking(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.svc_expire_stale_bookings() from public, anon, authenticated;
grant execute on function public.svc_create_booking_request(uuid, uuid, timestamptz, timestamptz, jsonb, jsonb) to service_role;
grant execute on function public.svc_accept_booking(uuid, uuid) to service_role;
grant execute on function public.svc_decline_booking(uuid, uuid, text) to service_role;
grant execute on function public.svc_cancel_booking(uuid, uuid, text, text) to service_role;
grant execute on function public.svc_expire_stale_bookings() to service_role;
