import { radii, spacing } from '@booksyde/theme';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { DisplayFonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  secure?: boolean;
};

/** Labelled text input with room for a hint or an error. `secure` adds a Show/Hide toggle. */
export function FormField({ label, error, hint, aside, secure, style, ...input }: FieldProps) {
  const theme = useTheme();
  const [shown, setShown] = useState(false);
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label.toUpperCase()}</Text>
        {aside}
      </View>
      <View>
        <TextInput
          placeholderTextColor={`${theme.textSecondary}88`}
          secureTextEntry={secure && !shown}
          accessibilityLabel={label}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: error ? theme.accent : theme.border },
            secure && { paddingRight: 72 },
            style,
          ]}
          {...input}
        />
        {secure ? (
          <Pressable
            onPress={() => setShown((s) => !s)}
            style={styles.showButton}
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
            hitSlop={8}
          >
            <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>{shown ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={{ color: theme.accent, fontSize: 13 }}>{error}</Text>
      ) : typeof hint === 'string' ? (
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{hint}</Text>
      ) : (
        hint
      )}
    </View>
  );
}

export function PrimaryButton({ label, busy, onPress }: { label: string; busy?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
    >
      {busy ? <ActivityIndicator color={theme.primaryText} /> : <Text style={[styles.primaryLabel, { color: theme.primaryText }]}>{label}</Text>}
    </Pressable>
  );
}

export function FormError({ message }: { message?: string | null }) {
  const theme = useTheme();
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={[styles.formError, { borderColor: theme.accent, backgroundColor: theme.backgroundElement }]}>
      <Text style={{ color: theme.text }}>{message}</Text>
    </View>
  );
}

export function AuthHeading({ kicker, title, accent, body }: { kicker: string; title: string; accent: string; body: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing[2], marginBottom: spacing[2] }}>
      <Text style={[styles.kicker, { color: theme.accent }]}>{kicker.toUpperCase()}</Text>
      <Text style={[styles.title, { color: theme.text }]}>
        {title} <Text style={[styles.titleAccent, { color: theme.accent }]}>{accent}</Text>.
      </Text>
      <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 23 }}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  input: { borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3] + 2, fontSize: 16 },
  showButton: { position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: spacing[3] },
  primary: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill, paddingVertical: spacing[4], marginTop: spacing[2] },
  primaryLabel: { fontWeight: '700', fontSize: 16 },
  formError: { borderWidth: 1, borderRadius: radii.lg, padding: spacing[3] },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2.4 },
  title: { fontFamily: DisplayFonts.regular, fontSize: 44, lineHeight: 46 },
  titleAccent: { fontFamily: DisplayFonts.italic },
});
