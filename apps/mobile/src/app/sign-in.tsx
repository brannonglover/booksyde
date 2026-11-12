import { authErrorMessage, fieldErrors, signInSchema, type FieldErrors, type SignInInput } from '@booksyde/shared';
import { spacing } from '@booksyde/theme';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthHeading, FormError, FormField, PrimaryButton } from '@/components/auth-form';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const webUrl = process.env.EXPO_PUBLIC_WEB_URL;

export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<SignInInput>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    if (!supabase) return setError('Supabase isn’t configured. Copy .env.example to .env.local.');
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (authError) return setError(authErrorMessage(authError));
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthHeading
          kicker="Welcome back"
          title="Your chair is"
          accent="right where you left it"
          body="Sign in to pick up your shelves and your notes in the margins."
        />
        <FormError message={error} />
        <FormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          error={errors.email}
        />
        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
          error={errors.password}
          aside={
            webUrl ? (
              <Pressable onPress={() => Linking.openURL(`${webUrl}/forgot-password`)} hitSlop={8}>
                <Text style={{ color: theme.accent, fontWeight: '700' }}>Forgot it?</Text>
              </Pressable>
            ) : null
          }
        />
        <PrimaryButton label="Sign in" busy={busy} onPress={submit} />
        <View style={styles.switchRow}>
          <Text style={{ color: theme.textSecondary }}>New here?</Text>
          <Link href="/sign-up" replace style={{ color: theme.accent, fontWeight: '700' }}>
            Get a library card
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: spacing[5], paddingTop: spacing[6], gap: spacing[4] },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing[2], marginTop: spacing[3] },
});
