import { isUsernameAvailable, profileUpdateSchema, updateMyProfile, usernameSchema } from '@booksyde/shared';
import { palette, radii, spacing } from '@booksyde/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { FormError, FormField, PrimaryButton } from '@/components/auth-form';
import { Avatar } from '@/components/avatar';
import { AvatarPicker } from '@/components/avatar-picker';
import { InkPicker } from '@/components/ink-picker';
import { Loading } from '@/components/page-chrome';
import { inks } from '@/constants/inks';
import { DisplayFonts } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** Edit your bookplate: how other readers see you. Mirrors apps/web/src/app/settings/profile. */

type Profile = {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme_color: string | null;
  is_private: boolean;
};

export default function EditProfileScreen() {
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const { data: profile, error } = useAsync<Profile | null>(
    supabase && userId
      ? async () => {
          const { data, error: e } = await supabase!
            .from('profiles')
            .select('username, display_name, bio, avatar_url, theme_color, is_private')
            .eq('id', userId)
            .single();
          if (e) throw e;
          return data;
        }
      : null,
    [userId],
  );

  if (!sessionLoading && !userId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Sign in to edit your bookplate.</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Couldn’t load your profile.</Text>
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Loading />
      </View>
    );
  }
  return <ProfileForm profile={profile} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const theme = useTheme();
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const [name, setName] = useState(profile.display_name ?? '');
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [ink, setInk] = useState<string>(profile.theme_color ?? inks[0].hex);
  const [isPrivate, setIsPrivate] = useState(profile.is_private);
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [taken, setTaken] = useState<{ username: string; taken: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || username === profile.username || !usernameSchema.safeParse(username).success) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      isUsernameAvailable(supabase!, username)
        .then((free) => !cancelled && setTaken({ username, taken: !free }))
        .catch(() => {});
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, profile.username]);

  const formatOk = usernameSchema.safeParse(username).success;
  const hint =
    username === profile.username ? (
      `Your profile lives at /u/${username}`
    ) : !formatOk ? (
      <Text style={{ color: theme.accent, fontSize: 13 }}>3–30 characters: letters, numbers and underscores</Text>
    ) : taken?.username === username ? (
      taken.taken ? (
        <Text style={{ color: theme.accent, fontSize: 13 }}>Someone already has @{username}</Text>
      ) : (
        <Text style={{ color: '#4A7C59', fontSize: 13 }}>✓ @{username} is free</Text>
      )
    ) : (
      'Checking…'
    );

  async function save() {
    if (!supabase) return;
    const parsed = profileUpdateSchema.safeParse({
      display_name: name.trim() || null,
      username,
      bio: bio.trim() || null,
      theme_color: ink,
      is_private: isPrivate,
    });
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
      setErrors(fields);
      return;
    }
    setErrors({});
    setError(null);
    setBusy(true);
    try {
      // A new username must be free (your current one is, to you).
      if (parsed.data.username && parsed.data.username !== profile.username) {
        if (!(await isUsernameAvailable(supabase, parsed.data.username))) {
          setErrors({ username: 'Someone already has that username. Try another?' });
          setBusy(false);
          return;
        }
      }
      await updateMyProfile(supabase, parsed.data);
      // Nudges every screen's session listener, so the new name and ink show up everywhere.
      await supabase.auth.refreshSession().catch(() => {});
      const next = parsed.data.username ?? profile.username;
      // Same address: back to the profile, which reloads. New address: open the profile there.
      if (next === profile.username && router.canGoBack()) router.back();
      else router.replace({ pathname: '/u/[username]', params: { username: next } });
    } catch {
      setError('We couldn’t save your bookplate. Please try again.');
      setBusy(false);
    }
  }

  const shown = name || username;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 23 }}>This is how other readers see you on Booksyde.</Text>

        {/* Live preview of the bookplate */}
        <View style={[styles.plateOuter, { backgroundColor: dark ? '#2F2822' : '#FBF5E8' }]}>
          <View style={[styles.plateInner, { borderColor: ink }]}>
            <Text style={[styles.plateLabel, { color: ink }]}>READER</Text>
            <Avatar name={shown} src={avatar} ink={ink} size={56} style={styles.monogram} />
            <Text style={[styles.plateName, { color: dark ? palette.paper : palette.ink }]}>{shown}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              @{username}
              {isPrivate ? ' · 🔒 Private' : ''}
            </Text>
            {bio ? <Text style={[styles.plateBio, { color: dark ? palette.paper : palette.ink }]}>{bio}</Text> : null}
          </View>
        </View>

        <View style={{ gap: spacing[3] }}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>YOUR PHOTO</Text>
          <AvatarPicker hasPhoto={!!avatar} onChange={setAvatar} />
        </View>

        <FormError message={error} />
        <FormField label="Your name" value={name} onChangeText={setName} maxLength={60} error={errors.display_name} />
        <FormField
          label="Username"
          value={username}
          onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, '_'))}
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.username}
          hint={hint}
        />
        <View style={{ gap: 6 }}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>A LINE ABOUT YOU</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{bio.length}/500</Text>
          </View>
          <TextInput
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={500}
            placeholder="Rereads Austen every winter…"
            placeholderTextColor={`${theme.textSecondary}88`}
            accessibilityLabel="A line about you"
            style={[styles.textarea, { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}
          />
        </View>

        <View style={{ gap: spacing[3] }}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>YOUR INK</Text>
          <InkPicker value={ink} onChange={setInk} />
        </View>

        <Pressable
          onPress={() => setIsPrivate((p) => !p)}
          style={[styles.toggle, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Keep my profile private</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
              Only people you approve can see your shelves, ratings and notes. Anyone can still see your bookplate.
            </Text>
          </View>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: theme.primary }} accessibilityLabel="Keep my profile private" />
        </Pressable>

        <PrimaryButton label={busy ? 'Saving…' : 'Save my bookplate'} busy={busy} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing[5], gap: spacing[5], paddingBottom: spacing[8] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  title: { fontFamily: DisplayFonts.regular, fontSize: 30, lineHeight: 34, textAlign: 'center' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  textarea: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
    textAlignVertical: 'top',
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.lg, padding: spacing[4] },
  plateOuter: { borderRadius: 3, padding: 6, alignSelf: 'center', width: '100%', maxWidth: 320 },
  plateInner: { borderWidth: 3, borderStyle: 'solid', borderRadius: 3, paddingHorizontal: spacing[5], paddingVertical: spacing[5], alignItems: 'center', gap: spacing[2] },
  plateLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 4.5 },
  monogram: { borderWidth: 3, borderColor: palette.gilt },
  plateName: { fontFamily: DisplayFonts.regular, fontSize: 28, lineHeight: 30, textAlign: 'center' },
  plateBio: { fontFamily: DisplayFonts.italic, fontSize: 17, lineHeight: 22, textAlign: 'center' },
});
