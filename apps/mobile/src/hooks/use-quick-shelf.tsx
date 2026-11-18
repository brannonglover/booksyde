import { getMyReadingStatus, removeFromShelves, setReadingStatus } from '@booksyde/shared';
import type { ReadingStatus } from '@booksyde/types';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { ShelfStatusSheet } from '@/components/shelf-status-sheet';
import { supabase } from '@/lib/supabase';

type Target = { id: string; title: string; status?: ReadingStatus | null; signedOut?: boolean };

/**
 * The quick shelf menu for covers anywhere in the app: `open(book)` (from a
 * long press) shows a sheet that looks up the reader's shelf for the book and
 * lets them put it on a shelf, move it, or take it off. Render `sheet` once on
 * the screen.
 */
export function useQuickShelf() {
  const router = useRouter();
  const [target, setTarget] = useState<Target | null>(null);
  // The book the latest lookup is for, so a slow answer for an earlier one is ignored.
  const current = useRef<string | null>(null);

  function open(book: { id: string; title: string }) {
    if (!supabase) return;
    const client = supabase;
    current.current = book.id;
    setTarget({ id: book.id, title: book.title });
    const settle = (patch: Partial<Target>) => {
      if (current.current === book.id) setTarget((t) => (t && t.id === book.id ? { ...t, ...patch } : t));
    };
    client.auth
      .getSession()
      .then(async ({ data }) => {
        if (!data.session) return settle({ signedOut: true });
        settle({ status: await getMyReadingStatus(client, book.id) });
      })
      .catch(() => settle({ status: null }));
  }

  function close() {
    current.current = null;
    setTarget(null);
  }

  async function choose(next: ReadingStatus | null) {
    const book = target;
    close();
    if (!book || !supabase || book.status === undefined || next === book.status) return;
    try {
      if (next) await setReadingStatus(supabase, book.id, next);
      else await removeFromShelves(supabase, book.id);
    } catch {
      Alert.alert('Couldn’t shelve that book', 'Something went wrong. Try again?');
    }
  }

  const sheet = (
    <ShelfStatusSheet
      book={target}
      onChoose={choose}
      onSignIn={
        target?.signedOut
          ? () => {
              close();
              router.push('/sign-in');
            }
          : undefined
      }
      onClose={close}
    />
  );

  return { open, sheet };
}
