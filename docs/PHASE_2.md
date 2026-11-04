# Phase 2 handoff

Phase 2 adds the authenticated application foundation plus the Overview, Pets,
and pet detail screens.

## Added

- Supabase Auth provider with persisted sessions and profile lookup
- Sign-in route at `/sign-in`
- Protected routes with a profile guard
- Shared PawRecord shell with sidebar, top search bar, clinic label, account menu,
  logout, and responsive navigation
- Overview route at `/`
- Pets route at `/pets`
- Pet detail route at `/pets/:id`
- Loading, empty, error, and unconfigured-Supabase states
- Real Supabase queries for appointments, pets, due vaccines, visits, and owners

## Run

```powershell
Copy-Item .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
npm run dev
```

Local seeded staff login:

```text
manager@pawrecord.test
PawRecordDemo!2026
```

## Verification

```text
npm run lint      PASS
npm run build     PASS
npm run test:db   PASS
```

The UI requires valid Supabase environment variables for sign-in and live data.
Without them, the sign-in screen explains the missing configuration rather than
issuing invalid requests.
