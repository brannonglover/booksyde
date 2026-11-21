/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { christmasColors } from '@booksyde/theme';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSeason } from '@/hooks/use-season';

/** Through December the accent turns holly red (christmasColors in @booksyde/theme), as on the web. */
const Christmas = {
  light: { ...Colors.light, ...christmasColors.light },
  dark: { ...Colors.dark, ...christmasColors.dark },
};

export function useTheme() {
  const scheme = useColorScheme();
  const season = useSeason();
  const theme = scheme === 'dark' ? 'dark' : 'light';

  return season === 'christmas' ? Christmas[theme] : Colors[theme];
}
