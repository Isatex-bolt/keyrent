-- 0034 · Chi apre il link della demo: link personali keyrent.it/demo?da=nome → visite e ingressi nell'area di prova,
-- visibili solo allo staff in Admin → Account demo. Rieseguibile.
create table if not exists public.demo_visits (
  ref          text primary key check (ref ~ '^[a-z0-9-]{1,60}$'),
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  visits       integer not null default 1,
  entered      integer not null default 0,
  entered_at   timestamptz,
  clone_org    uuid references public.organizations(id) on delete set null
);
revoke all on public.demo_visits from anon, authenticated;
alter table public.demo_visits enable row level security;
grant select on public.demo_visits to authenticated;
drop policy if exists demo_visits_staff on public.demo_visits;
create policy demo_visits_staff on public.demo_visits for select to authenticated using (private.is_staff());

create or replace function public.svc_demo_visit(p_ref text) returns void
language sql security definer set search_path = public as $$
  insert into demo_visits (ref) values (p_ref)
  on conflict (ref) do update set visits = demo_visits.visits + 1, last_seen = now();
$$;
create or replace function public.svc_demo_entered(p_ref text, p_org uuid) returns void
language sql security definer set search_path = public as $$
  insert into demo_visits (ref, entered, entered_at, clone_org) values (p_ref, 1, now(), p_org)
  on conflict (ref) do update set entered = demo_visits.entered + 1, entered_at = now(), last_seen = now(),
                                  clone_org = coalesce(excluded.clone_org, demo_visits.clone_org);
$$;
revoke all on function public.svc_demo_visit(text), public.svc_demo_entered(text, uuid) from public, anon, authenticated;
grant execute on function public.svc_demo_visit(text), public.svc_demo_entered(text, uuid) to service_role;
