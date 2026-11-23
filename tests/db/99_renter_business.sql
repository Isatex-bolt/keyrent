\set ON_ERROR_STOP 1
set role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', false);
select public.create_renter_organization('Cliente Spa', 'IT 55544433322', 'ABC1234') as org \gset
select test.ok((select kind = 'renter' and verification_status = 'verified' from organizations where id = :'org'), 'azienda cliente creata e verificata');
select test.fails(format($$insert into locations (organization_id, name, address_line, postal_code, city, province, latitude, longitude) values (%L, 'x', 'x', '1', 'x', 'PD', 45, 11)$$, :'org'),
  'NOT_PROVIDER_ORG', 'un''azienda cliente non può avere sedi');
select test.fails($$select public.create_renter_organization('', 'x')$$, 'EMPTY', 'servono ragione sociale e P.IVA');
reset role; reset request.jwt.claim.sub;
select test.ok((select kind = 'provider' from organizations where id = '0a000000-0000-0000-0000-000000000001'), 'i noleggiatori esistenti restano noleggiatori');
set role service_role;
select test.fails(format('select public.svc_set_booking_billing(gen_random_uuid(), %L, %L)', 'c0000000-0000-0000-0000-000000000002', :'org'), 'NOT_MEMBER', 'solo i membri intestano all''azienda');
reset role;
