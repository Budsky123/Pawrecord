# Phase 4 handoff

Phase 4 adds the appointment scheduling workflow.

## Added

- Appointments route at `/appointments`
- Monday-Friday weekday tab strip
- Appointment list grouped by selected day
- New appointment form for staff, vets, and owners
- Vet directory lookup through the restricted `list_veterinarians` RPC for owners
- Owner bookings are created as `pending`
- Staff and vet bookings are created as `confirmed`
- Appointment cancellation action
- Friendly database double-booking message for exclusion constraint error `23P01`
- Loading, empty, and error states

The database exclusion constraint remains authoritative for preventing overlapping
appointments for the same vet.

## Verification

```text
npm run lint      PASS
npm run build     PASS
npm run test:db   PASS
npm audit         PASS — 0 vulnerabilities
```
