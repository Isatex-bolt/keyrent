-- KeyRent · 0004 · Workflow annunci, revisioni, messaggistica protetta, notifiche, preferiti, recensioni

-- ---------------------------------------------------------------------------
-- Guardia: su un annuncio pubblicato/in revisione i campi sensibili non si modificano direttamente.
-- Le modifiche passano da una revisione (private.propose_listing_changes).
-- ---------------------------------------------------------------------------
create or replace function private.guard_listing_update() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if old.status not in ('draft', 'changes_required') and (
         new.title is distinct from old.title or new.description is distinct from old.description
      or new.category_id is distinct from old.category_id or new.subcategory_id is distinct from old.subcategory_id
      or new.make_id is distinct from old.make_id or new.model_id is distinct from old.model_id
      or new.version_id is distinct from old.version_id or new.attributes is distinct from old.attributes
      or new.location_id is distinct from old.location_id or new.quantity_mode is distinct from old.quantity_mode) then
      raise exception 'USE_REVISION: su un annuncio in stato % le modifiche ai dati sensibili richiedono una revisione', old.status
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger listings_guard before update on public.listings
  for each row execute function private.guard_listing_update();

create or replace function private.guard_terms_update() returns trigger
language plpgsql as $$
declare s public.listing_status;
begin
  if current_user in ('authenticated', 'anon') then
    select status into s from public.listings where id = coalesce(new.listing_id, old.listing_id);
    if s not in ('draft', 'changes_required') then
      raise exception 'USE_REVISION: condizioni e cauzione si modificano con una revisione' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger rental_terms_guard before update or delete on public.rental_terms
  for each row execute function private.guard_terms_update();

-- Le foto aggiunte a un annuncio già pubblicato restano 'pending' finché lo staff non le approva
create or replace function private.media_moderation_default() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.moderation_status := 'pending';
  end if;
  return new;
end $$;
create trigger listing_media_moderation before insert or update on public.listing_media
  for each row execute function private.media_moderation_default();

-- Snapshot completo dell'annuncio (per revisioni e storico)
create or replace function private.listing_snapshot(p_listing uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'listing', to_jsonb(l) - 'status' - 'published_revision_id',
    'terms',   (select to_jsonb(t) from rental_terms t where t.listing_id = l.id),
    'pricing', coalesce((select jsonb_agg(to_jsonb(p) order by p.unit, p.valid_from) from pricing_rules p where p.listing_id = l.id), '[]'),
    'extras',  coalesce((select jsonb_agg(to_jsonb(e)) from extras e where e.listing_id = l.id), '[]'),
    'media',   coalesce((select jsonb_agg(to_jsonb(m) order by m.sort) from listing_media m where m.listing_id = l.id), '[]'),
    'units',   coalesce((select jsonb_agg(lu.vehicle_unit_id) from listing_units lu where lu.listing_id = l.id), '[]')
  ) from listings l where l.id = p_listing
$$;

