import {
  ARRANGEABLE_SHELVES,
  arrangeShelf,
  getMyShelfStandings,
  moveOnShelf,
  removeFromShelves,
  setReadingStatus,
  type ShelfMove,
  type ShelfStanding,
} from '@booksyde/shared';
import type { ReadingStatus } from '@booksyde/types';
import { spacing } from '@booksyde/theme';
import { Link, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Grid } from '@/components/grid';
import { EmptyNote, Loading } from '@/components/page-chrome';
import { ShelfStatusSheet } from '@/components/shelf-status-sheet';
import { Stars } from '@/components/stars';
import { BottomTabInset, DisplayFonts, MaxContentWidth } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useBreakpoint, useColumns } from '@/hooks/use-breakpoint';
import { isShelfStatus, MY_SHELVES, type MyShelfBook, useMyShelves } from '@/hooks/use-my-shelves';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/*
 * One of the reader's own shelves, every book on it as a cover grid. Press and
 * hold a cover to move it to another shelf, or along Reading now and Want to
 * read to put them in your order (as on your profile). Under each title is
 * where you stand with it: how far in, your rating, when you added, finished
 * or set it down.
 */

export default function ShelfScreen() {
  const { status: raw } = useLocalSearchParams<{ status: string }>();
  const theme = useTheme();
  const status: ReadingStatus = isShelfStatus(raw) ? raw : 'reading';
  const shelf = MY_SHELVES.find((s) => s.status === status)!;
  const { contentWidth } = useBreakpoint();
  const columns = useColumns(3, { md: 5, lg: 6 });
  const { signedIn, sessionLoading, shelves, loading, reload: reloadShelves } = useMyShelves();
  const { data: standings, reload: reloadStandings } = useAsync(supabase && signedIn ? () => getMyShelfStandings(supabase!) : null, [signedIn]);
  useFocusEffect(
    useCallback(() => {
      reloadStandings();
    }, [reloadStandings]),
  );
  const reload = () => {
    reloadShelves();
    reloadStandings();
  };
  const [moving, setMoving] = useState<{ id: string; title: string; status: ReadingStatus; index: number } | null>(null);
  // An order the reader has just made, shown straight away while it saves.
  const [arranged, setArranged] = useState<MyShelfBook[] | null>(null);
  const [seen, setSeen] = useState(shelves);
  if (seen !== shelves) {
    setSeen(shelves);
    setArranged(null);
  }
  const books = arranged ?? shelves?.books[status] ?? [];
  const canArrange = ARRANGEABLE_SHELVES.includes(status);

  async function saveOrder(next: MyShelfBook[] | null) {
    if (!supabase) return;
    if (next) setArranged(next);
    try {
      await arrangeShelf(supabase, status, next ? next.map((b) => b.id) : null);
    } catch {
      setArranged(null);
      Alert.alert('Couldn’t save that order', 'Something went wrong. Try again?');
    }
    reload();
  }

  function moveAlong(how: ShelfMove) {
    const book = moving;
    setMoving(null);
    if (book) void saveOrder(moveOnShelf(books, book.index, how));
  }

  async function moveTo(next: ReadingStatus | null) {
    const book = moving;
    setMoving(null);
    if (!book || !supabase || next === book.status) return;
    try {
      if (next) await setReadingStatus(supabase, book.id, next);
      else await removeFromShelves(supabase, book.id);
      reload();
    } catch {
      Alert.alert('Couldn’t move that book', 'Something went wrong. Try again?');
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ paddingBottom: BottomTabInset + spacing[8] }}>
      <Stack.Screen options={{ title: shelf.title }} />
      <View style={[styles.content, { maxWidth: contentWidth }]}>
        {sessionLoading || (signedIn && !shelves && loading) ? (
          <Loading />
        ) : !signedIn ? (
          <EmptyNote>
            <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 15 }}>
              <Link href="/sign-in" style={{ color: theme.accent, fontWeight: '700' }}>
                Sign in
              </Link>{' '}
              to see your shelves.
            </Text>
          </EmptyNote>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
                {books.length} {books.length === 1 ? 'book' : 'books'} · {shelf.blurb}
              </Text>
              {canArrange && shelves?.arranged[status] ? (
                <Pressable accessibilityRole="button" onPress={() => saveOrder(null)} hitSlop={8}>
                  <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 14 }}>Back to date added</Text>
                </Pressable>
              ) : null}
            </View>
            {books.length === 0 ? (
              <EmptyNote>
                <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 15, lineHeight: 22 }}>
                  {shelf.empty}{' '}
                  <Link href="/discover" style={{ color: theme.accent, fontWeight: '700' }}>
                    Find a book
                  </Link>
                </Text>
              </EmptyNote>
            ) : (
              <>
                <Grid columns={columns} gap={spacing[3]} rowGap={spacing[5]}>
                  {books.map((w, index) => {
                    const standing = standings?.[w.id];
                    return (
                      <Link key={w.id} href={{ pathname: '/book/[id]', params: { id: w.id } }} push asChild>
                        <Pressable
                          onLongPress={() => setMoving({ id: w.id, title: w.title, status, index })}
                          delayLongPress={400}
                          accessibilityLabel={standing ? `${w.title}, ${standingLabel(status, standing)}` : w.title}
                          accessibilityHint="Press and hold to move it to another shelf"
                        >
                          {({ pressed }) => (
                            <View style={[styles.book, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}>
                              <CoverCell book={w} />
                              <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
                                {w.title}
                              </Text>
                              {standing ? <Standing status={status} standing={standing} /> : null}
                            </View>
                          )}
                        </Pressable>
                      </Link>
                    );
                  })}
                </Grid>
                <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 13 }}>
                  {canArrange
                    ? 'Press and hold a book to move it to another shelf, or along this one to put it in your order.'
                    : 'Press and hold a book to move it to another shelf.'}
                </Text>
              </>
            )}
          </>
        )}
      </View>
      <ShelfStatusSheet
        book={moving}
        arrange={moving && canArrange ? { index: moving.index, count: books.length } : undefined}
        onChoose={moveTo}
        onArrange={moveAlong}
        onClose={() => setMoving(null)}
      />
    </ScrollView>
  );
}

