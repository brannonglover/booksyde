import { radii, spacing } from '@booksyde/theme';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { DisplayFonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/*
 * The page furniture shared by the screens: the fleuron rule, numbered section
 * headings, the centred page header, dashed empty notes and pill buttons.
 */

export function Ornament({ center = false }: { center?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.ornament, center && { alignSelf: 'center' }]}>
      <View style={[styles.ornamentRule, { backgroundColor: theme.highlight }]} />
      <Text style={{ color: theme.highlight, fontSize: 16 }}>❦</Text>
      <View style={[styles.ornamentRule, { backgroundColor: theme.highlight }]} />
    </View>
  );
}

export function SectionHeading({ numeral, children, aside }: { numeral?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.sectionHeading, { borderBottomColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {numeral ? <Text style={[styles.sectionNumeral, { color: theme.highlight }]}>{numeral}. </Text> : null}
        {children}
      </Text>
      {aside}
    </View>
  );
}

/** A centred kicker, display title (with an italic accent word) and lede. */
export function PageHeader({
  kicker,
  before,
  accent,
  after = '.',
  lede,
}: {
  kicker: string;
  before: string;
  accent: string;
  after?: string;
  lede?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <Text style={[styles.kicker, { color: theme.accent }]}>{kicker.toUpperCase()}</Text>
      <Text style={[styles.title, { color: theme.text }]}>
        {before} <Text style={{ fontFamily: DisplayFonts.italic, color: theme.accent }}>{accent}</Text>
        {after}
      </Text>
      <Ornament center />
      {lede ? <Text style={[styles.lede, { color: theme.textSecondary }]}>{lede}</Text> : null}
    </View>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.empty, { borderColor: theme.border }]}>{children}</View>;
}

export function Loading() {
  const theme = useTheme();
  return <ActivityIndicator color={theme.textSecondary} style={{ paddingVertical: spacing[7] }} />;
}

type PillProps = {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'outline' | 'quiet';
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Pill({ label, onPress, kind = 'primary', busy, disabled, small, style }: PillProps) {
  const theme = useTheme();
  const colors =
    kind === 'primary'
      ? { backgroundColor: theme.primary, borderColor: theme.primary, color: theme.primaryText }
      : kind === 'outline'
        ? { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }
        : { backgroundColor: 'transparent', borderColor: 'transparent', color: theme.textSecondary };
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.pill,
        small && styles.pillSmall,
        { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor, opacity: busy || disabled ? 0.6 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[styles.pillLabel, small && { fontSize: 14 }, { color: colors.color }]}>{label}</Text>
    </Pressable>
  );
}

/** A yes/no question before something you can't take back. Resolves true on yes. */
export function confirm(title: string, yes: string, message?: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: yes, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/** Tell the reader something went wrong. */
export function notify(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert(message);
}

const styles = StyleSheet.create({
  ornament: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  ornamentRule: { height: StyleSheet.hairlineWidth * 2, width: 36, opacity: 0.6 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: -spacing[2],
  },
  sectionTitle: { flexShrink: 1, fontFamily: DisplayFonts.regular, fontSize: 34, lineHeight: 38 },
  sectionNumeral: { fontFamily: DisplayFonts.italic, fontSize: 24 },
  header: { alignItems: 'center', gap: spacing[3], paddingTop: spacing[4] },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 3, textAlign: 'center' },
  title: { fontFamily: DisplayFonts.regular, fontSize: 48, lineHeight: 56, textAlign: 'center' },
  lede: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radii.lg, padding: spacing[5], alignItems: 'center', gap: spacing[3] },
  pill: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  pillSmall: { paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  pillLabel: { fontWeight: '700', fontSize: 15 },
});
