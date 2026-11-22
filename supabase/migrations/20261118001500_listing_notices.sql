-- KeyRent · 0015 · Avvisi al noleggiatore sull'esito della revisione degli annunci
create table if not exists public.listing_notices (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references public.listings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind            text not null check (kind in ('approved', 'changes_required', 'rejected', 'changes_approved', 'changes_rejected')),
  message         text,
  created_at      timestamptz not null default now(),
  seen_at         timestamptz
);
create index if not exists listing_notices_unseen_idx on public.listing_notices(organization_id) where seen_at is null;

revoke all on public.listing_notices from anon, authenticated;
alter table public.listing_notices enable row level security;
drop policy if exists listing_notices_read on public.listing_notices;
create policy listing_notices_read on public.listing_notices for select to authenticated
  using (private.is_org_member(organization_id));
grant select on public.listing_notices to authenticated;

-- Quando lo staff chiude una revisione, nasce l'avviso (e la notifica, che andrà anche per email)
create or replace function private.on_revision_reviewed() returns trigger
language plpgsql security definer set search_path = public as $$
declare l record; k text; msg text;
begin
  if old.status <> 'pending_review' or new.status not in ('approved', 'changes_required', 'rejected') then return new; end if;
  select id, organization_id, title, published_at into l from listings where id = new.listing_id;
  -- una modifica a un annuncio già online (published_at valorizzato prima della revisione) ha esiti dedicati
  k := case
         when new.status = 'approved' and new.number > 1 and l.published_at is not null then 'changes_approved'
         when new.status = 'rejected' and new.number > 1 and l.published_at is not null then 'changes_rejected'
         else new.status end;
  msg := nullif(coalesce(new.review_notes ->> 'note', new.review_notes ->> '_reason'), '');
  insert into listing_notices (listing_id, organization_id, kind, message) values (l.id, l.organization_id, k, msg);
  perform private.notify_org(l.organization_id, 'listing_' || k,
    jsonb_build_object('listing_id', l.id, 'title', l.title, 'message', msg));
  return new;
end $$;
revoke execute on function private.on_revision_reviewed() from public, anon, authenticated;
drop trigger if exists revision_reviewed on public.listing_revisions;
create trigger revision_reviewed after update of status on public.listing_revisions
  for each row execute function private.on_revision_reviewed();

-- Il noleggiatore segna come letti gli avvisi (tutti, o di un annuncio)
create or replace function public.mark_listing_notices_seen(p_listing uuid default null)
returns void language sql security definer set search_path = public as $$
  update listing_notices n set seen_at = now()
   where n.seen_at is null and private.is_org_member(n.organization_id)
     and (p_listing is null or n.listing_id = p_listing)
$$;
revoke execute on function public.mark_listing_notices_seen(uuid) from public, anon;
grant execute on function public.mark_listing_notices_seen(uuid) to authenticated;
