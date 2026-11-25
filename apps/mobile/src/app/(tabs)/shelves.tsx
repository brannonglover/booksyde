import { compactCount } from '@booksyde/shared';
import type { ReadingStatus } from '@booksyde/types';
import { mixHex, radii, spacing } from '@booksyde/theme';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoverFan } from '@/components/cover-fan';
import { Grid } from '@/components/grid';
import { EmptyNote, Loading, PageHeader, Pill } from '@/components/page-chrome';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, DisplayFonts, DisplayMaxScale, Fonts, MaxContentWidth } from '@/constants/theme';
import { useBreakpoint, useColumns } from '@/hooks/use-breakpoint';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MY_SHELVES, type MyShelfBook, useMyShelves } from '@/hooks/use-my-shelves';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';

/*
 * Shelves: the signed-in reader's own shelves, one card each, so they're a tap
 * away instead of down at the foot of their profile. A card opens the shelf.
 */

const WebTabBarHeight = 72;

export default function ShelvesScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { contentWidth } = useBreakpoint();
  const columns = useColumns(1, { md: 2 });
  const { profile } = useSession();
  const { signedIn, sessionLoading, shelves, loading, error } = useMyShelves();

  return (
    <ThemedView style={{ flex: 1 }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: (Platform.OS === 'web' ? WebTabBarHeight : insets.top) + spacing[4],
          paddingBottom: insets.bottom + BottomTabInset + spacing[7],
        }}
      >
        <View style={[styles.content, { maxWidth: contentWidth }]}>
          <PageHeader
            kicker="Your shelves"
            before="Everything you’re"
            accent="reading"
            lede={signedIn || sessionLoading ? undefined : 'Sign in to keep track of what you’re reading, what’s next, and what you’ve finished.'}
          />

          {sessionLoading || (signedIn && !shelves && loading) ? (
            <Loading />
          ) : !signedIn ? (
            <View style={styles.signedOut}>
              <Link href="/sign-up" asChild>
                <Pill label="Join free" />
              </Link>
              <Link href="/sign-in" asChild>
                <Pill label="Sign in" kind="outline" />
              </Link>
            </View>
          ) : error && !shelves ? (
            <EmptyNote>
              <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 15 }}>Couldn’t load your shelves. Come back to this tab to try again.</Text>
            </EmptyNote>
          ) : (
            <>
              <Grid columns={columns} gap={spacing[2]}>
                {MY_SHELVES.map((shelf) => (
                  <ShelfCard
                    key={shelf.status}
                    status={shelf.status}
                    title={shelf.title}
                    blurb={shelf.blurb}
                    books={shelves?.books[shelf.status] ?? []}
                  />
                ))}
              </Grid>
              {profile ? (
                <Link
                  href={{ pathname: '/u/[username]', params: { username: profile.username } }}
                  style={{ color: theme.accent, fontWeight: '700', fontSize: 15, textAlign: 'center' }}
                >
                  See your profile →
                </Link>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

/** Each shelf gets its own colour, used for its blank covers and the card's pressed edge. */
function useShelfTint(status: ReadingStatus) {
  const theme = useTheme();
  return { reading: theme.accent, want_to_read: theme.primary, read: theme.highlight, did_not_finish: theme.textSecondary }[status];
}

function ShelfCard({ status, title, blurb, books }: { status: ReadingStatus; title: string; blurb: string; books: MyShelfBook[] }) {
  const theme = useTheme();
  const tint = useShelfTint(status);
  const count = books.length;
  return (
    <Link href={{ pathname: '/shelf/[status]', params: { status } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${count} ${count === 1 ? 'book' : 'books'}`}>
        {/* Link's slot drops a style function, so the card's layout lives on a plain View inside. */}
        {(state) => {
          // react-native-web adds `hovered`; native only knows `pressed`.
          const active = state.pressed || (state as { hovered?: boolean }).hovered;
          return (
            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: active ? tint : theme.border }]}>
              <CoverFan covers={books.slice(0, 3)} tint={tint} edge={theme.backgroundElement} width={32} />
              <View style={styles.cardText}>
                <Text maxFontSizeMultiplier={DisplayMaxScale} numberOfLines={1} style={[styles.cardTitle, { color: theme.text }]}>
                  {title}
                  <Text style={[styles.cardCount, { color: theme.textSecondary }]}>{`  ${compactCount(count)}`}</Text>
                </Text>
                <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {count === 0 ? 'Empty for now' : blurb}
                </Text>
              </View>
              <View style={[styles.arrow, { backgroundColor: mixHex(theme.backgroundElement, tint, 0.18) }]}>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>→</Text>
              </View>
            </View>
          );
        }}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: spacing[4], gap: spacing[6] },
  signedOut: { flexDirection: 'row', justifyContent: 'center', gap: spacing[3] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing[2],
    paddingLeft: spacing[3],
    paddingRight: spacing[3],
  },
  cardText: { flex: 1, minWidth: 0, gap: 1 },
  cardTitle: { fontFamily: DisplayFonts.regular, fontSize: 22, lineHeight: 26 },
  cardCount: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '600' },
  arrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
