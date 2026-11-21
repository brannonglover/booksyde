import type { ThemePreference } from '@booksyde/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { setThemePreference, useThemePreference } from '@/lib/appearance';

/** An SF Symbol on iOS, with the matching Material icon on Android and web. */
type Icon = { ios: SymbolViewProps['name']; material: ComponentProps<typeof MaterialIcons>['name'] };
const icons: Record<ThemePreference, Icon> = {
  system: { ios: 'circle.lefthalf.filled', material: 'contrast' },
  light: { ios: 'sun.max', material: 'light-mode' },
  dark: { ios: 'moon', material: 'dark-mode' },
};

function ThemeIcon({ icon, color, size }: { icon: Icon; color: ColorValue; size: number }) {
  return (
    <SymbolView
      name={icon.ios}
      tintColor={color}
      size={size}
      fallback={<MaterialIcons name={icon.material} color={color as string} size={size} />}
    />
  );
}

const options: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Three-way picker: follow the device, or always light / always dark. */
export function AppearancePicker({ center = false }: { center?: boolean }) {
  const theme = useTheme();
  const preference = useThemePreference();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Appearance"
      style={[styles.picker, center && { alignSelf: 'center' }, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
    >
      {options.map(({ value, label }) => {
        const selected = preference === value;
        const color = selected ? theme.primaryText : theme.textSecondary;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => setThemePreference(value)}
            style={[styles.option, selected && { backgroundColor: theme.primary }]}
          >
            <ThemeIcon icon={icons[value]} color={color} size={15} />
            <Text style={[styles.optionLabel, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { flexDirection: 'row', alignSelf: 'flex-start', gap: 4, padding: 4, borderWidth: 1, borderRadius: 999 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  optionLabel: { fontSize: 14, fontWeight: '600' },
});
