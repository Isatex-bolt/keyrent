-- Lavori automatici programmati nel database (Supabase → SQL editor). Rieseguibile. NON è una migrazione.
-- Prima: Supabase → Integrations → attiva "Cron" (pg_cron) e "pg_net". Oppure le righe create extension qui sotto.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Ogni minuto, solo database: scadenze delle richieste (non serve il sito, non tocca addebiti in corso).
select cron.unschedule(jobid) from cron.job where jobname = 'keyrent-expire';
select cron.schedule('keyrent-expire', '* * * * *', $$select count(*) from public.svc_expire_all()$$);

-- 2) Ogni 5 minuti: il sito fa il giro completo (carte da sbloccare, addebiti da verificare, rimborsi, versamenti, email).
--    Il segreto sta nel Vault di Supabase, non nel codice: la prima volta sostituisci INCOLLA_QUI con il valore di
--    CRON_SECRET che trovi su Vercel (Settings → Environment Variables) ed esegui SOLO questa riga:
--    select vault.create_secret('INCOLLA_QUI', 'keyrent_cron_secret');
select cron.unschedule(jobid) from cron.job where jobname = 'keyrent-tick';
select cron.schedule('keyrent-tick', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://keyrent.vercel.app/api/jobs/tick',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'keyrent_cron_secret'),
                                  'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 55000)
$$);

-- Controllo: ultime esecuzioni
-- select jobname, status, return_message, start_time from cron.job_run_details d join cron.job j using (jobid) order by start_time desc limit 10;
