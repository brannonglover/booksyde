/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { type SchemeColors, type Season, seasonColors, SEASONS } from '@booksyde/theme';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSeason } from '@/hooks/use-season';

type AppColors = (typeof Colors)['light'];

/** A season's tokens (seasonColors in @booksyde/theme) over the app's colours, as on the web. */
function withSeason(base: AppColors, c: Partial<SchemeColors>): AppColors {
  return {
    ...base,
    ...(c.background && { background: c.background }),
    ...(c.surface && { backgroundElement: c.surface }),
    ...(c.surfaceRaised && { backgroundSelected: c.surfaceRaised }),
    ...(c.text && { text: c.text }),
    ...(c.textMuted && { textSecondary: c.textMuted }),
    ...(c.border && { border: c.border }),
    ...(c.primary && { primary: c.primary }),
    ...(c.primaryText && { primaryText: c.primaryText }),
    ...(c.accent && { accent: c.accent }),
    ...(c.highlight && { highlight: c.highlight }),
  };
}

const Seasonal = Object.fromEntries(
  SEASONS.map((s) => [s, { light: withSeason(Colors.light, seasonColors[s].light), dark: withSeason(Colors.dark, seasonColors[s].dark) }]),
) as Record<Season, { light: AppColors; dark: AppColors }>;

/** The app's colours for light or dark, in the season's colours through November and December. */
export function useTheme(): AppColors {
  const scheme = useColorScheme();
  const season = useSeason();
  const theme = scheme === 'dark' ? 'dark' : 'light';

  return season ? Seasonal[season][theme] : Colors[theme];
}
