# PawRecord — Vet Clinic Records System

Single-clinic university project for **Pawsitive Pet Health**. React + Vite,
TypeScript, Tailwind CSS, React Router and supabase-js; Supabase PostgreSQL,
Auth and Deno Edge Functions; Resend email; Vercel frontend hosting.

**Current deliverable: complete scoped demo.** Includes the project scaffold, theme,
SQL migrations, RLS, local seed and SQL test scripts, plus Supabase Auth,
protected routes, the shared clinic shell, Overview, Pets, pet detail, medical
records, vaccinations, appointments, the Resend reminder Edge Function, the
owner portal, reports, and CI configuration.

## Run the frontend

Requires Node.js **22.12+** and npm. From this directory:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open Vite's printed URL, normally `http://localhost:5173`. The Phase 1 theme
specimen works without Supabase credentials. For backend work, replace the two
values in `.env.local` with the public URL and anon key from the local stack.
No service-role key belongs in any `VITE_` variable.

Dependencies are exactly pinned. **This creation workspace could not resolve
registry.npmjs.org**, so installation and lockfile generation could not complete.
After the first successful install, commit `package-lock.json`; subsequent
installs and the later CI workflow must use `npm ci`.

```powershell
npm run lint
npm run build
npm run test:db
```

`test:db` runs the real PostgreSQL engine through PGlite with btree_gist and
pgcrypto. It applies the migrations and seed, then executes five transactional
SQL suites. Only the Supabase-managed Auth tables/functions are fixtures.
GoTrue sign-in, JWT signatures and PostgREST require the actual Supabase stack.

## Set up the local database

Install and start Docker Desktop. The Supabase CLI is a pinned dev dependency.
Use a fresh local stack; its configured ports are 54320–54324.

```powershell
npm run supabase -- --help
npm run supabase -- start
npm run supabase -- db reset --help
npm run supabase -- db reset --local
npm run supabase -- status
```

`db reset --local` resets this **local** database, applies the migrations in order,
then runs `Backend/supabase/seed.sql`. Do not run the demo seed against a production
database. Copy the local URL and anon key into `.env.local`. Public signup is
disabled for this clinic demo; a signup trigger still defaults new accounts to
the `owner` role.

Open Studio at `http://127.0.0.1:54323` and run each file in `Backend/supabase/tests/` in
its SQL editor. Successful tests complete without exceptions and roll back all
test writes. `owner_read_smoke.sql` is the short grading proof: Janicah can read
Luna and cannot read Max. With PostgreSQL's psql installed, the same check is:

```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/owner_read_smoke.sql
```

Expected fresh seed counts:

| Profiles | Owners | Pets | Vaccine types | Visits | Vaccinations | Appointments | Reminders |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | 4 | 4 | 4 | 4 | 6 | 7 | 4 |

## Local demo accounts

All four use the **local-only** password `PawRecordDemo!2026`. Both auth.users
and auth.identities are seeded. The login screen comes in Phase 2.

| Email | Name | Role | Access |
| --- | --- | --- | --- |
| manager@pawrecord.test | Angel Mae | staff | Clinic manager; all clinic data |
| sunny@pawrecord.test | Dr. Sunny | vet | All clinic data |
| cj@pawrecord.test | Dr. CJ | vet | All clinic data |
| janicah@pawrecord.test | Janicah Grace | owner | Luna; own future bookings/cancellations |

Other owners: Arah Marie (Max), Joseph Dean (Coco), Paul Frank (Buddy).
Their nullable `profile_id` is unlinked because they have no portal accounts.
The `.test` emails are fictional and cannot receive Resend mail; real test
recipients and a verified sender will be configured during the email phase.

## Folder layout

| Path | Contents |
| --- | --- |
| `Frontend/src/app/` | React Router entry |
| `Frontend/src/components/ui/` | Avatar, StatCard, StatusChip |
| `Frontend/src/lib/` | Browser Supabase client; clinic/timezone constants |
| `Frontend/src/pages/` | Application route pages |
| `Frontend/src/styles/` | Tailwind layers, shared styles and print defaults |
| `Frontend/public/images/` | Generated Luna portrait; other pets fall back to initials |
| `Backend/supabase/migrations/` | Schema and security/care-rule migrations |
| `Backend/supabase/seed.sql` | Local Auth accounts and fictional clinic data |
| `Backend/supabase/tests/` | Five SQL verification scripts |
| `Backend/supabase/functions/` | Deno reminder function and cron setup |
| `Backend/scripts/` | Embedded PostgreSQL runner and test-only Auth fixture |

## Database and RLS

Every application table has RLS enabled. Anonymous users have no clinic data
access; `authenticated` is explicitly granted table privileges, with RLS deciding
which rows each signed-in user can read/write. Roles come from `profiles.role`,
never user-editable metadata. The private role lookup reads only the caller's
profile and avoids recursive profile policies. Public RPC wrappers are security
invokers; privileged internal functions use fixed search paths and restricted
execution privileges.

