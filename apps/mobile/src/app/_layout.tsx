import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
  useFonts,
} from '@expo-google-fonts/instrument-serif';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { CloseButton } from '@/components/close-button';
import { SplashOverlay } from '@/components/splash-overlay';
import { ThemeTransitionOverlay } from '@/components/theme-transition';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { loadThemePreference } from '@/lib/appearance';

/**
 * An ✕ on screens that slide up as a sheet. On iOS it goes in as a header item without the
 * glass bubble iOS 26 puts behind header buttons, which made it louder than the screen's title.
 */
const closeable = {
  // A render function: the header calls it, so handing it the component itself would run its hooks out of place.
  headerRight: () => <CloseButton />,
  unstable_headerRightItems: () => [{ type: 'custom' as const, element: <CloseButton />, hidesSharedBackground: true }],
};

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
      {/* Covers the app with a copy of the splash, then fades it in. */}
      <SplashOverlay />
      {/* Tabs at the root; book pages slide in on top with a back button. */}
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
          // iOS lets each screen set the status bar, so the stack must follow a theme switch;
          // the StatusBar components alone only take effect at launch.
          statusBarStyle: colorScheme === 'dark' ? 'light' : 'dark',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="book/[id]" options={{ title: '' }} />
        <Stack.Screen name="author/[id]" options={{ title: '' }} />
        <Stack.Screen name="u/[username]" options={{ title: '' }} />
        <Stack.Screen name="shelf/[status]" options={{ title: '' }} />
        <Stack.Screen name="clubs/[slug]" options={{ title: '' }} />
        <Stack.Screen name="clubs/new" options={{ presentation: 'modal', title: 'Start a club', ...closeable }} />
        <Stack.Screen name="settings/profile" options={{ presentation: 'modal', title: 'Edit your bookplate', ...closeable }} />
        <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: 'Sign in', ...closeable }} />
        <Stack.Screen name="sign-up" options={{ presentation: 'modal', title: 'Join Booksyde', ...closeable }} />
      </Stack>
      <ThemeTransitionOverlay />
    </ThemeProvider>
  );
}
