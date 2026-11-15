import { formatRating } from '@booksyde/shared';
import { spacing } from '@booksyde/theme';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { DisplayFonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export type ShelfBook = {
  id: string;
  title: string;
  cover_url: string | null;
  cover_color: string | null;
  avg_rating: number | string | null;
  ratings_count?: number | null;
};

const COVER = 104;

/** Covers standing on a wooden plank that scrolls sideways, with titles and ratings beneath. */
export function Bookshelf({ books }: { books: ShelfBook[] }) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {books.map((w, i) => (
        <Link key={w.id} href={{ pathname: '/book/[id]', params: { id: w.id } }} asChild>
          <Pressable style={styles.slot} accessibilityLabel={w.title}>
            <View style={[styles.standing, { transform: [{ rotate: i % 3 === 1 ? '-2deg' : i % 3 === 2 ? '1deg' : '0deg' }] }]}>
              <BookCover title={w.title} author="" src={w.cover_url} color={w.cover_color} width={COVER} />
            </View>
            {/* Each slot carries its stretch of the plank, so together they make one shelf. */}
            <View style={[styles.plank, { backgroundColor: dark ? '#6E543B' : '#8A6A4A' }]} />
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
              {w.title}
            </Text>
            {w.ratings_count === 0 ? null : (
              <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: 'center' }}>★ {formatRating(Number(w.avg_rating))}</Text>
            )}
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -spacing[4] },
  row: { paddingHorizontal: spacing[4] },
  slot: { width: COVER + spacing[4] },
  standing: { alignItems: 'center', paddingHorizontal: spacing[2], paddingTop: spacing[2] },
  plank: { height: 10, marginBottom: spacing[3] },
  title: { fontFamily: DisplayFonts.regular, fontSize: 17, lineHeight: 19, textAlign: 'center', paddingHorizontal: spacing[1] },
});
