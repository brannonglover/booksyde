import { formatRating, starParts } from '@booksyde/shared';
import { genreColor, mixHex, palette, radii, spacing } from '@booksyde/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Placeholder shelf until the catalog is wired up (matches supabase/seed.sql).
const trending = [
  { title: 'Pride and Prejudice', author: 'Jane Austen', color: '#C2416B', rating: 4.5 },
  { title: 'Frankenstein', author: 'Mary Shelley', color: '#2F6B5E', rating: 4 },
  { title: 'Dracula', author: 'Bram Stoker', color: '#7A1F2B', rating: 4 },
  { title: 'Moby-Dick', author: 'Herman Melville', color: '#2457A6', rating: 3.5 },
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', color: '#C9A227', rating: 4 },
];

const genres = [
  ['fantasy', 'Fantasy'],
  ['romance', 'Romance'],
  ['thriller', 'Thriller'],
  ['science-fiction', 'Sci-fi'],
  ['horror', 'Horror'],
  ['young-adult', 'Young adult'],
] as const;

function Stars({ rating }: { rating: number }) {
  const { full, half, empty } = starParts(rating);
  const star = (key: string, fill: 'full' | 'half' | 'empty') => (
    <View key={key} style={styles.star}>
      <Text style={[styles.starGlyph, { color: palette.sunshine, opacity: fill === 'full' ? 1 : 0.25 }]}>★</Text>
      {fill === 'half' ? (
        <View style={styles.starHalf}>
          <Text style={[styles.starGlyph, { color: palette.sunshine }]}>★</Text>
        </View>
      ) : null}
    </View>
  );
  return (
    <View style={styles.stars} accessibilityLabel={`${rating} out of 5 stars`}>
      {Array.from({ length: full }, (_, i) => star(`f${i}`, 'full'))}
      {half ? star('h', 'half') : null}
      {Array.from({ length: empty }, (_, i) => star(`e${i}`, 'empty'))}
    </View>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Edge-to-edge hero that fades into the page background instead of a floating card. */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing[3] }]}>
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={[palette.grape, palette.grape, mixHex(palette.grape, theme.background, 0.65), theme.background]}
            locations={[0, 0.45, 0.78, 1]}
          />
          {/* Soft colour washes (React Native has no cross-platform blur, so no hard-edged blobs). */}
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={[`${palette.coral}99`, `${palette.bubblegum}33`, `${palette.grape}00`]}
            locations={[0, 0.35, 0.7]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.2, y: 0.8 }}
          />
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={[`${palette.sky}00`, `${palette.sky}55`, `${palette.sky}00`]}
            locations={[0.1, 0.45, 0.85]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 0.6, y: 1 }}
          />

          {/* Last layer: fade everything into the page so the hero has no bottom edge. */}
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={[`${theme.background}00`, theme.background]}
            locations={[0.72, 1]}
          />

          <View style={styles.heroInner}>
            <Text style={styles.wordmark}>
              booksyde<Text style={{ color: palette.sunshine }}>.</Text>
            </Text>
            <Text style={styles.heroKicker}>📚 Your reading life, but fun</Text>
            <Text style={styles.heroTitle}>
              Find your next <Text style={{ color: palette.sunshine }}>obsession.</Text>
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.heading}>
            Pick a vibe
          </ThemedText>
          <View style={styles.chips}>
            {genres.map(([slug, label]) => {
              const c = genreColor(slug);
              return (
                <Text key={slug} style={[styles.chip, { backgroundColor: c.bg, color: c.fg }]}>
                  {label}
                </Text>
              );
            })}
          </View>

          <ThemedText type="subtitle" style={styles.heading}>
            Trending this week
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
            {trending.map((book) => (
              <View key={book.title} style={styles.book}>
                <View style={[styles.cover, { backgroundColor: book.color }]}>
                  <Text style={styles.coverTitle}>{book.title}</Text>
                </View>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {book.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {book.author}
                </ThemedText>
                <View style={styles.ratingRow}>
                  <Stars rating={book.rating} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatRating(book.rating)}
                  </ThemedText>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  scroll: { paddingBottom: BottomTabInset + spacing[6] },
  hero: { overflow: 'hidden', paddingBottom: spacing[8] + spacing[6] },
  heroInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing[4],
    gap: spacing[4],
  },
  wordmark: { color: 'white', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: spacing[6] },
  heroKicker: { color: 'white', fontWeight: '600', opacity: 0.9 },
  heroTitle: { color: 'white', fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1 },
  heading: { fontSize: 24, lineHeight: 30, marginTop: spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    overflow: 'hidden',
    borderRadius: radii.pill,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    fontWeight: '700',
  },
  shelf: { gap: spacing[4] },
  book: { width: 130, gap: 2 },
  cover: {
    aspectRatio: 2 / 3,
    borderRadius: radii.md,
    padding: spacing[3],
    justifyContent: 'flex-end',
    marginBottom: spacing[2],
  },
  coverTitle: { color: 'white', fontWeight: '800', fontSize: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  stars: { flexDirection: 'row' },
  star: { width: 14, height: 18 },
  starGlyph: { fontSize: 14, lineHeight: 18 },
  starHalf: { position: 'absolute', top: 0, left: 0, width: 7, height: 18, overflow: 'hidden' },
});
