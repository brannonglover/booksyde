import { type ClubCard as Club, getMyClubs, getPublicClubs } from '@booksyde/shared';
import { spacing } from '@booksyde/theme';
import { Link, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClubCard } from '@/components/club-card';
import { EmptyNote, Loading, PageHeader, Pill, SectionHeading } from '@/components/page-chrome';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/*
 * Clubs: the reader's own clubs, then the open ones anyone can join.
 * Mirrors apps/web/src/app/clubs.
 */

const WebTabBarHeight = 72;

type Data = { mine: (Club & { role: string })[]; open: Club[] };

async function loadClubs(signedIn: boolean): Promise<Data> {
  const client = supabase!;
  const [mine, all] = await Promise.all([
    signedIn ? getMyClubs(client).catch(() => []) : [],
    getPublicClubs(client).catch(() => []),
  ]);
  // Clubs you're already in are listed above.
  const mineIds = new Set(mine.map((c) => c.id));
  return { mine, open: all.filter((c) => !mineIds.has(c.id)) };
}

export default function ClubsScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { session, loading: sessionLoading } = useSession();
  const signedIn = Boolean(session);
  const { data, loading, reload } = useAsync(supabase && !sessionLoading ? () => loadClubs(signedIn) : null, [
    signedIn,
    sessionLoading,
  ]);
  // Back from starting or leaving a club: show the change.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const startHref = signedIn ? '/clubs/new' : '/sign-in';
  return (
    <ThemedView style={{ flex: 1 }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: (Platform.OS === 'web' ? WebTabBarHeight : insets.top) + spacing[4],
          paddingBottom: insets.bottom + BottomTabInset + spacing[7],
        }}
      >
        <View style={styles.content}>
          <View style={{ alignItems: 'center', gap: spacing[5] }}>
            <PageHeader
              kicker="Clubs"
              before="Read it"
              accent="together"
              lede="Join a club to read alongside other readers, or start your own: a big open circle or a quiet buddy read for two."
            />
            <Link href={startHref} asChild>
              <Pill label="Start a club" style={{ alignSelf: 'center' }} />
            </Link>
          </View>

          {!data && loading ? (
            <Loading />
          ) : (
            <>
              {data?.mine.length ? (
                <View style={styles.section}>
                  <SectionHeading numeral="I">Your clubs</SectionHeading>
                  {data.mine.map((club) => (
                    <ClubCard key={club.id} club={club} role={club.role} />
                  ))}
                </View>
              ) : null}
              <View style={styles.section}>
                <SectionHeading numeral={data?.mine.length ? 'II' : 'I'}>Open clubs</SectionHeading>
                {data?.open.length ? (
                  data.open.map((club) => <ClubCard key={club.id} club={club} />)
                ) : (
                  <EmptyNote>
                    <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 15, lineHeight: 22 }}>
                      {data?.mine.length ? 'No other open clubs right now. ' : 'No open clubs yet. '}
                      <Link href={startHref} style={{ color: theme.accent, fontWeight: '700' }}>
                        Start one
                      </Link>{' '}
                      and others can join.
                    </Text>
                  </EmptyNote>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: spacing[4], gap: spacing[8] },
  section: { gap: spacing[5] },
});
