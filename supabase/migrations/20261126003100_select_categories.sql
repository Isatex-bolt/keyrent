-- 0031 · Categorie KeyRent Select: NCC con autista, Jet privati, Elicotteri. Tutto ciò che ci entra è Select. Rieseguibile.
insert into public.categories (slug, name_it, sort) values
  ('ncc', 'NCC con autista', 80), ('jet', 'Jet privati', 90), ('elicotteri', 'Elicotteri', 100)
on conflict (slug) do update set name_it = excluded.name_it, sort = excluded.sort, active = true;

create or replace function private.auto_select_listing() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT' or new.make_id is distinct from old.make_id or new.category_id is distinct from old.category_id)
     and (exists (select 1 from makes m where m.id = new.make_id and m.slug in
            ('ferrari','lamborghini','rolls-royce','bentley','mclaren','aston-martin','bugatti','pagani','koenigsegg','maybach'))
          or exists (select 1 from categories c where c.id = new.category_id and c.slug in ('ncc','jet','elicotteri'))) then
    new.is_select := true;
  end if;
  return new;
end $$;
drop trigger if exists listings_auto_select on public.listings;
create trigger listings_auto_select before insert or update of make_id, category_id on public.listings
  for each row execute function private.auto_select_listing();
update public.listings l set is_select = true from categories c
 where c.id = l.category_id and not l.is_select and c.slug in ('ncc','jet','elicotteri');

-- Commissione su importi alti (jet, elicotteri): il calcolo "totale × percentuale" usciva dai numeri interi oltre ~43.000 €.
-- Si corregge la sola riga nelle funzioni esistenti (prenotazione vera e noleggi finti della demo).
do $$
declare f record; d text;
begin
  for f in select p.oid from pg_proc p where p.pronamespace = 'private'::regnamespace
             and p.proname in ('create_booking_request', 'demo_seed_bookings') loop
    d := pg_get_functiondef(f.oid);
    if position('round(v_total * c.rate_bps' in d) > 0 then
      execute replace(d, 'round(v_total * c.rate_bps', 'round(v_total::numeric * c.rate_bps');
    end if;
  end loop;
end $$;

-- "Cosa ti serve oggi?": idee KeyRent Select (foto da Admin → Contenuti home)
insert into public.home_collections (slug, title, subtitle, query, sort) values
  ('supercar', 'Una supercar per un giorno', 'Ferrari, Lamborghini, Porsche: consegnata dove vuoi', 'select=1&cat=auto', 15),
  ('ncc-con-autista', 'Un autista per la serata', 'Van e berline di lusso con autista professionista', 'select=1&cat=ncc', 25),
  ('jet-privato', 'Un jet privato', 'Parti quando vuoi, imbarco riservato', 'select=1&cat=jet', 45),
  ('elicottero', 'Un volo in elicottero', 'Panoramici sulle Dolomiti e transfer', 'select=1&cat=elicotteri', 65)
on conflict (slug) do nothing;
