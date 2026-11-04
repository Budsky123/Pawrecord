import { CalendarPlus, ClipboardList, ImagePlus, PawPrint, Syringe } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/ui/Avatar';
import { StatusChip } from '../components/ui/StatusChip';
import { supabase } from '../lib/supabase';
import type { Appointment, Pet, VaccineDue, Visit } from '../lib/types';

export function OwnerPortalPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [due, setDue] = useState<VaccineDue[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(supabase ? 'loading' : 'ready');
  const [error, setError] = useState('');
  const [uploadingPetId, setUploadingPetId] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const uploadPetPhoto = async (pet: Pet, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!supabase || !file) return;
    if (!file.type.startsWith('image/')) {
      setUploadMessage('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadMessage('Please choose an image smaller than 5 MB.');
      return;
    }
    setUploadingPetId(pet.id);
    setUploadMessage('');
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${pet.owner_id}/${pet.id}.${extension}`;
    const upload = await supabase.storage.from('pet-photos').upload(path, file, { upsert: true, contentType: file.type });
    if (upload.error) {
      setUploadMessage(upload.error.message);
      setUploadingPetId(null);
      return;
    }
    const { data } = supabase.storage.from('pet-photos').getPublicUrl(path);
    const photoUrl = `${data.publicUrl}?v=${Date.now()}`;
    const update = await supabase.from('pets').update({ photo_url: photoUrl }).eq('id', pet.id);
    if (update.error) setUploadMessage(update.error.message);
    else {
      setPets((current) => current.map((item) => item.id === pet.id ? { ...item, photo_url: photoUrl } : item));
      setUploadMessage(`${pet.name}'s profile picture was updated.`);
    }
    setUploadingPetId(null);
  };

  useEffect(() => {
    if (!supabase) return;
    void Promise.all([
      supabase.from('pets').select('id, owner_id, name, species, breed, birth_date, sex, photo_url, health_status').order('name'),
      supabase.from('appointments').select('id, pet_id, vet_id, starts_at, ends_at, reason, status, pets(name, photo_url, owners(full_name)), profiles(full_name)').gte('starts_at', new Date().toISOString()).order('starts_at'),
      supabase.from('visits').select('id, visit_date, reason, category, diagnosis, treatment, notes, pets(name, photo_url), profiles(full_name)').is('deleted_at', null).order('visit_date', { ascending: false }).limit(6),
      supabase.from('vaccines_due').select('vaccination_id, pet_id, pet_name, vaccine_name, next_due_on, days_until_due, status').limit(7),
    ]).then(([petResult, appointmentResult, visitResult, dueResult]) => {
      const failure = petResult.error ?? appointmentResult.error ?? visitResult.error ?? dueResult.error;
      if (failure) { setError(failure.message); setState('error'); return; }
      setPets((petResult.data ?? []) as Pet[]);
      setAppointments((appointmentResult.data ?? []) as unknown as Appointment[]);
      setVisits((visitResult.data ?? []) as unknown as Visit[]);
      setDue((dueResult.data ?? []) as VaccineDue[]);
      setState('ready');
    });
  }, []);

  if (state === 'loading') return <p className="panel p-5 text-sm text-text-muted">Loading your pet portal…</p>;
  if (state === 'error') return <p role="alert" className="panel p-5 text-sm text-primary-hover">{error}</p>;
  const primaryPet = pets[0];
  const nextAppointment = appointments[0];

  return <div className="space-y-7">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Owner portal</p>
      <h1 className="page-title mt-3">{primaryPet ? `Welcome back. ${primaryPet.name}'s care is here.` : 'Your pet care, all in one place.'}</h1>
      <p className="mt-2 text-sm text-text-muted">Review your pets, upcoming visits, health history, and preventive care.</p>
    </header>
    {pets.length === 0 ? <section className="panel p-8 text-center"><PawPrint className="mx-auto text-primary" /><p className="mt-3 text-sm text-text-muted">No pets are linked to your owner account yet.</p></section> : <>
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="panel p-5"><p className="text-xs text-text-muted">My pets</p><p className="mt-2 font-heading text-3xl">{pets.length}</p><p className="mt-1 text-xs text-text-muted">Linked to your account</p></article>
        <article className="panel p-5"><p className="text-xs text-text-muted">Upcoming visits</p><p className="mt-2 font-heading text-3xl">{appointments.length}</p><p className="mt-1 text-xs text-text-muted">Scheduled appointments</p></article>
        <article className="panel p-5"><p className="text-xs text-text-muted">Care items due</p><p className="mt-2 font-heading text-3xl">{due.length}</p><p className="mt-1 text-xs text-text-muted">Vaccinations needing attention</p></article>
      </section>
      <section className="panel flex flex-wrap items-center gap-5 p-6">
        <div className="relative"><Avatar name={primaryPet.name} src={primaryPet.photo_url} className="h-24 w-24 text-2xl" /><button type="button" aria-label={`Upload a profile picture for ${primaryPet.name}`} onClick={() => fileInputs.current[primaryPet.id]?.click()} className="absolute -bottom-1 -right-1 rounded-full bg-primary p-2 text-white shadow-primary hover:bg-primary-hover"><ImagePlus size={14} /></button><input ref={(element) => { fileInputs.current[primaryPet.id] = element; }} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadPetPhoto(primaryPet, event)} /></div>
        <div className="min-w-0 flex-1"><p className="text-sm text-text-muted">{primaryPet.species} · {primaryPet.breed ?? 'Mixed breed'}</p><h2 className="font-heading text-2xl">{primaryPet.name}</h2><p className="mt-1 text-xs text-text-muted">{primaryPet.birth_date ? `Born ${primaryPet.birth_date}` : 'Birth date not recorded'}</p><StatusChip label={primaryPet.health_status.replace('_', ' ')} tone="neutral" /><p className="mt-2 text-xs text-text-muted">Click the camera button to update the photo.</p></div>
        <Link to="/appointments?book=1" className="button-primary"><CalendarPlus size={16} /> Book a visit</Link>
      </section>
      {uploadMessage && <p role="status" className="rounded-xl border border-border bg-surface-inner p-3 text-sm text-primary-hover">{uploadMessage}</p>}
      {pets.length > 1 && <section><div className="mb-3 flex items-center justify-between"><h2 className="font-heading text-lg">My pets</h2><Link className="text-xs text-primary" to="/medical-records">View care records →</Link></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pets.map((pet) => <article key={pet.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"><div className="relative"><Avatar name={pet.name} src={pet.photo_url} className="h-12 w-12" /><button type="button" aria-label={`Upload a profile picture for ${pet.name}`} onClick={() => fileInputs.current[pet.id]?.click()} className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1.5 text-white hover:bg-primary-hover"><ImagePlus size={11} /></button><input ref={(element) => { fileInputs.current[pet.id] = element; }} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadPetPhoto(pet, event)} /></div><div><p className="text-sm font-medium">{pet.name}</p><p className="text-xs text-text-muted">{pet.species} · {pet.breed ?? 'Mixed breed'}</p><p className="mt-1 text-xs text-text-muted">{uploadingPetId === pet.id ? 'Uploading…' : pet.health_status.replace('_', ' ')}</p></div></article>)}</div></section>}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="panel p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-heading text-lg"><CalendarPlus size={17} className="text-primary" /> Next appointment</h2><Link className="text-xs text-primary" to="/appointments">View all →</Link></div>{nextAppointment ? <div className="mt-4 rounded-xl bg-surface-inner p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{nextAppointment.reason}</p><p className="mt-1 text-xs text-text-muted">{nextAppointment.pets.name} · {new Date(nextAppointment.starts_at).toLocaleString()}</p><p className="mt-1 text-xs text-text-muted">Vet: {nextAppointment.profiles?.full_name ?? 'Clinic team'}</p></div><StatusChip label={nextAppointment.status} /></div></div> : <p className="mt-4 rounded-xl bg-surface-inner p-4 text-sm text-text-muted">No upcoming appointments. Book your pet's next visit when ready.</p>}</div>
        <div className="panel p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-heading text-lg"><Syringe size={17} className="text-primary" /> Preventive care</h2><Link className="text-xs text-primary" to="/vaccinations">View all →</Link></div>{due.length === 0 ? <p className="mt-4 rounded-xl bg-surface-inner p-4 text-sm text-text-muted">All vaccination care is current.</p> : <div className="mt-4 space-y-3">{due.slice(0, 4).map((item) => <div key={item.vaccination_id} className="flex items-center justify-between rounded-xl bg-surface-inner p-3"><div><p className="text-sm font-medium">{item.vaccine_name}</p><p className="text-xs text-text-muted">{item.pet_name} · Due {item.next_due_on}</p></div><StatusChip label={item.status === 'overdue' ? 'Overdue' : `${item.days_until_due} days`} tone="rose" /></div>)}</div>}</div>
      </section>
      <section className="panel p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-heading text-lg"><ClipboardList size={17} className="text-primary" /> Recent care history</h2><Link className="text-xs text-primary" to="/medical-records">View records →</Link></div>{visits.length === 0 ? <p className="mt-4 rounded-xl bg-surface-inner p-4 text-sm text-text-muted">No medical records have been added yet.</p> : <div className="mt-4 divide-y divide-border">{visits.map((visit) => <article key={visit.id} className="flex items-start gap-3 py-3"><span className="mt-1 h-2 w-2 rounded-full bg-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{visit.reason}</p><p className="mt-1 text-xs text-text-muted">{visit.pets?.name ?? 'Pet'} · {new Date(visit.visit_date).toLocaleDateString()} · {visit.profiles?.full_name ?? 'Clinic team'}</p>{visit.diagnosis && <p className="mt-2 text-xs text-text-muted">{visit.diagnosis}</p>}</div><span className="rounded-full bg-surface-inner px-2.5 py-1 text-xs">{visit.category}</span></article>)}</div>}</section>
    </>}
  </div>;
}
