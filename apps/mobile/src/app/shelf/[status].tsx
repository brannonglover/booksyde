import { ARRANGEABLE_SHELVES, arrangeShelf, moveOnShelf, removeFromShelves, setReadingStatus, type ShelfMove } from '@booksyde/shared';
import type { ReadingStatus } from '@booksyde/types';
import { spacing } from '@booksyde/theme';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Grid } from '@/components/grid';
import { EmptyNote, Loading } from '@/components/page-chrome';
import { ShelfStatusSheet } from '@/components/shelf-status-sheet';
import { BottomTabInset, DisplayFonts, MaxContentWidth } from '@/constants/theme';
import { useBreakpoint, useColumns } from '@/hooks/use-breakpoint';
import { isShelfStatus, MY_SHELVES, type MyShelfBook, useMyShelves } from '@/hooks/use-my-shelves';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/*
 * One of the reader's own shelves, every book on it as a cover grid. Press and
 * hold a cover to move it to another shelf, or along Reading now and Want to
 * read to put them in your order (as on your profile).
 */

export default function ShelfScreen() {
  const { status: raw } = useLocalSearchParams<{ status: string }>();
  const theme = useTheme();
  const status: ReadingStatus = isShelfStatus(raw) ? raw : 'reading';
  const shelf = MY_SHELVES.find((s) => s.status === status)!;
  const { contentWidth } = useBreakpoint();
  const columns = useColumns(3, { md: 5, lg: 6 });
  const { signedIn, sessionLoading, shelves, loading, reload } = useMyShelves();
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
                  {books.map((w, index) => (
                    <Link key={w.id} href={{ pathname: '/book/[id]', params: { id: w.id } }} push asChild>
                      <Pressable
                        onLongPress={() => setMoving({ id: w.id, title: w.title, status, index })}
                        delayLongPress={400}
                        accessibilityLabel={w.title}
                        accessibilityHint="Press and hold to move it to another shelf"
                      >
                        {({ pressed }) => (
                          <View style={[styles.book, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}>
                            <CoverCell book={w} />
                            <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
                              {w.title}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    </Link>
                  ))}
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

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: spacing[4], gap: spacing[5] },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: spacing[3], rowGap: spacing[1] },
  book: { gap: spacing[2] },
  title: { fontFamily: DisplayFonts.regular, fontSize: 16, lineHeight: 18 },
});
