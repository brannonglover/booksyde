import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * The scheme to render with. On iOS/Android the reader's choice is applied as
 * a native override (see lib/appearance.ts), so React Native's hook already
 * reflects it.
 */
export function useColorScheme() {
  return useRNColorScheme();
}
