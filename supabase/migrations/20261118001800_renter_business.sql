-- KeyRent · 0018 · Aziende clienti (prenotano e ricevono fatture) separate dai noleggiatori (pubblicano mezzi)
alter table public.organizations add column if not exists kind text not null default 'provider';
do $$ begin
  alter table public.organizations add constraint organizations_kind_check check (kind in ('provider', 'renter'));
exception when duplicate_object then null; end $$;

-- Solo le attività noleggiatore possono avere sedi, mezzi e annunci
create or replace function private.assert_provider_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select kind from organizations where id = new.organization_id) <> 'provider' then
    raise exception 'NOT_PROVIDER_ORG' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists locations_provider_only on public.locations;
create trigger locations_provider_only before insert on public.locations for each row execute function private.assert_provider_org();
drop trigger if exists listings_provider_only on public.listings;
create trigger listings_provider_only before insert on public.listings for each row execute function private.assert_provider_org();
drop trigger if exists units_provider_only on public.vehicle_units;
create trigger units_provider_only before insert on public.vehicle_units for each row execute function private.assert_provider_org();

-- Prenotazione intestata a un'azienda cliente
alter table public.bookings add column if not exists billing_organization_id uuid references public.organizations(id);

-- Nuova azienda cliente: chi la crea ne è amministratore (ruolo owner). Non serve verifica: non pubblica mezzi.
create or replace function public.create_renter_organization(p_legal_name text, p_vat text, p_sdi text default null,
  p_pec text default null, p_email text default null, p_phone text default null, p_address jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if coalesce(btrim(p_legal_name), '') = '' or coalesce(btrim(p_vat), '') = '' then raise exception 'EMPTY' using errcode = 'P0001'; end if;
  insert into organizations (kind, legal_name, vat_number, sdi_code, pec, business_email, business_phone, legal_address,
                             verification_status, created_by, inventory_source_id)
  values ('renter', btrim(p_legal_name), upper(replace(p_vat, ' ', '')), nullif(btrim(p_sdi), ''), nullif(btrim(p_pec), ''),
          nullif(btrim(p_email), ''), nullif(btrim(p_phone), ''), coalesce(p_address, '{}'::jsonb), 'verified', v_user,
          (select id from inventory_sources where kind = 'direct' order by created_at limit 1))
  returning id into v_org;
  insert into organization_members (organization_id, user_id, role) values (v_org, v_user, 'owner');
  perform private.audit(v_user, 'user', 'organization', v_org, 'create_renter');
  return v_org;
end $$;
revoke execute on function public.create_renter_organization(text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_renter_organization(text, text, text, text, text, text, jsonb) to authenticated;

-- Il server intesta la richiesta a un'azienda del cliente (cliente o anche noleggiatore: prenota come azienda)
create or replace function public.svc_set_booking_billing(p_booking uuid, p_customer uuid, p_org uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from organizations o join organization_members m on m.organization_id = o.id
                  where o.id = p_org and m.user_id = p_customer and m.status = 'active') then
    raise exception 'NOT_MEMBER' using errcode = 'P0001';
  end if;
  update bookings set billing_organization_id = p_org
   where id = p_booking and customer_id = p_customer and status = 'requested';
  if not found then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.svc_set_booking_billing(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.svc_set_booking_billing(uuid, uuid, uuid) to service_role;
