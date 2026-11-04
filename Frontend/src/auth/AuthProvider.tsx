import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  configurationError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [configurationError, setConfigurationError] = useState<string | null>(
    supabase ? null : 'Supabase is not configured. Copy .env.example to .env.local and add the project URL and anon key.',
  );

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    const loadProfile = async (nextSession: Session | null) => {
      if (!nextSession) {
        if (active) {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const client = supabase;
      if (!client) return;
      const { data, error } = await client.from('profiles').select('id, full_name, role, phone').eq('id', nextSession.user.id).maybeSingle();
      if (!active) return;
      setSession(nextSession);
      setProfile(data as Profile | null);
      setConfigurationError(error ? `Could not load your profile: ${error.message}` : null);
      setLoading(false);
    };
    void supabase.auth.getSession().then(({ data }) => loadProfile(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void loadProfile(nextSession);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session, profile, loading, configurationError,
    signIn: async (email, password) => {
      if (!supabase) return { error: configurationError ?? 'Supabase is not configured.' };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      if (!supabase) return { error: configurationError ?? 'Supabase is not configured.' };
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      return { error: error?.message ?? null };
    },
  }), [configurationError, loading, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The provider and hook intentionally share one context module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
