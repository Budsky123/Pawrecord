import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, PawPrint } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export function SignInPage() {
  const { session, signIn, configurationError } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const result = await signIn(email, password);
    if (result.error) setError(result.error);
  };
  return <main className="flex min-h-screen items-center justify-center bg-bg-page p-5"><section className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-primary">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-primary p-3 text-white"><PawPrint /></span><span className="font-heading text-2xl font-semibold">PawRecord</span></div>
    <p className="mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Welcome back</p><h1 className="page-title mt-3 text-3xl">Care starts here.</h1><p className="mt-3 text-sm text-text-muted">Sign in to your clinic workspace.</p>
    {configurationError && <p className="mt-5 rounded-xl border border-border bg-surface-inner p-3 text-sm text-text-muted">{configurationError}</p>}
    <form className="mt-6 space-y-4" onSubmit={submit}><label className="block text-sm">Email<input className="field mt-2" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="block text-sm">Password<div className="relative mt-2"><input className="field pr-11" type={showPassword ? 'text' : 'password'} required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>{error && <p role="alert" className="text-sm text-primary-hover">{error}</p>}<button className="button-primary w-full" type="submit" disabled={!configurationError && false}>Sign in</button></form>
  </section></main>;
}
