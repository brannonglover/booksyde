import { type OpenLibraryBook, seriesLabel } from '@booksyde/shared';
import { mixHex, radii, spacing } from '@booksyde/theme';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { SeriesLine } from '@/components/series-line';
import { DisplayFonts, DisplayMaxScale } from '@/constants/theme';
import { useQuickShelf } from '@/hooks/use-quick-shelf';
import { useTheme } from '@/hooks/use-theme';
import { webUrl } from '@/lib/web-url';

/**
 * An Open Library book we don't hold yet: tapping anywhere on the card adds it
 * to the catalogue (through the web app) and opens its page. When we already
 * hold it (`workId`), the card just links to the book.
 */
export function RequestSlip({ book }: { book: OpenLibraryBook & { workId?: string | null } }) {
  const router = useRouter();
  const quick = useQuickShelf();
  const theme = useTheme();
  const [state, setState] = useState<'idle' | 'adding' | 'error'>('idle');
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

  // Dashed until pressed, when it firms up into a solid card — the web slip does the same on hover.
  // Link (asChild) only passes a plain style through, so the pressed look is tracked by hand.
  const [active, setActive] = useState(false);
  const press = {
    onPressIn: () => setActive(true),
    onPressOut: () => setActive(false),
  };
  const shell = StyleSheet.flatten([
    styles.card,
    {
      borderColor: active ? mixHex(theme.border, theme.text, 0.25) : theme.border,
      borderStyle: active ? ('solid' as const) : ('dashed' as const),
      backgroundColor: active ? theme.backgroundElement : 'transparent',
      transform: [{ translateY: active ? -2 : 0 }],
    },
  ]);

  const details = (
    <>
      {book.year ? <Text style={[styles.year, { color: theme.textSecondary }]}>{book.year}</Text> : null}
      <Text numberOfLines={2} maxFontSizeMultiplier={DisplayMaxScale} style={[styles.title, { color: theme.text }]}>
        {book.title}
      </Text>
      {book.subtitle ? (
        <Text numberOfLines={1} style={[styles.subtitle, { color: theme.textSecondary }]}>
          {book.subtitle}
        </Text>
      ) : null}
      <Text numberOfLines={1} style={[styles.byline, { color: theme.text }]}>
        <Text style={{ color: theme.textSecondary }}>by </Text>
        <Text style={{ fontWeight: '500' }}>{byline}</Text>
      </Text>
      {book.series ? <SeriesLine label={seriesLabel(book.series)} /> : null}
    </>
  );
  const cover = <BookCover title={book.title} author={byline} coverId={book.coverId} width={80} />;

  // Already on file (someone added it earlier): it opens the book, and press and hold puts it on a shelf like any other cover.
  if (book.workId) {
    const workId = book.workId;
    return (
      <>
        <Link href={{ pathname: '/book/[id]', params: { id: workId } }} asChild>
          <Pressable
            {...press}
            style={shell}
            onLongPress={() => quick.open({ id: workId, title: book.title })}
            delayLongPress={400}
            accessibilityHint="Press and hold to put it on a shelf"
          >
            {cover}
            <View style={styles.body}>
              {details}
              <Text style={[styles.footer, { color: theme.accent, fontWeight: '600', fontSize: 14 }]}>Now on Booksyde →</Text>
            </View>
          </Pressable>
        </Link>
        {quick.sheet}
      </>
    );
  }

  const adding = state === 'adding';
  return (
    <Pressable
      onPress={add}
      disabled={adding}
      accessibilityRole="button"
      accessibilityLabel={`Add ${book.title} by ${byline} to Booksyde`}
      {...press}
      style={shell}
    >
      {cover}
      <View style={styles.body}>
        {details}
        <View style={[styles.footer, { gap: spacing[2] }]}>
          {state === 'error' ? (
            <Text style={{ color: theme.accent, fontSize: 14 }}>The stacks are stuck right now. Try again in a moment.</Text>
          ) : null}
          <View style={[styles.button, { backgroundColor: theme.primary, opacity: adding ? 0.7 : 1 }]}>
            <Text style={[styles.buttonText, { color: theme.primaryText }]}>{adding ? 'Adding…' : '+ Add to Booksyde'}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing[4],
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing[4],
  },
  body: { flex: 1, minWidth: 0 },
  year: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  title: {
    fontFamily: DisplayFonts.regular,
    fontSize: 24,
    lineHeight: 26,
    marginTop: 2,
  },
  subtitle: { fontSize: 14, marginTop: 4 },
  byline: { fontSize: 14, marginTop: 6 },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing[4],
    alignItems: 'flex-start',
  },
  button: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  buttonText: { fontWeight: '600', fontSize: 14 },
});