-- Requisiti minimi per l'invio in revisione
create or replace function private.assert_listing_complete(p_listing uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare l record; o record; missing text[] := '{}'; min_photos constant integer := 4;
begin
  select * into l from listings where id = p_listing;
  select * into o from organizations where id = l.organization_id;
  if o.verification_status <> 'verified' then missing := missing || 'organizzazione non verificata'; end if;
  if o.stripe_onboarding_status <> 'complete' then missing := missing || 'pagamenti Stripe non attivi'; end if;
  if l.description is null or length(l.description) < 40 then missing := missing || 'descrizione (min 40 caratteri)'; end if;
  if not exists (select 1 from listing_units where listing_id = p_listing) then missing := missing || 'almeno un mezzo collegato'; end if;
  if not exists (select 1 from pricing_rules where listing_id = p_listing) then missing := missing || 'almeno una tariffa'; end if;
  if not exists (select 1 from rental_terms where listing_id = p_listing) then missing := missing || 'condizioni di noleggio'; end if;
  if (select count(*) from listing_media where listing_id = p_listing and moderation_status <> 'rejected') < min_photos then
    missing := missing || format('almeno %s foto', min_photos);
  end if;
  if not exists (select 1 from locations where id = l.location_id and active) then missing := missing || 'sede attiva'; end if;
  if cardinality(missing) > 0 then
    raise exception 'LISTING_INCOMPLETE: %', array_to_string(missing, ', ') using errcode = 'P0001';
  end if;
end $$;

-- Prezzo "da" per ordinamento e card (prezzo giornaliero più basso, o la tariffa più bassa)
create or replace function private.refresh_price_from(p_listing uuid) returns void
language sql security definer set search_path = public as $$
  update listings set price_from_cents = (
    select coalesce(min(price_cents) filter (where unit = 'day'), min(price_cents))
    from pricing_rules where listing_id = p_listing)
  where id = p_listing;
$$;

-- Macchina a stati dell'annuncio. Unico punto in cui cambia listings.status.
create or replace function private.listing_transition(
  p_listing uuid, p_to public.listing_status, p_actor uuid, p_reason text default null, p_notes jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  l record; v_staff public.staff_role; v_provider boolean; ok boolean := false;
  v_rev uuid; v_num integer;
begin
  select * into l from listings where id = p_listing for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select role into v_staff from staff_members where user_id = p_actor and active;
  v_provider := exists (select 1 from organization_members m
                         where m.organization_id = l.organization_id and m.user_id = p_actor
                           and m.status = 'active' and m.role in ('owner', 'manager'));

  if v_staff in ('admin', 'operations') then
    ok := (l.status = 'pending_review' and p_to in ('changes_required', 'approved', 'rejected'))
       or (l.status = 'approved' and p_to = 'published')
       or (l.status = 'published' and p_to = 'unpublished')
       or (v_staff = 'admin' and ((l.status = 'published' and p_to = 'suspended')
                               or (l.status = 'suspended' and p_to = 'published')));
  end if;
  if not ok and v_provider then
    ok := (l.status in ('draft', 'changes_required') and p_to = 'pending_review')
       or (l.status = 'approved' and p_to = 'published')
       or (l.status = 'published' and p_to = 'unpublished')
       or (l.status = 'unpublished' and p_to = 'published' and l.published_revision_id is not null);
  end if;
  if not ok then
    raise exception 'FORBIDDEN_TRANSITION: % → %', l.status, p_to using errcode = '42501';
  end if;
  if p_to in ('changes_required', 'rejected', 'suspended') and coalesce(trim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  if p_to = 'pending_review' then
    perform private.assert_listing_complete(p_listing);
    select coalesce(max(number), 0) + 1 into v_num from listing_revisions where listing_id = p_listing;
    insert into listing_revisions (listing_id, number, snapshot, submitted_by)
    values (p_listing, v_num, private.listing_snapshot(p_listing), p_actor);
  elsif p_to in ('changes_required', 'rejected', 'approved') then
    select id into v_rev from listing_revisions
     where listing_id = p_listing and status = 'pending_review' order by number desc limit 1;
    update listing_revisions
       set status = p_to::text, reviewed_by = p_actor, reviewed_at = now(),
           review_notes = coalesce(p_notes, jsonb_build_object('_reason', p_reason))
     where id = v_rev;
    if p_to = 'approved' then
      update listing_revisions set status = 'superseded'
       where listing_id = p_listing and status = 'approved' and id <> v_rev;
      update listings set published_revision_id = v_rev where id = p_listing;
      -- approva i media in attesa inclusi nella revisione
      update listing_media set moderation_status = 'approved' where listing_id = p_listing and moderation_status = 'pending';
    end if;
  end if;

  update listings
     set status = p_to,
         published_at = case when p_to = 'published' then coalesce(published_at, now()) else published_at end
   where id = p_listing;
  if p_to = 'published' then perform private.refresh_price_from(p_listing); end if;

  perform private.audit(p_actor, case when v_staff is not null then 'staff' else 'user' end,
                        'listing', p_listing, 'status:' || l.status || '→' || p_to,
                        jsonb_build_object('notes', p_notes), p_reason);

  -- approvato → pubblicato subito (pubblicazione programmata: futura)
  if p_to = 'approved' then
    perform private.listing_transition(p_listing, 'published', p_actor);
  end if;
end $$;

-- Modifiche ai campi sensibili di un annuncio già pubblicato: revisione separata, l'annuncio resta online
create or replace function private.propose_listing_changes(p_listing uuid, p_actor uuid, p_changes jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  l record; v_num integer; v_rev uuid;
  allowed constant text[] := array['title', 'description', 'category_id', 'subcategory_id', 'make_id',
                                   'model_id', 'version_id', 'attributes', 'location_id', 'terms'];
  clean jsonb;
begin
  select * into l from listings where id = p_listing for update;
  perform private.assert_member(l.organization_id, p_actor, array['owner', 'manager']::org_role[]);
  if l.status not in ('published', 'unpublished', 'suspended') then
    raise exception 'EDIT_DIRECTLY: annuncio in stato %, modificabile direttamente o in revisione', l.status using errcode = 'P0001';
  end if;
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into clean
    from jsonb_each(p_changes) as e(k, v) where k = any (allowed);
  if clean = '{}'::jsonb then raise exception 'NO_CHANGES' using errcode = 'P0001'; end if;
  if exists (select 1 from listing_revisions where listing_id = p_listing and status = 'pending_review') then
    raise exception 'REVISION_ALREADY_PENDING' using errcode = 'P0001';
  end if;

  select coalesce(max(number), 0) + 1 into v_num from listing_revisions where listing_id = p_listing;
  insert into listing_revisions (listing_id, number, snapshot, submitted_by)
  values (p_listing, v_num, jsonb_build_object('changes', clean, 'base', private.listing_snapshot(p_listing)), p_actor)
  returning id into v_rev;
  perform private.audit(p_actor, 'user', 'listing', p_listing, 'revision:proposed', clean);
  return v_rev;
end $$;

-- Revisione staff di una modifica proposta su annuncio pubblicato
create or replace function private.review_listing_changes(p_revision uuid, p_actor uuid, p_approve boolean, p_notes jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; l public.listings; ch jsonb; merged public.listings;
begin
  if not exists (select 1 from staff_members where user_id = p_actor and active and role in ('admin', 'operations')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into r from listing_revisions where id = p_revision for update;
  if r.status <> 'pending_review' or not (r.snapshot ? 'changes') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  if not p_approve then
    update listing_revisions set status = 'changes_required', reviewed_by = p_actor, reviewed_at = now(), review_notes = p_notes
     where id = p_revision;
    return;
  end if;

  ch := r.snapshot -> 'changes';
  select * into l from listings where id = r.listing_id for update;
  merged := jsonb_populate_record(l, to_jsonb(l) || (ch - 'terms'));
  update listings set title = merged.title, description = merged.description, category_id = merged.category_id,
                      subcategory_id = merged.subcategory_id, make_id = merged.make_id, model_id = merged.model_id,
                      version_id = merged.version_id, attributes = merged.attributes, location_id = merged.location_id,
                      published_revision_id = p_revision
   where id = l.id;
  if ch ? 'terms' then
    update rental_terms t set
      included_km_per_day = coalesce((ch -> 'terms' ->> 'included_km_per_day')::integer, t.included_km_per_day),
      extra_km_cents = coalesce((ch -> 'terms' ->> 'extra_km_cents')::integer, t.extra_km_cents),
      min_driver_age = coalesce((ch -> 'terms' ->> 'min_driver_age')::smallint, t.min_driver_age),
      min_license_years = coalesce((ch -> 'terms' ->> 'min_license_years')::smallint, t.min_license_years),
      deposit_cents = coalesce((ch -> 'terms' ->> 'deposit_cents')::integer, t.deposit_cents),
      insurance_excess_cents = coalesce((ch -> 'terms' ->> 'insurance_excess_cents')::integer, t.insurance_excess_cents),
      notes = coalesce(ch -> 'terms' ->> 'notes', t.notes)
    where t.listing_id = l.id;
  end if;
  update listing_revisions set status = 'superseded' where listing_id = l.id and status = 'approved';
  update listing_revisions set status = 'approved', reviewed_by = p_actor, reviewed_at = now(), review_notes = p_notes
   where id = p_revision;
  update listing_media set moderation_status = 'approved' where listing_id = l.id and moderation_status = 'pending';
  perform private.audit(p_actor, 'staff', 'listing', l.id, 'revision:approved', ch);
end $$;

-- ---------------------------------------------------------------------------
-- Notifiche in-app + coda email (mai invii simulati: pending → sent / failed)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.email_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  notification_id     uuid references public.notifications(id) on delete set null,
  user_id             uuid references auth.users(id) on delete set null,
  template            text not null,
  status              text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error               text,
  attempts            integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index email_deliveries_pending_idx on public.email_deliveries(status, created_at) where status = 'pending';
create trigger email_deliveries_touch before update on public.email_deliveries
  for each row execute function private.touch_updated_at();

create or replace function private.notify(p_user uuid, p_type text, p_payload jsonb, p_email boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare n uuid;
begin
  insert into notifications (user_id, type, payload) values (p_user, p_type, p_payload) returning id into n;
  if p_email then
    insert into email_deliveries (notification_id, user_id, template) values (n, p_user, p_type);
  end if;
end $$;

create or replace function private.notify_org(p_org uuid, p_type text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in select user_id from organization_members
            where organization_id = p_org and status = 'active' and role in ('owner', 'manager') loop
    perform private.notify(m.user_id, p_type, p_payload);
  end loop;
end $$;

-- Ogni evento di prenotazione genera le notifiche giuste
create or replace function private.on_booking_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare b record; payload jsonb;
begin
  select id, code, customer_id, organization_id, pickup_at into b from bookings where id = new.booking_id;
  payload := jsonb_build_object('booking_id', b.id, 'code', b.code, 'status', new.to_status);
  case new.to_status
    when 'requested' then perform private.notify_org(b.organization_id, 'booking_requested', payload);
    when 'accepted'  then perform private.notify(b.customer_id, 'booking_accepted', payload);
    when 'declined'  then perform private.notify(b.customer_id, 'booking_declined', payload);
    when 'expired'   then perform private.notify(b.customer_id, 'booking_expired', payload);
                          perform private.notify_org(b.organization_id, 'booking_expired', payload);
    when 'confirmed' then perform private.notify(b.customer_id, 'booking_confirmed', payload);
                          perform private.notify_org(b.organization_id, 'booking_confirmed', payload);
    when 'cancelled' then perform private.notify(b.customer_id, 'booking_cancelled', payload);
                          perform private.notify_org(b.organization_id, 'booking_cancelled', payload);
    else null;
  end case;
  return null;
end $$;
create trigger booking_events_notify after insert on public.booking_events
  for each row execute function private.on_booking_event();

create or replace function private.on_payout_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform private.notify_org(new.organization_id, 'payout_paid',
      jsonb_build_object('booking_id', new.booking_id, 'amount_cents', new.amount_cents));
  end if;
  return null;
end $$;
create trigger payouts_notify after update on public.payouts
  for each row execute function private.on_payout_paid();

-- ---------------------------------------------------------------------------
-- Messaggistica protetta
-- ---------------------------------------------------------------------------
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references public.listings(id),
  booking_id      uuid references public.bookings(id),
  customer_id     uuid not null references public.profiles(id),
  organization_id uuid not null references public.organizations(id),
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  unique nulls not distinct (listing_id, customer_id, booking_id)
);
create index conversations_customer_idx on public.conversations(customer_id, last_message_at desc);
create index conversations_org_idx on public.conversations(organization_id, last_message_at desc);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id),
  sender_side     text not null check (sender_side in ('customer', 'provider', 'staff', 'system')),
  body_original   text not null,          -- visibile solo allo staff
  body_shown      text not null,
  filter_result   text not null check (filter_result in ('clean', 'redacted', 'blocked', 'unfiltered')),
  created_at      timestamptz not null default now()
);
create index messages_conv_idx on public.messages(conversation_id, created_at);

-- Rimuove contatti: email, URL/domini, telefoni (≥ 8 cifre anche con separatori), social e app di messaggistica.
create or replace function private.filter_contacts(p_body text, out shown text, out result text)
language plpgsql immutable as $$
declare
  t text := p_body;
  mask constant text := '[contatto rimosso]';
  m text;
begin
  -- email (anche "nome at dominio punto it")
  t := regexp_replace(t, '[A-Za-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\s+at\s+)\s*[A-Za-z0-9.-]+\s*(\.|\s+punto\s+|\s+dot\s+)\s*[A-Za-z]{2,}', mask, 'gi');
  -- URL e domini
  t := regexp_replace(t, '(https?://|www\.)\S+', mask, 'gi');
  t := regexp_replace(t, '\m[A-Za-z0-9-]+\.(it|com|net|org|eu|info|biz|me|ly|io|app|shop|store)\M(/\S*)?', mask, 'gi');
  t := regexp_replace(t, '\m(wa\.me|t\.me)/\S*', mask, 'gi');
  -- telefoni: sequenze di cifre con spazi/punti/trattini/barre, almeno 8 cifre in totale
  for m in select (regexp_matches(t, '\+?\d[\d\s./()-]{6,}\d', 'g'))[1] loop
    if length(regexp_replace(m, '\D', '', 'g')) >= 8 then
      t := replace(t, m, mask);
    end if;
  end loop;
  -- handle e app esterne
  t := regexp_replace(t, '(^|\s)@[A-Za-z0-9_.]{3,}', '\1' || mask, 'g');
  t := regexp_replace(t, '\m(whats\s*app|whatsapp|telegram|signal|instagram|insta|facebook|fb|tiktok|skype|messenger)\M', mask, 'gi');

  if t = p_body then
    shown := p_body; result := 'clean';
  elsif length(regexp_replace(replace(t, mask, ''), '\s', '', 'g')) < 3 then
    shown := 'Messaggio bloccato: non è possibile condividere contatti prima della conferma della prenotazione.';
    result := 'blocked';
  else
    shown := t; result := 'redacted';
  end if;
end $$;

-- Prima conversazione su un annuncio (cliente → provider)
create or replace function public.start_conversation(p_listing uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare l record; v_conv uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select id, organization_id, status into l from listings where id = p_listing;
  if not found or l.status <> 'published' then raise exception 'LISTING_NOT_AVAILABLE' using errcode = 'P0001'; end if;
  insert into conversations (listing_id, customer_id, organization_id)
  values (p_listing, v_user, l.organization_id)
  on conflict (listing_id, customer_id, booking_id) do update set listing_id = excluded.listing_id
  returning id into v_conv;
  perform public.send_message(v_conv, p_body);
  return v_conv;
end $$;

create or replace function public.send_message(p_conversation uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c record; v_user uuid := auth.uid(); v_side text; v_unlocked boolean; v_shown text; v_result text; v_msg uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_body is null or length(trim(p_body)) = 0 or length(p_body) > 4000 then
    raise exception 'INVALID_BODY' using errcode = 'P0001';
  end if;
  select * into c from conversations where id = p_conversation;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  if c.customer_id = v_user then
    v_side := 'customer';
  elsif exists (select 1 from organization_members m where m.organization_id = c.organization_id
                  and m.user_id = v_user and m.status = 'active') then
    v_side := 'provider';
  else
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- contatti sbloccati solo con una prenotazione confermata tra questo cliente e questo provider sul mezzo
  v_unlocked := exists (select 1 from bookings b
                         where b.customer_id = c.customer_id and b.organization_id = c.organization_id
                           and (b.id = c.booking_id or b.listing_id = c.listing_id)
                           and b.status in ('confirmed', 'picked_up', 'completed'));
  if v_unlocked then
    v_shown := p_body; v_result := 'unfiltered';
  else
    select shown, result into v_shown, v_result from private.filter_contacts(p_body);
  end if;

  insert into messages (conversation_id, sender_id, sender_side, body_original, body_shown, filter_result)
  values (p_conversation, v_user, v_side, p_body, v_shown, v_result)
  returning id into v_msg;
  update conversations set last_message_at = now() where id = p_conversation;

  if v_result <> 'blocked' then
    if v_side = 'customer' then
      perform private.notify_org(c.organization_id, 'new_message', jsonb_build_object('conversation_id', c.id));
    else
      perform private.notify(c.customer_id, 'new_message', jsonb_build_object('conversation_id', c.id));
    end if;
  end if;
  return v_msg;
end $$;

-- ---------------------------------------------------------------------------
-- Preferiti e recensioni
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id),
  listing_id  uuid not null references public.listings(id),
  author_id   uuid not null references auth.users(id),
  author_side text not null check (author_side in ('customer', 'provider')),
  rating      smallint not null check (rating between 1 and 5),
  body        text,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (booking_id, author_side)
);

create or replace function public.leave_review(p_booking uuid, p_rating smallint, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare b record; v_user uuid := auth.uid(); v_side text; v_id uuid;
begin
  select * into b from bookings where id = p_booking;
  if not found or b.status <> 'completed' then raise exception 'NOT_REVIEWABLE' using errcode = 'P0001'; end if;
  if b.customer_id = v_user then v_side := 'customer';
  elsif exists (select 1 from organization_members where organization_id = b.organization_id and user_id = v_user) then v_side := 'provider';
  else raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  insert into reviews (booking_id, listing_id, author_id, author_side, rating, body)
  values (p_booking, b.listing_id, v_user, v_side, p_rating, p_body) returning id into v_id;
  return v_id;
end $$;
