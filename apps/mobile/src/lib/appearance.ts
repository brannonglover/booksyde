import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemePreference } from '@booksyde/theme';
import { useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';

/**
 * The reader's light/dark choice ("system" follows the device), saved across
 * launches. On iOS/Android we also set the native override so system UI such
 * as the tab bar and keyboard match; on web the color-scheme hook reads it.
 */
const STORAGE_KEY = 'booksyde-theme';

let preference: ThemePreference = 'system';
const listeners = new Set<() => void>();

function apply(next: ThemePreference) {
  preference = next;
  if (Platform.OS !== 'web') Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
  listeners.forEach((listener) => listener());
}

type TransitionHandler = (commit: () => void) => void;
let transitionHandler: TransitionHandler | null = null;

/**
 * Lets a component animate theme changes: it is handed a `commit` callback to
 * run once it has covered the screen (see components/theme-transition.tsx).
 */
export function registerThemeTransition(handler: TransitionHandler) {
  transitionHandler = handler;
  return () => {
    if (transitionHandler === handler) transitionHandler = null;
  };
}

export function setThemePreference(next: ThemePreference) {
  if (next === preference) return;
  const commit = () => {
    apply(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };
  if (transitionHandler) transitionHandler(commit);
  else commit();
}

/** Restore the saved choice; call once at startup. */
export async function loadThemePreference() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') apply(saved);
  } catch {
    // No storage available (e.g. during static web rendering): follow the device.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribe,
    () => preference,
    () => 'system',
  );
}
