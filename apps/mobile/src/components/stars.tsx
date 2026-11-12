import { starParts } from '@booksyde/shared';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Gilt stars with half-star support. `size` is the glyph size in points. */
export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const theme = useTheme();
  const { full, half, empty } = starParts(Math.round(rating * 2) / 2);
  const box = { width: size, height: size * 1.3 };
  const glyph = { fontSize: size, lineHeight: size * 1.3 };
  const star = (key: string, fill: 'full' | 'half' | 'empty') => (
    <View key={key} style={box}>
      <Text style={[glyph, { color: theme.highlight, opacity: fill === 'full' ? 1 : 0.25 }]}>★</Text>
      {fill === 'half' ? (
        <View style={[styles.half, { width: size / 2, height: size * 1.3 }]}>
          <Text style={[glyph, { color: theme.highlight }]}>★</Text>
        </View>
      ) : null}
    </View>
  );
  return (
    <View style={styles.row} accessibilityLabel={`${rating} out of 5 stars`}>
      {Array.from({ length: full }, (_, i) => star(`f${i}`, 'full'))}
      {half ? star('h', 'half') : null}
      {Array.from({ length: empty }, (_, i) => star(`e${i}`, 'empty'))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  half: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
});
