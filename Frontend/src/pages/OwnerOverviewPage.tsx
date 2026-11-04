import { CalendarDays, Clock3, PawPrint, Syringe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusChip } from '../components/ui/StatusChip';
import { supabase } from '../lib/supabase';
import type { Appointment, Pet, VaccineDue } from '../lib/types';

export function OwnerOverviewPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [due, setDue] = useState<VaccineDue[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(supabase ? 'loading' : 'ready');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    void Promise.all([
      supabase.from('pets').select('id, owner_id, name, species, breed, birth_date, sex, photo_url, health_status').order('name'),
      supabase.from('appointments').select('id, pet_id, vet_id, starts_at, ends_at, reason, status, pets(name, photo_url, owners(full_name)), profiles(full_name)').gte('starts_at', new Date().toISOString()).order('starts_at'),
      supabase.from('vaccines_due').select('vaccination_id, pet_id, pet_name, vaccine_name, next_due_on, days_until_due, status').limit(7),
    ]).then(([petResult, appointmentResult, dueResult]) => {
      const failure = petResult.error ?? appointmentResult.error ?? dueResult.error;
      if (failure) { setError(failure.message); setState('error'); return; }
      setPets((petResult.data ?? []) as Pet[]);
      setAppointments((appointmentResult.data ?? []) as unknown as Appointment[]);
      setDue((dueResult.data ?? []) as VaccineDue[]);
      setState('ready');
    });
  }, []);

  if (state === 'loading') return <p className="panel p-5 text-sm text-text-muted">Loading your overview…</p>;
  if (state === 'error') return <p role="alert" className="panel p-5 text-sm text-primary-hover">{error}</p>;

  const todayKey = new Date().toDateString();
  const todayAppointments = appointments.filter((appointment) => new Date(appointment.starts_at).toDateString() === todayKey);
  const nextAppointment = appointments[0];
  const activeDue = due.filter((item) => item.status === 'overdue' || item.days_until_due <= 14);

  return <div className="space-y-7">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your care overview</p>
      <h1 className="page-title mt-3">Good morning.</h1>
      <p className="mt-2 text-sm text-text-muted">Here is everything you need for your pets today.</p>
    </header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="panel p-5"><p className="text-xs text-text-muted">My pets</p><p className="mt-2 font-heading text-3xl">{pets.length}</p><p className="mt-1 text-xs text-text-muted">Linked to your account</p></article>
      <article className="panel p-5"><p className="text-xs text-text-muted">My appointments</p><p className="mt-2 font-heading text-3xl">{appointments.length}</p><p className="mt-1 text-xs text-text-muted">Upcoming visits</p></article>
      <article className="panel p-5"><p className="text-xs text-text-muted">Today</p><p className="mt-2 font-heading text-3xl">{todayAppointments.length}</p><p className="mt-1 text-xs text-text-muted">{todayAppointments.length ? 'Appointment scheduled today' : 'No visits scheduled today'}</p></article>
      <article className="panel p-5"><p className="text-xs text-text-muted">Care reminders</p><p className="mt-2 font-heading text-3xl">{activeDue.length}</p><p className="mt-1 text-xs text-text-muted">{activeDue.length ? 'Needs your attention' : 'Everything is current'}</p></article>
    </section>
    <section className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
      <div className="panel p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-heading text-lg"><CalendarDays size={18} className="text-primary" /> Today’s schedule</h2><Link className="text-xs text-primary" to="/appointments">View appointments →</Link></div>{todayAppointments.length === 0 ? <div className="mt-5 rounded-xl bg-surface-inner p-5"><p className="text-sm font-medium">No appointments today.</p><p className="mt-1 text-xs text-text-muted">You can book your pet’s next visit whenever you are ready.</p><Link className="mt-4 inline-block text-xs text-primary" to="/appointments">Book an appointment →</Link></div> : <div className="mt-4 divide-y divide-border">{todayAppointments.map((appointment) => <div key={appointment.id} className="flex items-center gap-3 py-3"><Clock3 size={16} className="text-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{appointment.reason}</p><p className="text-xs text-text-muted">{appointment.pets.name} · {new Date(appointment.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p></div><StatusChip label={appointment.status} /></div>)}</div>}</div>
      <div className="panel p-5"><h2 className="flex items-center gap-2 font-heading text-lg"><Syringe size={18} className="text-primary" /> Care reminders</h2>{activeDue.length === 0 ? <p className="mt-5 rounded-xl bg-surface-inner p-4 text-sm text-text-muted">No vaccinations are due soon.</p> : <div className="mt-4 space-y-3">{activeDue.slice(0, 4).map((item) => <div key={item.vaccination_id} className="rounded-xl bg-surface-inner p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{item.vaccine_name}</p><StatusChip label={item.status === 'overdue' ? 'Overdue' : `Due in ${item.days_until_due} days`} tone="rose" /></div><p className="mt-1 text-xs text-text-muted">{item.pet_name} · {item.next_due_on}</p></div>)}</div>}<Link className="mt-5 inline-block text-xs text-primary" to="/vaccinations">View vaccination records →</Link></div>
    </section>
    <section className="panel p-5"><h2 className="flex items-center gap-2 font-heading text-lg"><PawPrint size={18} className="text-primary" /> My pets</h2>{pets.length === 0 ? <p className="mt-4 text-sm text-text-muted">No pets are linked to your account yet.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pets.map((pet) => <Link key={pet.id} to="/owner-portal" className="rounded-xl bg-surface-inner p-4 transition-colors hover:bg-status-rose"><p className="text-sm font-medium">{pet.name}</p><p className="mt-1 text-xs text-text-muted">{pet.species} · {pet.breed ?? 'Mixed breed'}</p><p className="mt-2 text-xs text-text-muted">Health: {pet.health_status.replace('_', ' ')}</p></Link>)}</div>}</section>
    {nextAppointment && <p className="text-xs text-text-muted">Next appointment: {nextAppointment.pets.name} · {new Date(nextAppointment.starts_at).toLocaleString()}.</p>}
  </div>;
}
