import { compactCount, getMyShelfStandings, getYearInBooks, type ShelfStanding } from '@booksyde/shared';
import type { ReadingStatus } from '@booksyde/types';
import { radii, spacing } from '@booksyde/theme';
import { Link, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { CoverFan } from '@/components/cover-fan';
import { EmptyNote, Loading, PageHeader, Pill } from '@/components/page-chrome';
import { Stars } from '@/components/stars';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, ChromeMaxScale, DisplayFonts, DisplayMaxScale, MaxContentWidth } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MY_SHELVES, type MyShelfBook, useMyShelves } from '@/hooks/use-my-shelves';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/*
 * Shelves: the signed-in reader's own shelves, weighted by how much they're
 * used. Reading now gets a wide tile with your place in each book; Want to read
 * and Read sit side by side; Did not finish is a quiet row; and the books you
 * finished last are underneath. Each tile opens its shelf.
 */

const WebTabBarHeight = 72;
const ReadingCoverWidth = 72;
const FinishedCoverWidth = 88;

const numberFormat = new Intl.NumberFormat('en');
const shelfInfo = (status: ReadingStatus) => MY_SHELVES.find((s) => s.status === status)!;
const shelfHref = (status: ReadingStatus) => ({
  pathname: '/shelf/[status]' as const,
  params: { status },
});

/** Books with cover art first, so a fan of three doesn't show blank cloth when there are covers to show. */
function coversFirst(books: MyShelfBook[]) {
  return [...books].sort((a, b) => Number(!a.cover_url) - Number(!b.cover_url));
}

/** Your place in each book and this year's totals: the finer detail the shelves themselves don't carry. */
function useShelfDetail(userId: string | null) {
  const { data, reload } = useAsync(
    supabase && userId
      ? () =>
          Promise.all([
            getMyShelfStandings(supabase!).catch(() => ({}) as Record<string, ShelfStanding>),
            getYearInBooks(supabase!, { userId, spines: 0 }).catch(() => null),
          ]).then(([standings, year]) => ({ standings, year }))
      : null,
    [userId],
  );
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  return data;
}

export default function ShelvesScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { contentWidth } = useBreakpoint();
  const { profile, session } = useSession();
  const { signedIn, sessionLoading, shelves, loading, error } = useMyShelves();
  const detail = useShelfDetail(session?.user.id ?? null);
  const standings = detail?.standings ?? {};
  const books = shelves?.books;
  const total = books ? MY_SHELVES.reduce((n, s) => n + books[s.status].length, 0) : 0;

  return (
    <ThemedView style={{ flex: 1 }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: (Platform.OS === 'web' ? WebTabBarHeight : insets.top) + spacing[4],
          paddingBottom: insets.bottom + BottomTabInset + spacing[7],
        }}
      >
        <View style={[styles.content, { maxWidth: contentWidth }]}>
          {sessionLoading || (signedIn && !shelves && loading) ? (
            <Loading />
          ) : !signedIn ? (
            <>
              <PageHeader
                kicker="Your shelves"
                before="Everything you’re"
                accent="reading"
                lede="Sign in to keep track of what you’re reading, what’s next, and what you’ve finished."
              />
              <View style={styles.signedOut}>
                <Link href="/sign-up" asChild>
                  <Pill label="Join free" />
                </Link>
                <Link href="/sign-in" asChild>
                  <Pill label="Sign in" kind="outline" />
                </Link>
              </View>
            </>
          ) : error && !books ? (
            <EmptyNote>
              <Text
                style={{
                  color: theme.textSecondary,
                  textAlign: 'center',
                  fontSize: 15,
                }}
              >
                Couldn’t load your shelves. Come back to this tab to try again.
              </Text>
            </EmptyNote>
          ) : books ? (
            <>
              <View style={styles.header}>
                <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.kicker, { color: theme.accent }]}>
                  YOUR SHELVES
                </Text>
                <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.headline, { color: theme.text }]}>
                  {numberFormat.format(total)} <Text style={[styles.italic, { color: theme.accent }]}>{total === 1 ? 'book' : 'books'}</Text>
                </Text>
                {detail?.year ? (
                  <Text style={[styles.stats, { color: theme.textSecondary }]}>
                    {detail.year.books === 0
                      ? `Nothing finished yet in ${detail.year.year}`
                      : `${numberFormat.format(detail.year.books)} finished in ${detail.year.year} · ${numberFormat.format(detail.year.pages)} pages`}
                  </Text>
                ) : null}
              </View>

              <ReadingNowTile books={books.reading} standings={standings} />

              <View style={styles.pair}>
                <CountTile status="want_to_read" books={books.want_to_read} />
                <CountTile status="read" books={books.read} />
              </View>

              <QuietRow status="did_not_finish" count={books.did_not_finish.length} />

              <RecentlyFinished books={books.read} standings={standings} />

              {profile ? (
                <Link
                  href={{
                    pathname: '/u/[username]',
                    params: { username: profile.username },
                  }}
                  style={{
                    color: theme.accent,
                    fontWeight: '700',
                    fontSize: 15,
                    textAlign: 'center',
                    marginTop: spacing[2],
                  }}
                >
                  See your profile →
                </Link>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
      {/* Keeps scrolled content from running under the clock and battery. */}
      {Platform.OS !== 'web' ? (
        <View pointerEvents="none" style={[styles.statusBarBacking, { height: insets.top, backgroundColor: theme.background }]} />
      ) : null}
    </ThemedView>
  );
}

