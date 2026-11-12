import { coverUrl, mixHex, palette } from '@booksyde/theme';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { DisplayFonts } from '@/constants/theme';

type BookCoverProps = {
  title: string;
  author: string;
  width: number;
  /** Full cover image URL (e.g. works.cover_url). */
  src?: string | null;
  /** Or an Open Library cover id. */
  coverId?: number | null;
  /** Cloth colour for the typeset fallback cover (e.g. works.cover_color). */
  color?: string | null;
};

/** A book cover in a clean frame: real cover art when we have it, a simple typeset cover when we don't. */
export function BookCover({ title, author, width, src, coverId, color }: BookCoverProps) {
  const url = src ?? (coverId ? coverUrl(coverId, 'M') : null);
  return (
    <View style={[styles.frame, { width }]}>
      {url ? (
        <Image
          source={url}
          style={styles.image}
          contentFit="cover"
          transition={200}
          accessibilityLabel={`Cover of ${title} by ${author}`}
        />
      ) : (
        <View
          style={[styles.fallback, { backgroundColor: color ? mixHex(color, palette.ink, 0.35) : palette.green }]}
          accessibilityLabel={`${title} by ${author}`}
        >
          <View style={styles.fallbackBorder} />
          <Text style={[styles.fallbackTitle, { fontSize: Math.max(14, width * 0.13) }]}>{title}</Text>
          <Text style={styles.fallbackStar}>✦</Text>
          {author ? <Text style={styles.fallbackAuthor}>{author.toUpperCase()}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 2 / 3,
    borderRadius: 3,
    backgroundColor: '#E4DACA',
    shadowColor: '#1F1B16',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  image: { flex: 1, borderRadius: 3 },
  fallback: { flex: 1, borderRadius: 3, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  fallbackBorder: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(184,137,58,0.6)',
  },
  fallbackTitle: { color: palette.paper, fontFamily: DisplayFonts.regular, textAlign: 'center' },
  fallbackStar: { color: palette.gilt },
  fallbackAuthor: { color: 'rgba(250,246,238,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center' },
});