/** A cover that fills its grid cell's width. */
function CoverCell({ book }: { book: MyShelfBook }) {
  const [width, setWidth] = useState(0);
  return (
    <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))} style={{ aspectRatio: 2 / 3 }}>
      {width > 0 ? <BookCover title={book.title} author="" src={book.cover_url} color={book.cover_color} width={width} /> : null}
    </View>
  );
}

const dayMonth = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "Nov 3" this year, "Nov 2024" before it. */
function shortDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  return date.getUTCFullYear() === new Date().getUTCFullYear() ? dayMonth.format(date) : monthYear.format(date);
}

/** How far into the book they are, 0–100, when they've logged a page and we know its length. */
function percentIn(standing: ShelfStanding) {
  return standing.page != null && standing.pages ? Math.min(100, Math.round((standing.page / standing.pages) * 100)) : null;
}

/** The short line under a book's title, by the shelf it's on. */
function standingLine(status: ReadingStatus, standing: ShelfStanding): string | null {
  const when = (verb: string, iso: string | null) => {
    const date = shortDate(iso);
    return date ? `${verb} ${date}` : null;
  };
  switch (status) {
    case 'reading': {
      const percent = percentIn(standing);
      if (percent != null) return `${percent}% · p. ${standing.page}`;
      if (standing.page != null) return `Page ${standing.page}`;
      return when('Started', standing.startedAt ?? standing.shelvedAt);
    }
    case 'want_to_read':
      return when('Added', standing.shelvedAt);
    case 'read':
      return when('Finished', standing.finishedAt);
    case 'did_not_finish':
      return standing.page != null ? `Stopped at p. ${standing.page}` : when('Set down', standing.shelvedAt);
  }
}

/** The same, for screen readers: spelled out, with their rating. */
function standingLabel(status: ReadingStatus, standing: ShelfStanding) {
  const percent = status === 'reading' ? percentIn(standing) : null;
  const line = percent != null ? `${percent} percent in, page ${standing.page}` : (standingLine(status, standing)?.replace(/\bp\. /, 'page ') ?? null);
  const rating = standing.rating != null && status !== 'want_to_read' ? `you rated it ${standing.rating} out of 5` : null;
  return [line, rating].filter(Boolean).join(', ');
}

/** Where the reader stands with a book on this shelf: a progress bar, their stars, a date. */
function Standing({ status, standing }: { status: ReadingStatus; standing: ShelfStanding }) {
  const theme = useTheme();
  const percent = status === 'reading' ? percentIn(standing) : null;
  const showStars = standing.rating != null && status !== 'want_to_read';
  const line = standingLine(status, standing);
  if (percent == null && !showStars && !line) return null;
  return (
    <View style={styles.standing} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {percent != null ? (
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: theme.accent }]} />
        </View>
      ) : null}
      {showStars ? <Stars rating={standing.rating!} size={11} /> : null}
      {line ? (
        <Text numberOfLines={1} style={[styles.standingText, { color: percent != null ? theme.accent : theme.textSecondary }]}>
          {line}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: spacing[4], gap: spacing[5] },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: spacing[3], rowGap: spacing[1] },
  book: { gap: spacing[2] },
  title: { fontFamily: DisplayFonts.regular, fontSize: 16, lineHeight: 18 },
  standing: { gap: spacing[1], marginTop: -spacing[1] },
  standingText: { fontSize: 12, lineHeight: 15, fontWeight: '600' },
  progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
});
