-- 0020 · Consegna a domicilio decisa dal noleggiatore, mezzo per mezzo.
-- Spunta + raggio massimo (km dalla sede) + prezzo fisso + prezzo al km. Su un annuncio già online
-- la modifica passa dalla revisione del team (come titolo e condizioni). Rieseguibile.

alter table public.rental_terms add column if not exists delivery_enabled boolean not null default false;
alter table public.rental_terms add column if not exists delivery_radius_km integer;
alter table public.rental_terms add column if not exists delivery_fee_cents integer not null default 0;
alter table public.rental_terms add column if not exists delivery_per_km_cents integer not null default 0;
do $$ begin
  alter table public.rental_terms add constraint rental_terms_delivery_check check (
    delivery_fee_cents >= 0 and delivery_per_km_cents >= 0
    and (not delivery_enabled or delivery_radius_km between 1 and 500));
exception when duplicate_object then null; end $$;

-- Dal browser la consegna si cambia solo su bozze o annunci da correggere; altrimenti va in revisione
create or replace function private.guard_delivery_terms() returns trigger
language plpgsql set search_path = public as $$
declare st text;
begin
  if current_user <> 'authenticated' then return new; end if;
  if (new.delivery_enabled, new.delivery_radius_km, new.delivery_fee_cents, new.delivery_per_km_cents)
     is not distinct from (old.delivery_enabled, old.delivery_radius_km, old.delivery_fee_cents, old.delivery_per_km_cents) then
    return new;
  end if;
  select status into st from listings where id = new.listing_id;
  if st not in ('draft', 'changes_required') then raise exception 'DELIVERY_NEEDS_REVIEW' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists rental_terms_delivery_guard on public.rental_terms;
create trigger rental_terms_delivery_guard before update on public.rental_terms
  for each row execute function private.guard_delivery_terms();

-- Revisione approvata dal team: applica anche la consegna proposta
create or replace function private.apply_revision_delivery() returns trigger
language plpgsql security definer set search_path = public as $$
declare t jsonb := new.snapshot -> 'changes' -> 'terms';
begin
  if new.status::text = 'approved' and old.status::text <> 'approved' and t ? 'delivery_enabled' then
    update rental_terms set
      delivery_enabled = coalesce((t ->> 'delivery_enabled')::boolean, false),
      delivery_radius_km = nullif(t ->> 'delivery_radius_km', '')::integer,
      delivery_fee_cents = coalesce(nullif(t ->> 'delivery_fee_cents', '')::integer, 0),
      delivery_per_km_cents = coalesce(nullif(t ->> 'delivery_per_km_cents', '')::integer, 0)
     where listing_id = new.listing_id;
  end if;
  return new;
end $$;
drop trigger if exists listing_revisions_delivery on public.listing_revisions;
create trigger listing_revisions_delivery after update on public.listing_revisions
  for each row execute function private.apply_revision_delivery();

-- Consegna di un annuncio pubblicato, per la scheda pubblica (solo dati non sensibili)
create or replace function public.listing_delivery(p_listing uuid)
returns table (enabled boolean, radius_km integer, fee_cents integer, per_km_cents integer)
language sql stable security definer set search_path = public as $$
  select t.delivery_enabled, t.delivery_radius_km, t.delivery_fee_cents, t.delivery_per_km_cents
    from rental_terms t join listings l on l.id = t.listing_id
   where t.listing_id = p_listing and l.status = 'published';
$$;
revoke execute on function public.listing_delivery(uuid) from public;
grant execute on function public.listing_delivery(uuid) to anon, authenticated;
