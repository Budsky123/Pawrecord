-- Appointment workflow statuses used by the staff/vet attendance controls.
alter type public.appointment_status add value if not exists 'rescheduled';
