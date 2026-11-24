import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** "Book 3 of Red Rising" on a result card, so a sequel never passes for a first book. */
export function SeriesLine({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color: theme.accent }]} accessibilityElementsHidden importantForAccessibility="no">
        ❧
      </Text>
      <Text numberOfLines={1} style={[styles.text, { color: theme.accent, flexShrink: 1 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, minWidth: 0 },
  text: { fontSize: 14, fontWeight: '500' },
});
