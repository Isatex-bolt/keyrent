-- 0033 · Lungo termine a contatto: il cliente invia una richiesta (mezzo, durata, km, servizi, contatti),
-- il noleggiatore la vede subito con i contatti. KeyRent fattura il 5% della prima rata per contatto valido. Rieseguibile.
create table if not exists public.lt_requests (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references public.listings(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  customer_id      uuid references auth.users(id) on delete set null,
  customer_name    text not null,
  customer_email   text not null,
  customer_phone   text not null,
  customer_kind    text not null check (customer_kind in ('privato', 'azienda')),
  company_name     text,
  company_vat      text,
  months           integer not null check (months in (12, 24, 36, 48)),
  km_per_year      integer not null check (km_per_year > 0),
  services         text[] not null default '{}',
  note             text check (length(note) <= 1000),
  monthly_cents    integer not null check (monthly_cents > 0),
  fee_cents        integer not null check (fee_cents >= 0),
  status           text not null default 'new' check (status in ('new', 'contacted', 'closed', 'reported', 'invalid')),
  report_reason    text check (length(report_reason) <= 500),
  reported_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists lt_requests_org_idx on public.lt_requests(organization_id, created_at desc);
create index if not exists lt_requests_customer_idx on public.lt_requests(customer_id, listing_id, created_at desc);
revoke all on public.lt_requests from anon, authenticated;
alter table public.lt_requests enable row level security;
grant select on public.lt_requests to authenticated;
drop policy if exists lt_requests_read on public.lt_requests;
create policy lt_requests_read on public.lt_requests for select to authenticated
  using (customer_id = auth.uid() or private.is_org_member(organization_id) or private.is_staff());

-- Rata mensile calcolata dal server (stessa regola della scheda): durata × km + servizi scelti
create or replace function private.lt_monthly_cents(p_listing uuid, p_months int, p_km int, p_services text[])
returns integer language plpgsql stable security definer set search_path = public as $$
declare t rental_terms; v jsonb; base int; s text; extra int := 0;
begin
  select * into t from rental_terms where listing_id = p_listing;
  if t.listing_id is null or not t.long_term_enabled then raise exception 'LT_NOT_OFFERED' using errcode = 'P0001'; end if;
  v := t.lt_prices -> p_months::text;
  if jsonb_typeof(v) = 'number' then base := case when p_km = t.lt_km_per_year then v::text::int end;
  elsif jsonb_typeof(v) = 'object' then base := (v ->> p_km::text)::int;
  end if;
  if coalesce(base, 0) <= 0 then raise exception 'LT_NOT_OFFERED' using errcode = 'P0001'; end if;
  foreach s in array coalesce(p_services, '{}') loop
    if coalesce((t.lt_services -> s ->> 'offered')::boolean, false) then extra := extra + coalesce((t.lt_services -> s ->> 'cents')::int, 0); end if;
  end loop;
  return base + extra;
end $$;

create or replace function public.svc_create_lt_request(p_user uuid, p_listing uuid, p_months int, p_km int, p_services text[],
  p_name text, p_email text, p_phone text, p_kind text, p_company text, p_vat text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare l listings; v_id uuid; v_rate int;
begin
  select * into l from listings where id = p_listing and status = 'published';
  if l.id is null or exists (select 1 from organizations o where o.id = l.organization_id and o.is_demo) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' or coalesce(trim(p_email), '') = '' then
    raise exception 'LT_CONTACT_MISSING' using errcode = 'P0001';
  end if;
  if p_kind = 'azienda' and (coalesce(trim(p_company), '') = '' or coalesce(trim(p_vat), '') = '') then
    raise exception 'LT_COMPANY_MISSING' using errcode = 'P0001';
  end if;
  v_rate := private.lt_monthly_cents(p_listing, p_months, p_km, p_services);
  -- stesso cliente, stesso mezzo, entro 30 giorni: è lo stesso contatto (si aggiorna, non si paga due volte)
  select id into v_id from lt_requests where customer_id = p_user and listing_id = p_listing
     and created_at > now() - interval '30 days' order by created_at desc limit 1;
  if v_id is not null then
    update lt_requests set months = p_months, km_per_year = p_km, services = coalesce(p_services, '{}'), monthly_cents = v_rate,
           customer_phone = trim(p_phone), note = nullif(trim(p_note), '') where id = v_id;
    return v_id;
  end if;
  insert into lt_requests (listing_id, organization_id, customer_id, customer_name, customer_email, customer_phone, customer_kind,
                           company_name, company_vat, months, km_per_year, services, note, monthly_cents, fee_cents)
  values (p_listing, l.organization_id, p_user, trim(p_name), lower(trim(p_email)), trim(p_phone), p_kind,
          nullif(trim(p_company), ''), nullif(upper(trim(p_vat)), ''), p_months, p_km, coalesce(p_services, '{}'),
          nullif(trim(p_note), ''), v_rate, round(v_rate * 0.05))
  returning id into v_id;
  perform private.notify_org(l.organization_id, 'lt_request', jsonb_build_object('lt_request_id', v_id, 'listing_id', p_listing, 'title', l.title));
  return v_id;
end $$;

-- Noleggiatore: segna contattato / chiuso, oppure segnala una richiesta non valida entro 7 giorni
create or replace function public.svc_lt_set_status(p_actor uuid, p_id uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r lt_requests;
begin
  select * into r from lt_requests where id = p_id;
  if r.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  perform private.assert_member(r.organization_id, p_actor, array['owner', 'manager', 'staff']::org_role[]);
  if r.status in ('reported', 'invalid') then raise exception 'LT_LOCKED' using errcode = 'P0001'; end if;
  if p_status = 'reported' then
    if r.created_at < now() - interval '7 days' then raise exception 'LT_REPORT_LATE' using errcode = 'P0001'; end if;
    if coalesce(trim(p_reason), '') = '' then raise exception 'LT_REASON_MISSING' using errcode = 'P0001'; end if;
    update lt_requests set status = 'reported', report_reason = trim(p_reason), reported_at = now() where id = p_id;
  elsif p_status in ('new', 'contacted', 'closed') then
    update lt_requests set status = p_status where id = p_id;
  else raise exception 'BAD_STATUS' using errcode = 'P0001';
  end if;
end $$;

-- Staff: decide sulle segnalazioni (valida = si paga, non valida = non si paga)
create or replace function public.svc_lt_resolve(p_id uuid, p_invalid boolean)
returns void language sql security definer set search_path = public as $$
  update lt_requests set status = case when p_invalid then 'invalid' else 'contacted' end where id = p_id and status = 'reported';
$$;

revoke all on function private.lt_monthly_cents(uuid, int, int, text[]) from public, anon, authenticated;
revoke all on function public.svc_create_lt_request(uuid, uuid, int, int, text[], text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.svc_lt_set_status(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.svc_lt_resolve(uuid, boolean) from public, anon, authenticated;
grant execute on function private.lt_monthly_cents(uuid, int, int, text[]) to service_role;
grant execute on function public.svc_create_lt_request(uuid, uuid, int, int, text[], text, text, text, text, text, text, text) to service_role;
grant execute on function public.svc_lt_set_status(uuid, uuid, text, text) to service_role;
grant execute on function public.svc_lt_resolve(uuid, boolean) to service_role;
