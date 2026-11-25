-- 0029 · Recensioni dei clienti sul noleggiatore, mostrate nella scheda mezzo.
-- Il noleggiatore resta anonimo: si vedono voto, testo, nome del cliente (es. "Giulia B.") e il mezzo noleggiato,
-- raccolti su tutti gli annunci pubblici della stessa attività. Rieseguibile.
create or replace function public.provider_reviews(p_listing uuid, p_limit int default 6)
returns jsonb language sql stable security definer set search_path = public as $$
  with org as (
    select l.organization_id as id from listings l
    where l.id = p_listing and exists (select 1 from public_listings pl where pl.id = l.id)
  ), r as (
    select rv.rating, rv.body, rv.created_at, pl.title,
           trim(coalesce(p.first_name, 'Cliente') || ' ' || coalesce(left(p.last_name, 1) || '.', '')) as author
    from reviews rv
    join listings l on l.id = rv.listing_id
    join org on org.id = l.organization_id
    join public_listings pl on pl.id = l.id
    left join profiles p on p.id = rv.author_id
    where rv.published and rv.author_side = 'customer'
  )
  select jsonb_build_object(
    'count', (select count(*) from r),
    'avg', (select round(avg(rating)::numeric, 1) from r),
    'items', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select rating, body, created_at, title, author from r
        where body is not null and length(trim(body)) > 0
        order by created_at desc limit greatest(1, least(p_limit, 20))) x), '[]'::jsonb));
$$;
revoke all on function public.provider_reviews(uuid, int) from public;
grant execute on function public.provider_reviews(uuid, int) to anon, authenticated, service_role;
