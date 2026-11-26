import { palette } from '@booksyde/theme';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * Matches the native splash (the expo-splash-screen plugin in app.config.js):
 * the same green, and the spectacles centred at the same width. Change them together.
 */
const LogoWidth = 160;
const LogoAspect = 798 / 391;

const Hold = 250;
const Fade = 550;

/**
 * Takes over from the native splash with an exact copy of it, so the handoff
 * can't be seen, then lifts the spectacles a little and fades away, bringing
 * the app in underneath. With Reduce Motion on, it only fades.
 */
export function SplashOverlay() {
  const [visible, setVisible] = useState(true);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  const overlay = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const logo = useAnimatedStyle(() => ({ transform: [{ scale: reduceMotion ? 1 : 1 + progress.value * 0.08 }] }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.overlay, overlay]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={() => {
        // The copy is drawn: swap the native splash for it, then fade.
        SplashScreen.hideAsync()
          .catch(() => {})
          .finally(() => {
            progress.value = withDelay(
              Hold,
              withTiming(1, { duration: Fade, easing: Easing.out(Easing.cubic) }, (finished) => {
                'worklet';
                if (finished) scheduleOnRN(setVisible, false);
              }),
            );
          });
      }}
    >
      <Animated.View style={logo}>
        <View style={styles.logoBox}>
          <Image source={require('@/assets/images/splash-icon.png')} style={StyleSheet.absoluteFill} contentFit="contain" />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  logoBox: { width: LogoWidth, height: LogoWidth / LogoAspect },
});
