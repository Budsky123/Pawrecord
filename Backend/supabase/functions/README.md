# Edge Functions

## `send-reminders`

Deploy with:

```powershell
npm run supabase -- functions deploy send-reminders
npm run supabase -- secrets set RESEND_API_KEY=re_xxx REMINDER_FROM_EMAIL="PawRecord <reminders@your-domain.example>" CRON_SECRET="long-random-secret"
```

The function accepts an authenticated staff/vet bearer token for manual sends.
The daily job uses `x-cron-secret` instead. `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase at runtime. The service-role
key is never exposed to the frontend.

## `admin-create-user`

Deploy this function before using the Administration page. It uses the
service-role key only inside the Edge Function to send Auth invitations.

Run [`schedule-reminders.sql`](./schedule-reminders.sql) once in the hosted SQL
editor after enabling the `pg_cron`, `pg_net`, and Vault extensions. Change the
cron expression if the clinic needs a different local delivery time.
