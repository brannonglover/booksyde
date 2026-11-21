import {
  compactCount,
  describeNextRead,
  type FeaturedBook,
  formatRating,
  getFeaturedBook,
  getMyReadingDesk,
  getNextRead,
  getNightstand,
  getWork,
  getYearInBooks,
  type NightstandBook,
  toFeatured,
  type YearInBooks,
} from '@booksyde/shared';
import { coverUrl, genreColor, radii, spacing } from '@booksyde/theme';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { AppearancePicker } from '@/components/appearance-picker';
import { BookCover } from '@/components/book-cover';
import { BookObject } from '@/components/book-object';
import { Ornament, SectionHeading } from '@/components/page-chrome';
import { Stars } from '@/components/stars';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Wordmark } from '@/components/wordmark';
import { BottomTabInset, ChromeMaxScale, DisplayFonts, DisplayMaxScale, MaxContentWidth } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useQuickShelf } from '@/hooks/use-quick-shelf';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { webUrl } from '@/lib/web-url';

// On web the tab bar floats over the top of the screen; start the masthead below it.
const WebTabBarHeight = 72;

const moods = [
  ['fantasy', 'Fantasy'],
  ['romance', 'Romance'],
  ['mystery', 'Mystery'],
  ['thriller', 'Thriller'],
  ['science-fiction', 'Science fiction'],
  ['horror', 'Gothic & horror'],
  ['literary-fiction', 'Literary'],
  ['historical-fiction', 'Historical'],
  ['non-fiction', 'Non-fiction'],
  ['poetry', 'Poetry'],
] as const;

const features = [
  { numeral: 'i', title: 'Read by mood', body: 'Cozy, dark, hopeful, tense: find the book that suits your mood.' },
  { numeral: 'ii', title: 'Half-stars, finally', body: 'Because some books are a 3.5, and that’s all right.' },
  { numeral: 'iii', title: 'Buddy reads', body: 'Read alongside friends, with no spoilers past your page.' },
];

/** Shown when the catalogue is empty (or unreachable), so the hero is never bare. */
const fallbackPick: FeaturedBook = {
  id: '',
  title: 'Pride and Prejudice',
  author: 'Jane Austen',
  year: 1813,
  cover_url: coverUrl(14348537),
  cover_color: null,
  backdrop_style: null,
  tags: [],
};

/**
 * Today's pick, the same one the web home page shows. Before Booksyde has a
 * crowd the web picks from the bestseller list, which needs its server key, so
 * ask it; if the web can't be reached, work out the pick here (a classic, then).
 */
async function loadTodaysPick(): Promise<FeaturedBook | null> {
  // Don't hold the hero up for long on a slow connection.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 6000);
  try {
    const res = await fetch(`${webUrl}/api/featured`, { signal: abort.signal });
    if (res.ok) {
      const { book } = (await res.json()) as { book: FeaturedBook | null };
      if (book) return book;
    }
  } catch {
    // Offline or the web is down: fall through.
  } finally {
    clearTimeout(timer);
  }
  return supabase ? getFeaturedBook(supabase).catch(() => null) : null;
}

type Pick = {
  book: FeaturedBook;
  /** Null for today's pick; the reader's own next read otherwise. */
  personal: {
    caption: { label: string; why: string | null };
    reading: boolean;
    page: number | null;
    pages: number | null;
  } | null;
};

/** The signed-in reader's next read, with their place in it if they've started; null when signed out or nothing fits. */
async function loadPersonalPick(): Promise<Pick | null> {
  const client = supabase;
  if (!client) return null;
  try {
    const pick = await getNextRead(client);
    if (!pick) return null;
    const reading = pick.reason === 'reading';
    const [work, desk] = await Promise.all([getWork(client, pick.work.id), reading ? getMyReadingDesk(client).catch(() => null) : null]);
    if (!work) return null;
    const onDesk = desk?.find((b) => b.work.id === pick.work.id);
    return {
      book: toFeatured(work),
      personal: {
        caption: describeNextRead(pick),
        reading,
        page: onDesk?.page ?? null,
        // The longest edition's count unless we know which edition they're holding.
        pages: onDesk?.pages ?? (Math.max(0, ...work.editions.map((e) => e.page_count ?? 0)) || null),
      },
    };
  } catch {
    // e.g. the next_read migration hasn't run yet: show today's pick instead.
    return null;
  }
}

