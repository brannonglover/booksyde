import { formatRating, starParts } from '@booksyde/shared';
import { genreColor, palette, radii, spacing } from '@booksyde/theme';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  return (
    <Text style={{ color: palette.sunshine }}>
      {'★'.repeat(full)}
      {half ? '⯪' : ''}
      <Text style={{ opacity: 0.25 }}>{'★'.repeat(empty)}</Text>
    </Text>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.wordmark, { color: theme.text }]}>
            booksyde<Text style={{ color: palette.coral }}>.</Text>
          </Text>

          <View style={styles.hero}>
            <View style={[styles.blob, { backgroundColor: palette.coral, top: -40, right: -30 }]} />
            <View style={[styles.blob, { backgroundColor: palette.sunshine, bottom: -60, left: 60 }]} />
            <Text style={styles.heroKicker}>📚 Your reading life, but fun</Text>
            <Text style={styles.heroTitle}>
              Find your next <Text style={{ color: palette.sunshine }}>obsession.</Text>
            </Text>
          </View>

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
                <ThemedText type="small">
                  <Stars rating={book.rating} /> {formatRating(book.rating)}
                </ThemedText>
              </View>
            ))}
          </ScrollView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  scroll: { padding: spacing[4], paddingBottom: BottomTabInset + spacing[6], gap: spacing[4] },
  wordmark: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  hero: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    backgroundColor: palette.grape,
    padding: spacing[5],
    paddingVertical: spacing[7],
    gap: spacing[3],
  },
  blob: { position: 'absolute', width: 160, height: 160, borderRadius: 80, opacity: 0.6 },
  heroKicker: { color: 'white', fontWeight: '600', opacity: 0.9 },
  heroTitle: { color: 'white', fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1 },
  heading: { fontSize: 24, lineHeight: 30, marginTop: spacing[3] },
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
});
