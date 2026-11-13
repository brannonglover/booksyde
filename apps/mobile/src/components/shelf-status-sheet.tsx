import { READING_STATUS_LABELS } from '@booksyde/shared';
import type { ReadingStatus } from '@booksyde/types';
import { radii, spacing } from '@booksyde/theme';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayFonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const statuses: ReadingStatus[] = ['want_to_read', 'reading', 'read', 'did_not_finish'];

/**
 * A bottom sheet for moving a book between the reader's shelves, opened by
 * long-pressing a cover. `onChoose(null)` means take it off the shelves.
 */
export function ShelfStatusSheet({
  book,
  onChoose,
  onClose,
}: {
  book: { title: string; status: ReadingStatus } | null;
  onChoose: (status: ReadingStatus | null) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={book !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.backgroundSelected, borderColor: theme.border, paddingBottom: insets.bottom + spacing[3] },
        ]}
        accessibilityViewIsModal
      >
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <Text style={[styles.kicker, { color: theme.textSecondary }]}>MOVE TO A SHELF</Text>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {book?.title}
        </Text>
        {statuses.map((s) => {
          const current = book?.status === s;
          return (
            <Pressable
              key={s}
              accessibilityRole="radio"
              accessibilityState={{ checked: current }}
              onPress={() => onChoose(s)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}
            >
              <Text style={[styles.rowText, { color: theme.text }]}>{READING_STATUS_LABELS[s]}</Text>
              {current ? <Text style={[styles.rowText, { color: theme.accent }]}>✓</Text> : null}
            </Pressable>
          );
        })}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Pressable
          accessibilityRole="button"
          onPress={() => onChoose(null)}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}
        >
          <Text style={[styles.rowText, { color: theme.textSecondary }]}>Remove from my shelves</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(31,27,22,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: spacing[3] },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 2, paddingHorizontal: spacing[3] },
  title: { fontFamily: DisplayFonts.regular, fontSize: 26, paddingHorizontal: spacing[3], marginBottom: spacing[2] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
  },
  rowText: { fontSize: 17 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing[1], marginHorizontal: spacing[3] },
});
