import {
  follow,
  type FollowState,
  getFollowState,
  getProfileByUsername,
  getProfileShelves,
  getProfileStats,
  getUserReviews,
  type ProfileStats,
  removeFromShelves,
  setReadingStatus,
  unfollow,
} from '@booksyde/shared';
import type { ReadingStatus } from '@booksyde/types';
import { genreColor, palette, radii, spacing } from '@booksyde/theme';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { ShelfStatusSheet } from '@/components/shelf-status-sheet';
import { Stars } from '@/components/stars';
import { BottomTabInset, DisplayFonts, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/*
 * A reader's profile as the "Ex Libris" bookplate inside their books, then
 * their reading palette, shelves and notes. Mirrors apps/web/src/app/u/[username].
 */

type Profile = NonNullable<Awaited<ReturnType<typeof getProfileByUsername>>>;
type Shelves = Awaited<ReturnType<typeof getProfileShelves>>;
type Reviews = Awaited<ReturnType<typeof getUserReviews>>;
type Data = { profile: Profile; followState: FollowState; stats: ProfileStats; shelves: Shelves | null; reviews: Reviews };

const webUrl = process.env.EXPO_PUBLIC_WEB_URL;
const monthYear = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function useProfile(username: string) {
  const { session } = useSession();
  const [state, setState] = useState<{ data?: Data | null; error?: string }>({});
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    (async () => {
      const profile = await getProfileByUsername(client, username);
      if (!profile) return null;
      const [followState, stats] = await Promise.all([getFollowState(client, profile.id), getProfileStats(client, profile.id)]);
      const canSee = !profile.is_private || followState === 'self' || followState === 'following';
      const [shelves, reviews] = canSee
        ? await Promise.all([getProfileShelves(client, profile.id), getUserReviews(client, profile.id, 6)])
        : [null, [] as Reviews];
      return { profile, followState, stats, shelves, reviews };
    })()
      .then((data) => !cancelled && setState({ data }))
      .catch(() => !cancelled && setState({ error: 'Couldn’t load this profile. Is Supabase running?' }));
    return () => {
      cancelled = true;
    };
    // Reload when the reader signs in or out, or after following.
  }, [username, session, version]);

  if (!supabase) return { state: { error: 'Supabase isn’t configured. Copy .env.example to .env.local.' }, reload };
  return { state, reload };
}

export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const theme = useTheme();
  const { state, reload } = useProfile(String(username).replace(/^@/, ''));
  const { data, error } = state;

  if (error || data === null) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.chapterTitle, { color: theme.text, textAlign: 'center' }]}>
          {data === null ? 'No reader by that name.' : 'Something went wrong.'}
        </Text>
        {error ? <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>{error}</Text> : null}
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.highlight} />
      </View>
    );
  }
  return <ProfileDetail data={data} onChange={reload} />;
}

