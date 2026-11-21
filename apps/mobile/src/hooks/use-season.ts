import { resolveSeason, type Season } from '@booksyde/theme';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

/**
 * The season on the reader's own clock (Christmas through December; see
 * seasonOn in @booksyde/theme). Checked again whenever the app comes back to
 * the foreground, so it turns over on 1 December without a restart. One
 * shared store, since every useTheme() call reads it.
 * EXPO_PUBLIC_SEASON=christmas (or off) forces it in development, for previewing.
 */
const override = __DEV__ ? process.env.EXPO_PUBLIC_SEASON : undefined;

let current = resolveSeason(override);
const listeners = new Set<() => void>();

AppState.addEventListener('change', (state) => {
  if (state !== 'active') return;
  const next = resolveSeason(override);
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSeason(): Season | null {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
