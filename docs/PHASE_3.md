# Phase 3 handoff

Phase 3 adds the clinic's medical-history and immunization workflows.

## Added

- Medical records route at `/medical-records`
- Vaccinations route at `/vaccinations`
- Staff and vet forms for adding visit records
- Staff and vet forms for recording administered vaccines
- Real Supabase queries with loading, empty, and error states
- Vaccination status display based on the database-calculated `next_due_on`
- Existing pet detail page continues to show the patient's care history

The database trigger remains authoritative for vaccine due dates. The frontend
does not accept or calculate `next_due_on`.

## Verification

```text
npm run lint      PASS
npm run build     PASS
npm run test:db   PASS
```

Owners retain read-only access through the existing RLS policies and do not see
the add-record controls.