| Data | Staff / vet | Owner |
| --- | --- | --- |
| Profiles | Full read/write | Read own; no role edits |
| Owners | Full read/write | Read linked owner row |
| Pets | Full read/write | Read own pets |
| Visits | Full read/write | Read own pets' non-deleted records |
| Vaccinations | Full read/write | Read own pets' doses |
| Vaccine types | Full read/write | Read catalog for labels/intervals |
| Appointments | Full read/write | Read own; insert pending future bookings; cancel own future pending/confirmed bookings |
| Reminders | Full read/write | No access |
| Vet directory RPC | IDs/names | IDs/names for booking; no private profile fields |

Only staff can link `owners.profile_id`; signup names/emails cannot claim an
existing owner's records. An owner cancellation policy checks old/new ownership
and status, while a trigger prevents changing time, vet, pet, reason or other
fields during cancellation. Owner appointment deletion and medical edits are
denied.

Appointments require a vet profile and positive duration. A GiST exclusion
constraint prevents overlaps for one vet across pending, confirmed and completed
appointments. Half-open intervals allow adjacent slots; cancelling frees a slot.
The later UI must handle database conflict SQLSTATE `23P01`.

Vaccination dates are calculated on every insert/update. Editing a catalog
interval recalculates existing doses. Future care belongs in appointments;
`vaccinations` records actual administrations. `vaccines_due` includes only the
latest dose for each pet/type, overdue or due within 14 days. It uses
`security_invoker = true`, so it honors the caller's RLS.

Reminder source IDs and unique source/date indexes support duplicate prevention.
The reminder function atomically claims/retries a row and uses Resend idempotency
keys. No email or cron job runs until the function is deployed. Service-role, Resend and cron secrets
belong in server configuration, never frontend environment variables.

## Design and sample-data decisions

- The supplied palette is retained in `Frontend/tailwind.config.js`. Tailwind **3.4** is
  used for its requested JavaScript theme configuration. Headings/numbers use
  Manrope; body uses DM Sans.
- Cards use 2xl corners, inputs/buttons xl, avatars circles, and chips soft pink
  or neutral tones. Only the primary button has a shadow.
- Clinic manager maps to `staff`. Exactly two vets are seeded; Dr. CJ handles
  records shown under a third vet in the screenshots.
- Dates are relative to the seed day in **Asia/Manila**. Today's schedule has
  four appointments; tomorrow has two; Luna's booster is booked in two days.
  There are four queued reminders.
- Sample ages are older than the tiny screenshot ages so the year-long vaccine
  history makes sense. Buddy is a dog to match the DHPP record.
- Overview/report totals will come from real data, not screenshot placeholders.
  “Scheduled” vaccination care will be derived from future appointments.
- Contacts, clinical history and vaccine intervals are fictional demonstration
  data. Luna's generated portrait is a bundled asset, not a Storage integration.

## Phases

1. Project structure, theme, migrations, RLS, seed and SQL checks.
2. Auth/route guards, shared shell, Overview, Pets and patient detail.
3. Visits and vaccination forms, with loading/empty/error states.
4. Appointment booking/cancellation, weekday views and conflict handling.
5. Reminder function with Resend, then pg_cron/pg_net scheduling.
6. Owner portal with records and booking.
7. GitHub Actions, Vercel and end-to-end deployment verification.
8. Reports and print export.

These development phases preserve the requested scope priority. The complete
scoped demo is now implemented locally; hosted deployment still requires the
Supabase and Vercel actions below.

## Hosted setup checklist

1. Apply all three migrations in `Backend/supabase/migrations/` to the hosted
   Supabase project, in filename order. The third migration adds the
   `rescheduled` appointment status used by staff/vet workflow controls.
2. Create or update a matching `public.profiles` row for each hosted Auth user.
3. Deploy `send-reminders`, set `RESEND_API_KEY`, `REMINDER_FROM_EMAIL`, and
   `CRON_SECRET`, then run `Backend/supabase/functions/schedule-reminders.sql`.
4. Configure Vercel with the repository root as the project root and set
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never add a service-role key
   to Vercel frontend variables.
5. Enable email confirmation/password settings appropriate for the demo and use
   a verified Resend sender/domain. The fictional `.test` seed addresses cannot
   receive email.

## Deployment notes for the deployment phase

Import the eventual GitHub repository into Vercel. Use the Vite preset, build
command `npm run build`, and output `dist`. Set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`, configure Supabase Auth redirects for the Vercel domain,
and add a React Router SPA rewrite. Auto-deploy `main`. The later
`.github/workflows/ci.yml` will run `npm ci`, lint and build on push/PR.
No hosted deployment or passing remote CI is claimed in Phase 1.

## Future Work

SMS, multi-clinic support, PDF certificates, full-text search, audit trail.

## References

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [View security](https://supabase.com/docs/guides/database/views)
- [Auth profiles](https://supabase.com/docs/guides/auth/managing-user-data)
- [Local seeding](https://supabase.com/docs/guides/local-development/seeding-your-database)
- [Tailwind 3 + Vite](https://v3.tailwindcss.com/docs/guides/vite)
- [PGlite extensions](https://pglite.dev/extensions/)
