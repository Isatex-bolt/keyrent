-- KeyRent · 0012 · Foto indicative (create con l'AI) per il singolo annuncio
alter table public.listing_media add column if not exists is_indicative boolean not null default false;

create or replace view public.public_listing_media with (security_barrier = true) as
select m.id, m.listing_id, m.storage_path, m.sort, m.alt, m.is_indicative
from listing_media m
join listings l on l.id = m.listing_id
where l.status = 'published' and m.moderation_status = 'approved';
revoke all on public.public_listing_media from anon, authenticated;
grant select on public.public_listing_media to anon, authenticated;
