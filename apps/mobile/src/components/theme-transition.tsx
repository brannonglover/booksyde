import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { registerThemeTransition } from '@/lib/appearance';

const FADE_MS = 450;

/**
 * Softens light/dark switches: covers the screen in the outgoing background
 * colour, swaps the theme underneath, then fades the cover away — like a lamp
 * being turned up or down. Skipped when the reader prefers reduced motion.
 */
export function ThemeTransitionOverlay() {
  const scheme = useColorScheme();
  const reduceMotion = useReducedMotion();
  const outgoingBackground = Colors[scheme === 'dark' ? 'dark' : 'light'].background;
  const [opacity] = useState(() => new Animated.Value(0));
  const [cover, setCover] = useState<string | null>(null);

  // Read the latest values from the handler without re-registering it.
  const latest = useRef({ outgoingBackground, reduceMotion });
  useEffect(() => {
    latest.current = { outgoingBackground, reduceMotion };
  }, [outgoingBackground, reduceMotion]);

  useEffect(
    () =>
      registerThemeTransition((commit) => {
        if (latest.current.reduceMotion) {
          commit();
          return;
        }
        opacity.stopAnimation();
        opacity.setValue(1);
        setCover(latest.current.outgoingBackground);
        // Let the cover paint first, then swap the theme beneath it and fade out.
        requestAnimationFrame(() => {
          commit();
          Animated.timing(opacity, {
            toValue: 0,
            duration: FADE_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }).start(({ finished }) => finished && setCover(null));
        });
      }),
    [opacity],
  );

  if (!cover) return null;
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: cover, opacity }]} />;
}
