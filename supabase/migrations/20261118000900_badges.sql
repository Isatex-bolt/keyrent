-- KeyRent · 0009 · Contatori delle novità nei menu (messaggi non letti, richieste, aggiornamenti prenotazioni, revisioni)

create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
revoke all on public.conversation_reads from anon, authenticated;
grant all on public.conversation_reads to service_role;
alter table public.conversation_reads enable row level security;
grant select on public.conversation_reads to authenticated;
drop policy if exists conv_reads_own on public.conversation_reads;
create policy conv_reads_own on public.conversation_reads for select to authenticated using (user_id = auth.uid());

-- Segna come letta una conversazione (solo se ne fai parte)
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from conversations c where c.id = p_conversation
                   and (c.customer_id = auth.uid()
                        or exists (select 1 from organization_members m where m.organization_id = c.organization_id
                                     and m.user_id = auth.uid() and m.status = 'active'))) then
    return;
  end if;
  insert into conversation_reads (conversation_id, user_id, last_read_at) values (p_conversation, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = excluded.last_read_at;
  update notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and type = 'new_message' and payload ->> 'conversation_id' = p_conversation::text;
end $$;

-- Segna come viste le notifiche di una prenotazione (o di tutte, se p_booking è null) per un tipo di destinatario
create or replace function public.mark_booking_updates_seen(p_booking uuid default null, p_as text default 'customer')
returns void language sql security definer set search_path = public as $$
  update notifications n set read_at = now()
   where n.user_id = auth.uid() and n.read_at is null and n.type like 'booking_%'
     and (p_booking is null or n.payload ->> 'booking_id' = p_booking::text)
     and exists (select 1 from bookings b where b.id = (n.payload ->> 'booking_id')::uuid
                   and ((p_as = 'customer' and b.customer_id = auth.uid())
                        or (p_as = 'provider' and exists (select 1 from organization_members m
                              where m.organization_id = b.organization_id and m.user_id = auth.uid() and m.status = 'active'))));
$$;

-- Tutti i contatori in una chiamata
create or replace function public.my_badges()
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  orgs as (select organization_id from organization_members m, me where m.user_id = me.uid and m.status = 'active'),
  staff as (select exists (select 1 from staff_members s, me where s.user_id = me.uid and s.active) as yes),
  convs as (
    select c.id, case when c.customer_id = (select uid from me) then 'customer' else 'provider' end as side
    from conversations c
    where c.customer_id = (select uid from me) or c.organization_id in (select organization_id from orgs)
  )
  select jsonb_build_object(
    'messages', (select count(*) from messages ms
                   join convs c on c.id = ms.conversation_id
                   left join conversation_reads r on r.conversation_id = ms.conversation_id and r.user_id = (select uid from me)
                  where ms.sender_side <> c.side and ms.filter_result <> 'blocked'
                    and ms.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)),
    'requests', (select count(*) from bookings b
                  where b.organization_id in (select organization_id from orgs)
                    and b.status = 'requested' and b.provider_response_due_at > now()),
    'provider_bookings', (select count(*) from notifications n
                           where n.user_id = (select uid from me) and n.read_at is null
                             and n.type in ('booking_confirmed', 'booking_cancelled', 'booking_expired')
                             and exists (select 1 from bookings b where b.id = (n.payload ->> 'booking_id')::uuid
                                           and b.organization_id in (select organization_id from orgs))),
    'customer_bookings', (select count(*) from notifications n
                           where n.user_id = (select uid from me) and n.read_at is null
                             and n.type in ('booking_accepted', 'booking_declined', 'booking_expired', 'booking_confirmed', 'booking_cancelled')
                             and exists (select 1 from bookings b where b.id = (n.payload ->> 'booking_id')::uuid
                                           and b.customer_id = (select uid from me))),
    'listings_to_fix', (select count(*) from listings l
                         where l.organization_id in (select organization_id from orgs) and l.status = 'changes_required'),
    'admin_reviews', case when (select yes from staff) then (select count(*) from listing_revisions where status = 'pending_review') else 0 end,
    'admin_orgs', case when (select yes from staff) then (select count(*) from organizations where verification_status = 'pending') else 0 end
  )
$$;

revoke execute on function public.my_badges(), public.mark_conversation_read(uuid), public.mark_booking_updates_seen(uuid, text) from public, anon;
grant execute on function public.my_badges(), public.mark_conversation_read(uuid), public.mark_booking_updates_seen(uuid, text) to authenticated;
