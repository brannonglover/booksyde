import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemePreference } from '@/lib/appearance';

const noopSubscribe = () => () => {};

/**
 * The scheme to render with: the reader's choice, or the browser's setting
 * when they chose "system". To support static rendering this is 'light'
 * during SSR and hydration (useSyncExternalStore's server snapshot), then the
 * real value.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const system = useRNColorScheme();
  const preference = useThemePreference();
  if (!hasHydrated) return 'light';
  return preference === 'system' ? system : preference;
}
