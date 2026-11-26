import {
  compactCount,
  followAuthor,
  formatRating,
  getAuthor,
  getAuthorFollowState,
  getAuthorFollowersCount,
  getAuthorNews,
  lifeYears,
  unfollowAuthor,
} from '@booksyde/shared';
import { palette, radii, spacing } from '@booksyde/theme';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Grid } from '@/components/grid';
import { NewsCard } from '@/components/news';
import { BottomTabInset, DisplayFonts, DisplayMaxScale, MaxContentWidth } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useQuickShelf } from '@/hooks/use-quick-shelf';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/*
 * An author's screen, as on the web (apps/web/src/app/authors/[id]): who they
 * are, a Follow button for hearing about their new books and news, what's new
 * from them, and the books of theirs we hold.
 */

type Author = NonNullable<Awaited<ReturnType<typeof getAuthor>>>;

export default function AuthorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { data, error } = useAsync(supabase ? () => getAuthor(supabase!, id) : null, [id]);

  if (!supabase || error || data === null) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.emptyTitle, { color: theme.text }]}>
          {data === null ? 'We couldn’t find this author.' : 'Something went wrong.'}
        </Text>
        <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
          {data === null ? 'They may have been merged with another.' : 'Couldn’t load this author. Try again in a moment.'}
        </Text>
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
  return <AuthorDetail author={data} />;
}

function AuthorDetail({ author }: { author: Author }) {
  const theme = useTheme();
  const quick = useQuickShelf();
  const { md } = useBreakpoint();
  const { data: news } = useAsync(supabase ? () => getAuthorNews(supabase!, author.id, 6) : null, [author.id]);
  const years = lifeYears(author.birth_date, author.death_date);
  const paragraphs = (author.bio ?? '').split(/\n{2,}/).filter(Boolean);
  const n = author.books.length;
  const columns = md ? 5 : 3;
  const now = new Date();

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title: '' }} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Portrait author={author} />
          <PhotoCredit author={author} />
          <Text style={[styles.kicker, { color: theme.accent }]}>AUTHOR</Text>
          <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.name, { color: theme.text }]}>
            {author.name}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
            {[years, `${n} ${n === 1 ? 'book' : 'books'} on Booksyde`].filter(Boolean).join(' · ')}
          </Text>
          <FollowAuthorButton authorId={author.id} initialCount={author.followers_count} />
          <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
            Follow to hear about {author.name}’s new books and news.
          </Text>
        </View>

        {paragraphs.map((p, i) => (
          <Text key={i} style={[styles.bio, { color: theme.text }]}>
            {p}
          </Text>
        ))}

        {news && news.length > 0 ? (
          <View style={styles.section}>
            <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.heading, { color: theme.text, borderBottomColor: theme.border }]}>
              What’s new
            </Text>
            <Grid columns={md ? 2 : 1} gap={spacing[3]}>
              {news.map((item) => (
                <NewsCard key={item.id} item={item} now={now} onAuthorPage />
              ))}
            </Grid>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.heading, { color: theme.text, borderBottomColor: theme.border }]}>
            Books by {author.name}
          </Text>
          {n === 0 ? (
            <Text style={{ color: theme.textSecondary }}>None of their books are on Booksyde yet.</Text>
          ) : (
            <Grid columns={columns} gap={spacing[3]} rowGap={spacing[5]}>
              {author.books.map((b) => (
                <Link key={b.id} href={{ pathname: '/book/[id]', params: { id: b.id } }} push asChild>
                  <Pressable
                    onLongPress={() => quick.open(b)}
                    delayLongPress={400}
                    accessibilityLabel={b.title}
                    accessibilityHint="Press and hold to put it on a shelf"
                    style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
                  >
                    {({ pressed }) => <BookTile book={b} author={author.name} pressed={pressed} />}
                  </Pressable>
                </Link>
              ))}
            </Grid>
          )}
        </View>
      </View>
      {quick.sheet}
    </ScrollView>
  );
}

function BookTile({ book, author, pressed }: { book: Author['books'][number]; author: string; pressed: boolean }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <View style={pressed ? { transform: [{ translateY: -3 }] } : undefined}>
          <BookCover title={book.title} author={author} src={book.cover_url} color={book.cover_color} width={width} />
        </View>
      ) : (
        <View style={{ aspectRatio: 2 / 3 }} />
      )}
      <Text numberOfLines={2} style={[styles.bookTitle, { color: theme.text }]}>
        {book.title}
      </Text>
      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
        {[book.first_published_year, book.ratings_count > 0 ? `★ ${formatRating(Number(book.avg_rating))}` : null]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </View>
  );
}