function ProfileDetail({ data, onChange }: { data: Data; onChange: () => void }) {
  const theme = useTheme();
  const { profile, followState, stats, shelves, reviews } = data;
  const canSee = !profile.is_private || followState === 'self' || followState === 'following';
  const ink = profile.theme_color ?? palette.green;
  const name = profile.display_name || profile.username;
  const first = name.split(' ')[0];
  const isOwn = followState === 'self';
  const [moving, setMoving] = useState<{ id: string; title: string; status: ReadingStatus } | null>(null);

  async function moveTo(next: ReadingStatus | null) {
    const book = moving;
    setMoving(null);
    if (!book || !supabase || next === book.status) return;
    try {
      if (next) await setReadingStatus(supabase, book.id, next);
      else await removeFromShelves(supabase, book.id);
      onChange();
    } catch {
      Alert.alert('Couldn’t move that book', 'Something went wrong. Try again?');
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title: `@${profile.username}` }} />
      <View style={styles.content}>
        <Bookplate profile={profile} name={name} ink={ink} stats={canSee ? stats : null} followState={followState} onChange={onChange} />

        {!canSee ? (
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border, alignItems: 'center' }]}>
            <Text style={{ fontSize: 40 }}>🔒</Text>
            <Text style={[styles.cardTitle, { color: theme.text }]}>A private library</Text>
            <Text style={{ color: theme.textSecondary, textAlign: 'center', lineHeight: 21 }}>
              {followState === 'pending'
                ? `Your request is with ${first}. Once they say yes, you’ll see their shelves and notes here.`
                : `${first} keeps their shelves to friends. Ask to follow, and once they say yes you’ll see what they’re reading.`}
            </Text>
          </View>
        ) : (
          <>
            {stats.moods.length > 0 ? <ReadingPalette first={first} stats={stats} /> : null}
            <ChapterHeading kicker="THE BOOKCASE" title="On their shelves" />
            {(
              [
                ['reading', 'Reading now', 'Nothing on the nightstand right now.'],
                ['want_to_read', 'Want to read', 'No books waiting in the wings yet.'],
                ['read', 'Read', 'No finished books yet.'],
              ] as const
            ).map(([key, title, empty]) => (
              <ShelfRow
                key={key}
                title={title}
                empty={empty}
                books={shelves?.[key] ?? []}
                onLongPress={isOwn ? (w) => setMoving({ id: w.id, title: w.title, status: key }) : undefined}
              />
            ))}
            {isOwn ? (
              <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 13 }}>
                Press and hold a book to move it to another shelf.
              </Text>
            ) : null}

            <ChapterHeading kicker="IN THE MARGINS" title={`${first}’s notes`} />
            {reviews.length === 0 ? (
              <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>No notes in the margins yet.</Text>
            ) : (
              reviews.map((r, i) => <NoteCard key={r.id} review={r} tilt={i % 2 ? '0.6deg' : '-0.6deg'} />)
            )}
          </>
        )}
      </View>
      <ShelfStatusSheet book={moving} onChoose={moveTo} onClose={() => setMoving(null)} />
    </ScrollView>
  );
}

function Bookplate({
  profile,
  name,
  ink,
  stats,
  followState,
  onChange,
}: {
  profile: Profile;
  name: string;
  ink: string;
  stats: ProfileStats | null;
  followState: FollowState;
  onChange: () => void;
}) {
  const dark = useColorScheme() === 'dark';
  const theme = useTheme();
  const text = dark ? palette.paper : palette.ink;
  const facts: [number, string][] = [
    [profile.followers_count, profile.followers_count === 1 ? 'FOLLOWER' : 'FOLLOWERS'],
    [profile.following_count, 'FOLLOWING'],
    ...(stats ? ([[stats.read, stats.read === 1 ? 'BOOK READ' : 'BOOKS READ'], [stats.pages, 'PAGES']] as [number, string][]) : []),
  ];
  return (
    <View style={[styles.plateOuter, { backgroundColor: dark ? '#2F2822' : '#FBF5E8' }]}>
      <View style={[styles.plateInner, { borderColor: ink }]}>
        <Text style={[styles.exLibris, { color: ink }]}>EX LIBRIS</Text>
        <View style={[styles.monogram, { backgroundColor: ink }]}>
          <Text style={styles.monogramText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.name, { color: text }]}>{name}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          @{profile.username}
          {profile.is_private ? ' · 🔒 Private' : ''}
        </Text>
        {profile.bio ? <Text style={[styles.bio, { color: text }]}>{profile.bio}</Text> : null}
        <Text style={[styles.since, { color: theme.textSecondary }]}>
          A MEMBER SINCE {monthYear.format(new Date(profile.created_at)).toUpperCase()}
        </Text>
        <View style={[styles.facts, { borderColor: theme.border }]}>
          {facts.map(([value, label]) => (
            <Text key={label} style={{ color: text }}>
              <Text style={styles.factValue}>{value}</Text> <Text style={[styles.factLabel, { color: theme.textSecondary }]}>{label}</Text>
            </Text>
          ))}
        </View>
        {followState === 'self' ? (
          webUrl ? (
            <Pressable onPress={() => Linking.openURL(`${webUrl}/settings/profile`)} style={[styles.outlineButton, { borderColor: theme.border }]}>
              <Text style={{ color: text, fontWeight: '700' }}>Edit your bookplate</Text>
            </Pressable>
          ) : null
        ) : (
          <FollowButton userId={profile.id} state={followState} isPrivate={profile.is_private} onChange={onChange} />
        )}
      </View>
    </View>
  );
}

