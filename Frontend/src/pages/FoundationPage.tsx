import { ArrowUpRight, Database, Heart, PawPrint, Plus } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { StatCard } from '../components/ui/StatCard';
import { StatusChip } from '../components/ui/StatusChip';
import { clinic } from '../lib/clinic';

const palette = [
  ['Page', 'bg-bg-page', '#FFE4E1'],
  ['Sidebar', 'bg-bg-sidebar', '#FFE9E6'],
  ['Surface', 'bg-surface', '#F8D3D6'],
  ['Inner surface', 'bg-surface-inner', '#FFF1EF'],
  ['Primary', 'bg-primary', '#C8627A'],
  ['Hover', 'bg-primary-hover', '#B5546B'],
];

// This is a theme specimen, not a dashboard with pretend live data.
export function FoundationPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:px-10 sm:py-16">
      <header className="mb-14 flex items-center gap-3">
        <span className="rounded-xl bg-primary p-3 text-white"><PawPrint aria-hidden size={24} /></span>
        <span className="font-heading text-xl font-semibold">PawRecord</span>
        <span className="ml-auto text-sm text-text-muted">{clinic.name}</span>
      </header>
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary-hover">Phase 01 · The foundation</p>
      <h1 className="page-title max-w-xl">A little care.<br />A lasting record.</h1>
      <p className="mt-5 max-w-lg text-sm leading-7 text-text-muted">Your clinic’s visual foundation is ready. This preview checks the palette, type, and reusable elements before the patient screens are built.</p>
      <section aria-label="Design tokens" className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {palette.map(([name, color, hex]) => (
          <div key={name} className="overflow-hidden rounded-xl border border-border bg-surface-inner">
            <div aria-hidden className={`h-16 border-b border-border ${color}`} />
            <div className="p-3"><p className="text-xs font-medium">{name}</p><p className="mt-1 text-[11px] text-text-muted">{hex}</p></div>
          </div>
        ))}
      </section>
      <section aria-label="Component specimens" className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="panel space-y-6 p-6">
          <h2 className="text-sm">Small details, familiar care</h2>
          <div className="flex flex-wrap gap-2"><StatusChip label="Healthy" /><StatusChip label="Due soon" tone="rose" /><StatusChip label="Scheduled" tone="scheduled" /><StatusChip label="Medication" tone="medication" /></div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-inner p-3"><Avatar name="Luna" src="/images/luna.png" /><div><p className="text-sm font-medium">Luna</p><p className="text-xs text-text-muted">Patient avatar specimen</p></div><Heart aria-hidden size={16} className="ml-auto text-primary" /></div>
          <button className="button-primary" type="button" disabled><Plus aria-hidden size={16} /> Book appointment</button>
          <p className="text-xs text-text-muted">Booking becomes available with the appointments phase.</p>
        </div>
        <div className="space-y-4">
          <StatCard icon={Database} label="Clinic data tables" value="8" hint="Profiles, owners, patients, and care records" />
          <div className="panel p-6"><h2 className="text-sm">Up next</h2><p className="mt-3 font-heading text-xl">Sign in, then settle in.</p><p className="mt-2 text-sm leading-6 text-text-muted">Role-aware authentication, the shared app shell, Overview, Pets, and patient details.</p><ArrowUpRight aria-hidden className="mt-4 text-primary" size={20} /></div>
        </div>
      </section>
      <footer className="mt-10 text-xs text-text-muted">Phase 1 preview · Database setup and verification steps are in README.md.</footer>
    </main>
  );
}
