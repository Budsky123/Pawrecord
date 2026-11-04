# Phase 5 — Reminder delivery

## Delivered

- Added the Deno `send-reminders` Edge Function.
- Added authenticated staff/vet manual sends from the Overview reminder cards.
- Added daily vaccination reminders for doses due in the next seven days.
- Added appointment reminders for tomorrow's pending or confirmed appointments.
- Added duplicate-safe reminder rows using the existing source/date unique indexes.
- Added Resend delivery with idempotency keys and failed-delivery recording.
- Added Vault, `pg_cron`, and `pg_net` scheduling SQL.

## Deploy

From the project root, after linking the Supabase project:

```powershell
npm run supabase -- functions deploy send-reminders
npm run supabase -- secrets set RESEND_API_KEY=re_xxx REMINDER_FROM_EMAIL="PawRecord <reminders@your-domain.example>" CRON_SECRET="long-random-secret"
```

The Supabase runtime supplies `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. Never add the service-role key to `.env.local` or
any `VITE_` variable.

Run `Backend/supabase/functions/schedule-reminders.sql` in the hosted SQL
editor once. Replace its project URL and generated cron secret, then verify
the schedule in `cron.job`.

## Manual verification

1. Use a staff or vet account in the web app.
2. Open Overview and click **Send reminder** on a due vaccination.
3. Confirm the email in Resend and inspect the new `public.reminders` row.
4. Click the same button again; the function should report it as skipped rather
   than sending a duplicate.
5. Invoke the function with the cron secret to verify the scheduled path.

The fictional `.test` seed addresses cannot receive mail. Use a real owner
email and a verified Resend sender for hosted testing.
