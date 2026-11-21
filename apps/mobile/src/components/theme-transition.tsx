import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { captureScreen, releaseCapture } from 'react-native-view-shot';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { registerThemeTransition } from '@/lib/appearance';

/*
 * Crossfades light/dark switches, as the web does with a view transition
 * (apps/web/src/lib/theme.ts): take a picture of the screen, lay it on top,
 * switch the theme underneath, and once the new colours have drawn, fade the
 * picture away. The page never blanks; it blends from one theme to the other.
 * Skipped when the reader prefers reduced motion.
 */

// The web's ::view-transition timing (apps/web/src/app/globals.css).
const FADE_MS = 500;
const EASING = Easing.bezier(0.4, 0, 0.2, 1);
/** Start the fade anyway if the scheme doesn't change (e.g. dark → "system" on a dark phone). */
const SETTLE_MS = 400;

type Cover = { kind: 'snapshot'; uri: string } | { kind: 'colour'; colour: string };

export function ThemeTransitionOverlay() {
  const scheme = useColorScheme();
  const reduceMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0));
  const [cover, setCover] = useState<Cover | null>(null);

  // Read the latest values from the handler without re-registering it.
  const latest = useRef({ scheme, reduceMotion });
  useEffect(() => {
    latest.current = { scheme, reduceMotion };
  }, [scheme, reduceMotion]);

  // The next step of a switch in progress, run when the cover has loaded or the new theme has rendered.
  const pending = useRef<{ onCoverShown?: () => void; onThemeDrawn?: () => void } | null>(null);

  useEffect(() => {
    const fadeOut = (done: () => void) =>
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: EASING,
        useNativeDriver: Platform.OS !== 'web',
      }).start(({ finished }) => finished && done());

    return registerThemeTransition((commit) => {
      if (latest.current.reduceMotion) {
        commit();
        return;
      }
      opacity.stopAnimation();
      opacity.setValue(1);

      // Once the cover is on screen: switch the theme beneath it, wait for the new colours to
      // render (or a moment, if the scheme doesn't change), then fade the cover away.
      const switchUnderCover = (cleanup: () => void) => {
        let faded = false;
        const fade = () => {
          if (faded) return;
          faded = true;
          pending.current = null;
          // One more frame so the new theme is on screen, not just committed.
          requestAnimationFrame(() => fadeOut(cleanup));
        };
        pending.current = { onThemeDrawn: fade };
        commit();
        setTimeout(fade, SETTLE_MS);
      };

      // No snapshot (the web build, or an app build without the native module): cover with the
      // outgoing background instead, which blanks the screen briefly but still softens the switch.
      const colourCover = () => {
        setCover({ kind: 'colour', colour: Colors[latest.current.scheme === 'dark' ? 'dark' : 'light'].background });
        requestAnimationFrame(() => switchUnderCover(() => setCover(null)));
      };

      if (Platform.OS === 'web') {
        colourCover();
        return;
      }
      // captureScreen throws rather than rejects when the native module is missing.
      Promise.resolve()
        .then(() => captureScreen({ format: 'jpg', quality: 0.9, result: 'tmpfile' }))
        .then((uri) => {
          pending.current = {
            onCoverShown: () => {
              pending.current = null;
              switchUnderCover(() => {
                setCover(null);
                releaseCapture(uri);
              });
            },
          };
          setCover({ kind: 'snapshot', uri });
        }, colourCover);
    });
  }, [opacity]);

  // The new scheme has rendered: start the fade.
  useEffect(() => {
    pending.current?.onThemeDrawn?.();
  }, [scheme]);

  if (!cover) return null;
  if (cover.kind === 'colour') {
    return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: cover.colour, opacity }]} />;
  }
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Image
        source={{ uri: cover.uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        fadeDuration={0}
        // Switch the theme only once the picture is actually covering the screen.
        onLoad={() => pending.current?.onCoverShown?.()}
        onError={() => pending.current?.onCoverShown?.()}
      />
    </Animated.View>
  );
}
