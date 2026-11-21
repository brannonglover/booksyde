import { Platform, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { christmas, thanksgiving } from '@booksyde/theme';

import { HollySprig } from '@/components/holly';
import { MapleLeaf } from '@/components/leaves';
import { DisplayFonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSeason } from '@/hooks/use-season';
import { useTheme } from '@/hooks/use-theme';

/**
 * The Booksyde wordmark: the "oo" is a pair of reading glasses (matches the web
 * header). Frames are ink on the light theme and gilt on the dark theme; the
 * closing period is gilt. Through November a maple leaf rests on the bridge and
 * the period turns rust; through December it's a sprig of holly and a red berry.
 */
export function Wordmark({ size = 30 }: { size?: number }) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const season = useSeason();
  const isChristmas = season === 'christmas';
  const leaf = size * 0.6;
  const sprig = size * 0.46;
  return (
    <Text
      accessible
      accessibilityLabel="Booksyde"
      // The logo is artwork: the glasses are drawn at `size`, so the letters must not grow with the reader's text size.
      allowFontScaling={false}
      style={{ fontFamily: DisplayFonts.regular, fontSize: size, color: theme.text }}
    >
      B
      {/* React Native drops inline views about 0.18em below the baseline (measured on iOS); lift the
          lenses so their bottoms sit on it. On the web they already do. */}
      <View style={{ width: size * 1.09, height: size * 0.52, marginHorizontal: size * 0.03, transform: [{ translateY: Platform.OS === 'web' ? 0 : -size * 0.18 }] }}>
        <ReadingGlasses color={dark ? theme.highlight : theme.text} />
        {isChristmas ? (
          <View style={{ position: 'absolute', top: -size * 0.36, left: (size * 1.09 - sprig * 1.75) / 2, transform: [{ rotate: '-8deg' }] }}>
            <HollySprig color={dark ? '#8DB88F' : '#2F5D46'} height={sprig} />
          </View>
        ) : null}
        {season === 'thanksgiving' ? (
          <View style={{ position: 'absolute', top: -size * 0.44, left: (size * 1.09 - leaf) / 2, transform: [{ rotate: '18deg' }] }}>
            <MapleLeaf color={dark ? '#F09A62' : thanksgiving.rust} size={leaf} />
          </View>
        ) : null}
      </View>
      ksyde
      <Text style={{ color: isChristmas ? christmas.berry : season === 'thanksgiving' ? thanksgiving.rust : theme.highlight }}>.</Text>
    </Text>
  );
}

/** Two round lenses and an arched bridge, in the wordmark's stroke weight. */
export function ReadingGlasses({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="32 27 50 24" fill="none" stroke={color} strokeWidth={3}>
      <Circle cx={44} cy={39} r={10.5} />
      <Circle cx={70} cy={39} r={10.5} />
      <Path d="M54.5 37q2.5-3.5 5 0" strokeWidth={2.5} />
    </Svg>
  );
}
