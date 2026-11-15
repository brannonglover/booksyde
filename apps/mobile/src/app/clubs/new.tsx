import { clubInputSchema, clubSlug, createClub, fieldErrors } from '@booksyde/shared';
import { radii, spacing } from '@booksyde/theme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { FormError, FormField, PrimaryButton } from '@/components/auth-form';
import { ClubCardFace } from '@/components/club-card';
import { DEFAULT_INK } from '@/constants/inks';
import { DisplayFonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { InkPicker } from '@/components/ink-picker';

/** Start a club: name it, give it a colour and choose who can join. Mirrors apps/web/src/app/clubs/new. */
export default function NewClubScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, loading } = useSession();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ink, setInk] = useState(DEFAULT_INK);
  const [isPrivate, setIsPrivate] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!supabase) return;
    const parsed = clubInputSchema.safeParse({
      name,
      description: description.trim() || null,
      cover_color: ink,
      is_private: isPrivate,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setError(null);
    setBusy(true);
    try {
      const { slug } = await createClub(supabase, parsed.data);
      router.replace({ pathname: '/clubs/[slug]', params: { slug } });
    } catch {
      setError('We couldn’t start your club. Please try again.');
      setBusy(false);
    }
  }

  if (!loading && !session) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text, textAlign: 'center' }]}>Sign in to start a club.</Text>
        <PrimaryButton label="Sign in" onPress={() => router.replace('/sign-in')} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 23 }}>
          Name it, give it a colour, and choose who can join. You can pick the first book next.
        </Text>
        <FormError message={error} />
        <FormField
          label="Club name"
          value={name}
          onChangeText={setName}
          maxLength={80}
          placeholder="The Thursday Night Readers"
          error={errors.name}
          hint={name.trim() ? `Your club will live at /clubs/${clubSlug(name)}` : undefined}
        />
        <View style={{ gap: 6 }}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>WHAT IT’S ABOUT</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{description.length}/1000</Text>
          </View>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
            placeholder="One classic a month, argued over tea…"
            placeholderTextColor={`${theme.textSecondary}88`}
            accessibilityLabel="What it’s about"
            style={[styles.textarea, { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}
          />
          {errors.description ? <Text style={{ color: theme.accent, fontSize: 13 }}>{errors.description}</Text> : null}
        </View>

        <View style={{ gap: spacing[3] }}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>CLOTH COLOUR</Text>
          <InkPicker value={ink} onChange={setInk} />
        </View>

        <Pressable
          onPress={() => setIsPrivate((p) => !p)}
          style={[styles.toggle, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Make it private</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
              Good for a buddy read. Only members can see a private club, and nobody can join it by themselves.
            </Text>
          </View>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: theme.primary }} accessibilityLabel="Make it private" />
        </Pressable>

        <View style={{ gap: spacing[2] }}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>PREVIEW</Text>
          <ClubCardFace
            ink={ink}
            name={name.trim() || 'Your club'}
            description={description.trim() || null}
            memberCount={1}
            isPrivate={isPrivate}
            read={null}
          />
        </View>

        <PrimaryButton label={busy ? 'Starting…' : 'Start the club'} busy={busy} onPress={start} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing[5], gap: spacing[5], paddingBottom: spacing[8] },
  center: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: spacing[6], gap: spacing[4] },
  title: { fontFamily: DisplayFonts.regular, fontSize: 32, lineHeight: 36 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  textarea: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    fontSize: 16,
    textAlignVertical: 'top',
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.lg, padding: spacing[4] },
});
