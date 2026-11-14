import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { DisplayFonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The Booksyde wordmark: the "oo" is a pair of reading glasses (matches the web
 * header). Frames are ink on the light theme and gilt on the dark theme; the
 * closing period is always gilt.
 */
export function Wordmark({ size = 30 }: { size?: number }) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  return (
    <Text
      accessible
      accessibilityLabel="Booksyde"
      style={{ fontFamily: DisplayFonts.regular, fontSize: size, color: theme.text }}
    >
      B
      {/* Inline views sit on the text baseline, which is where the lenses' bottoms belong. */}
      <View style={{ width: size * 1.09, height: size * 0.52, marginHorizontal: size * 0.03 }}>
        <ReadingGlasses color={dark ? theme.highlight : theme.text} />
      </View>
      ksyde<Text style={{ color: theme.highlight }}>.</Text>
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