function FollowButton({ userId, state, isPrivate, onChange }: { userId: string; state: FollowState; isPrivate: boolean; onChange: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const onPress = async () => {
    if (!supabase) return;
    if (state === 'signed-out') return router.push('/sign-in');
    setBusy(true);
    try {
      if (state === 'none') await follow(supabase, userId);
      else await unfollow(supabase, userId);
      onChange();
    } catch {
      // Leave it as it was; the next tap will try again.
    } finally {
      setBusy(false);
    }
  };
  const active = state === 'pending' || state === 'following';
  const label =
    state === 'signed-out'
      ? isPrivate
        ? 'Sign in to request a look'
        : 'Sign in to follow'
      : state === 'pending'
        ? 'Requested · tap to cancel'
        : state === 'following'
          ? 'Following · tap to unfollow'
          : isPrivate
            ? 'Request to follow'
            : 'Follow';
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.followButton,
        active
          ? { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 }
          : { backgroundColor: theme.primary },
        { opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={{ color: active ? theme.text : theme.primaryText, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function ChapterHeading({ kicker, title }: { kicker: string; title: string }) {
  const theme = useTheme();
  return (
    <View style={styles.chapter}>
      <Text style={[styles.kicker, { color: theme.accent }]}>{kicker}</Text>
      <Text style={[styles.chapterTitle, { color: theme.text }]}>{title}</Text>
      <Text style={{ color: theme.highlight }}>❦</Text>
    </View>
  );
}

function ReadingPalette({ first, stats }: { first: string; stats: ProfileStats }) {
  const theme = useTheme();
  const total = stats.moods.reduce((sum, m) => sum + m.weight, 0) || 1;
  const top = stats.moods.slice(0, 2).map((m) => m.name.toLowerCase());
  const genres = stats.genres.slice(0, 2).map((g) => g.name.toLowerCase());
  return (
    <>
      <ChapterHeading kicker="READING PALETTE" title="What they reach for" />
      <Text style={[styles.paletteText, { color: theme.text }]}>
        {first} reads mostly <Text style={{ color: theme.accent }}>{top.join(' and ')}</Text> books
        {genres.length ? (
          <>
            , with a soft spot for <Text style={{ color: theme.accent }}>{genres.join(' and ')}</Text>
          </>
        ) : null}
        .
      </Text>
      <View style={[styles.paletteBar, { borderColor: theme.border }]}>
        {stats.moods.map((m) => (
          <View key={m.slug} style={{ width: `${(m.weight / total) * 100}%`, backgroundColor: genreColor(m.slug).dot }} />
        ))}
      </View>
      <View style={styles.legend}>
        {stats.moods.map((m) => (
          <View key={m.slug} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: genreColor(m.slug).dot }]} />
            <Text style={{ color: theme.text, fontSize: 13 }}>{m.name}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

type ShelfWork = NonNullable<Shelves>['read'][number];

function ShelfRow({
  title,
  empty,
  books,
  onLongPress,
}: {
  title: string;
  empty: string;
  books: ShelfWork[];
  onLongPress?: (book: ShelfWork) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing[3] }}>
      <Text style={[styles.shelfTitle, { color: theme.text }]}>
        {title} <Text style={{ fontFamily: undefined, fontSize: 14, color: theme.textSecondary }}>{books.length}</Text>
      </Text>
      {books.length === 0 ? (
        <View style={[styles.emptyShelf, { borderColor: theme.border }]}>
          <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>{empty}</Text>
        </View>
      ) : (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfBooks}>
            {books.map((w) => (
              <Link key={w.id} href={{ pathname: '/book/[id]', params: { id: w.id } }} push asChild>
                <Pressable
                  onLongPress={onLongPress ? () => onLongPress(w) : undefined}
                  delayLongPress={400}
                  accessibilityHint={onLongPress ? 'Press and hold to move it to another shelf' : undefined}
                  style={({ pressed }) => pressed && onLongPress ? { opacity: 0.7, transform: [{ scale: 0.97 }] } : null}
                >
                  <BookCover title={w.title} author="" src={w.cover_url} color={w.cover_color} width={88} />
                </Pressable>
              </Link>
            ))}
          </ScrollView>
          <View style={styles.shelfBoard} />
        </View>
      )}
    </View>
  );
}

function NoteCard({ review, tilt }: { review: Reviews[number]; tilt: string }) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const [revealed, setRevealed] = useState(!review.has_spoilers);
  const ink = dark ? theme.text : palette.ink;
  return (
    <View style={[styles.noteCard, { backgroundColor: dark ? theme.backgroundSelected : '#FFFDF6', transform: [{ rotate: tilt }] }]}>
      {review.works ? (
        <Link href={{ pathname: '/book/[id]', params: { id: review.works.id } }} push asChild>
          <Pressable style={styles.noteHeader}>
            <BookCover title={review.works.title} author="" src={review.works.cover_url} color={review.works.cover_color} width={36} />
            <Text numberOfLines={1} style={[styles.noteTitle, { color: ink }]}>
              {review.works.title}
            </Text>
            {review.rating ? <Stars rating={Number(review.rating)} size={12} /> : null}
          </Pressable>
        </Link>
      ) : null}
      {revealed ? (
        <Text style={{ color: ink, fontSize: 15, lineHeight: 26 }}>{review.body}</Text>
      ) : (
        <Pressable onPress={() => setRevealed(true)} style={[styles.spoiler, { borderColor: dark ? theme.border : '#DCD1BE' }]}>
          <Text style={{ color: ink, fontWeight: '600' }}>Contains spoilers · Show anyway</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], padding: spacing[6] },
  scroll: { paddingBottom: BottomTabInset + spacing[8] },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: spacing[4], gap: spacing[5] },
  plateOuter: {
    borderRadius: 3,
    padding: 6,
    marginTop: spacing[3],
    shadowColor: '#1F1B16',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  plateInner: { borderWidth: 3, borderRadius: 2, alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[5] },
  exLibris: { fontSize: 11, fontWeight: '800', letterSpacing: 5 },
  monogram: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: palette.gilt, alignItems: 'center', justifyContent: 'center', marginTop: spacing[2] },
  monogramText: { color: palette.paper, fontFamily: DisplayFonts.regular, fontSize: 36 },
  name: { fontFamily: DisplayFonts.regular, fontSize: 40, lineHeight: 44, textAlign: 'center' },
  bio: { fontFamily: DisplayFonts.italic, fontSize: 19, lineHeight: 24, textAlign: 'center', marginTop: spacing[1] },
  since: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginTop: spacing[1] },
  facts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[4], borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: spacing[2], marginTop: spacing[2], alignSelf: 'stretch' },
  factValue: { fontFamily: DisplayFonts.regular, fontSize: 22 },
  factLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  followButton: { alignSelf: 'stretch', alignItems: 'center', borderRadius: radii.pill, paddingVertical: spacing[3], marginTop: spacing[3] },
  outlineButton: { alignSelf: 'stretch', alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, paddingVertical: spacing[3], marginTop: spacing[3] },
  card: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[5], gap: spacing[2] },
  cardTitle: { fontFamily: DisplayFonts.regular, fontSize: 30 },
  chapter: { alignItems: 'center', gap: spacing[1], marginTop: spacing[6] },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  chapterTitle: { fontFamily: DisplayFonts.regular, fontSize: 38, lineHeight: 42, textAlign: 'center' },
  paletteText: { fontFamily: DisplayFonts.italic, fontSize: 26, lineHeight: 32, textAlign: 'center' },
  paletteBar: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', borderWidth: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[3] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  shelfTitle: { fontFamily: DisplayFonts.regular, fontSize: 26 },
  emptyShelf: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radii.lg, padding: spacing[4] },
  shelfBooks: { gap: spacing[3], paddingHorizontal: spacing[2], alignItems: 'flex-end' },
  shelfBoard: { height: 10, borderRadius: 2, backgroundColor: '#8A6A4A' },
  noteCard: { borderRadius: 3, padding: spacing[4], gap: spacing[3], shadowColor: '#1F1B16', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingBottom: spacing[3], borderBottomWidth: 2, borderBottomColor: 'rgba(139,58,43,0.45)' },
  noteTitle: { flex: 1, fontFamily: DisplayFonts.regular, fontSize: 20 },
  spoiler: { alignItems: 'center', borderWidth: 1, borderRadius: radii.md, paddingVertical: spacing[4] },
});
