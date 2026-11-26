-- 0030 · Voto e recensioni nelle schede dei risultati + noleggiatore Premium (lo decide lo staff). Rieseguibile.
alter table public.organizations add column if not exists is_premium boolean not null default false;

-- Per ogni annuncio pubblico: voto medio e numero di recensioni del mezzo, e se il noleggiatore è Premium.
create or replace function public.listing_ratings(p_ids uuid[])
returns table (listing_id uuid, rating_avg numeric, rating_count bigint, premium boolean)
language sql stable security definer set search_path = public as $$
  select pl.id,
         (select round(avg(rv.rating)::numeric, 1) from reviews rv where rv.listing_id = pl.id and rv.published and rv.author_side = 'customer'),
         (select count(*) from reviews rv where rv.listing_id = pl.id and rv.published and rv.author_side = 'customer'),
         o.is_premium
  from public_listings pl
  join listings l on l.id = pl.id
  join organizations o on o.id = l.organization_id
  where pl.id = any (p_ids[1:200]);
$$;
revoke all on function public.listing_ratings(uuid[]) from public;
grant execute on function public.listing_ratings(uuid[]) to anon, authenticated, service_role;

-- L'attività dimostrativa è Premium (per far vedere come appare)
update public.organizations set is_premium = true where id = 'dd000000-0000-0000-0000-000000000001';
