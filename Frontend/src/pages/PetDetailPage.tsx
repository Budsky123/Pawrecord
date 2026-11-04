import { ArrowLeft, CalendarDays, FileText, Syringe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../components/ui/Avatar';
import { StatusChip } from '../components/ui/StatusChip';
import { supabase } from '../lib/supabase';
import type { Pet, Visit, VaccineDue } from '../lib/types';

export function PetDetailPage() {
  const { id } = useParams();
  const [pet, setPet] = useState<Pet | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [vaccines, setVaccines] = useState<VaccineDue[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(supabase ? 'loading' : 'ready');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id || !supabase) return;
    void Promise.all([
      supabase.from('pets').select('id, owner_id, name, species, breed, birth_date, sex, photo_url, health_status, owners(full_name, email)').eq('id', id).single(),
      supabase.from('visits').select('id, visit_date, reason, category, diagnosis, treatment, notes, profiles(full_name)').eq('pet_id', id).is('deleted_at', null).order('visit_date', { ascending: false }),
      supabase.from('vaccines_due').select('vaccination_id, pet_id, pet_name, vaccine_name, next_due_on, days_until_due, status').eq('pet_id', id),
    ]).then(([petResult, visitsResult, vaccineResult]) => {
      const failure = petResult.error ?? visitsResult.error ?? vaccineResult.error;
      if (failure) { setError(failure.message); setState('error'); return; }
      setPet(petResult.data as unknown as Pet); setVisits((visitsResult.data ?? []) as unknown as Visit[]); setVaccines((vaccineResult.data ?? []) as VaccineDue[]); setState('ready');
    });
  }, [id]);
  if (state === 'loading') return <p className="panel p-5 text-sm text-text-muted">Loading patient details…</p>;
  if (state === 'error') return <p role="alert" className="rounded-xl border border-border bg-surface-inner p-5 text-sm text-primary-hover">{error}</p>;
  if (!pet) return <div className="space-y-4"><Link to="/pets" className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft size={16} /> Back to pets</Link><p className="panel p-5 text-sm text-text-muted">Patient not found.</p></div>;
  return <div className="space-y-7"><Link to="/pets" className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft size={16} /> Back to pets</Link><section className="panel flex flex-wrap items-center gap-5 p-6"><Avatar name={pet.name} src={pet.photo_url} className="h-20 w-20 text-xl" /><div className="flex-1"><p className="text-xs uppercase tracking-[0.2em] text-primary">Patient profile</p><h1 className="page-title mt-2">{pet.name}</h1><p className="mt-1 text-sm text-text-muted">{pet.breed ?? pet.species} · Owner: {pet.owners?.full_name ?? 'Unassigned'}</p></div><StatusChip label={pet.health_status === 'follow_up' ? 'Follow-up' : pet.health_status === 'medication' ? 'Medication' : 'Healthy'} tone={pet.health_status === 'healthy' ? 'neutral' : 'rose'} /></section>
    <div className="grid gap-5 lg:grid-cols-2"><section className="panel p-5"><div className="flex items-center justify-between"><h2 className="font-heading text-lg">Medical history</h2><FileText size={18} className="text-primary" /></div>{visits.length === 0 ? <p className="mt-5 text-sm text-text-muted">No medical records yet.</p> : <div className="mt-4 space-y-4">{visits.map((visit) => <div key={visit.id} className="border-l-2 border-border pl-4"><p className="text-sm font-medium">{visit.reason}</p><p className="mt-1 text-xs text-text-muted">{new Date(visit.visit_date).toLocaleDateString()} · {visit.profiles?.full_name ?? 'Veterinary team'}</p>{visit.diagnosis && <p className="mt-2 text-sm text-text-muted">{visit.diagnosis}</p>}</div>)}</div>}</section><section className="panel p-5"><div className="flex items-center justify-between"><h2 className="font-heading text-lg">Vaccinations</h2><Syringe size={18} className="text-primary" /></div>{vaccines.length === 0 ? <p className="mt-5 text-sm text-text-muted">No vaccinations due soon.</p> : <div className="mt-4 divide-y divide-border">{vaccines.map((vaccine) => <div key={vaccine.vaccination_id} className="flex items-center gap-3 py-3"><CalendarDays size={16} className="text-primary" /><div className="flex-1"><p className="text-sm font-medium">{vaccine.vaccine_name}</p><p className="text-xs text-text-muted">Due {vaccine.next_due_on}</p></div><StatusChip label={vaccine.status === 'overdue' ? 'Overdue' : 'Due soon'} tone="rose" /></div>)}</div>}</section></div>
  </div>;
}
