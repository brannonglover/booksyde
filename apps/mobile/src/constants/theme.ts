/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { colors as brand } from '@booksyde/theme';
import { Platform } from 'react-native';

// Colours come from the shared @booksyde/theme package so web and mobile match.
export const Colors = {
  light: {
    text: brand.light.text,
    background: brand.light.background,
    backgroundElement: brand.light.surface,
    backgroundSelected: brand.light.surfaceRaised,
    textSecondary: brand.light.textMuted,
    primary: brand.light.primary,
    accent: brand.light.accent,
    highlight: brand.light.highlight,
    border: brand.light.border,
  },
  dark: {
    text: brand.dark.text,
    background: brand.dark.background,
    backgroundElement: brand.dark.surface,
    backgroundSelected: brand.dark.surfaceRaised,
    textSecondary: brand.dark.textMuted,
    primary: brand.dark.primary,
    accent: brand.dark.accent,
    highlight: brand.dark.highlight,
    border: brand.dark.border,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
