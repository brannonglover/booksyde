import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
  useFonts,
} from '@expo-google-fonts/instrument-serif';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemeTransitionOverlay } from '@/components/theme-transition';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { loadThemePreference } from '@/lib/appearance';

SplashScreen.preventAutoHideAsync();
loadThemePreference();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Keep the splash screen up until the display font is ready.
  const [fontsLoaded] = useFonts({ InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic });
  if (!fontsLoaded) return null;
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {/* Tabs at the root; book pages slide in on top with a back button. */}
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="book/[id]" options={{ title: '' }} />
      </Stack>
      <ThemeTransitionOverlay />
    </ThemeProvider>
  );
}
