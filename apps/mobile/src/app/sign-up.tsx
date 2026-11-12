import {
  authErrorMessage,
  fieldErrors,
  isUsernameAvailable,
  signUpSchema,
  usernameSchema,
  type FieldErrors,
  type SignUpInput,
} from '@booksyde/shared';
import { palette, spacing } from '@booksyde/theme';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthHeading, FormError, FormField, PrimaryButton } from '@/components/auth-form';
import { DisplayFonts, Fonts, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/** "Margot Okafor" → "margot_okafor" (fits the username rules). */
function suggestUsername(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

type Availability = { username: string; free: boolean };

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [errors, setErrors] = useState<FieldErrors<SignUpInput>>({});
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Check the username a moment after the reader stops typing.
  useEffect(() => {
    if (!supabase || !usernameSchema.safeParse(username).success) return;
    const client = supabase;
    let cancelled = false;
    const timer = setTimeout(() => {
      isUsernameAvailable(client, username)
        .then((free) => !cancelled && setAvailability({ username, free }))
        .catch(() => {});
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  const submit = async () => {
    setError(null);
    const parsed = signUpSchema.safeParse({ displayName, username, email, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    if (!supabase) return setError('Supabase isn’t configured. Copy .env.example to .env.local.');
    setBusy(true);
    try {
      if (!(await isUsernameAvailable(supabase, parsed.data.username))) {
        setErrors({ username: 'Someone already has that username. Try another?' });
        return;
      }
      const { data, error: authError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { data: { username: parsed.data.username, display_name: parsed.data.displayName } },
      });
      if (authError) return setError(authErrorMessage(authError));
      if (!data.session) return setSentTo(parsed.data.email);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ fontSize: 44 }}>✉️</Text>
        <Text style={[styles.inboxTitle, { color: theme.text }]}>Check your inbox</Text>
        <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 16 }}>
          We sent a link to {sentTo}. Tap it to confirm your email and your library card is ready.
        </Text>
      </View>
    );
  }

  const formatOk = !username || usernameSchema.safeParse(username).success;
  const known = availability?.username === username ? availability.free : null;
  const usernameHint = !username ? (
    'This is your @handle. Letters, numbers and underscores.'
  ) : !formatOk ? (
    <Text style={{ color: theme.accent, fontSize: 13 }}>3–30 characters: letters, numbers and underscores</Text>
  ) : known === true ? (
    <Text style={{ color: theme.highlight, fontSize: 13 }}>✓ @{username} is yours if you want it</Text>
  ) : known === false ? (
    <Text style={{ color: theme.accent, fontSize: 13 }}>Someone already has @{username}. Try another?</Text>
  ) : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthHeading
          kicker="Join Booksyde"
          title="Get your"
          accent="library card"
          body="Track what you read, find your next favorite by mood, and swap notes with readers like you."
        />

        {/* The card fills itself in as the reader types. */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>BOOKSYDE LENDING LIBRARY</Text>
          </View>
          {[
            ['NAME', displayName || 'Your name here'],
            ['CARD NO.', username ? `@${username}` : '@your_username'],
            ['MEMBER SINCE', 'Today'],
          ].map(([label, value]) => (
            <View key={label} style={styles.cardRow}>
              <Text style={[styles.mono, { fontSize: 10, opacity: 0.7, letterSpacing: 1.2 }]}>{label}</Text>
              <Text numberOfLines={1} style={[styles.mono, { fontSize: 13, flexShrink: 1 }]}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        <FormError message={error} />
        <FormField
          label="Your name"
          value={displayName}
          onChangeText={(v) => {
            setDisplayName(v);
            if (!usernameEdited) setUsername(suggestUsername(v));
          }}
          placeholder="Margot Okafor"
          autoComplete="name"
          textContentType="name"
          error={errors.displayName}
        />
        <FormField
          label="Username"
          value={username}
          onChangeText={(v) => {
            setUsernameEdited(true);
            setUsername(v.toLowerCase().replace(/\s/g, '_'));
          }}
          placeholder="margot_reads"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          error={errors.username}
          hint={usernameHint}
        />
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
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
          hint="At least 8 characters."
        />
        <PrimaryButton label="Get my library card" busy={busy} onPress={submit} />
        <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 12 }}>
          Free forever. No ads, no selling your reading history.
        </Text>
        <View style={styles.switchRow}>
          <Text style={{ color: theme.textSecondary }}>Already a member?</Text>
          <Link href="/sign-in" replace style={{ color: theme.accent, fontWeight: '700' }}>
            Sign in
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: spacing[5], paddingTop: spacing[6], gap: spacing[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[6] },
  inboxTitle: { fontFamily: DisplayFonts.regular, fontSize: 36 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing[2], marginTop: spacing[2] },
  card: {
    backgroundColor: '#F6EBD3',
    borderColor: '#D8C7A3',
    borderWidth: 1,
    borderRadius: 6,
    padding: spacing[4],
    gap: spacing[2],
    transform: [{ rotate: '-1.5deg' }],
    marginVertical: spacing[2],
  },
  cardHeader: { borderBottomWidth: 2, borderBottomColor: 'rgba(139,58,43,0.4)', paddingBottom: spacing[2] },
  cardLabel: { color: palette.ink, fontSize: 10, fontWeight: '800', letterSpacing: 2.4 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  mono: { fontFamily: Fonts?.mono, color: palette.ink },
});
