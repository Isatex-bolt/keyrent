-- 0030 · Voto e recensioni nelle schede dei risultati, noleggiatore Premium (lo decide lo staff),
-- KeyRent Select (mezzi esclusivi in una sezione a parte). Rieseguibile.
alter table public.organizations add column if not exists is_premium boolean not null default false;
alter table public.listings add column if not exists is_select boolean not null default false;
-- (il noleggiatore non può scriverla: i permessi del client sulle colonne di listings non la includono)

-- Marche esclusive: l'annuncio entra in Select da solo (lo staff può comunque toglierlo o aggiungerne altri)
create or replace function private.auto_select_listing() returns trigger
language plpgsql as $$
begin
  if new.make_id is not null and (tg_op = 'INSERT' or new.make_id is distinct from old.make_id)
     and exists (select 1 from makes m where m.id = new.make_id and m.slug in
       ('ferrari','lamborghini','rolls-royce','bentley','mclaren','aston-martin','bugatti','pagani','koenigsegg','maybach')) then
    new.is_select := true;
  end if;
  return new;
end $$;
drop trigger if exists listings_auto_select on public.listings;
create trigger listings_auto_select before insert or update of make_id on public.listings
  for each row execute function private.auto_select_listing();
update public.listings l set is_select = true from makes m
 where m.id = l.make_id and not l.is_select and m.slug in
   ('ferrari','lamborghini','rolls-royce','bentley','mclaren','aston-martin','bugatti','pagani','koenigsegg','maybach');

-- Per ogni annuncio pubblico: voto medio e numero di recensioni del mezzo, noleggiatore Premium, Select.
drop function if exists public.listing_ratings(uuid[]);
create or replace function public.listing_ratings(p_ids uuid[])
returns table (listing_id uuid, rating_avg numeric, rating_count bigint, premium boolean, is_select boolean)
language sql stable security definer set search_path = public as $$
  select pl.id,
         (select round(avg(rv.rating)::numeric, 1) from reviews rv where rv.listing_id = pl.id and rv.published and rv.author_side = 'customer'),
         (select count(*) from reviews rv where rv.listing_id = pl.id and rv.published and rv.author_side = 'customer'),
         o.is_premium, l.is_select
  from public_listings pl
  join listings l on l.id = pl.id
  join organizations o on o.id = l.organization_id
  where pl.id = any (p_ids[1:200]);
$$;
revoke all on function public.listing_ratings(uuid[]) from public;
grant execute on function public.listing_ratings(uuid[]) to anon, authenticated, service_role;

-- L'attività dimostrativa è Premium (per far vedere come appare)
update public.organizations set is_premium = true where id = 'dd000000-0000-0000-0000-000000000001';
