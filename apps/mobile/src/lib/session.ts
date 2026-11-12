import { getMyProfile } from '@booksyde/shared';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type Profile = Awaited<ReturnType<typeof getMyProfile>>;
type Client = NonNullable<typeof supabase>;
type Session = Awaited<ReturnType<Client['auth']['getSession']>>['data']['session'];

/** The current Supabase session and the reader's profile; updates on sign-in/out. */
export function useSession() {
  const [state, setState] = useState<{ session: Session | null; profile: Profile; loading: boolean }>({
    session: null,
    profile: null,
    loading: Boolean(supabase),
  });

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    const load = async (session: Session | null) => {
      const profile = session ? await getMyProfile(client).catch(() => null) : null;
      if (!cancelled) setState({ session, profile, loading: false });
    };
    client.auth.getSession().then(({ data }) => load(data.session));
    // Supabase recommends not awaiting other Supabase calls inside this callback.
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => load(session), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