/** A card that opens a shelf, with the pressed (or, on the web, hovered) state on its border. */
function ShelfLink({ status, label, style, children }: { status: ReadingStatus; label: string; style?: object; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Link href={shelfHref(status)} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={label} style={style}>
        {/* Link's slot drops a style function, so the card's look lives on a plain View inside. */}
        {(state) => {
          const active = state.pressed || (state as { hovered?: boolean }).hovered;
          return (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: active ? theme.backgroundSelected : theme.backgroundElement,
                  borderColor: theme.border,
                },
              ]}
            >
              {children}
            </View>
          );
        }}
      </Pressable>
    </Link>
  );
}

function countLabel(title: string, count: number) {
  return `${title}, ${count} ${count === 1 ? 'book' : 'books'}`;
}

/** Reading now, wide: a cover for each open book with how far in you are. */
function ReadingNowTile({ books, standings }: { books: MyShelfBook[]; standings: Record<string, ShelfStanding> }) {
  const theme = useTheme();
  const { title, empty } = shelfInfo('reading');
  return (
    <ShelfLink status="reading" label={countLabel(title, books.length)}>
      <View style={styles.tileHead}>
        <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.tileTitle, { color: theme.text }]}>
          {title}
          <Text style={[styles.tileCount, { color: theme.textSecondary }]}>{`  ${books.length}`}</Text>
        </Text>
        <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
      </View>
      {books.length === 0 ? (
        <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{empty}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardBleed} contentContainerStyle={styles.readingRow}>
          {books.map((book) => {
            const s = standings[book.id];
            const percent = s?.page != null && s.pages ? Math.min(100, Math.round((s.page / s.pages) * 100)) : null;
            return (
              <Link key={book.id} href={{ pathname: '/book/[id]', params: { id: book.id } }} asChild>
                <Pressable accessibilityLabel={`${book.title}${percent != null ? `, ${percent} percent in` : ''}`}>
                  {({ pressed }) => (
                    <View style={[{ width: ReadingCoverWidth, gap: spacing[2] }, pressed && { opacity: 0.8 }]}>
                      <BookCover title={book.title} author="" src={book.cover_url} color={book.cover_color} width={ReadingCoverWidth} />
                      <View style={[styles.track, { backgroundColor: theme.border }]}>
                        {percent != null ? (
                          <View
                            style={[
                              styles.fill,
                              {
                                width: `${percent}%`,
                                backgroundColor: theme.accent,
                              },
                            ]}
                          />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.small,
                          {
                            color: percent != null ? theme.accent : theme.textSecondary,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {percent != null ? `${percent}%` : s?.page != null ? `p. ${s.page}` : 'Not started'}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </Link>
            );
          })}
        </ScrollView>
      )}
    </ShelfLink>
  );
}

/** Half-width: a fan of covers over a big count. */
function CountTile({ status, books }: { status: ReadingStatus; books: MyShelfBook[] }) {
  const theme = useTheme();
  const { title } = shelfInfo(status);
  const tint = status === 'read' ? theme.highlight : theme.primary;
  return (
    <ShelfLink status={status} label={countLabel(title, books.length)} style={styles.half}>
      <CoverFan covers={coversFirst(books).slice(0, 3)} tint={tint} edge={theme.backgroundElement} width={42} />
      <View>
        <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.bigCount, { color: theme.text }]}>
          {compactCount(books.length)}
        </Text>
        <View style={styles.tileHead}>
          <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.tileLabel, { color: theme.textSecondary }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
        </View>
      </View>
    </ShelfLink>
  );
}

