import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * An ✕ for the header of a screen that slides up as a sheet (sign in, join,
 * start a club, edit your bookplate). Swiping the sheet down still works, but
 * isn't something every reader knows to try.
 */
export function CloseButton() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canDismiss() ? router.dismiss() : router.back())}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={10}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
    >
      <SymbolView
        name="xmark"
        size={14}
        weight="semibold"
        tintColor={theme.textSecondary}
        fallback={<MaterialIcons name="close" size={18} color={theme.textSecondary} />}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
});
