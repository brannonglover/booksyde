import { formatRating } from '@booksyde/shared';
import { genreColor, palette, radii, spacing } from '@booksyde/theme';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppearancePicker, ThemeToggleButton } from '@/components/appearance-picker';
import { BookCover } from '@/components/book-cover';
import { Stars } from '@/components/stars';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, DisplayFonts, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// On web the tab bar floats over the top of the screen; start the masthead below it.
const WebTabBarHeight = 72;

// Placeholder shelf until the catalog is wired up. Cover ids are Open Library's.
const nightstand = [
  { id: '00000000-0000-4000-b000-000000000001', title: 'Pride and Prejudice', author: 'Jane Austen', coverId: 14348537, rating: 4.5 },
  { id: '00000000-0000-4000-b000-000000000007', title: 'Wuthering Heights', author: 'Emily Brontë', coverId: 12818862, rating: 4 },
  { id: '00000000-0000-4000-b000-000000000006', title: 'Jane Eyre', author: 'Charlotte Brontë', coverId: 8235363, rating: 4.5 },
  { id: '00000000-0000-4000-b000-000000000002', title: 'Frankenstein', author: 'Mary Shelley', coverId: 12356249, rating: 4 },
  { id: '00000000-0000-4000-b000-000000000003', title: 'Moby-Dick', author: 'Herman Melville', coverId: 10544254, rating: 3.5 },
];

const moods = [
  ['fantasy', 'Fantasy'],
  ['romance', 'Romance'],
  ['mystery', 'Mystery'],
  ['thriller', 'Thriller'],
  ['science-fiction', 'Sci-fi'],
  ['horror', 'Gothic'],
  ['literary-fiction', 'Literary'],
  ['poetry', 'Poetry'],
] as const;

const features = [
  { numeral: 'i', title: 'Read by mood', body: 'Cozy, dark, hopeful, tense: find the book that suits tonight.' },
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

export default function HomeScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
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
            <Pressable style={[styles.joinButton, { backgroundColor: theme.primary }]}>
              <Text style={[styles.buttonLabel, { color: theme.primaryText }]}>Join free</Text>
            </Pressable>
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
                placeholder="Search titles, authors, ISBNs…"
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.text }]}
              />
              <Pressable style={[styles.searchButton, { backgroundColor: theme.primary }]}>
                <Text style={[styles.buttonLabel, { color: theme.primaryText }]}>Search</Text>
              </Pressable>
            </View>
          </View>

          {/* Tonight's pick, framed in a library-window arch */}
          <View>
            <View style={styles.arch}>
              <View style={styles.archInner} />
              <View style={styles.archBook}>
                <BookCover title="Pride and Prejudice" author="Jane Austen" coverId={14348537} width={132} />
              </View>
            </View>
            <View style={[styles.caption, { borderBottomColor: theme.border }]}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>TONIGHT’S PICK</Text>
              <Text style={{ color: theme.text }}>
                <Text style={styles.captionTitle}>Pride and Prejudice</Text>
                <Text style={{ color: theme.textSecondary }}> · 1813</Text>
              </Text>
            </View>
          </View>

          <SectionHeading numeral="I">What are you in the mood for?</SectionHeading>
          <View style={styles.chips}>
            {moods.map(([slug, label]) => (
              <View
                key={slug}
                style={[styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              >
                <View style={[styles.chipDot, { backgroundColor: genreColor(slug).dot }]} />
                <Text style={[styles.chipLabel, { color: theme.text }]}>{label}</Text>
              </View>
            ))}
          </View>

          <SectionHeading numeral="II">On everyone’s nightstand</SectionHeading>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shelf}
            style={styles.shelfScroll}
          >
            {nightstand.map((book) => (
              <Link key={book.title} href={{ pathname: '/book/[id]', params: { id: book.id } }} asChild>
              <Pressable style={styles.book}>
                <BookCover title={book.title} author={book.author} coverId={book.coverId} width={128} />
                <Text style={[styles.bookTitle, { color: theme.text }]} numberOfLines={1}>
                  {book.title}
                </Text>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {book.author}
                </ThemedText>
                <View style={styles.ratingRow}>
                  <Stars rating={book.rating} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatRating(book.rating)}
                  </ThemedText>
                </View>
              </Pressable>
              </Link>
            ))}
          </ScrollView>

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
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    maxWidth: 360,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  captionTitle: { fontFamily: DisplayFonts.italic, fontSize: 18 },
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
  quote: { gap: spacing[4], paddingVertical: spacing[4] },
  quoteText: { fontFamily: DisplayFonts.italic, fontSize: 30, lineHeight: 36, textAlign: 'center' },
  features: { borderWidth: 1, borderRadius: radii.md, overflow: 'hidden', gap: 1 },
  feature: { flexDirection: 'row', gap: spacing[4], padding: spacing[4] },
  featureNumeral: { fontFamily: DisplayFonts.italic, fontSize: 26, width: 32 },
  featureTitle: { fontFamily: DisplayFonts.regular, fontSize: 22, lineHeight: 26 },
});
