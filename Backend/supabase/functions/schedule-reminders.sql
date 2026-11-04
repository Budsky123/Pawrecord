-- Run once in the hosted Supabase SQL editor after enabling pg_cron and pg_net.
-- Store the project URL and secret in Vault; do not put service-role keys in source.
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'pawrecord-project-url');
select vault.create_secret('replace-with-a-long-random-secret', 'pawrecord-cron-secret');

select cron.schedule(
  'pawrecord-send-reminders-daily',
  '0 8 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'pawrecord-project-url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pawrecord-cron-secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
