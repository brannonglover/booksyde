import { useWindowDimensions } from 'react-native';

import { MaxContentWidth, WideContentWidth } from '@/constants/theme';

/**
 * The web's Tailwind breakpoints (md 768, lg 1024, xl 1280), read from the
 * window's width so iPad layouts follow the website's tablet and desktop ones.
 * The window, not the screen: on iPad the app may share the screen in Split
 * View or a resizable window, so a 13" iPad can still be phone-narrow.
 *
 * iPad Pro 13" is lg in portrait and xl in landscape; iPad Pro 11" and iPad Air
 * are md in portrait and lg in landscape; every iPhone is below md.
 */
export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const md = width >= 768;
  return {
    width,
    md,
    lg: width >= 1024,
    xl: width >= 1280,
    /** How wide a page's centred column may grow: the web's max-w-6xl from md up. */
    contentWidth: md ? WideContentWidth : MaxContentWidth,
  };
}

/**
 * How many grid columns to use, as Tailwind's `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
 * would: `useColumns(1, { md: 2, lg: 3 })`. Each breakpoint carries the one below it up.
 */
export function useColumns(base: number, at: { md?: number; lg?: number; xl?: number }) {
  const { md, lg, xl } = useBreakpoint();
  let columns = base;
  if (md && at.md) columns = at.md;
  if (lg && at.lg) columns = at.lg;
  if (xl && at.xl) columns = at.xl;
  return columns;
}
