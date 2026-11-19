# PawRecord - Comprehensive Frontend, Backend, Security, and Operations Guide

Date: 2026-11-19
Repository: `Budsky123/Pawrecord`
Production frontend: `https://pawrecord-ochre.vercel.app`
Hosting: React/Vite on Vercel; PostgreSQL, Auth, Storage, and Edge Functions on Supabase

## 1. Executive summary

PawRecord is a single-clinic veterinary records system. The application separates clinic staff/vet workflows from owner workflows and uses Supabase for authentication, PostgreSQL data access, authorization, file storage, scheduled jobs, and server-side email delivery.

The project has a working frontend build and passes all current database security suites. However, a final security review found several improvements required before it should be considered production-ready:

1. The pet-photo storage bucket is public.
2. Clinic staff and vets share unrestricted write access to every application table.
3. Rescheduling is not atomic.
4. Appointment parsing can disagree with the clinic timezone.
5. Invitation redirects should be fixed by the server instead of accepting a redirect value from the browser.
6. Several user-visible database errors should be normalized further across non-appointment pages.

Remediation status after the 2026-11-19 hardening pass:

1. Pet-photo storage is intended to use private bucket signed URLs.
2. Vet/staff write access is separated in migration `20261104000500`.
3. Rescheduling is implemented through the transactional `reschedule_appointment` RPC.
4. Appointment UI uses the `Asia/Manila` clinic timezone helper.
5. Invitations use a server-selected PawRecord redirect URL.
6. Database errors are normalized through a shared frontend error mapper.

The deployed Edge Function and hosted secret setup should be considered operational configuration, not source-code evidence. Production configuration must be verified from the Supabase and Resend dashboards.

## 2. Technology stack

### Frontend

- React 19
- Vite 7
- TypeScript 5
- Tailwind CSS 3
- React Router 7
- `supabase-js`
- Lucide React
- Manrope and DM Sans

### Backend

- Supabase PostgreSQL
- Supabase Auth
- Supabase Row Level Security
- Supabase Storage
- Supabase Edge Functions using Deno
- pg_cron
- pg_net
- Resend REST API

### Deployment

- Vercel hosts the React application.
- GitHub hosts the source repository and GitHub Actions CI.
- Supabase hosts the database, authentication, storage, and server-side functions.

## 3. Repository structure

```text
Frontend/
  src/
    app/App.tsx
    auth/
    components/
      layout/
      ui/
    lib/
    pages/
    styles/
  vite.config.ts
  tsconfig.json

Backend/
  supabase/
    migrations/
    functions/
    tests/
    seed.sql
    config.toml
  scripts/

.github/workflows/
public/
vercel.json
package.json
package-lock.json
README.md
```

Files generated or downloaded locally should not be committed:

- `node_modules/`
- `dist/`
- `.env`
- `.env.*`
- `Backend/supabase/.temp/`
- `coverage/`
- `*.tsbuildinfo`

## 4. Frontend architecture

### 4.1 Application entry

`Frontend/src/main.tsx` mounts the React application and wraps it with:

1. `BrowserRouter`
2. `AuthProvider`
3. `App`

The Vite application is configured with `Frontend` as the source root and writes production output to the repository-level `dist/` directory. Vercel uses that directory and rewrites application routes to `index.html`.

### 4.2 Authentication provider

`Frontend/src/auth/AuthProvider.tsx` owns:

- Session state
- Profile state
- Loading state
- Sign in
- Sign up
- Password reset
- Password update
- Sign out
- Supabase configuration errors

The provider calls `getSession()` initially and subscribes to `onAuthStateChange()`. It loads the matching public `profiles` row after a session is established.

The frontend never uses or reads the Supabase service-role key.

### 4.3 Route structure

`Frontend/src/app/App.tsx` defines all application routes.

Public route:

- `/sign-in`

Protected staff/vet/owner routes:

- `/`
- `/pets/:id`
- `/medical-records`
- `/vaccinations`
- `/appointments`

Staff/vet-only routes:

- `/pets`
- `/reports`
- `/administration`

Owner-only route:

- `/owner-portal`

The owner overview is rendered from the root route by `OverviewLanding`, while staff and vets receive the clinic overview.

### 4.4 Role guards

`ProtectedRoute` confirms that a session exists.

It redirects unauthenticated users to `/sign-in`.

