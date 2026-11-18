-- KeyRent · 0011 · Immagini indicative di catalogo (per modello o per categoria), usate quando l'annuncio non ha foto
create table if not exists public.catalog_images (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories(id),
  model_id     uuid references public.models(id) on delete cascade,
  storage_path text not null,
  source       text not null default 'ai' check (source in ('ai', 'licensed', 'own')),
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create unique index if not exists catalog_images_model_uq on public.catalog_images(model_id) where model_id is not null;
create unique index if not exists catalog_images_cat_uq on public.catalog_images(category_id) where model_id is null;

revoke all on public.catalog_images from anon, authenticated;
alter table public.catalog_images enable row level security;
drop policy if exists catalog_images_read on public.catalog_images;
create policy catalog_images_read on public.catalog_images for select to anon, authenticated using (true);
grant select on public.catalog_images to anon, authenticated;

create or replace view public.public_catalog_images as
select c.slug as category_slug, mk.slug as make_slug, md.slug as model_slug, ci.storage_path, ci.source
from catalog_images ci
join categories c on c.id = ci.category_id
left join models md on md.id = ci.model_id
left join makes mk on mk.id = md.make_id;
revoke all on public.public_catalog_images from anon, authenticated;
grant select on public.public_catalog_images to anon, authenticated;
