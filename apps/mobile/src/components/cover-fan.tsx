import { mixHex, palette } from '@booksyde/theme';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

export type FanCover = { id: string; cover_url: string | null; cover_color: string | null };

/** Three overlapping covers; tinted blanks stand in when there are fewer. `width` is each cover's width. */
export function CoverFan({ covers, tint, edge, width = 35 }: { covers: FanCover[]; tint: string; edge: string; width?: number }) {
  const height = Math.round(width * 1.5);
  return (
    <View style={{ flexDirection: 'row' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((i) => {
        const c = covers[i];
        return (
          <View
            key={c?.id ?? i}
            style={[
              styles.cover,
              {
                width,
                height,
                marginLeft: i === 0 ? 0 : -Math.round(width * 0.34),
                zIndex: 3 - i,
                borderColor: edge,
                backgroundColor: c?.cover_color ? mixHex(c.cover_color, palette.ink, 0.35) : mixHex(tint, palette.paper, i * 0.25),
              },
            ]}
          >
            {c?.cover_url ? <Image source={c.cover_url} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: 3, borderWidth: 2, overflow: 'hidden' },
});