If a session exists but no `profiles` row is available, it displays an account setup message instead of allowing access.

`RoleRoute` verifies that the authenticated profile role is allowed for the route.

This frontend checking improves user experience, but PostgreSQL RLS is the real authorization boundary.

### 4.5 Sign-in, sign-up, reset, and invite

The sign-in page supports:

- Password sign-in
- Public sign-up, if enabled
- Password reset email
- New-password setup after a recovery or invitation link

Normal reset and invite links call Supabase with `redirectTo` set to the set-password route.

The set-password route calls `supabase.auth.updateUser({ password })`.

Important behavior:

- Opening a recovery link establishes a recovery session.
- The page must not redirect immediately to the protected app.
- The user must successfully update the password before normal sign-in behavior resumes.
- Supabase redirect URLs must allow the Vercel domain.

Invitation accounts are created by the staff/vet-only `admin-create-user` Edge Function with `inviteUserByEmail()`.

The invitation function updates the profile with the invited full name and role.

### 4.6 Appointment UI

`AppointmentsPage` contains:

- Monthly calendar
- Daily appointment list
- Appointment creation
- Appointment rescheduling
- Appointment status updates
- Owner booking
- Portal-style action menu
- Manual reminder sending

The action menu uses a fixed/portal position to keep it visible without page scrolling.

Before submission, it validates:

- Start/end ordering
- Past date/time
- Required patient/vet/reason fields

Database errors are converted to friendly messages for:

- Vet schedule conflicts
- Permission failures
- Invalid appointment duration
- Missing foreign records

Remaining concern:

Browser timezone and clinic timezone can disagree. Appointment timestamps should be constructed explicitly with the clinic timezone, and UI date strings should not depend on the server/browser timezone.

### 4.7 Pet and owner UI

The pets page allows staff/vets to:

- Search for pets
- Add pets
- Open pet details

The owner portal allows owners to:

- Select among their pets
- View pet profile information
- Update only their own pet photo
- View their own appointments
- View their own vaccinations
- View their own medical history

The owner portal filters loaded global lists locally by the selected pet ID. The backend RLS policies remain the security boundary.

The pet-photo upload:

- Limits file size to 5 MB
- Requires an image MIME type
- Stores under the owner ID and pet ID path
- Updates the pet `photo_url`

### 4.8 Medical and vaccination UI

Medical records are expandable and can show:

- Diagnosis
- Treatment
- Notes
- Vet
- Date
- Category

The page provides a pet filter.

The vaccination page provides:

- Vaccine status
- Given date
- Next due date
- Pet filter
- Due/overdue/current status

Vaccination status is calculated in the frontend, while next due dates are calculated in PostgreSQL.

### 4.9 Overview and reminders

The staff overview shows:

- Today's appointments
- Active patient count
- Vaccines due soon
- Pending reminder count
- Today's schedule
- Due-care reminders
- Recently viewed patients

The existing reminder panel can invoke `send-reminders`.

For one appointment, the actions menu invokes:

```text
supabase.functions.invoke("send-reminders", {
  body: { appointmentId }
})
```

The backend restricts this to clinic staff/vets.

### 4.10 Skeleton screens

`PageSkeleton` provides animated placeholders for dashboard/list loading states.

It should be used consistently when data loading is meaningful enough to benefit from layout continuity.

Recommended improvements:

- Keep skeleton dimensions close to the final card/table geometry.
- Disable actions while loading.
- Announce loading state with `aria-busy`.
- Preserve reduced-motion behavior.

### 4.11 Frontend error handling

Supabase calls generally display an error state or inline alert.

Current strengths:

- Loading and error states exist.
- Appointment database codes are normalized.
- Role guards prevent normal navigation into unauthorized routes.
- Upload validates file size and MIME type.

Current weaknesses:

- Raw database messages remain visible in some add/edit pages.
- Some forms do not clear stale errors after field correction.
- Appointment status/update actions do not use a typed error mapping everywhere.
- The app has no global Sentry or application telemetry integration.
- There is no retry mechanism for transient network failures.

## 5. Backend architecture

### 5.1 PostgreSQL role model

The `app_role` enum is:

- `vet`
- `staff`
- `owner`

The `profiles` table links one authenticated Supabase Auth user to a role.

The `owners` table represents a client owner and may link to a profile through `profile_id`.

