import {
  compactCount,
  describeNextRead,
  formatRating,
  getNextRead,
  getNightstand,
  type NextRead,
  type NightstandBook,
} from '@booksyde/shared';
import { genreColor, palette, radii, spacing } from '@booksyde/theme';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppearancePicker, ThemeToggleButton } from '@/components/appearance-picker';
import { BookCover } from '@/components/book-cover';
import { Stars } from '@/components/stars';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, DisplayFonts, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
  ['science-fiction', 'Sci-fi'],
  ['gothic', 'Gothic'],
  ['literary-fiction', 'Literary'],
  ['poetry', 'Poetry'],
] as const;

const features = [
  { numeral: 'i', title: 'Read by mood', body: 'Cozy, dark, hopeful, tense: find the book that suits your mood.' },
  { numeral: 'ii', title: 'Half-stars, finally', body: 'Because some books are a 3.5, and that’s all right.' },
  { numeral: 'iii', title: 'Buddy reads', body: 'Read alongside friends, with no spoilers past your page.' },
];

function Ornament({ center = false }: { center?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.ornament, center && { alignSelf: 'center' }]}>
      <View style={[styles.ornamentRule, { backgroundColor: theme.highlight }]} />
      <Text style={{ color: theme.highlight, fontSize: 16 }}>❦</Text>
      <View style={[styles.ornamentRule, { backgroundColor: theme.highlight }]} />
    </View>
  );
}

