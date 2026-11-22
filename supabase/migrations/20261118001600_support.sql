-- KeyRent · 0016 · Assistenza: conversazioni tra utenti (noleggiatori e clienti) e il team KeyRent
create table if not exists public.support_threads (
  id                uuid primary key default gen_random_uuid(),
  requester_id      uuid not null references auth.users(id) on delete cascade,
  organization_id   uuid references public.organizations(id) on delete set null,
  subject           text not null check (length(subject) between 1 and 200),
  status            text not null default 'open' check (status in ('open', 'closed')),
  last_message_at   timestamptz not null default now(),
  last_from_staff   boolean not null default false,
  requester_read_at timestamptz,
  staff_read_at     timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists support_threads_requester_idx on public.support_threads(requester_id, last_message_at desc);
create index if not exists support_threads_recent_idx on public.support_threads(last_message_at desc);

create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.support_threads(id) on delete cascade,
  sender_id  uuid not null references auth.users(id),
  from_staff boolean not null,
  body       text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_thread_idx on public.support_messages(thread_id, created_at);

revoke all on public.support_threads, public.support_messages from anon, authenticated;
grant all on public.support_threads, public.support_messages to service_role;
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
grant select on public.support_threads, public.support_messages to authenticated;
drop policy if exists support_threads_read on public.support_threads;
create policy support_threads_read on public.support_threads for select to authenticated
  using (requester_id = auth.uid() or private.is_staff());
drop policy if exists support_messages_read on public.support_messages;
create policy support_messages_read on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_threads t where t.id = thread_id
                   and (t.requester_id = auth.uid() or private.is_staff())));

-- Dove l'utente legge la risposta: area noleggiatore se ha scritto per un'attività, altrimenti il suo account
create or replace function private.support_path(t public.support_threads)
returns text language sql immutable as $$
  select case when t.organization_id is null then '/assistenza/' else '/pro/assistenza/' end || t.id
$$;

-- Nuova conversazione con il team (il primo messaggio arriva a tutti gli admin)
create or replace function public.support_start(p_subject text, p_body text, p_org uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare t support_threads; s record;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_org is not null and not private.is_org_member(p_org) then raise exception 'NOT_MEMBER'; end if;
  if coalesce(btrim(p_subject), '') = '' or coalesce(btrim(p_body), '') = '' then raise exception 'EMPTY'; end if;
  insert into support_threads (requester_id, organization_id, subject, requester_read_at)
  values (auth.uid(), p_org, left(btrim(p_subject), 200), now()) returning * into t;
  insert into support_messages (thread_id, sender_id, from_staff, body) values (t.id, auth.uid(), false, left(btrim(p_body), 4000));
  for s in select user_id from staff_members where active and role in ('admin', 'customer_care') loop
    perform private.notify(s.user_id, 'support_to_staff', jsonb_build_object('thread_id', t.id, 'subject', t.subject));
  end loop;
  return t.id;
end $$;

-- Risposta: dallo staff (avvisa chi ha scritto) o da chi ha aperto la conversazione (avvisa lo staff)
create or replace function public.support_reply(p_thread uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare t support_threads; staff boolean := private.is_staff(); s record;
begin
  select * into t from support_threads where id = p_thread for update;
  if not found or (t.requester_id <> auth.uid() and not staff) then raise exception 'NOT_ALLOWED'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'EMPTY'; end if;
  staff := staff and t.requester_id <> auth.uid();
  insert into support_messages (thread_id, sender_id, from_staff, body) values (t.id, auth.uid(), staff, left(btrim(p_body), 4000));
  update support_threads set last_message_at = now(), last_from_staff = staff, status = 'open',
         staff_read_at = case when staff then now() else staff_read_at end,
         requester_read_at = case when staff then requester_read_at else now() end
   where id = t.id;
  if staff then
    perform private.notify(t.requester_id, 'support_reply',
      jsonb_build_object('thread_id', t.id, 'subject', t.subject, 'path', private.support_path(t)));
  else
    for s in select user_id from staff_members where active and role in ('admin', 'customer_care') loop
      perform private.notify(s.user_id, 'support_to_staff', jsonb_build_object('thread_id', t.id, 'subject', t.subject));
    end loop;
  end if;
end $$;

-- Letto (chi apre la conversazione) · chiudi/riapri (solo staff)
create or replace function public.support_mark_read(p_thread uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update support_threads set requester_read_at = now() where id = p_thread and requester_id = auth.uid();
  if private.is_staff() then
    update support_threads set staff_read_at = now() where id = p_thread and requester_id <> auth.uid();
  end if;
  update notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and type in ('support_to_staff', 'support_reply')
     and payload ->> 'thread_id' = p_thread::text;
end $$;

create or replace function public.support_set_status(p_thread uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.is_staff() then raise exception 'NOT_ALLOWED'; end if;
  if p_status not in ('open', 'closed') then raise exception 'BAD_STATUS'; end if;
  update support_threads set status = p_status where id = p_thread;
end $$;

-- Contatori: risposte del team non lette (utente) e messaggi non letti per lo staff
create or replace function public.my_support_badges()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'support', (select count(*) from support_threads
                 where requester_id = auth.uid() and last_from_staff
                   and last_message_at > coalesce(requester_read_at, '-infinity'::timestamptz)),
    'admin_support', case when private.is_staff() then
                       (select count(*) from support_threads
                         where not last_from_staff and status = 'open' and requester_id <> auth.uid()
                           and last_message_at > coalesce(staff_read_at, '-infinity'::timestamptz))
                     else 0 end)
$$;

revoke execute on function public.support_start(text, text, uuid), public.support_reply(uuid, text),
  public.support_mark_read(uuid), public.support_set_status(uuid, text), public.my_support_badges() from public, anon;
grant execute on function public.support_start(text, text, uuid), public.support_reply(uuid, text),
  public.support_mark_read(uuid), public.support_set_status(uuid, text), public.my_support_badges() to authenticated;
revoke execute on function private.support_path(public.support_threads) from public, anon, authenticated;
