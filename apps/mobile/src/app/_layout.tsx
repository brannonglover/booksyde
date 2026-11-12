import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
  useFonts,
} from '@expo-google-fonts/instrument-serif';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ThemeTransitionOverlay } from '@/components/theme-transition';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { loadThemePreference } from '@/lib/appearance';

SplashScreen.preventAutoHideAsync();
loadThemePreference();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // Keep the splash screen up until the display font is ready.
  const [fontsLoaded] = useFonts({ InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic });
  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
      <ThemeTransitionOverlay />
    </ThemeProvider>
  );
}
