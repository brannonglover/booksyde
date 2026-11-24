import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * A soft glow of a book's own colour in a card's top-left corner, like the
 * blurred wash behind the web catalogue cards. The card should clip it
 * (`overflow: 'hidden'`).
 */
export function TintWash({ color, opacity = 0.3 }: { color: string; opacity?: number }) {
  const id = `wash-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <View pointerEvents="none" style={styles.wash} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.45} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { position: 'absolute', left: -110, top: -120, width: 320, height: 320 },
});
