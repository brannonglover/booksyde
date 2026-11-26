import { type DeskBook, finishReading, getMyReadingDesk, setReadingPage } from '@booksyde/shared';
import { radii, spacing } from '@booksyde/theme';
import { Link, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { Pill } from '@/components/page-chrome';
import { ChromeMaxScale, DisplayFonts, DisplayMaxScale } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const CoverWidth = 72;
const CardGap = spacing[3];
// How much of the next card shows at the screen's edge, so it's plain there are more.
const Peek = 44;

/** How far into the book they are, 0–100, when they've logged a page and we know its length. */
function percentOf(book: DeskBook) {
  return book.page != null && book.pages ? Math.min(100, Math.round((book.page / book.pages) * 100)) : null;
}

/**
 * The reader's Reading now shelf, in their own order, as a row of cards they
 * swipe through: cover, how far in, and a button to log the page they're on.
 * Reloads whenever Home comes back into view, so a page logged elsewhere shows.
 *
 * Renders `fallback` when they have nothing open (or it can't load), and a
 * placeholder of the same height while it loads, so the page doesn't jump.
 */
export function ContinueReading({ userId, fallback }: { userId: string; fallback: ReactNode }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { data: desk, loading, reload } = useAsync(supabase ? () => getMyReadingDesk(supabase!) : null, [userId]);
  const [logging, setLogging] = useState<DeskBook | null>(null);

  // Skip the first focus: useAsync has just loaded.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (focused) reload();
      else setFocused(true);
    }, [focused, reload]),
  );

  if (loading && !desk) {
    return (
      <View style={styles.section}>
        <View style={[styles.skeletonLabel, { backgroundColor: theme.border }]} />
        <View style={[styles.card, styles.skeletonCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]} />
      </View>
    );
  }
  if (!desk?.length) return <>{fallback}</>;

  const full = width - spacing[4] * 2;
  const cardWidth = desk.length > 1 ? full - Peek : full;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.label, { color: theme.textSecondary }]}>
          CONTINUE READING{desk.length > 1 ? ` · ${desk.length}` : ''}
        </Text>
        <Link href={{ pathname: '/shelf/[status]', params: { status: 'reading' } }} style={[styles.all, { color: theme.accent }]}>
          All →
        </Link>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
        snapToInterval={cardWidth + CardGap}
        decelerationRate="fast"
        disableIntervalMomentum
      >
        {desk.map((book) => (
          <ReadingCard key={book.work.id} book={book} width={cardWidth} onLog={() => setLogging(book)} />
        ))}
      </ScrollView>
      <PageSheet
        book={logging}
        onClose={() => setLogging(null)}
        onSaved={() => {
          setLogging(null);
          reload();
        }}
      />
    </View>
  );
}

