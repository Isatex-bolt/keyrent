-- KeyRent · AZZERA account, attività, annunci, prenotazioni e messaggi (resta: catalogo, foto catalogo, contenuti home, regole globali)
begin;
alter table public.audit_log disable trigger audit_log_immutable;
alter table public.booking_events disable trigger booking_events_immutable;
alter table public.ledger_entries disable trigger ledger_immutable;

update public.catalog_images set created_by = null;
delete from public.reviews;
delete from public.support_threads;
delete from public.conversation_reads;
delete from public.messages;
delete from public.conversations;
delete from public.ledger_entries;
delete from public.payouts;
delete from public.refunds;
delete from public.payments;
delete from public.unit_reservations;
delete from public.booking_events;
delete from public.bookings;
update public.listings set published_revision_id = null;
delete from public.listings;
delete from public.vehicle_units;
delete from public.commission_rules where organization_id is not null;
delete from public.organizations;
delete from public.email_deliveries;
delete from public.notifications;
delete from public.audit_log;
delete from auth.users;

alter table public.audit_log enable trigger audit_log_immutable;
alter table public.booking_events enable trigger booking_events_immutable;
alter table public.ledger_entries enable trigger ledger_immutable;
commit;

select (select count(*) from auth.users) as account, (select count(*) from public.organizations) as attivita,
       (select count(*) from public.listings) as annunci, (select count(*) from public.models) as modelli_catalogo,
       (select count(*) from public.catalog_images) as foto_catalogo, (select count(*) from public.destinations) as mete;