This separation is intentional:

- Vets/staff do not require an `owners` row.
- Owners may require an `owners` row for pet ownership and email.
- `owners.profile_id` determines owner pet visibility.

### 5.2 Core tables

#### profiles

- User ID
- Full name
- Role
- Phone
- Updated timestamp

#### owners

- Owner ID
- Optional profile link
- Full name
- Email
- Phone

#### pets

- Owner ID
- Name
- Species
- Breed
- Birth date
- Sex
- Photo URL
- Health status

#### vaccine_types

- Name
- Interval in days

#### vaccinations

- Pet
- Vaccine type
- Given date
- Calculated next-due date
- Administering profile

#### visits

- Pet
- Vet
- Visit date
- Category
- Reason
- Diagnosis
- Treatment
- Notes
- Soft-delete timestamp

#### appointments

- Pet
- Vet
- Start/end times
- Reason
- Status

#### reminders

- Pet
- Source type
- Destination email
- Sent timestamp
- Status
- Vaccination or appointment reference
- Due date

### 5.3 RLS summary

Every application table enables RLS.

Owner policies allow read access to:

- Their own profile
- Their own owner row
- Their own pets
- Related vaccinations
- Related visits
- Related appointments

Owners can:

- Cancel upcoming appointments
- Book pending appointments
- Update only `photo_url` on their own pets

Staff/vets receive the `clinic_full_access` policy across the application tables.

### 5.4 Critical RLS finding

The current `clinic_full_access` policy allows both vets and staff to modify all application tables, including:

- `profiles`
- `owners`
- Account role fields
- Owner/profile links

That contradicts the intended separation between clinic data access and account administration.

The policy should be divided into:

- Staff/vet read/write clinic care data
- Staff-only account administration
- Vet-only or staff/vet permissions for clinical records according to final product rules

### 5.5 Appointment constraints

The appointments table has:

- Positive-duration constraint
- Vet overlap exclusion using `tstzrange`
- Appointment status enum
- Foreign keys to pets and profiles

The overlap exclusion requires `btree_gist`.

This prevents a second overlapping appointment for the same vet.

Appointments are not currently rescheduled as one database transaction by the frontend. This should be fixed with an RPC or dedicated database function.

### 5.6 Vaccination behavior

A trigger:

1. Reads `vaccine_types.interval_days`
2. Adds the interval to `given_on`
3. Writes `next_due_on`

A view identifies due and overdue vaccinations.

The frontend receives the view through the vaccines due relation.

### 5.7 Storage

Storage bucket: `pet-photos`

Current migration behavior:

- Public bucket
- Staff/vet full storage access
- Owner read access
- Owner insert access

Public bucket URLs expose files without a Supabase session.

Recommended design:

- Make the bucket private
- Use signed URLs
- Restrict inserts and updates to exact owner/pet folders
- Delete orphaned old objects

### 5.8 Edge Function: send-reminders

Location:

`Backend/supabase/functions/send-reminders/index.ts`

The function:

1. Requires staff/vet authorization or a valid cron secret.
2. Finds due vaccination reminders.
3. Finds upcoming appointment reminders.
4. Resolves the owner email.
5. Claims or deduplicates the reminder row.
6. Calls the Resend REST API.
7. Updates the reminder status to sent or failed.

The function supports:

- `petId`
- `appointmentId`

An appointment-specific call is intended to send only that appointment.

The function is deployed and was reported active on the hosted project.

### 5.9 Edge Function: admin-create-user

Location:

`Backend/supabase/functions/admin-create-user/index.ts`

The function:

1. Requires an authenticated staff/vet actor.
2. Calls `inviteUserByEmail()`.
3. Updates the invited user's profile name and role.

The invitation link uses a redirect supplied by the frontend.

Recommended hardening:

- Require staff only
- Validate the role allowlist
- Use a server-configured Vercel URL
- Reject unrecognized redirect hosts
- Add audit logging

### 5.10 Authentication

Supabase Auth is used for:

- Email/password login
- Self-sign-up
- Password reset
- Invitation
- Session management

Supabase automatically creates a profile for every new Auth user through a database trigger.

The trigger intentionally defaults all users to `owner`.

Clinic accounts must be promoted only through the staff administration layer.

### 5.11 Reminder scheduling