function Portrait({ author }: { author: Author }) {
  const initials = author.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  return (
    <View style={styles.portrait}>
      <Text maxFontSizeMultiplier={DisplayMaxScale} style={styles.initials}>
        {initials}
      </Text>
      {/* The portrait sits over the initials, so a photo that fails to load still leaves them. */}
      {author.photo_url ? (
        <Image
          source={{ uri: author.photo_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          transition={150}
          cachePolicy="memory-disk"
          accessible={false}
        />
      ) : null}
    </View>
  );
}

/** Commons photos must name their photographer and licence (see apps/web/src/lib/author-portrait.ts). */
function PhotoCredit({ author }: { author: Author }) {
  const theme = useTheme();
  if (!author.photo_url || !author.photo_credit || !author.photo_credit_url) return null;
  const url = author.photo_credit_url;
  return (
    <Pressable accessibilityRole="link" hitSlop={8} onPress={() => Linking.openURL(url)} style={styles.credit}>
      <Text style={{ color: theme.textSecondary, fontSize: 11, textAlign: 'center' }}>Photo: {author.photo_credit}</Text>
    </Pressable>
  );
}

function FollowAuthorButton({ authorId, initialCount }: { authorId: string; initialCount: number }) {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Whether the reader follows, once we know who they are.
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const client = supabase;
    (session ? getAuthorFollowState(client, authorId) : Promise.resolve(null))
      .then((f) => !cancelled && setFollowing(f))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authorId, session]);

  const onPress = async () => {
    if (!supabase) return;
    if (!session) return router.push('/sign-in');
    const client = supabase;
    setBusy(true);
    setFailed(false);
    try {
      if (following) await unfollowAuthor(client, authorId);
      else await followAuthor(client, authorId);
      setFollowing(!following);
      setCount(await getAuthorFollowersCount(client, authorId).catch(() => Math.max(0, count + (following ? -1 : 1))));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const active = Boolean(session && following);
  return (
    <View style={styles.followWrap}>
      <Pressable
        onPress={onPress}
        disabled={busy || (Boolean(session) && following === null)}
        accessibilityRole="button"
        accessibilityState={{ selected: active, busy }}
        style={({ pressed }) => [
          styles.followButton,
          active ? { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 } : { backgroundColor: theme.primary },
          { opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={{ color: active ? theme.text : theme.primaryText, fontWeight: '700', fontSize: 16 }}>
          {!session ? 'Sign in to follow' : active ? '✓ Following · tap to unfollow' : 'Follow'}
        </Text>
      </Pressable>
      {failed ? (
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>That didn’t work. Try again?</Text>
      ) : count > 0 ? (
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          {compactCount(count)} {count === 1 ? 'reader follows' : 'readers follow'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], padding: spacing[6] },
  emptyTitle: { fontFamily: DisplayFonts.regular, fontSize: 26, textAlign: 'center' },
  scroll: { paddingBottom: BottomTabInset + spacing[8] },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: spacing[5] },
  header: { alignItems: 'center', gap: spacing[2] },
  portrait: {
    width: 136,
    height: 136,
    borderRadius: 68,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.green,
    marginBottom: spacing[3],
  },
  initials: { fontFamily: DisplayFonts.regular, fontSize: 48, color: palette.paper },
  credit: { marginTop: -spacing[2], marginBottom: spacing[2], maxWidth: 220 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2.4, textAlign: 'center' },
  name: { fontFamily: DisplayFonts.regular, fontSize: 40, lineHeight: 44, textAlign: 'center' },
  followWrap: { alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },
  followButton: { borderRadius: radii.pill, paddingHorizontal: spacing[6], paddingVertical: spacing[3], minWidth: 200, alignItems: 'center' },
  bio: { fontSize: 17, lineHeight: 26 },
  section: { gap: spacing[4], marginTop: spacing[3] },
  heading: { fontFamily: DisplayFonts.regular, fontSize: 30, lineHeight: 34, paddingBottom: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth },
  bookTitle: { fontFamily: DisplayFonts.regular, fontSize: 16, lineHeight: 19, marginTop: spacing[2] },
});