async function loadFeaturedPick(signedIn: boolean): Promise<Pick> {
  const personal = signedIn ? await loadPersonalPick() : null;
  if (personal) return personal;
  return { book: (await loadTodaysPick()) ?? fallbackPick, personal: null };
}

/** How wide the featured book is drawn: 58% of the web's 384pt figure, or of the screen when narrower. */
function useFeaturedWidth() {
  const { width } = useWindowDimensions();
  return Math.round(Math.min(384, width - spacing[4] * 2) * 0.58);
}

/** Your next read (or today's pick when signed out), drawn as a book; with a bookmark if you've started it. As on the web. */
function FeaturedPick() {
  const theme = useTheme();
  const bookWidth = useFeaturedWidth();
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const { data, loading } = useAsync(sessionLoading ? null : () => loadFeaturedPick(userId !== null), [userId, sessionLoading]);
  if (sessionLoading || (loading && !data)) {
    return (
      <View style={styles.figure}>
        <View style={styles.art}>
          <View style={[styles.bookSkeleton, { width: bookWidth, backgroundColor: theme.border }]} />
        </View>
        <View style={[styles.captionSkeleton, { backgroundColor: theme.border }]} />
      </View>
    );
  }
  const { book, personal } = data ?? { book: fallbackPick, personal: null };
  const reading = personal?.reading ?? false;
  const label = (text: string) => (
    <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.label, { color: theme.textSecondary }]}>
      {text.toUpperCase()}
    </Text>
  );
  const titleLine = (
    <Text style={[styles.captionText, { color: theme.text }]} numberOfLines={1}>
      <Text style={styles.captionTitle}>{book.title}</Text>
      {book.author ? <Text style={{ color: theme.textSecondary }}> · {book.author}</Text> : null}
    </Text>
  );
  const percent = personal?.page != null && personal.pages ? Math.min(100, Math.round((personal.page / personal.pages) * 100)) : null;

  return (
    <View style={styles.figure}>
      {/* A pick that isn't in the catalogue yet goes to search, where it can be found and added. */}
      <Link
        href={
          book.id
            ? { pathname: '/book/[id]', params: { id: book.id } }
            : { pathname: '/search', params: { q: `${book.title} ${book.author}`.trim() } }
        }
        asChild
      >
        {/* Link's slot drops a style function, so the layout lives on a plain View inside. */}
        <Pressable accessibilityLabel={`${book.title} by ${book.author}`}>
          {({ pressed }) => (
            <View style={[styles.art, pressed && { opacity: 0.85 }]}>
              <View style={{ transform: [{ rotate: '-2deg' }, { translateY: pressed ? -4 : 0 }] }}>
                <BookObject
                  width={bookWidth}
                  ribbon={reading}
                  cover={<BookCover title={book.title} author={book.author} src={book.cover_url} color={book.cover_color} width={bookWidth} />}
                />
              </View>
            </View>
          )}
        </Pressable>
      </Link>
      <View style={[styles.caption, { borderBottomColor: theme.border }]}>
        {personal && reading ? (
          <>
            <View style={styles.captionRow}>
              {label(personal.caption.label)}
              {percent != null ? <Text style={[styles.captionTitle, { color: theme.accent }]}>{percent}%</Text> : null}
            </View>
            <View style={{ marginTop: spacing[1] }}>{titleLine}</View>
            {percent != null ? (
              <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: theme.accent }]} />
              </View>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: spacing[2] }}>
              {personal.page != null ? (personal.pages ? `Page ${personal.page} of ${personal.pages}` : `Page ${personal.page}`) : 'Pick up where you left off'}
            </ThemedText>
          </>
        ) : personal ? (
          // A book they haven't started: why it's next is the news.
          <>
            {label(personal.caption.label)}
            {personal.caption.why ? (
              <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.captionWhy, { color: theme.text }]}>
                {personal.caption.why}
              </Text>
            ) : null}
            <View style={{ marginTop: spacing[1] }}>{titleLine}</View>
          </>
        ) : (
          <View style={styles.captionRow}>
            {label('Today’s pick')}
            <Text style={[styles.captionText, { color: theme.text, textAlign: 'right' }]} numberOfLines={1}>
              <Text style={styles.captionTitle}>{book.title}</Text>
              {book.year ? <Text style={{ color: theme.textSecondary }}> · {book.year}</Text> : null}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const numberFormat = new Intl.NumberFormat('en');

// Spines between 100 and 900 pages scale from short and slim to tall and thick.
function spineSize(pages: number | null) {
  const t = pages == null ? 0.4 : Math.min(Math.max((pages - 100) / 800, 0), 1);
  return { height: Math.round(54 + t * 44), width: Math.round(12 + t * 8) };
}

/** The year as a shelf of spines: the reader's own when signed in, everyone's when signed out. */
function YearInBooksSection({ numeral }: { numeral: string }) {
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const { data: year } = useAsync<YearInBooks | null>(
    sessionLoading || !supabase ? null : () => getYearInBooks(supabase!, { userId, spines: 18 }).catch(() => null),
    [userId, sessionLoading],
  );
  const mine = year?.scope === 'mine';
  const label = year?.year ?? new Date().getUTCFullYear();
  const empty = !year || year.books === 0;
  const body = mine
    ? empty
      ? `Nothing finished yet in ${label}. Mark a book as read and its spine lands here.`
      : `Every book you finished in ${label}, lined up on one shelf.`
    : empty
      ? `Every book our readers finish in ${label} lines up here. Join and add yours.`
      : `Every book our readers finished in ${label}, lined up on one shelf. Join and add yours.`;
  return (
    <>
      <SectionHeading numeral={numeral}>{mine ? 'Your year in books' : 'Booksyde’s year in books'}</SectionHeading>
      <View style={[styles.year, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <ThemedText themeColor="textSecondary" style={{ fontSize: 16, lineHeight: 23 }}>
          {body}
        </ThemedText>
        <View style={styles.yearStats}>
          {[
            ['BOOKS', year ? numberFormat.format(year.books) : '—'],
            ['PAGES', year ? numberFormat.format(year.pages) : '—'],
          ].map(([name, value]) => (
            <View key={name}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{name}</Text>
              <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.yearValue, { color: theme.text }]}>{value}</Text>
            </View>
          ))}
        </View>
        <View>
          <View style={styles.spines}>
            {year?.spines.map((s, i) => {
              const { height, width } = spineSize(s.pages);
              return (
                <Link key={`${s.workId}-${i}`} href={{ pathname: '/book/[id]', params: { id: s.workId } }} asChild>
                  <Pressable
                    accessibilityLabel={s.title}
                    style={[styles.spine, { height, width, backgroundColor: genreColor(s.genre ?? 'default').dot }]}
                  >
                    {i % 3 === 0 ? <View style={styles.spineBand} /> : null}
                  </Pressable>
                </Link>
              );
            })}
            {empty ? (
              <Text style={[styles.captionTitle, { color: theme.textSecondary, marginBottom: spacing[3] }]}>
                {mine ? 'Your shelf is waiting.' : 'The shelf is waiting.'}
              </Text>
            ) : null}
          </View>
          <View style={styles.plank} />
        </View>
      </View>
    </>
  );
}

/** The books the most readers have open right now. */
/**
 * The books the most readers have open right now, or null while there's no such
 * shelf to show. Until enough different readers have a book open, nightstand_works
 * sends catalogue books with no reader counts, and the section stays hidden (as on
 * the web); it stays hidden while loading or if it can't load, too.
 */
function useNightstandBooks() {
  const [books, setBooks] = useState<NightstandBook[] | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    getNightstand(supabase, 8)
      .then((b) => live && setBooks(b.some((book) => book.readers > 0) ? b : null))
      .catch(() => live && setBooks(null));
    return () => {
      live = false;
    };
  }, []);
  return books;
}