The SQL file in `schedule-reminders.sql` schedules an HTTP Edge Function call with pg_cron and pg_net.

Required setup:

1. Enable pg_cron and pg_net.
2. Store the project URL in Vault.
3. Store the cron secret in Vault.
4. Schedule the HTTP call.
5. Verify Edge Function secrets.

Required Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `REMINDER_FROM_EMAIL`
- `CRON_SECRET`

Supabase supplies several URL/service secrets automatically. Do not duplicate or expose them in source.

### 5.12 Resend

Resend is the outbound email provider.

The function sends email through:

`https://api.resend.com/emails`

Using Resend:

1. A Resend API key authenticates server-side requests.
2. `REMINDER_FROM_EMAIL` identifies the sender.
3. The owner's `email` is the recipient.
4. Resend tracks delivery.
5. PawRecord records status in `reminders`.

For password-reset and invitation emails:

- Supabase Auth is the sender/originator.
- Custom SMTP can relay through Resend SMTP.
- The testing sender is `onboarding@resend.dev`.
- A custom domain is recommended for production.

The Resend API key must remain server-side.

It must never be placed in Vite variables, GitHub, Vercel frontend variables, browser JavaScript, or documentation.

## 6. Security findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟠 HIGH | `Backend/supabase/migrations/20261104000400_owner_pet_photos.sql` | 30 | Public pet-photo storage bucket exposes photos without authentication | 10/10 |
| 2 | 🟠 HIGH | `Backend/supabase/migrations/20261104000200_security_and_care_rules.sql` | 57 | Staff and vet share unrestricted table-level write access, including roles and owner links | 8/10 |
| 3 | 🟡 MEDIUM | `Frontend/src/pages/AppointmentsPage.tsx` | 316 | Rescheduling inserts a new appointment and updates the old one separately, without a transaction | 10/10 |
| 4 | 🟡 MEDIUM | `Frontend/src/pages/AppointmentsPage.tsx` | 82 | Browser timezone and Asia/Manila clinic timezone can disagree | 9/10 |
| 5 | 🟡 MEDIUM | `Backend/supabase/functions/admin-create-user/index.ts` | 44 | Redirect target is supplied by the client instead of fixed server configuration | 7/10 |
| 6 | 🟡 MEDIUM | `Backend/supabase/functions/send-reminders/index.ts` | 86-158 | Reminder lookup and delivery lacks stronger content/status validation and robust retries | 7/10 |
| 7 | 🟡 MEDIUM | `Frontend/src/pages/AppointmentsPage.tsx` | 603 | Menu and reminder UX should close/clear stale messages predictably after actions | 6/10 |
| 8 | ⚪ LOW | `Frontend/src/pages/*` | Various | Raw database messages remain visible on some non-appointment forms | 8/10 |

## 7. Vulnerability details and remediation

### 7.1 Public pet-photo bucket

Risk:

- Anonymous users can download known public URLs.
- Object enumeration or URL exposure can leak owner/pet information.
- Storage RLS cannot protect objects after the bucket is public.

Remediation:

1. Set bucket `public = false`.
2. Use signed URLs for owner and staff/vet reads.
3. Keep RLS policies for insert/delete.
4. Remove public URL caching for photos.
5. Add a test for anonymous object download.

### 7.2 Vet/staff privilege separation

Risk:

- A vet account can update profiles and owners.
- A vet can relink owner accounts or change account roles.
- This may bypass intended staff-only account administration.

Remediation:

1. Keep staff/vet care-data access.
2. Create staff-only policies for `profiles` and `owners`.
3. Restrict role and owner profile-link updates.
4. Require staff to invoke the invitation function.
5. Add SQL tests showing vets cannot promote users or relink owners.

### 7.3 Rescheduling atomicity

Risk:

- Insert succeeds.
- Old status update fails.
- Two appointments remain active.

Remediation:

Create a PostgreSQL RPC that:

1. Locks the old appointment.
2. Validates status and ownership.
3. Inserts the replacement.
4. Marks the old appointment rescheduled.
5. Returns the new appointment ID.

Do not perform a non-transactional two-request workflow.

### 7.4 Clinic timezone

Risk:

- Browser timezone may differ from clinic timezone.
- Date-only fields and `toISOString()` can shift dates.
- Manila clinic appointments can appear on the wrong date.

Remediation:

