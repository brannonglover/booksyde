import type { SeasonPick, SeasonPicks } from '@booksyde/shared';
import { radii, spacing } from '@booksyde/theme';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { HollySprig } from '@/components/holly';
import { ChromeMaxScale, DisplayFonts, DisplayMaxScale } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { webUrl } from '@/lib/web-url';

/** December's pair from the web (the bestseller needs its NYT key); null if it can't be reached. */
async function loadSeasonPicks(): Promise<SeasonPicks | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 6000);
  try {
    const res = await fetch(`${webUrl}/api/season-picks`, { signal: abort.signal });
    if (!res.ok) return null;
    const { picks } = (await res.json()) as { picks: SeasonPicks | null };
    return picks;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * December on the home screen, as on the web: this week's bestseller beside a
 * Christmas book readers are picking up. Nothing at all if neither loads.
 */
export function SeasonPicksSection() {
  const theme = useTheme();
  const { data } = useAsync(loadSeasonPicks, []);
  const books = [data?.bestseller, data?.christmas].filter((b): b is SeasonPick => Boolean(b));
  if (!books.length) return null;
  return (
    <View style={styles.section}>
      <View style={[styles.heading, { borderBottomColor: theme.border }]}>
        <View style={styles.kickerRow}>
          <HollySprig color={theme.highlight} height={13} />
          <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.kicker, { color: theme.accent }]}>
            SEASON’S READINGS
          </Text>
        </View>
        <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.title, { color: theme.text }]}>
          Two for the <Text style={{ fontFamily: DisplayFonts.italic, color: theme.accent }}>holidays</Text>
        </Text>
      </View>
      {books.map((book) => (
        <SeasonPickCard key={book.kind} book={book} />
      ))}
    </View>
  );
}

function SeasonPickCard({ book }: { book: SeasonPick }) {
  const theme = useTheme();
  return (
    // A pick that isn't in the catalogue yet goes to search, where it can be found and added.
    <Link
      href={
        book.id
          ? { pathname: '/book/[id]', params: { id: book.id } }
          : { pathname: '/search', params: { q: `${book.title} ${book.author}`.trim() } }
      }
      asChild
    >
      <Pressable accessibilityLabel={`${book.note}: ${book.title} by ${book.author}`}>
        {({ pressed }) => (
          <View
            style={[
              styles.card,
              { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement, borderColor: pressed ? theme.accent : theme.border },
            ]}
          >
            <BookCover title={book.title} author={book.author} src={book.cover_url} color={book.cover_color} width={72} />
            <View style={styles.cardBody}>
              <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.note, { color: theme.accent }]} numberOfLines={2}>
                {book.note.toUpperCase()}
              </Text>
              <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.bookTitle, { color: theme.text }]} numberOfLines={2}>
                {book.title}
              </Text>
              <Text style={[styles.byline, { color: theme.textSecondary }]} numberOfLines={1}>
                {book.author}
                {book.year ? ` · ${book.year}` : ''}
              </Text>
            </View>
            <View style={[styles.arrow, { borderColor: pressed ? theme.accent : theme.border, backgroundColor: pressed ? theme.accent : 'transparent' }]}>
              <Text style={{ color: pressed ? theme.backgroundElement : theme.text, fontSize: 16 }}>→</Text>
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  heading: { gap: spacing[2], paddingBottom: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: spacing[1] },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2.4 },
  title: { fontFamily: DisplayFonts.regular, fontSize: 34, lineHeight: 38 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing[4],
  },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  note: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  bookTitle: { fontFamily: DisplayFonts.regular, fontSize: 22, lineHeight: 26, marginTop: spacing[1] },
  byline: { fontSize: 14 },
  arrow: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
