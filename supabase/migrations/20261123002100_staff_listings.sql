-- 0021 · Il team KeyRent prepara annunci per conto dei noleggiatori (su loro richiesta) e li invia in revisione.
-- Unica differenza rispetto alla macchina a stati di prima: lo staff può fare bozza → in revisione. Rieseguibile.

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
    -- il team può anche inviare in revisione un annuncio preparato per conto di un noleggiatore
    ok := (l.status in ('draft', 'changes_required') and p_to = 'pending_review')
       or (l.status = 'pending_review' and p_to in ('changes_required', 'approved', 'rejected'))
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
