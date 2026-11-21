import { type OpenLibraryBook, seriesEntry } from '@booksyde/shared';
import { palette, radii, spacing } from '@booksyde/theme';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { DisplayFonts, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useQuickShelf } from '@/hooks/use-quick-shelf';
import { webUrl } from '@/lib/web-url';

/**
 * An Open Library book we don't hold yet, as a library request slip: "Add to
 * the catalogue" imports it (through the web app) and opens its page. When we
 * already hold it (`workId`), the slip just links to the book.
 */
export function RequestSlip({ book, tilt = '0deg' }: { book: OpenLibraryBook & { workId?: string | null }; tilt?: string }) {
  const router = useRouter();
  const quick = useQuickShelf();
  const dark = useColorScheme() === 'dark';
  const [state, setState] = useState<'idle' | 'adding' | 'error'>('idle');
  const ink = dark ? palette.paper : palette.ink;
  const label = dark ? '#A9C29A' : '#4A6040';
  const byline = book.authors.map((a) => a.name).join(', ') || 'Unknown';

  async function add() {
    setState('adding');
    try {
      const res = await fetch(`${webUrl}/api/books/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olid: book.olid }),
      });
      const json = (await res.json()) as { id?: string };
      if (!res.ok || !json.id) throw new Error('Import failed');
      setState('idle');
      router.push({ pathname: '/book/[id]', params: { id: json.id } });
    } catch {
      setState('error');
    }
  }

  const fields: [string, string | number | null][] = [
    ['Title', book.subtitle ? `${book.title}: ${book.subtitle}` : book.title],
    ['Author', byline],
    ['Series', book.series ? seriesEntry(book.series) : null],
    ['Year', book.year],
  ];
  const body = (
    <View style={styles.body}>
      <View style={{ flex: 1, gap: 6 }}>
        {fields.map(([name, value]) =>
          value ? (
            <View key={name} style={styles.field}>
              <Text style={[styles.mono, { color: label, width: 58 }]}>{name}:</Text>
              <Text style={[name === 'Title' ? styles.title : styles.mono, { color: ink, flex: 1 }]}>{value}</Text>
            </View>
          ) : null,
        )}
      </View>
      <BookCover title={book.title} author={byline} coverId={book.coverId} width={56} />
    </View>
  );
  const card = { backgroundColor: dark ? '#2C3529' : '#EEF3E8', transform: [{ rotate: tilt }] };

  // Already on file: it opens the book, and press and hold puts it on a shelf like any other cover.
  if (book.workId) {
    const workId = book.workId;
    return (
      <>
        <Link href={{ pathname: '/book/[id]', params: { id: workId } }} asChild>
          <Pressable
            style={StyleSheet.flatten([styles.card, card])}
            onLongPress={() => quick.open({ id: workId, title: book.title })}
            delayLongPress={400}
            accessibilityHint="Press and hold to put it on a shelf"
          >
            <View style={[styles.header, { borderBottomColor: 'rgba(126,154,110,0.6)' }]}>
              <Text style={[styles.headerText, { color: label }]}>ON FILE</Text>
            </View>
            {body}
            <Text style={{ color: label, fontWeight: '600', fontSize: 14 }}>Open the book →</Text>
          </Pressable>
        </Link>
        {quick.sheet}
      </>
    );
  }

  return (
    <View style={[styles.card, card]}>
      <View style={[styles.header, { borderBottomColor: 'rgba(126,154,110,0.6)' }]}>
        <Text style={[styles.headerText, { color: label }]}>REQUEST SLIP</Text>
        <Text style={[styles.headerText, { color: label }]}>NO. {book.olid.replace(/\D/g, '').slice(-5)}</Text>
      </View>
      {body}
      {state === 'error' ? (
        <Text style={{ color: palette.oxblood, fontSize: 13 }}>
          The stacks are stuck right now. Try again in a moment.
        </Text>
      ) : null}
      <Pressable
        onPress={add}
        disabled={state === 'adding'}
        accessibilityRole="button"
        style={[styles.button, { opacity: state === 'adding' ? 0.7 : 1 }]}
      >
        <Text style={styles.buttonText}>{state === 'adding' ? 'Fetching it from the stacks…' : 'Add to the catalogue →'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 3,
    padding: spacing[4],
    gap: spacing[3],
    shadowColor: '#1F1B16',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, borderBottomWidth: 1, borderStyle: 'dashed' },
  headerText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2 },
  body: { flexDirection: 'row', gap: spacing[4], alignItems: 'flex-start' },
  field: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  mono: { fontFamily: Fonts.mono, fontSize: 13, lineHeight: 20 },
  title: { fontFamily: DisplayFonts.regular, fontSize: 19, lineHeight: 22 },
  button: { alignSelf: 'flex-start', backgroundColor: palette.green, borderRadius: radii.pill, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  buttonText: { color: palette.paper, fontWeight: '600', fontSize: 14 },
});