function SectionHeading({ numeral, children }: { numeral: string; children: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.sectionHeading, { borderBottomColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        <Text style={[styles.sectionNumeral, { color: theme.highlight }]}>{numeral}. </Text>
        {children}
      </Text>
    </View>
  );
}

/** Shown when signed out, or when the reader's shelves don't suggest anything yet. */
const fallbackPick = {
  label: 'Today’s pick',
  why: null,
  work: { id: '', title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, cover_url: null, cover_color: null },
};

/** The signed-in reader's next read in the arch window; a classic for everyone else. */
function NextReadWindow() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  // Keyed by reader, so a pick never outlives a sign-out or account switch.
  const [loaded, setLoaded] = useState<{ userId: string; pick: NextRead | null } | null>(null);
  const pick = userId && loaded?.userId === userId ? loaded.pick : null;
  useEffect(() => {
    if (!supabase || !userId) return;
    let live = true;
    getNextRead(supabase)
      .then((p) => live && setLoaded({ userId, pick: p }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);

  const { label, why, work } = pick ? { ...describeNextRead(pick), work: pick.work } : fallbackPick;
  const stage = (
    <View style={styles.arch}>
      <View style={styles.archInner} />
      <View style={styles.archBook}>
        <BookCover
          title={work.title}
          author={work.author}
          src={work.cover_url}
          coverId={work.id ? null : 14348537}
          color={work.cover_color}
          width={132}
        />
      </View>
    </View>
  );
  return (
    <View>
      {work.id ? (
        <Link href={{ pathname: '/book/[id]', params: { id: work.id } }} asChild>
          <Pressable accessibilityLabel={`${work.title} by ${work.author}`}>{stage}</Pressable>
        </Link>
      ) : (
        stage
      )}
      <View style={[styles.caption, { borderBottomColor: theme.border }]}>
        <View style={styles.captionRow}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>{label.toUpperCase()}</Text>
          <Text style={[styles.captionText, { color: theme.text }]} numberOfLines={1}>
            <Text style={styles.captionTitle}>{work.title}</Text>
            {work.year ? <Text style={{ color: theme.textSecondary }}> · {work.year}</Text> : null}
          </Text>
        </View>
        {why ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.captionWhy}>
            {why}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

/** The books the most readers have open right now. */
function Nightstand() {
  const theme = useTheme();
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf} style={styles.shelfScroll}>
      {books.map((book) => (
        <Link key={book.id} href={{ pathname: '/book/[id]', params: { id: book.id } }} asChild>
          <Pressable style={styles.book}>
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
        contentContainerStyle={[styles.scroll, { paddingTop: Platform.OS === 'web' ? WebTabBarHeight : insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.masthead, { borderBottomColor: theme.border }]}>
          <Text style={[styles.wordmark, { color: theme.text }]}>
            Booksyde<Text style={{ color: theme.highlight }}>.</Text>
          </Text>
          <View style={styles.mastheadActions}>
            <ThemeToggleButton />
            {profile ? (
              <Link href={{ pathname: '/u/[username]', params: { username: profile.username } }} asChild>
                <Pressable
                  accessibilityLabel={`Your profile, ${profile.display_name || profile.username}`}
                  style={StyleSheet.flatten([styles.avatar, { backgroundColor: profile.theme_color ?? theme.primary }])}
                >
                  <Text style={styles.avatarInitial}>{(profile.display_name || profile.username).charAt(0).toUpperCase()}</Text>
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

          {/* Your next read, framed in a library-window arch */}
          <NextReadWindow />


          <SectionHeading numeral="I">What are you in the mood for?</SectionHeading>
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

          <SectionHeading numeral="II">On everyone’s nightstand</SectionHeading>
          <Nightstand />

          <View style={styles.quote}>
            <Ornament center />
            <Text style={[styles.quoteText, { color: theme.text }]}>
              “I declare after all there is no enjoyment like reading!”
            </Text>
            <Text style={[styles.label, { color: theme.textSecondary, textAlign: 'center' }]}>
              JANE AUSTEN, <Text style={styles.italicSmall}>Pride and Prejudice</Text>
            </Text>
          </View>

          <SectionHeading numeral="III">A better place to keep your books</SectionHeading>
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
            <Text style={[styles.wordmark, { color: theme.text, fontSize: 24 }]}>
              Booksyde<Text style={{ color: theme.highlight }}>.</Text>
            </Text>
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
  scroll: { paddingBottom: BottomTabInset + spacing[7] },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  wordmark: { fontFamily: DisplayFonts.regular, fontSize: 30 },
  mastheadActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  colophon: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[5], gap: spacing[2] },
  colophonText: { fontFamily: DisplayFonts.italic, fontSize: 16 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: palette.paper, fontFamily: DisplayFonts.regular, fontSize: 20 },
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
  heroTitle: { fontFamily: DisplayFonts.regular, fontSize: 54, lineHeight: 54, letterSpacing: -0.5 },
  italic: { fontFamily: DisplayFonts.italic },
  italicSmall: { fontFamily: DisplayFonts.italic, letterSpacing: 0, fontSize: 13 },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  ornamentRule: { height: StyleSheet.hairlineWidth * 2, width: 36, opacity: 0.6 },
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
  arch: {
    aspectRatio: 4 / 5,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: palette.green,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  archInner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(184,137,58,0.45)',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  archBook: { marginTop: spacing[7], transform: [{ rotate: '-2deg' }] },
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
  sectionHeading: { paddingBottom: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: -spacing[2] },
  sectionTitle: { fontFamily: DisplayFonts.regular, fontSize: 34, lineHeight: 38 },
  sectionNumeral: { fontFamily: DisplayFonts.italic, fontSize: 24 },
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
  quote: { gap: spacing[4], paddingVertical: spacing[4] },
  quoteText: { fontFamily: DisplayFonts.italic, fontSize: 30, lineHeight: 36, textAlign: 'center' },
  features: { borderWidth: 1, borderRadius: radii.md, overflow: 'hidden', gap: 1 },
  feature: { flexDirection: 'row', gap: spacing[4], padding: spacing[4] },
  featureNumeral: { fontFamily: DisplayFonts.italic, fontSize: 26, width: 32 },
  featureTitle: { fontFamily: DisplayFonts.regular, fontSize: 22, lineHeight: 26 },
});
