-- 0019 · Capacità separate: chi noleggia come persona, chi noleggia per un'azienda, chi mette a noleggio.
--   · profiles.rents_personally  = profilo PRIVATO attivo (noleggia come persona fisica)
--   · organizations kind 'renter' = profilo AZIENDA cliente (noleggia per l'azienda)
--   · organizations kind 'provider' = ATTIVITÀ DI NOLEGGIO (pubblica mezzi)
-- Nessuna capacità viene data in automatico perché se ne ha un'altra. Rieseguibile.

alter table public.profiles add column if not exists rents_personally boolean not null default false;

-- Utenti già esistenti: profilo privato attivo per chi è cliente (non noleggiatore, non staff, non registrato come azienda)
update public.profiles p set rents_personally = true
 where not p.rents_personally
   and not exists (select 1 from public.organization_members m join public.organizations o on o.id = m.organization_id
                    where m.user_id = p.id and m.status = 'active' and o.kind = 'provider')
   and not exists (select 1 from public.staff_members s where s.user_id = p.id and s.active)
   and not exists (select 1 from auth.users u where u.id = p.id
                    and (coalesce(u.raw_user_meta_data ->> 'customer_kind', '') = 'azienda'
                         or coalesce(u.raw_user_meta_data -> 'pending_org', 'null'::jsonb) <> 'null'::jsonb));

-- Nuove registrazioni: profilo privato solo per chi sceglie "Voglio noleggiare → Privato"
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, rents_personally)
  values (new.id, nullif(new.raw_user_meta_data ->> 'first_name', ''), nullif(new.raw_user_meta_data ->> 'last_name', ''),
          coalesce(new.raw_user_meta_data ->> 'customer_kind', '') = 'privato')
  on conflict do nothing;
  return new;
end $$;

-- "Aggiungi profilo privato": scelta esplicita dell'utente, solo per sé stesso
create or replace function public.enable_personal_renting(p_first text, p_last text, p_phone text, p_birth date default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if coalesce(btrim(p_first), '') = '' or coalesce(btrim(p_last), '') = '' or coalesce(btrim(p_phone), '') = '' then
    raise exception 'EMPTY' using errcode = 'P0001';
  end if;
  update profiles set first_name = btrim(p_first), last_name = btrim(p_last), phone = btrim(p_phone),
                      birth_date = coalesce(p_birth, birth_date), rents_personally = true
   where id = auth.uid();
end $$;
revoke execute on function public.enable_personal_renting(text, text, text, date) from public, anon;
grant execute on function public.enable_personal_renting(text, text, text, date) to authenticated;

-- Attività di noleggio e azienda cliente sono entità diverse: la stessa P.IVA può esistere una volta per tipo
alter table public.organizations drop constraint if exists organizations_vat_number_key;
create unique index if not exists organizations_kind_vat_key on public.organizations (kind, vat_number);

-- Intestare una prenotazione: solo a un'azienda CLIENTE di cui si è membri (un'attività di noleggio non noleggia)
create or replace function public.svc_set_booking_billing(p_booking uuid, p_customer uuid, p_org uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from organizations o join organization_members m on m.organization_id = o.id
                  where o.id = p_org and o.kind = 'renter' and m.user_id = p_customer and m.status = 'active') then
    raise exception 'NOT_MEMBER' using errcode = 'P0001';
  end if;
  update bookings set billing_organization_id = p_org
   where id = p_booking and customer_id = p_customer and status = 'requested';
  if not found then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.svc_set_booking_billing(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.svc_set_booking_billing(uuid, uuid, uuid) to service_role;
