import { radii, spacing } from '@booksyde/theme';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { FormError } from '@/components/auth-form';
import { Loading } from '@/components/page-chrome';
import { DisplayFonts, DisplayMaxScale } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/**
 * What we email you: for now, the monthly "next read" letter. The switch
 * saves as soon as it's flipped, like the phone's own settings. Mirrors
 * apps/web/src/app/settings/email.
 */

export default function EmailSettingsScreen() {
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const { data: monthlyPicks, error } = useAsync<boolean>(
    supabase && userId
      ? async () => {
          const { data, error: e } = await supabase!.from('email_preferences').select('monthly_picks').eq('user_id', userId).maybeSingle();
          if (e) throw e;
          // Every reader has a row from sign-up; without one, the letter's default is on.
          return data?.monthly_picks ?? true;
        }
      : null,
    [userId],
  );

  if (!sessionLoading && !userId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.title, { color: theme.text }]}>Sign in to change your email settings.</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.title, { color: theme.text }]}>Couldn’t load your email settings.</Text>
      </View>
    );
  }
  if (monthlyPicks === undefined || !userId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Loading />
      </View>
    );
  }
  return <EmailForm userId={userId} initial={monthlyPicks} />;
}

function EmailForm({ userId, initial }: { userId: string; initial: boolean }) {
  const theme = useTheme();
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Saved" fades back out after a moment.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  async function flip(next: boolean) {
    if (!supabase || saving) return;
    setOn(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    const { error: e } = await supabase.from('email_preferences').update({ monthly_picks: next }).eq('user_id', userId);
    setSaving(false);
    if (e) {
      // Put the switch back where the server still has it.
      setOn(!next);
      setError('We couldn’t save that. Please try again.');
    } else {
      setSaved(true);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 23 }}>
        Sign-in links and account emails always come through. The rest is up to you.
      </Text>

      <FormError message={error} />

      <Pressable
        onPress={() => flip(!on)}
        disabled={saving}
        accessibilityRole="switch"
        accessibilityState={{ checked: on, disabled: saving }}
        style={[styles.toggle, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Your next read, monthly</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
            Near the end of each month, a few ideas for your next book: the next in a series you’re reading, new books by authors you follow,
            what’s waiting on your Want to Read shelf, and picks close to the books you love.
          </Text>
        </View>
        <Switch
          value={on}
          onValueChange={flip}
          disabled={saving}
          trackColor={{ true: theme.primary }}
          accessibilityLabel="Your next read, monthly"
        />
      </Pressable>

      <Text accessibilityLiveRegion="polite" style={[styles.status, { color: saved ? theme.primary : 'transparent' }]}>
        ✓ Saved
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing[5], gap: spacing[5], paddingBottom: spacing[8] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  title: { fontFamily: DisplayFonts.regular, fontSize: 30, lineHeight: 34, textAlign: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.lg, padding: spacing[4] },
  status: { fontSize: 14, fontWeight: '600', marginTop: -spacing[2] },
});