function ReadingCard({ book, width, onLog }: { book: DeskBook; width: number; onLog: () => void }) {
  const theme = useTheme();
  const percent = percentOf(book);
  const where =
    percent != null
      ? `${percent}% · p. ${book.page} of ${book.pages}`
      : book.page != null
        ? `Page ${book.page}`
        : 'No page logged yet';
  return (
    <Link href={{ pathname: '/book/[id]', params: { id: book.work.id } }} asChild>
      <Pressable accessibilityLabel={`${book.work.title}${book.author ? ` by ${book.author}` : ''}, ${where}`}>
        {({ pressed }) => (
          <View
            style={[
              styles.card,
              { width, borderColor: theme.border, backgroundColor: theme.backgroundElement },
              pressed && { backgroundColor: theme.backgroundSelected },
            ]}
          >
            <BookCover title={book.work.title} author={book.author ?? ''} src={book.work.cover_url} color={book.work.cover_color} width={CoverWidth} />
            <View style={styles.cardBody}>
              <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                {book.work.title}
              </Text>
              {book.author ? (
                <Text style={[styles.author, { color: theme.textSecondary }]} numberOfLines={1}>
                  {book.author}
                </Text>
              ) : null}
              <View style={styles.progress}>
                {percent != null ? (
                  <View style={[styles.track, { backgroundColor: theme.border }]}>
                    <View style={[styles.fill, { width: `${percent}%`, backgroundColor: theme.accent }]} />
                  </View>
                ) : null}
                <Text style={[styles.where, { color: percent != null ? theme.accent : theme.textSecondary }]} numberOfLines={1}>
                  {where}
                </Text>
              </View>
              <Pressable
                onPress={onLog}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Update your page in ${book.work.title}`}
                style={({ pressed: p }) => [styles.update, { borderColor: theme.accent }, p && { opacity: 0.7 }]}
              >
                <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.updateLabel, { color: theme.accent }]}>
                  {book.page != null ? 'Update page' : 'Log your page'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

/** A bottom sheet asking which page they're on, with a way to say they've finished. */
function PageSheet({ book, onClose, onSaved }: { book: DeskBook | null; onClose: () => void; onSaved: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Start from their last page each time the sheet opens on a book.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const id = book?.work.id ?? null;
  if (openedFor !== id) {
    setOpenedFor(id);
    setValue(book?.page != null ? String(book.page) : '');
    setError(null);
  }

  async function run(work: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await work();
      onSaved();
    } catch {
      setError('That didn’t save. Try again?');
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!book || !supabase) return;
    const n = Number(value);
    if (value.trim() === '' || !Number.isInteger(n) || n < 0) {
      setError('Enter the page you’re on, like 142.');
      return;
    }
    run(() => setReadingPage(supabase!, book.work.id, n));
  }

  return (
    <Modal visible={book !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap} pointerEvents="box-none">
        <View
          style={[styles.sheet, { backgroundColor: theme.backgroundSelected, borderColor: theme.border, paddingBottom: insets.bottom + spacing[4] }]}
          accessibilityViewIsModal
        >
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.label, { color: theme.textSecondary }]}>
            WHERE ARE YOU?
          </Text>
          <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.sheetTitle, { color: theme.text }]} numberOfLines={2}>
            {book?.work.title}
          </Text>
          <View style={styles.pageRow}>
            <Text style={[styles.pageWord, { color: theme.textSecondary }]}>Page</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={`${theme.textSecondary}88`}
              accessibilityLabel="The page you’re on"
              onSubmitEditing={save}
              returnKeyType="done"
              autoFocus
              selectTextOnFocus
              style={[styles.pageInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
            />
            {book?.pages ? <Text style={[styles.pageWord, { color: theme.textSecondary }]}>of {book.pages}</Text> : null}
          </View>
          {error ? <Text style={{ color: theme.accent, fontSize: 14 }}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pill label={busy ? 'Saving…' : 'Save'} busy={busy} onPress={save} />
            <Pill
              label="I’ve finished it"
              kind="quiet"
              disabled={busy}
              onPress={() => book && supabase && run(() => finishReading(supabase!, book.work.id))}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.8 },
  all: { fontSize: 14, fontWeight: '700' },
  scroll: { marginHorizontal: -spacing[4] },
  row: { gap: CardGap, paddingHorizontal: spacing[4] },
  card: {
    flexDirection: 'row',
    gap: spacing[4],
    padding: spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
  },
  skeletonLabel: { width: 140, height: 11, borderRadius: 3, opacity: 0.5 },
  skeletonCard: { height: CoverWidth * 1.5 + spacing[3] * 2, opacity: 0.6 },
  cardBody: { flex: 1, minWidth: 0 },
  title: { fontFamily: DisplayFonts.regular, fontSize: 20, lineHeight: 24 },
  author: { fontSize: 14, marginTop: 2 },
  progress: { marginTop: 'auto', paddingTop: spacing[2], gap: spacing[1] },
  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  where: { fontSize: 13, fontWeight: '600' },
  update: {
    alignSelf: 'flex-start',
    marginTop: spacing[2],
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
  },
  updateLabel: { fontSize: 13, fontWeight: '700' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(31,27,22,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: spacing[3],
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: spacing[1] },
  sheetTitle: { fontFamily: DisplayFonts.regular, fontSize: 26, lineHeight: 31 },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  pageWord: { fontSize: 17 },
  pageInput: { width: 96, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[1] },
});
