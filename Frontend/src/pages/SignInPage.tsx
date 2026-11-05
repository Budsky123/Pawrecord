import { Eye, EyeOff, PawPrint } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const petFacts = [
  'Cats spend around 30–50% of their day grooming themselves.',
  'Dogs can learn more than 100 words and gestures with consistent training.',
  'A dog’s nose print is unique, much like a human fingerprint.',
  'Rabbits purr softly when they feel safe and content.',
  'Regular dental care helps pets stay healthier for longer.',
];

type Mode = 'sign-in' | 'sign-up' | 'reset';

export function SignInPage() {
  const { session, signIn, signUp, resetPassword, configurationError } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fact] = useState(() => petFacts[Math.floor(Math.random() * petFacts.length)]);

  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const result = mode === 'sign-in'
      ? await signIn(email, password)
      : mode === 'sign-up'
        ? await signUp(email, password, fullName)
        : await resetPassword(email);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (mode === 'sign-up') {
      setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
      setMode('sign-in');
      setPassword('');
    } else if (mode === 'reset') {
      setMessage('Password reset instructions were sent if this email has an account.');
      setMode('sign-in');
    }
  };

  const title = mode === 'sign-in' ? 'Welcome back' : mode === 'sign-up' ? 'Create your account' : 'Reset your password';
  const submitLabel = mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Sign up' : 'Send reset link';

  return <main className="flex min-h-screen items-center justify-center bg-bg-page p-4 sm:p-8">
    <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-surface-inner shadow-primary lg:grid-cols-2">
      <div className="p-6 sm:p-10 lg:p-14">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-primary p-3 text-white"><PawPrint /></span><span className="font-heading text-2xl font-semibold">PawRecord</span></div>
        <p className="mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{title}</p>
        <h1 className="page-title mt-3 text-3xl sm:text-4xl">{mode === 'sign-in' ? 'Care starts here.' : mode === 'sign-up' ? 'Join your pet care home.' : 'We can help you back in.'}</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">{mode === 'reset' ? 'Enter your email and we will send a secure password reset link.' : 'Sign in to your warm, simple pet care workspace.'}</p>
        {configurationError && <p className="mt-5 rounded-xl border border-border bg-surface p-3 text-sm text-text-muted">{configurationError}</p>}
        {message && <p role="status" className="mt-5 rounded-xl border border-border bg-status-neutral p-3 text-sm text-primary-hover">{message}</p>}
        <form className="mt-7 space-y-4" onSubmit={submit}>
          {mode === 'sign-up' && <label className="block text-sm">Your name<input className="field mt-2" type="text" required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}
          <label className="block text-sm">Email<input className="field mt-2" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {mode !== 'reset' && <label className="block text-sm">Password<div className="relative mt-2"><input className="field pr-11" type={showPassword ? 'text' : 'password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}
          {error && <p role="alert" className="text-sm text-primary-hover">{error}</p>}
          <button className="button-primary w-full" type="submit">{submitLabel}</button>
        </form>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          {mode === 'sign-in' && <><button type="button" className="text-text-muted hover:text-primary" onClick={() => changeMode('reset')}>Forgot password?</button><button type="button" className="font-medium text-primary hover:text-primary-hover" onClick={() => changeMode('sign-up')}>Create an account</button></>}
          {mode !== 'sign-in' && <button type="button" className="font-medium text-primary hover:text-primary-hover" onClick={() => changeMode('sign-in')}>Back to sign in</button>}
        </div>
      </div>
      <aside className="flex min-h-64 flex-col justify-center bg-primary p-8 text-white sm:p-12 lg:min-h-full lg:p-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/75">PawRecord</p>
        <h2 className="mt-5 font-heading text-4xl font-semibold leading-tight sm:text-5xl">Hello, Pawrent!</h2>
        <p className="mt-5 max-w-md text-sm leading-7 text-white/85">A friendly place to keep every appointment, record, and little milestone close at paw.</p>
        <div className="mt-10 rounded-2xl border border-white/25 bg-white/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Pet fact</p><p className="mt-3 text-sm leading-6">{fact}</p></div>
      </aside>
    </section>
  </main>;
}