/** A plain row for the shelf that needs the least room. */
function QuietRow({ status, count }: { status: ReadingStatus; count: number }) {
  const theme = useTheme();
  const { title } = shelfInfo(status);
  return (
    <Link href={shelfHref(status)} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={countLabel(title, count)}>
        {({ pressed }) => (
          <View style={[styles.quiet, { borderColor: theme.border }, pressed && { opacity: 0.6 }]}>
            <Text style={[styles.quietLabel, { color: theme.textSecondary }]}>
              {title} · {compactCount(count)}
            </Text>
            <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

/** The last books finished, newest first, with your rating under each. */
function RecentlyFinished({ books, standings }: { books: MyShelfBook[]; standings: Record<string, ShelfStanding> }) {
  const theme = useTheme();
  if (books.length === 0) return null;
  const when = (b: MyShelfBook) => Date.parse(standings[b.id]?.finishedAt ?? standings[b.id]?.shelvedAt ?? '') || 0;
  const recent = [...books].sort((a, b) => when(b) - when(a)).slice(0, 10);
  return (
    <View style={{ gap: spacing[3] }}>
      <View style={styles.tileHead}>
        <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.kicker, { color: theme.textSecondary }]}>
          RECENTLY FINISHED
        </Text>
        <Link href={shelfHref('read')} style={{ color: theme.accent, fontWeight: '700', fontSize: 14 }}>
          All →
        </Link>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.finishedRow}>
        {recent.map((book) => {
          const rating = standings[book.id]?.rating ?? null;
          return (
            <Link key={book.id} href={{ pathname: '/book/[id]', params: { id: book.id } }} asChild>
              <Pressable accessibilityLabel={`${book.title}${rating != null ? `, you gave it ${rating} stars` : ''}`}>
                {({ pressed }) => (
                  <View style={[{ width: FinishedCoverWidth, gap: spacing[2] }, pressed && { opacity: 0.8 }]}>
                    <BookCover title={book.title} author="" src={book.cover_url} color={book.cover_color} width={FinishedCoverWidth} />
                    <Text style={[styles.finishedTitle, { color: theme.text }]} numberOfLines={1}>
                      {book.title}
                    </Text>
                    {rating != null ? <Stars rating={rating} size={11} /> : null}
                  </View>
                )}
              </Pressable>
            </Link>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing[4],
    gap: spacing[4],
  },
  statusBarBacking: { position: 'absolute', top: 0, left: 0, right: 0 },
  signedOut: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[3],
  },
  header: {
    gap: spacing[1],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.8 },
  headline: {
    fontFamily: DisplayFonts.regular,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -0.3,
  },
  italic: { fontFamily: DisplayFonts.italic },
  stats: { fontSize: 15 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    padding: spacing[4],
    gap: spacing[3],
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  tileTitle: { fontFamily: DisplayFonts.regular, fontSize: 22, lineHeight: 26 },
  tileCount: { fontSize: 14, fontWeight: '600' },
  tileLabel: { flexShrink: 1, fontSize: 14, fontWeight: '600' },
  chevron: { fontSize: 22, lineHeight: 24 },
  // The cover rows run past their padding (pulled back with negative margins) so the covers' shadows
  // fade out inside the scroll view instead of stopping at a hard edge.
  cardBleed: { marginHorizontal: -spacing[4], marginTop: -spacing[4], marginBottom: -spacing[4] },
  readingRow: { gap: spacing[4], padding: spacing[4] },
  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  small: { fontSize: 12, fontWeight: '600', marginTop: -2 },
  pair: { flexDirection: 'row', gap: spacing[3] },
  half: { flex: 1 },
  bigCount: { fontFamily: DisplayFonts.regular, fontSize: 34, lineHeight: 40 },
  quiet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[1],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  quietLabel: { fontSize: 15, fontWeight: '600' },
  bleed: { marginHorizontal: -spacing[4], marginTop: -spacing[4] },
  finishedRow: { gap: spacing[3], padding: spacing[4] },
  finishedTitle: {
    fontFamily: DisplayFonts.regular,
    fontSize: 15,
    lineHeight: 18,
  },
});