/** "On everyone's nightstand": a sideways shelf of the books readers have open. */
function Nightstand({ books }: { books: NightstandBook[] }) {
  const theme = useTheme();
  const quick = useQuickShelf();
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf} style={styles.shelfScroll}>
        {books.map((book) => (
          <Link key={book.id} href={{ pathname: '/book/[id]', params: { id: book.id } }} asChild>
            <Pressable
              style={styles.book}
              onLongPress={() => quick.open(book)}
              delayLongPress={400}
              accessibilityHint="Press and hold to put it on a shelf"
            >
              <BookCover title={book.title} author={book.author} src={book.cover_url} color={book.cover_color} width={128} />
              <Text style={[styles.bookTitle, { color: theme.text }]} numberOfLines={1}>
                {book.title}
              </Text>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {book.author}
              </ThemedText>
              <View style={styles.ratingRow}>
                {book.ratings_count > 0 ? (
                  <>
                    <Stars rating={book.avg_rating} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatRating(book.avg_rating)}
                    </ThemedText>
                  </>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    No ratings yet
                  </ThemedText>
                )}
              </View>
              {book.readers > 0 ? (
                <Text style={[styles.readers, { color: theme.accent }]}>{compactCount(book.readers)} READING NOW</Text>
              ) : null}
            </Pressable>
          </Link>
        ))}
      </ScrollView>
      {quick.sheet}
    </>
  );
}

