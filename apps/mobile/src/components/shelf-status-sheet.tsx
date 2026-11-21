import { READING_STATUS_LABELS, type ShelfMove } from '@booksyde/shared';
import type { ReadingStatus } from '@booksyde/types';
import { radii, spacing } from '@booksyde/theme';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayFonts, DisplayMaxScale } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const statuses: ReadingStatus[] = ['want_to_read', 'reading', 'read', 'did_not_finish'];
const moves: { move: ShelfMove; label: string }[] = [
  { move: 'front', label: 'Move to the front' },
  { move: 'earlier', label: 'Move left' },
  { move: 'later', label: 'Move right' },
  { move: 'end', label: 'Move to the end' },
];

/**
 * A bottom sheet for putting a book on the reader's shelves or moving it
 * between them, opened by long-pressing a cover. `onChoose(null)` means take it
 * off the shelves. With `arrange` (where the book sits on a shelf the reader
 * can order), it also offers moves along that shelf.
 *
 * `status` is null for a book that isn't on the reader's shelves, and
 * undefined while that's still being looked up. With `onSignIn`, the reader is
 * signed out and the sheet asks them to sign in instead.
 */
export function ShelfStatusSheet({
  book,
  arrange,
  onChoose,
  onArrange,
  onSignIn,
  onClose,
}: {
  book: { title: string; status?: ReadingStatus | null } | null;
  arrange?: { index: number; count: number };
  onChoose: (status: ReadingStatus | null) => void;
  onArrange?: (move: ShelfMove) => void;
  onSignIn?: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const loading = book !== null && book.status === undefined && !onSignIn;
  const shelved = Boolean(book?.status);

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
        <Text style={[styles.kicker, { color: theme.textSecondary }]}>{shelved ? 'MOVE TO A SHELF' : 'PUT ON A SHELF'}</Text>
        <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {book?.title}
        </Text>
        {onSignIn ? (
          <>
            <Text style={[styles.note, { color: theme.textSecondary }]}>Sign in to keep track of your books.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onSignIn}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}
            >
              <Text style={[styles.rowText, { color: theme.accent, fontWeight: '700' }]}>Sign in</Text>
            </Pressable>
          </>
        ) : (
          statuses.map((s) => {
            const current = book?.status === s;
            return (
              <Pressable
                key={s}
                accessibilityRole="radio"
                accessibilityState={{ checked: current, disabled: loading }}
                disabled={loading}
                onPress={() => onChoose(s)}
                style={({ pressed }) => [styles.row, { opacity: loading ? 0.5 : 1 }, pressed && { backgroundColor: theme.backgroundElement }]}
              >
                <Text style={[styles.rowText, { color: theme.text }]}>{READING_STATUS_LABELS[s]}</Text>
                {current ? <Text style={[styles.rowText, { color: theme.accent }]}>✓</Text> : null}
                {loading && s === statuses[0] ? <ActivityIndicator color={theme.textSecondary} /> : null}
              </Pressable>
            );
          })
        )}
        {arrange && onArrange && arrange.count > 1 ? (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Text style={[styles.kicker, styles.subKicker, { color: theme.textSecondary }]}>ON THIS SHELF</Text>
            <View style={styles.moveGrid}>
              {moves.map(({ move, label }) => {
                const disabled =
                  move === 'front' || move === 'earlier' ? arrange.index === 0 : arrange.index === arrange.count - 1;
                return (
                  <Pressable
                    key={move}
                    accessibilityRole="button"
                    accessibilityState={{ disabled }}
                    disabled={disabled}
                    onPress={() => onArrange(move)}
                    style={({ pressed }) => [
                      styles.moveButton,
                      { borderColor: theme.border, opacity: disabled ? 0.4 : 1 },
                      pressed && { backgroundColor: theme.backgroundElement },
                    ]}
                  >
                    <Text style={[styles.moveText, { color: theme.text }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
        {shelved ? (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Pressable
              accessibilityRole="button"
              onPress={() => onChoose(null)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}
            >
              <Text style={[styles.rowText, { color: theme.textSecondary }]}>Remove from my shelves</Text>
            </Pressable>
          </>
        ) : null}
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
  note: { fontSize: 15, paddingHorizontal: spacing[3], paddingBottom: spacing[1] },
  subKicker: { paddingTop: spacing[2], paddingBottom: spacing[2] },
  moveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingHorizontal: spacing[3], paddingBottom: spacing[2] },
  moveButton: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  moveText: { fontSize: 15 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing[1], marginHorizontal: spacing[3] },
});