1. Define the clinic timezone once as `Asia/Manila`.
2. Construct appointment start/end values with that timezone.
3. Store timestamps in UTC.
4. Format display values in Manila.
5. Test users on UTC, PST, and EDT browsers.

### 7.5 Invitation redirects

Risk:

- Browser-supplied redirect paths increase configuration complexity.
- It could allow an incorrect redirect host if Supabase validation is weak or misconfigured.

Remediation:

1. Store the production URL in an Edge Function secret or fixed allowlisted domain.
2. Do not accept arbitrary redirect URLs from the request body.
3. Use only `/sign-in?mode=set-password`.
4. Verify the Supabase URL allowlist.

### 7.6 Reminder reliability

Risk:

- Email provider failures are only partially visible.
- Retry behavior depends on Resend or cron retries.
- Existing reminders may be in a pending or failed state.

Remediation:

1. Return a stable delivery summary.
2. Add provider message IDs.
3. Preserve failure detail safely.
4. Distinguish duplicate/skipped/sent/failed states.
5. Add a retry limit.
6. Add idempotency checks.

### 7.7 General error handling

Use a shared frontend error mapper for:

- `23P01` schedule conflicts
- `42501` authorization failures
- `23514` constraint failures
- `23503` foreign-key failures
- Supabase Auth rate limits
- SMTP failures
- Network failures

Never show raw SQL policy text or internal constraint names.

## 8. Functional flaw register

### 8.1 Supabase configuration

Verify:

- Hosted URL
- Hosted publishable/anon key
- Site URL
- Additional redirect URLs
- Email confirmation mode
- Custom SMTP
- Auth rate limits

The publishable key is safe for browser use.

The service-role key must never be in Vite variables or frontend code.

### 8.2 Password and invitations

Before production:

- Test invitation email.
- Test reset email.
- Test setting a password.
- Test sign-in after password setup.
- Test an expired or reused reset link.
- Test a reset link from another browser.
- Configure the Vercel domain in Supabase URL settings.

### 8.3 Resend SMTP

The screenshot configuration is structurally correct with:

- Host `smtp.resend.com`
- Port `465`
- Username `resend`
- Resend API key as password
- A valid sender email

If the onboarding sender is used, recipients may need to be verified or the provider may restrict delivery.

For production:

- Verify a custom domain.
- Add SPF, DKIM, and DMARC records.
- Use a sender on that domain.

### 8.4 Automatic reminders

Automatic reminders are not complete until pg_cron and pg_net execute the scheduled Edge Function.

Verify:

1. pg_cron enabled
2. pg_net enabled
3. Vault URL secret
4. Vault cron secret
5. Cron entry
6. Edge Function secrets
7. Owner email addresses
8. Reminder duplicate indexes

The cron schedule can be tested once by invoking `send-reminders` manually with the cron secret.

### 8.5 Owner account linking

Owner visibility depends on:

```text
owners.profile_id = auth.users.id
```

For each owner account:

1. Create or invite Auth user.
2. Create or identify owner row.
3. Set `profile_id`.
4. Confirm profile role is `owner`.
5. Confirm linked pets have matching `owner_id`.
6. Sign in as the owner and verify RLS.

### 8.6 Account role corrections

The known corrected state is:

- `lnapoleon@usa.edu.ph` is owner
- `napoleonluisvpedroso@gmail.com` is vet

This state should be verified again after Auth or database resets.

The reset password account also requires:

- Valid custom SMTP
- Authorized redirect URL
- A real password created through the set-password flow

## 9. Validation results

Validation performed:

- `npm audit --omit=dev`: 0 vulnerabilities
- `npm run lint`: passed
- `npm run build`: passed
- `npm run test:db`: 6 PostgreSQL suites passed

Database suites passed:

- `security_basics.sql`
- `owner_read_smoke.sql`
- `owner_isolation.sql`
- `appointment_constraints.sql`
- `vaccination_rules.sql`
- `hardened_roles_and_reschedule.sql`

All database suite mutations were rolled back.

Not independently verified:

- Hosted Resend delivery
- Hosted Supabase SMTP delivery
- pg_cron execution
- Custom domain DNS
- Vercel production redirect behavior
- Supabase URL allowlist
- Actual browser flows on a hosted account

## 10. Deployment checklist

### Source and CI