function AsideLink({ href, label }: { href: '/discover' | '/search'; label: string }) {
  const theme = useTheme();
  return (
    <Link href={href} style={{ color: theme.accent, fontWeight: '700', fontSize: 14 }}>
      {label}
    </Link>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const nightstand = useNightstandBooks();
  const search = () => router.navigate({ pathname: '/search', params: query.trim() ? { q: query.trim() } : {} });
  return (
    <ThemedView style={styles.container}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? WebTabBarHeight : insets.top, paddingBottom: insets.bottom + BottomTabInset + spacing[7] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.masthead, { borderBottomColor: theme.border }]}>
          <Wordmark />
          <View style={styles.mastheadActions}>
            {profile ? (
              <Link href={{ pathname: '/u/[username]', params: { username: profile.username } }} asChild>
                <Pressable
                  accessibilityLabel={`Your profile, ${profile.display_name || profile.username}`}
                  style={styles.avatar}
                >
                  <Avatar name={profile.display_name || profile.username} src={profile.avatar_url} ink={profile.theme_color ?? theme.primary} size={36} />
                </Pressable>
              </Link>
            ) : (
              <>
                {/* As on the web: a quiet way back in for readers who joined there, beside the way to join. */}
                <Link href="/sign-in" asChild>
                  <Pressable hitSlop={6} style={styles.signInButton}>
                    <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.signInLabel, { color: theme.text }]}>Sign in</Text>
                  </Pressable>
                </Link>
                <Link href="/sign-up" asChild>
                  <Pressable style={StyleSheet.flatten([styles.joinButton, { backgroundColor: theme.primary }])}>
                    <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.buttonLabel, { color: theme.primaryText }]}>Join free</Text>
                  </Pressable>
                </Link>
              </>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {/* Hero */}
          <View style={styles.hero}>
            <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.kicker, { color: theme.accent }]}>EST. 2026 · A READING ROOM FOR EVERYONE</Text>
            <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.heroTitle, { color: theme.text }]}>
              Settle in with your next <Text style={[styles.italic, { color: theme.accent }]}>favorite</Text> book.
            </Text>
            <Ornament />
            <ThemedText themeColor="textSecondary" style={styles.lede}>
              Keep track of what you read, find books that suit your mood, and trade recommendations with friends.
            </ThemedText>
            <View style={[styles.search, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={search}
                returnKeyType="search"
                autoCapitalize="none"
                placeholder="Title, author or ISBN"
                maxFontSizeMultiplier={ChromeMaxScale}
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.text }]}
              />
              <Pressable onPress={search} style={[styles.searchButton, { backgroundColor: theme.primary }]}>
                <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.buttonLabel, { color: theme.primaryText }]}>Search</Text>
              </Pressable>
            </View>
          </View>

          {/* Your next read (or today's pick), staged on a backdrop drawn from the book itself */}
          <FeaturedPick />

          <SectionHeading numeral="I" aside={<AsideLink href="/discover" label="Discover more →" />}>
            What are you in the mood for?
          </SectionHeading>
          <View style={styles.chips}>
            {moods.map(([slug, label]) => (
              <Link key={slug} href={{ pathname: '/search', params: { tags: slug } }} asChild>
                <Pressable
                  style={StyleSheet.flatten([styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }])}
                >
                  <View style={[styles.chipDot, { backgroundColor: genreColor(slug).dot }]} />
                  <Text style={[styles.chipLabel, { color: theme.text }]}>{label}</Text>
                </Pressable>
              </Link>
            ))}
          </View>

          {/* Only once readers have books open; the numbering after it follows, as on the web. */}
          {nightstand ? (
            <>
              <SectionHeading numeral="II" aside={<AsideLink href="/search" label="See all →" />}>
                On everyone’s nightstand
              </SectionHeading>
              <Nightstand books={nightstand} />
            </>
          ) : null}

          <YearInBooksSection numeral={nightstand ? 'III' : 'II'} />

          <View style={styles.quote}>
            <Ornament center />
            <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.quoteText, { color: theme.text }]}>
              “I declare after all there is no enjoyment like reading!”
            </Text>
            <Text style={[styles.label, { color: theme.textSecondary, textAlign: 'center' }]}>
              JANE AUSTEN, <Text style={styles.italicSmall}>Pride and Prejudice</Text>
            </Text>
          </View>

          <SectionHeading numeral={nightstand ? 'IV' : 'III'}>A few things you’ll love</SectionHeading>
          <View style={[styles.features, { borderColor: theme.border, backgroundColor: theme.border }]}>
            {features.map((f) => (
              <View key={f.title} style={[styles.feature, { backgroundColor: theme.backgroundElement }]}>
                <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.featureNumeral, { color: theme.highlight }]}>{f.numeral}.</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.featureTitle, { color: theme.text }]}>{f.title}</Text>
                  <ThemedText type="small" themeColor="textSecondary">
                    {f.body}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.colophon, { borderTopColor: theme.border }]}>
            <Wordmark size={24} />
            <Text style={[styles.colophonText, { color: theme.textSecondary }]}>Made for readers.</Text>
            <Text style={[styles.label, { color: theme.textSecondary, marginTop: spacing[3] }]}>APPEARANCE</Text>
            <AppearancePicker />
            {profile ? (
              <View style={styles.signedInRow}>
                <Text style={{ color: theme.textSecondary }}>Signed in as @{profile.username}</Text>
                <Pressable onPress={() => supabase?.auth.signOut()} hitSlop={8}>
                  <Text style={{ color: theme.accent, fontWeight: '700' }}>Sign out</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.signedInRow}>
                <Text style={{ color: theme.textSecondary }}>Already a member?</Text>
                <Link href="/sign-in" style={{ color: theme.accent, fontWeight: '700' }}>
                  Sign in
                </Link>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mastheadActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  colophon: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[5], gap: spacing[2] },
  colophonText: { fontFamily: DisplayFonts.italic, fontSize: 16 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  signedInRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  joinButton: { borderRadius: radii.pill, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  signInButton: { paddingHorizontal: spacing[2], paddingVertical: spacing[2] },
  signInLabel: { fontWeight: '600', fontSize: 14 },
  buttonLabel: { fontWeight: '700', fontSize: 14 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing[4],
    gap: spacing[6],
  },
  hero: { paddingTop: spacing[6], gap: spacing[4] },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  heroTitle: { fontFamily: DisplayFonts.regular, fontSize: 54, lineHeight: 62, letterSpacing: -0.5 },
  italic: { fontFamily: DisplayFonts.italic },
  italicSmall: { fontFamily: DisplayFonts.italic, letterSpacing: 0, fontSize: 13 },
  lede: { fontSize: 17, lineHeight: 25 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderRadius: radii.pill,
    padding: 6,
    paddingLeft: spacing[4],
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: spacing[2] },
  searchButton: { borderRadius: radii.pill, paddingHorizontal: spacing[4], paddingVertical: spacing[2] + 2 },
  // As on the web: a 384pt-wide figure, the book centred with room above and a shadow below.
  figure: { width: '100%', maxWidth: 384, alignSelf: 'center' },
  art: { alignItems: 'center', paddingTop: spacing[5], paddingBottom: spacing[7] + spacing[2] },
  bookSkeleton: { aspectRatio: 2 / 3, borderRadius: 3, opacity: 0.5 },
  captionSkeleton: { height: 24, borderRadius: 4, opacity: 0.4, marginTop: spacing[3] },
  caption: { paddingBottom: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth },
  captionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[4] },
  captionText: { flexShrink: 1, fontSize: 14 },
  captionTitle: { fontFamily: DisplayFonts.italic, fontSize: 18 },
  captionWhy: { marginTop: spacing[2], fontFamily: DisplayFonts.regular, fontSize: 24, lineHeight: 30 },
  progressTrack: { marginTop: spacing[3], height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing[3] + 2,
    paddingVertical: spacing[2],
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipLabel: { fontWeight: '600', fontSize: 15 },
  shelfScroll: { marginHorizontal: -spacing[4] },
  shelf: { gap: spacing[4], paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  book: { width: 128, gap: 2 },
  bookTitle: { fontFamily: DisplayFonts.regular, fontSize: 19, lineHeight: 22, marginTop: spacing[3] },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  readers: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginTop: 2 },
  year: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.lg, padding: spacing[5], gap: spacing[4] },
  yearStats: { flexDirection: 'row', gap: spacing[6] },
  yearValue: { fontFamily: DisplayFonts.regular, fontSize: 44, lineHeight: 52 },
  spines: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 104, overflow: 'hidden', paddingHorizontal: spacing[2] },
  spine: { borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  spineBand: { position: 'absolute', left: 0, right: 0, top: 12, height: 4, backgroundColor: 'rgba(184,137,58,0.7)' },
  plank: { height: 10, borderRadius: 2, backgroundColor: '#8A6A4A' },
  quote: { gap: spacing[4], paddingVertical: spacing[4] },
  quoteText: { fontFamily: DisplayFonts.italic, fontSize: 30, lineHeight: 36, textAlign: 'center' },
  features: { borderWidth: 1, borderRadius: radii.md, overflow: 'hidden', gap: 1 },
  feature: { flexDirection: 'row', gap: spacing[4], padding: spacing[4] },
  featureNumeral: { fontFamily: DisplayFonts.italic, fontSize: 26, width: 32 },
  featureTitle: { fontFamily: DisplayFonts.regular, fontSize: 22, lineHeight: 26 },
});
