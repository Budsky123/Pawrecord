import { Bell, CalendarDays, ChevronDown, Grid2X2, LogOut, PawPrint, Search, Settings, ShieldCheck, Stethoscope, Syringe, Users } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { clinic } from '../../lib/clinic';
import { Avatar } from '../ui/Avatar';

const navItems = [
  { to: '/', label: 'Overview', icon: Grid2X2 },
  { to: '/pets', label: 'Pets', icon: PawPrint },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/medical-records', label: 'Medical records', icon: Stethoscope },
  { to: '/vaccinations', label: 'Vaccinations', icon: Syringe },
  { to: '/reports', label: 'Reports', icon: ShieldCheck },
  { to: '/owner-portal', label: 'Owner portal', icon: Users },
  { to: '/administration', label: 'Administration', icon: Settings },
];

export function AppShell() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [dueCount, setDueCount] = useState<number | null>(supabase ? null : 0);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ label: string; detail: string; to: string }>>([]);
  const initials = profile?.full_name ?? 'Clinic manager';
  const visibleNavItems = navItems.filter(({ label }) => profile?.role === 'owner'
    ? ['Overview', 'Owner portal', 'Appointments', 'Medical records', 'Vaccinations'].includes(label)
    : label !== 'Owner portal' && (profile?.role === 'staff' || profile?.role === 'vet' || label !== 'Administration'));
  useEffect(() => {
    if (!supabase) return;
    void supabase.from('vaccines_due').select('vaccination_id', { count: 'exact', head: true }).then(({ count }) => {
      setDueCount(count ?? 0);
    });
  }, []);

  useEffect(() => {
    const term = search.trim();
    if (!supabase || term.length < 2) return;
    let active = true;
    const pattern = `%${term}%`;
    void Promise.all([
      supabase.from('pets').select('id, name, species').ilike('name', pattern).limit(5),
      supabase.from('owners').select('id, full_name').ilike('full_name', pattern).limit(5),
      supabase.from('visits').select('id, reason, visit_date, pets(name)').ilike('reason', pattern).is('deleted_at', null).limit(5),
    ]).then(([pets, owners, visits]) => {
      if (!active) return;
      const results: Array<{ label: string; detail: string; to: string }> = [];
      (pets.data ?? []).forEach((pet) => results.push({ label: pet.name, detail: `${pet.species} · Pet`, to: `/pets/${pet.id}` }));
      (owners.data ?? []).forEach((owner) => results.push({ label: owner.full_name, detail: 'Owner', to: '/administration' }));
      (visits.data ?? []).forEach((visit) => results.push({ label: visit.reason, detail: `${visit.pets?.[0]?.name ?? 'Pet'} · Medical record`, to: '/medical-records' }));
      setSearchResults(results);
    });
    return () => { active = false; };
  }, [search]);

  const logout = async () => {
    setLogoutError(null);
    const result = await signOut();
    if (result.error) {
      setLogoutError(result.error);
      return;
    }
    setMenuOpen(false);
    navigate('/sign-in', { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg-page md:flex">
      <aside className="flex w-full shrink-0 flex-col bg-bg-sidebar p-3 md:fixed md:inset-y-0 md:w-60 md:p-5">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="rounded-xl bg-primary p-2 text-white"><PawPrint size={18} /></span>
          <span className="font-heading text-lg font-semibold">PawRecord</span>
        </div>
        <nav className="mt-6 flex gap-1 overflow-x-auto pb-1 md:mt-8 md:block md:space-y-1 md:pb-0">
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${isActive ? 'bg-surface-inner font-medium text-primary' : 'text-text-muted hover:bg-status-rose hover:text-primary'}`}>
              <Icon size={16} /><span>{label}</span>{label === 'Vaccinations' && dueCount !== null && dueCount > 0 && <span className="ml-auto animate-bounce rounded-full bg-primary px-1.5 text-[10px] text-white" aria-label={`${dueCount} vaccinations due`}>{dueCount}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <div className="relative mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface-inner/70 px-3 py-3">
            <Avatar name={initials} className="h-11 w-11 text-sm" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{initials}</p><p className="text-xs capitalize text-text-muted">{profile?.role ?? 'Clinic manager'}</p></div>
            <button type="button" aria-label="Account menu" onClick={() => setMenuOpen(!menuOpen)} className="text-text-muted hover:text-primary"><ChevronDown size={16} /></button>
            {menuOpen && <button type="button" onClick={() => void logout()} className="absolute bottom-10 right-0 z-10 flex items-center gap-2 rounded-xl border border-border bg-surface-inner px-3 py-2 text-xs text-text-primary shadow-sm"><LogOut size={14} /> Log out</button>}
          </div>
          {logoutError && <p role="alert" className="mt-2 text-xs text-primary-hover">{logoutError}</p>}
        </div>
      </aside>
      <div className="min-w-0 flex-1 md:ml-60">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-surface-inner px-4 sm:h-16 sm:gap-4 sm:px-5">
          <div className="relative min-w-0 max-w-md flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} /><input className="field h-9 min-h-0 pl-9 text-xs sm:text-sm" placeholder="Search pets, owners, or records..." aria-label="Search pets, owners, or records" value={search} onChange={(event) => { const value = event.target.value; setSearch(value); if (value.trim().length < 2) setSearchResults([]); }} />{search.trim().length >= 2 && <div className="absolute left-0 right-0 top-11 z-20 overflow-hidden rounded-xl border border-border bg-surface-inner shadow-sm">{searchResults.length === 0 ? <p className="p-3 text-xs text-text-muted">No matching records.</p> : searchResults.map((result) => <Link key={`${result.to}-${result.label}`} to={result.to} onClick={() => setSearch('')} className="block border-b border-border px-3 py-2 last:border-0 hover:bg-status-rose"><p className="text-sm font-medium">{result.label}</p><p className="text-xs text-text-muted">{result.detail}</p></Link>)}</div>}</div>
          <button type="button" aria-label="View vaccination reminders" onClick={() => navigate('/vaccinations')} className="text-text-muted hover:text-primary"><Bell size={17} /></button>
          <div className="hidden border-l border-border pl-5 text-xs font-medium tracking-wide text-text-primary sm:block">{clinic.name}</div>
        </header>
        <main className="p-4 sm:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
