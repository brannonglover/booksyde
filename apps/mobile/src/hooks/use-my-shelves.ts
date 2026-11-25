import { getProfileShelves } from '@booksyde/shared';
import type { ReadingStatus } from '@booksyde/types';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useAsync } from '@/hooks/use-async';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export type MyShelves = Awaited<ReturnType<typeof getProfileShelves>>;
export type MyShelfBook = MyShelves['books']['read'][number];

/** The reader's shelves, in the order the Shelves tab lists them, with a line on what each holds. */
export const MY_SHELVES: { status: ReadingStatus; title: string; blurb: string; empty: string }[] = [
  { status: 'reading', title: 'Reading now', blurb: 'What’s open on your nightstand', empty: 'Nothing open right now.' },
  { status: 'want_to_read', title: 'Want to read', blurb: 'Books waiting their turn', empty: 'No books waiting yet.' },
  { status: 'read', title: 'Read', blurb: 'Everything you’ve finished', empty: 'No finished books yet.' },
  { status: 'did_not_finish', title: 'Did not finish', blurb: 'The ones you set down', empty: 'Nothing set down. Nice.' },
];

export function isShelfStatus(value: unknown): value is ReadingStatus {
  return MY_SHELVES.some((s) => s.status === value);
}

/**
 * The signed-in reader's own shelves. Reloads each time the screen comes back
 * into view, so a book shelved on another screen shows up here.
 */
export function useMyShelves() {
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const { data, loading, error, reload } = useAsync<MyShelves>(
    supabase && userId ? () => getProfileShelves(supabase!, userId, 1000) : null,
    [userId],
  );
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  return { signedIn: Boolean(userId), sessionLoading, shelves: data, loading, error, reload };
}
