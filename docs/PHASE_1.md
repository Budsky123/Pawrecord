# Phase 1 handoff

## Files created

| Group | Files |
| --- | --- |
| Toolchain | package.json; Frontend Vite, Tailwind, PostCSS and TypeScript configs; Frontend/index.html; .gitignore; .env.example |
| React foundation | Frontend/src/main.tsx; Frontend/src/app/App.tsx; Frontend/src/pages/FoundationPage.tsx; Frontend/src/styles/index.css |
| Shared UI | Frontend/src/components/ui/Avatar.tsx; StatCard.tsx; StatusChip.tsx |
| Client setup | Frontend/src/lib/supabase.ts; Frontend/src/lib/clinic.ts; Frontend/src/vite-env.d.ts |
| Schema | Backend/supabase/migrations/20261104000100_clinic_schema.sql |
| RLS/care rules | Backend/supabase/migrations/20261104000200_security_and_care_rules.sql |
| Local database | Backend/supabase/config.toml; Backend/supabase/seed.sql |
| SQL verification | Five files in Backend/supabase/tests/; Backend/scripts/test-database.mjs; Backend/scripts/fixtures/supabase-auth.sql |
| Asset/docs | Frontend/public/images/luna.png; README.md; docs/PHASE_1.md; feature/function boundary notes |

## Verification in the creation workspace

- Passed: JavaScript/config syntax checks with Node; JSON parsing of the package
  manifest and all TypeScript configuration files; Supabase TOML parsing.
- Reviewed: owner policies, cancellation transitions, invoker view security,
  exclusion/duplicate constraints, vaccine triggers and seed references.
- Blocked: dependency installation and lockfile generation; registry.npmjs.org
  could not be resolved. ESLint, TypeScript/Vite build and the PGlite suites
  therefore could not run.
- Unavailable: Docker, PostgreSQL/psql and the Supabase CLI. Actual local Auth
  login and Supabase migrations/seed have not been exercised here. No hosted
  database was changed.
- No lockfile was fabricated. Generate and commit package-lock.json after the
  first successful install before adding npm ci to CI.

## Run and test

Follow README.md: install dependencies, preview with `npm run dev`, then run
lint, build and `npm run test:db`. With Docker, start/reset local Supabase and
run the short owner-isolation script in Studio. The README lists demo logins
and expected seed counts.

## Next

Resolve installation/test blockers and fix any resulting failures first. After
your go-ahead, Phase 2 adds sign-in, role guards, shared navigation, Overview,
Pets and patient detail. No later phase is implemented in this deliverable.
