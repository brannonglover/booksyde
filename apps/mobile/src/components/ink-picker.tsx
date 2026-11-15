import { spacing } from '@booksyde/theme';
import { Pressable, StyleSheet, View } from 'react-native';

import { inks } from '@/constants/inks';
import { useTheme } from '@/hooks/use-theme';

/** A row of ink swatches; the chosen one gets a ring. */
export function InkPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {inks.map((i) => {
        const on = value.toLowerCase() === i.hex.toLowerCase();
        return (
          <Pressable
            key={i.hex}
            onPress={() => onChange(i.hex)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={i.name}
            hitSlop={4}
            style={[styles.ring, { borderColor: on ? theme.text : 'transparent' }]}
          >
            <View style={[styles.swatch, { backgroundColor: i.hex }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  ring: { padding: 3, borderRadius: 26, borderWidth: 2 },
  swatch: { width: 38, height: 38, borderRadius: 19 },
});