- Push to `main`
- GitHub Actions runs lint/build
- Vercel builds with root `dist`
- Vercel SPA fallback is configured
- Do not commit environment secrets

### Supabase database

- Confirm migration history
- Apply pending migrations
- Confirm RLS enabled on every table
- Confirm owner policies
- Confirm vet/staff policies
- Confirm storage policies
- Confirm trigger and exclusion behavior

### Supabase Auth

- Set site URL
- Set redirect URLs
- Configure email confirmation
- Configure custom SMTP
- Configure password reset template
- Test invitation and reset

### Edge Functions

- Deploy `send-reminders`
- Deploy `admin-create-user`
- Set required secrets
- Confirm JWT verification
- Review function logs

### Resend

- Rotate exposed keys
- Add replacement key to Supabase
- Verify sender/domain
- Add SPF/DKIM/DMARC
- Test to Gmail
- Test to a `.edu.ph` recipient

### Scheduler

- Enable pg_cron
- Enable pg_net
- Store URL and cron secret
- Schedule daily reminder task
- Monitor execution logs

## 11. Testing checklist

### Authentication

- Owner sign-in
- Vet sign-in
- Staff sign-in
- Invalid password
- Reset email
- Set-password link
- Expired link
- Invite link
- Logout

### Authorization

- Owner cannot read another owner's pets
- Owner cannot edit a non-photo field
- Owner cannot update another pet
- Vet can read/write clinic care data
- Vet cannot administer roles/owner links after policy separation
- Staff can administer roles/owner links
- Anonymous requests denied

### Appointments

- Create future appointment
- Reject past appointment
- Reject end-before-start
- Reject overlapping vet appointment
- Cancel appointment
- Reschedule and confirm exactly one active schedule
- Owner cannot cancel someone else's appointment

### Pets and storage

- Upload valid image
- Reject oversized file
- Reject non-image
- Owner can only update own pet
- Object accessible only through signed or authorized URL
- Deleting/updating photo does not change unrelated fields

### Records

- Add visit
- Expand visit
- Filter by pet
- Add vaccination
- Vaccination next date calculated
- Filter by pet

### Email

- Manual vaccination reminder
- Manual appointment reminder
- Duplicate reminder skipped
- Failed delivery recorded
- Cron daily execution
- Reset email delivered
- Invitation email delivered

## 12. Recommended implementation order

Priority 1:

1. Private pet-photo bucket
2. Separate staff administration from vet clinic access
3. Atomic rescheduling RPC
4. Clinic timezone helper

Priority 2:

5. Server-fixed invitation redirects
6. Shared frontend error mapper
7. Reset/invite end-to-end verification
8. Resend delivery monitoring

Priority 3:

9. Retry and dead-letter handling for reminders
10. Telemetry/Sentry
11. Full browser E2E tests
12. Production custom email domain

## 13. Safe secret management

Never commit:

- Resend API key
- Supabase service-role key
- Supabase database password
- Cron secret
- Supabase access token

Browser-safe only:

- Supabase URL
- Supabase publishable/anon key

Server-only:

- Supabase service-role key
- Resend API key
- Cron secret
- Database connection password

If a key is pasted into chat or source:

1. Revoke it immediately.
2. Create a replacement.
3. Update only the server secret.
4. Rotate tokens in any environment where they may have been exposed.

## 14. Maintenance guide

To modify clinic data:

1. Make migration under `Backend/supabase/migrations/`
2. Add or update RLS policies
3. Add a PGlite test
4. Run `npm run test:db`
5. Test both owner and staff/vet roles
6. Push and deploy

To modify an Edge Function:

1. Change `Backend/supabase/functions/<name>/index.ts`
2. Validate authorization
3. Add input validation
4. Avoid exposing internal errors
5. Deploy with the Supabase CLI
6. Check function logs

To modify frontend pages:

1. Follow existing Tailwind/theme conventions
2. Keep loading/error/empty states
3. Use RLS-aware Supabase queries
4. Run lint/build
5. Test mobile and desktop

## 15. Final conclusion

PawRecord has a usable React/Supabase architecture and strong database test coverage. It has already implemented meaningful RLS isolation and appointment constraints.

Before public or institutional production use, prioritize:

1. Private pet-photo storage
2. Staff-only account administration
3. Atomic rescheduling
4. Manila timezone normalization
5. Production email-domain verification
6. Complete reset/invite browser testing
