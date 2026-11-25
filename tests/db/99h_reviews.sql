-- Recensioni del noleggiatore nella scheda pubblica
\set urus '''3b000000-0000-0000-0000-000000000001'''
\set orgB '''0b000000-0000-0000-0000-000000000001'''
select test.ok((public.provider_reviews('00000000-0000-0000-0000-000000000000'::uuid) ->> 'count')::int = 0, 'annuncio inesistente: nessuna recensione');

-- noleggi conclusi (con recensioni) generati come nella demo
update organizations set is_demo = true where id = :orgB;
update listings set demo_keep = true where id = :urus;
select set_config('keyrent.demo_seed', 'on', false);
select private.demo_seed_bookings(:orgB);
select set_config('keyrent.demo_seed', '', false);

select test.ok((public.provider_reviews(:urus) ->> 'count')::int > 0, 'le recensioni dei noleggi conclusi si vedono');
select test.ok(jsonb_array_length(public.provider_reviews(:urus, 2) -> 'items') <= 2, 'limite rispettato');
select test.ok(not (public.provider_reviews(:urus)::text like '%@%'), 'nessuna email del cliente');
select test.ok(not (public.provider_reviews(:urus)::text ilike '%' || (select legal_name from organizations where id = :orgB) || '%'), 'il noleggiatore resta anonimo');
update listings set status = 'unpublished' where id = :urus;
select test.ok((public.provider_reviews(:urus) ->> 'count')::int = 0, 'annuncio non pubblico: niente recensioni');
update listings set status = 'published' where id = :urus;

-- pulizia
select set_config('keyrent.demo_seed', 'on', false);
delete from booking_events where booking_id in (select id from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%');
delete from reviews where listing_id = :urus;
delete from payments where booking_id in (select id from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%');
delete from payouts where booking_id in (select id from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%');
delete from unit_reservations where booking_id in (select id from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%');
delete from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%';
select set_config('keyrent.demo_seed', '', false);
update listings set demo_keep = false where id = :urus;
update organizations set is_demo = false where id = :orgB;
