-- KeyRent · 0007 · Funzioni usate dall'app: creazione bozza annuncio (atomica, con RLS),
-- verifica organizzazioni, ponti per il server (le funzioni private non sono esposte dalle API).

-- ---------------------------------------------------------------------------
-- Stripe non blocca più l'invio in revisione: si controlla al momento della prenotazione.
-- ---------------------------------------------------------------------------
create or replace function private.assert_listing_complete(p_listing uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare l record; o record; missing text[] := '{}'; min_photos constant integer := 4;
begin
  select * into l from listings where id = p_listing;
  select * into o from organizations where id = l.organization_id;
  if o.verification_status <> 'verified' then missing := missing || 'attività non ancora verificata da KeyRent'::text; end if;
  if l.description is null or length(l.description) < 40 then missing := missing || 'descrizione (almeno 40 caratteri)'::text; end if;
  if not exists (select 1 from listing_units where listing_id = p_listing) then missing := missing || 'almeno un mezzo collegato'::text; end if;
  if not exists (select 1 from pricing_rules where listing_id = p_listing) then missing := missing || 'almeno una tariffa'::text; end if;
  if not exists (select 1 from rental_terms where listing_id = p_listing) then missing := missing || 'condizioni di noleggio'::text; end if;
  if (select count(*) from listing_media where listing_id = p_listing and moderation_status <> 'rejected') < min_photos then
    missing := missing || format('almeno %s foto', min_photos);
  end if;
  if not exists (select 1 from locations where id = l.location_id and active) then missing := missing || 'sede attiva'::text; end if;
  if cardinality(missing) > 0 then
    raise exception 'LISTING_INCOMPLETE: %', array_to_string(missing, ', ') using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Bozza annuncio in un'unica transazione. SECURITY INVOKER: girano le policy RLS dell'utente,
-- quindi si può creare solo nella propria organizzazione e nelle proprie sedi.
-- ---------------------------------------------------------------------------
create or replace function public.create_listing_draft(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_org uuid := (p ->> 'organization_id')::uuid;
  v_loc uuid := (p ->> 'location_id')::uuid;
  v_cat uuid;
  v_listing uuid;
  v_qty integer := greatest(1, least(coalesce((p ->> 'quantity')::integer, 1), 200));
  v_mode text := case when coalesce((p ->> 'quantity')::integer, 1) > 1 then 'pool' else 'single' end;
  v_unit uuid;
  price jsonb;
  i integer;
begin
  select id into v_cat from categories where slug = p ->> 'category';
  if v_cat is null then raise exception 'CATEGORY_REQUIRED' using errcode = 'P0001'; end if;
  if coalesce(trim(p ->> 'title'), '') = '' then raise exception 'TITLE_REQUIRED' using errcode = 'P0001'; end if;

  insert into listings (organization_id, location_id, category_id, subcategory_id, make_id, model_id,
                        title, slug, description, attributes, quantity_mode)
  values (v_org, v_loc, v_cat,
          (select id from subcategories where category_id = v_cat and slug = p ->> 'subcategory'),
          (select id from makes where slug = p ->> 'make'),
          (select m.id from models m join makes mk on mk.id = m.make_id
            where mk.slug = p ->> 'make' and m.slug = p ->> 'model' and m.category_id = v_cat),
          trim(p ->> 'title'),
          trim(both '-' from lower(regexp_replace(unaccent(p ->> 'title'), '[^A-Za-z0-9]+', '-', 'g'))),
          nullif(trim(p ->> 'description'), ''),
          coalesce(p -> 'attributes', '{}'::jsonb), v_mode)
  returning id into v_listing;

  for i in 1..v_qty loop
    insert into vehicle_units (organization_id, location_id, category_id, make_id, model_id,
                               custom_make, custom_model, plate, year, label)
    values (v_org, v_loc, v_cat,
            (select id from makes where slug = p ->> 'make'),
            (select m.id from models m join makes mk on mk.id = m.make_id
              where mk.slug = p ->> 'make' and m.slug = p ->> 'model' and m.category_id = v_cat),
            nullif(p ->> 'custom_make', ''), nullif(p ->> 'custom_model', ''),
            case when v_qty = 1 then nullif(upper(replace(p ->> 'plate', ' ', '')), '') end,
            nullif(p ->> 'year', '')::smallint,
            case when v_qty > 1 then 'Unità #' || i end)
    returning id into v_unit;
    insert into listing_units (listing_id, vehicle_unit_id) values (v_listing, v_unit);
  end loop;

  insert into rental_terms (listing_id, deposit_cents, min_driver_age, min_license_years, required_license,
                            included_km_per_day, extra_km_cents, insurance_excess_cents, fuel_policy,
                            min_duration_minutes, buffer_minutes, notes)
  values (v_listing,
          coalesce((p -> 'terms' ->> 'deposit_cents')::integer, 0),
          nullif(p -> 'terms' ->> 'min_driver_age', '')::smallint,
          nullif(p -> 'terms' ->> 'min_license_years', '')::smallint,
          nullif(p -> 'terms' ->> 'required_license', ''),
          nullif(p -> 'terms' ->> 'included_km_per_day', '')::integer,
          nullif(p -> 'terms' ->> 'extra_km_cents', '')::integer,
          nullif(p -> 'terms' ->> 'insurance_excess_cents', '')::integer,
          nullif(p -> 'terms' ->> 'fuel_policy', ''),
          coalesce(nullif(p -> 'terms' ->> 'min_duration_minutes', '')::integer, 60),
          coalesce(nullif(p -> 'terms' ->> 'buffer_minutes', '')::integer, 0),
          nullif(p -> 'terms' ->> 'notes', ''));

  for price in select * from jsonb_array_elements(coalesce(p -> 'prices', '[]'::jsonb)) loop
    if coalesce((price ->> 'price_cents')::integer, 0) > 0 then
      insert into pricing_rules (listing_id, unit, price_cents)
      values (v_listing, (price ->> 'unit')::price_unit, (price ->> 'price_cents')::integer);
    end if;
  end loop;

  return v_listing;
end $$;
revoke execute on function public.create_listing_draft(jsonb) from public, anon;
grant execute on function public.create_listing_draft(jsonb) to authenticated;

-- Sostituisce le tariffe base (senza stagionalità) di un annuncio: consentito in ogni stato.
create or replace function public.set_listing_prices(p_listing uuid, p_prices jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare price jsonb;
begin
  if not private.is_org_member(private.listing_org(p_listing), array['owner', 'manager']::org_role[]) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  delete from pricing_rules where listing_id = p_listing and valid_from is null and valid_to is null;
  for price in select * from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) loop
    if coalesce((price ->> 'price_cents')::integer, 0) > 0 then
      insert into pricing_rules (listing_id, unit, price_cents)
      values (p_listing, (price ->> 'unit')::price_unit, (price ->> 'price_cents')::integer);
    end if;
  end loop;
end $$;
revoke execute on function public.set_listing_prices(uuid, jsonb) from public, anon;
grant execute on function public.set_listing_prices(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Verifica organizzazione (staff)
-- ---------------------------------------------------------------------------
create or replace function private.set_org_verification(p_org uuid, p_status public.org_verification, p_actor uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old_status public.org_verification;
begin
  if not exists (select 1 from staff_members where user_id = p_actor and active and role in ('admin', 'operations')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select verification_status into old_status from organizations where id = p_org for update;
  update organizations set verification_status = p_status where id = p_org;
  perform private.audit(p_actor, 'staff', 'organization', p_org, 'verification:' || old_status || '→' || p_status, null, p_reason);
end $$;

-- ---------------------------------------------------------------------------
-- Ponti per il server: chiamabili SOLO con la service role (mai dal browser).
-- Il server verifica la sessione e passa l'id dell'utente come attore.
-- ---------------------------------------------------------------------------
create or replace function public.svc_listing_transition(p_listing uuid, p_to public.listing_status, p_actor uuid,
                                                         p_reason text default null, p_notes jsonb default null)
returns void language sql security invoker set search_path = public as $$
  select private.listing_transition(p_listing, p_to, p_actor, p_reason, p_notes);
$$;

create or replace function public.svc_propose_listing_changes(p_listing uuid, p_actor uuid, p_changes jsonb)
returns uuid language sql security invoker set search_path = public as $$
  select private.propose_listing_changes(p_listing, p_actor, p_changes);
$$;

create or replace function public.svc_review_listing_changes(p_revision uuid, p_actor uuid, p_approve boolean, p_notes jsonb default null)
returns void language sql security invoker set search_path = public as $$
  select private.review_listing_changes(p_revision, p_actor, p_approve, p_notes);
$$;

create or replace function public.svc_set_org_verification(p_org uuid, p_status public.org_verification, p_actor uuid, p_reason text default null)
returns void language sql security invoker set search_path = public as $$
  select private.set_org_verification(p_org, p_status, p_actor, p_reason);
$$;

create or replace function public.svc_refresh_price_from(p_listing uuid)
returns void language sql security invoker set search_path = public as $$
  select private.refresh_price_from(p_listing);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.svc_refresh_price_from(uuid)',
    'public.svc_listing_transition(uuid, public.listing_status, uuid, text, jsonb)',
    'public.svc_propose_listing_changes(uuid, uuid, jsonb)',
    'public.svc_review_listing_changes(uuid, uuid, boolean, jsonb)',
    'public.svc_set_org_verification(uuid, public.org_verification, uuid, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
revoke execute on function private.set_org_verification(uuid, public.org_verification, uuid, text) from public, anon, authenticated;
grant execute on function private.set_org_verification(uuid, public.org_verification, uuid, text) to service_role;
revoke execute on function private.assert_listing_complete(uuid) from public, anon, authenticated;

-- Il profilo prende nome e cognome inseriti in registrazione
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'first_name', ''), nullif(new.raw_user_meta_data ->> 'last_name', ''))
  on conflict do nothing;
  return new;
end $$;
