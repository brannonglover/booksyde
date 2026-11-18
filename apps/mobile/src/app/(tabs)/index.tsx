import {
  compactCount,
  describeNextRead,
  type FeaturedBook,
  formatRating,
  getFeaturedBook,
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
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { AppearancePicker, ThemeToggleButton } from '@/components/appearance-picker';
import { BackdropStage } from '@/components/backdrop';
import { BookCover } from '@/components/book-cover';
import { Ornament, SectionHeading } from '@/components/page-chrome';
import { Stars } from '@/components/stars';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Wordmark } from '@/components/wordmark';
import { BottomTabInset, DisplayFonts, MaxContentWidth } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useQuickShelf } from '@/hooks/use-quick-shelf';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

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

type Pick = { book: FeaturedBook; caption: { label: string; why: string | null } };

/** The signed-in reader's next read; for everyone else, one of the most-shelved books, a different one each day. */
async function loadFeaturedPick(signedIn: boolean): Promise<Pick | null> {
  const client = supabase;
  if (!client) return null;
  if (signedIn) {
    // e.g. the next_read migration hasn't run yet: fall back to today's pick.
    const pick = await getNextRead(client).catch(() => null);
    const work = pick ? await getWork(client, pick.work.id).catch(() => null) : null;
    if (pick && work) return { book: toFeatured(work), caption: describeNextRead(pick) };
  }
  const book = await getFeaturedBook(client);
  return book ? { book, caption: { label: 'Today’s pick', why: null } } : null;
}

/** Your next read (or today's pick), staged on a backdrop drawn from the book itself. */
function FeaturedPick() {
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const { data, loading } = useAsync(sessionLoading ? null : () => loadFeaturedPick(userId !== null), [userId, sessionLoading]);
  if (sessionLoading || (loading && !data)) {
    return (
      <View>
        <View style={[styles.stageSkeleton, { backgroundColor: theme.border }]} />
        <View style={[styles.caption, { borderBottomColor: theme.border, height: 48 }]} />
      </View>
    );
  }
  const { book, caption } = data ?? { book: fallbackPick, caption: { label: 'Today’s pick', why: null } };
  const stage = (
    <BackdropStage
      work={book}
      cover={<BookCover title={book.title} author={book.author} src={book.cover_url} color={book.cover_color} width={150} />}
    />
  );
  return (
    <View>
      {book.id ? (
        <Link href={{ pathname: '/book/[id]', params: { id: book.id } }} asChild>
          <Pressable accessibilityLabel={`${book.title} by ${book.author}`}>{stage}</Pressable>
        </Link>
      ) : (
        stage
      )}
      <View style={[styles.caption, { borderBottomColor: theme.border }]}>
        <View style={styles.captionRow}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>{caption.label.toUpperCase()}</Text>
          <Text style={[styles.captionText, { color: theme.text }]} numberOfLines={1}>
            <Text style={styles.captionTitle}>{book.title}</Text>
            {book.year ? <Text style={{ color: theme.textSecondary }}> · {book.year}</Text> : null}
          </Text>
        </View>
        {caption.why ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.captionWhy}>
            {caption.why}
          </ThemedText>
        ) : null}
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
              <Text style={[styles.yearValue, { color: theme.text }]}>{value}</Text>
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
function Nightstand() {
  const theme = useTheme();
  const quick = useQuickShelf();
  // undefined while loading; null if it couldn't load.
  const [books, setBooks] = useState<NightstandBook[] | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    getNightstand(supabase, 8)
      .then((b) => live && setBooks(b))
      .catch(() => live && setBooks(null));
    return () => {
      live = false;
    };
  }, []);

  if (books === undefined) return <ActivityIndicator color={theme.textSecondary} style={styles.shelfLoading} />;
  if (!books?.length) {
    return (
      <ThemedText themeColor="textSecondary" style={[styles.shelfEmpty, { borderColor: theme.border }]}>
        {books === null ? 'Couldn’t reach the nightstands just now.' : 'The nightstands are bare for now. Start a book and yours will be the first.'}
      </ThemedText>
    );
  }
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
            <ThemeToggleButton />
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
              <Link href="/sign-up" asChild>
                <Pressable style={StyleSheet.flatten([styles.joinButton, { backgroundColor: theme.primary }])}>
                  <Text style={[styles.buttonLabel, { color: theme.primaryText }]}>Join free</Text>
                </Pressable>
              </Link>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={[styles.kicker, { color: theme.accent }]}>EST. 2026 · A READING ROOM FOR EVERYONE</Text>
            <Text style={[styles.heroTitle, { color: theme.text }]}>
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
                placeholder="Search titles, authors, ISBNs…"
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.text }]}
              />
              <Pressable onPress={search} style={[styles.searchButton, { backgroundColor: theme.primary }]}>
                <Text style={[styles.buttonLabel, { color: theme.primaryText }]}>Search</Text>
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

          <SectionHeading numeral="II" aside={<AsideLink href="/search" label="See all →" />}>
            On everyone’s nightstand
          </SectionHeading>
          <Nightstand />

          <YearInBooksSection numeral="III" />

          <View style={styles.quote}>
            <Ornament center />
            <Text style={[styles.quoteText, { color: theme.text }]}>
              “I declare after all there is no enjoyment like reading!”
            </Text>
            <Text style={[styles.label, { color: theme.textSecondary, textAlign: 'center' }]}>
              JANE AUSTEN, <Text style={styles.italicSmall}>Pride and Prejudice</Text>
            </Text>
          </View>

          <SectionHeading numeral="IV">A few things you’ll love</SectionHeading>
          <View style={[styles.features, { borderColor: theme.border, backgroundColor: theme.border }]}>
            {features.map((f) => (
              <View key={f.title} style={[styles.feature, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.featureNumeral, { color: theme.highlight }]}>{f.numeral}.</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.featureTitle, { color: theme.text }]}>{f.title}</Text>
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
  stageSkeleton: { aspectRatio: 4 / 5, width: '100%', maxWidth: 360, alignSelf: 'center', borderRadius: 28, opacity: 0.5 },
  caption: {
    maxWidth: 360,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  captionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[4] },
  captionText: { flexShrink: 1, textAlign: 'right' },
  captionTitle: { fontFamily: DisplayFonts.italic, fontSize: 18 },
  captionWhy: { marginTop: spacing[1], textAlign: 'right' },
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
  shelfLoading: { paddingVertical: spacing[7] },
  shelfEmpty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radii.md, padding: spacing[5], textAlign: 'center' },
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
