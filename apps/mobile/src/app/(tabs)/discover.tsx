import {
  bookIdentity,
  type DiscoverShelves,
  getDiscoverShelves,
  getMoreLikeThis,
  getMyBooks,
  getPicksFromShelf,
  getShelfProfile,
  getWiderStacksPicks,
  type WiderStacksBook,
} from '@booksyde/shared';
import { genreColor, radii, spacing } from '@booksyde/theme';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bookshelf, type ShelfBook } from '@/components/bookshelf';
import { EmptyNote, Loading, PageHeader, Pill, SectionHeading } from '@/components/page-chrome';
import { RequestSlip } from '@/components/request-slip';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, DisplayFonts, MaxContentWidth, DisplayMaxScale } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Grid } from '@/components/grid';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/*
 * Discover: picks pulled from your own shelves, then the most-shelved books,
 * a shelf for each of the fullest moods, and tropes and pace to browse by.
 * Mirrors apps/web/src/app/discover.
 */

const WebTabBarHeight = 72;

const MAX_SEED_ROWS = 2;
/** Plenty of books have no tags or embedding yet (so no "more like this"); keep trying the next one. */
const MAX_SEED_TRIES = 8;
/** A "Because you shelved…" row needs at least this many new books to be worth showing. */
const MIN_ROW = 3;
/** Below this many picks from our own shelves, look further afield on Open Library. */
const WIDER_STACKS_BELOW = 6;
const WIDER_STACKS_PICKS = 6;

export default function DiscoverScreen() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { contentWidth } = useBreakpoint();
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
            kicker="Discover"
            before="Wander the"
            accent="stacks"
            lede="What other readers keep reaching for, a shelf for every taste, and a few picks pulled from your own reading."
          />
          <ForYou />
          <PublicShelves />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

/* ------------------------------------------------------------- For you */

type Seed = { id: string; title: string };
type ForYouData =
  | { kind: 'none' }
  | {
      kind: 'picks';
      pooled: ShelfBook[];
      pooledCount: number;
      fromRead: boolean;
      rows: { seed: Seed; books: ShelfBook[] }[];
      wider: { shelved: string[]; read: string[]; headline: boolean } | null;
    };

async function loadForYou(): Promise<ForYouData> {
  const client = supabase!;
  const mine = await getMyBooks(client).catch(() => []);
  const shelved = new Set(mine.flatMap((b) => (b.works ? [b.works.id] : [])));
  // Books they've finished or are reading say the most about their taste; fall back to their wishlist.
  const read = mine.filter((b) => b.status === 'read' || b.status === 'reading');
  const ranked = [...read, ...mine.filter((b) => b.status === 'want_to_read')];
  const seeds = ranked.flatMap((b) => (b.works ? [b.works] : []));
  if (seeds.length === 0) return { kind: 'none' };

  // One row weighed against everything they've read, then a row or two for single favourites.
  const pooledFrom = read.length ? read : ranked;
  const pooledIds = pooledFrom.flatMap((b) => (b.works ? [b.works.id] : []));
  const pooled = await getPicksFromShelf(client, { seeds: pooledIds, exclude: shelved }).catch(() => []);

  const seen = new Set([...shelved, ...pooled.map((w) => w.id)]);
  const rows: { seed: Seed; books: ShelfBook[] }[] = [];
  for (const seed of seeds.slice(0, MAX_SEED_TRIES)) {
    // Ask for every match, not just the top few: the best ones are often already on their shelves.
    const similar = await getMoreLikeThis(client, seed.id, 50).catch(() => []);
    const books = similar.filter((w) => !seen.has(w.id)).slice(0, 6);
    if (books.length < MIN_ROW) continue;
    for (const w of books) seen.add(w.id);
    rows.push({ seed: { id: seed.id, title: seed.title }, books });
    if (rows.length === MAX_SEED_ROWS) break;
  }

  const localPicks = pooled.length + rows.reduce((n, r) => n + r.books.length, 0);
  return {
    kind: 'picks',
    pooled,
    pooledCount: pooledFrom.length,
    fromRead: read.length > 0,
    rows,
    wider: localPicks < WIDER_STACKS_BELOW ? { shelved: [...shelved], read: pooledIds, headline: localPicks === 0 } : null,
  };
}

/** Picks from the reader's own shelves; an invitation when signed out. */
function ForYou() {
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const { data, loading } = useAsync(supabase && userId ? loadForYou : null, [userId]);

  if (!supabase || sessionLoading) return null;
  if (!userId) return <SignedOutNote />;

  return (
    <View style={styles.section}>
      <SectionHeading>
        Picked <Text style={{ fontFamily: DisplayFonts.italic, color: theme.accent }}>for you</Text>
      </SectionHeading>
      {loading || !data ? (
        <Loading />
      ) : data.kind === 'none' ? (
        <EmptyNote>
          <Text style={[styles.noteText, { color: theme.textSecondary }]}>
            Shelve a few books you’ve loved and we’ll start pulling picks for you.
          </Text>
          <Link href="/search" style={[styles.noteLink, { color: theme.accent }]}>
            Find one in the catalogue
          </Link>
        </EmptyNote>
      ) : (
        <>
          {data.pooled.length ? (
            <View style={styles.row}>
              <RowHeading>
                From the{' '}
                <Text style={[styles.rowAccent, { color: theme.text }]}>
                  {data.pooledCount} {data.pooledCount === 1 ? 'book' : 'books'}
                </Text>{' '}
                {data.fromRead ? 'you’ve read' : 'on your shelves'}
              </RowHeading>
              <Bookshelf books={data.pooled} />
            </View>
          ) : null}
          {data.rows.map(({ seed, books }) => (
            <View key={seed.id} style={styles.row}>
              <RowHeading>
                Because you shelved{' '}
                <Link href={{ pathname: '/book/[id]', params: { id: seed.id } }} style={[styles.rowAccent, { color: theme.text }]}>
                  {seed.title}
                </Link>
              </RowHeading>
              <Bookshelf books={books} />
            </View>
          ))}
          {data.wider ? <WiderStacksPicks {...data.wider} /> : null}
        </>
      )}
    </View>
  );
}

/**
 * When our own shelves run dry: Open Library books by the reader's favourite
 * authors and in their top genres, as request slips that add them here.
 */
function WiderStacksPicks({ shelved, read, headline }: { shelved: string[]; read: string[]; headline: boolean }) {
  const theme = useTheme();
  const { data: picks, loading } = useAsync(async () => {
    const client = supabase!;
    const profile = await getShelfProfile(client, shelved, read).catch(() => null);
    const found =
      profile && (profile.authors.length || profile.genres.length)
        ? await getWiderStacksPicks(client, profile.authors.slice(0, 3), profile.genres.slice(0, 3))
        : { byAuthor: [], bySubject: [] };
    const onShelf = new Set(shelved);
    const owned = new Set((profile?.titles ?? []).map((t) => bookIdentity(t.title, t.author)));
    const isNew = (b: WiderStacksBook) =>
      !(b.workId && onShelf.has(b.workId)) && !owned.has(bookIdentity(b.title, b.authors[0]?.name));

    // A mix: up to four by favourite authors (two each at most), the rest from their genres,
    // topped up with more by those authors if the genres come up short.
    const out: WiderStacksBook[] = [];
    const taken = new Set<string>();
    const perAuthor = new Map<string, number>();
    const take = (books: WiderStacksBook[], cap: number, perAuthorCap: number) => {
      for (const b of books) {
        if (out.length >= cap) return;
        const author = b.authors[0]?.name ?? '';
        if (taken.has(b.olid) || !isNew(b) || (perAuthor.get(author) ?? 0) >= perAuthorCap) continue;
        taken.add(b.olid);
        perAuthor.set(author, (perAuthor.get(author) ?? 0) + 1);
        out.push(b);
      }
    };
    take(found.byAuthor, 4, 2);
    take(found.bySubject, WIDER_STACKS_PICKS, 1);
    take(found.byAuthor, WIDER_STACKS_PICKS, 3);
    return out;
  }, [shelved.join(','), read.join(',')]);

  if (loading) return <Loading />;
  if (!picks?.length) {
    return headline ? (
      <EmptyNote>
        <Text style={[styles.noteText, { color: theme.textSecondary }]}>
          You’ve already shelved everything we know of that’s like the books you read.
        </Text>
        <Link href="/search" style={[styles.noteLink, { color: theme.accent }]}>
          Search the catalogue for something new
        </Link>
      </EmptyNote>
    ) : null;
  }
  return (
    <View style={styles.row}>
      <View style={{ gap: spacing[1] }}>
        <RowHeading>
          From the <Text style={[styles.rowAccent, { color: theme.text }]}>wider stacks</Text>
        </RowHeading>
        <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
          {headline ? 'You’ve shelved nearly everything we hold that suits you, so we looked further afield. ' : ''}
          Not on Booksyde yet: add one to the catalogue and it’s ready to shelve. Courtesy of Open Library.
        </Text>
      </View>
      {picks.map((book) => (
        <RequestSlip key={book.olid} book={book} />
      ))}
    </View>
  );
}

function RowHeading({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{children}</Text>;
}

function SignedOutNote() {
  const theme = useTheme();
  return (
    <View style={[styles.signedOut, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.signedOutTitle, { color: theme.text }]}>Want picks of your own?</Text>
      <Text style={{ color: theme.textSecondary, textAlign: 'center', lineHeight: 21 }}>
        Sign in and we’ll pull suggestions from the books on your shelves.
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <Link href="/sign-in" asChild>
          <Pill label="Sign in" kind="quiet" small />
        </Link>
        <Link href="/sign-up" asChild>
          <Pill label="Join free" small />
        </Link>
      </View>
    </View>
  );
}

/* ------------------------------------------------------- Public shelves */

function PublicShelves() {
  const theme = useTheme();
  const { md } = useBreakpoint();
  const { data, error, loading } = useAsync<DiscoverShelves>(supabase ? () => getDiscoverShelves(supabase!) : null, []);
  if (loading) return <Loading />;
  if (error || !data) {
    return (
      <EmptyNote>
        <Text style={[styles.noteText, { color: theme.textSecondary }]}>Couldn’t reach the stacks just now.</Text>
      </EmptyNote>
    );
  }
  const { trending, drawers, moods } = data;
  const chips = (kind: string) => drawers.filter((d) => d.kind === kind && d.works > 0);
  const tropes = chips('trope');
  const paces = chips('pace');
  // Number only the sections that actually render.
  const numerals = ['I', 'II', 'III'];
  let n = 0;
  const next = () => numerals[n++];
  const browseAll = (
    <Link href="/search" style={[styles.asideLink, { color: theme.accent }]}>
      Browse all →
    </Link>
  );

  return (
    <>
      {trending.length ? (
        <View style={styles.section}>
          <SectionHeading numeral={next()} aside={browseAll}>
            Most shelved
          </SectionHeading>
          <Bookshelf books={trending} />
        </View>
      ) : null}

      {moods.length ? (
        <View style={styles.section}>
          <SectionHeading numeral={next()}>Shelf by shelf</SectionHeading>
          {/* Two shelves side by side on iPad, as on the web. */}
          <Grid columns={md ? 2 : 1} gap={spacing[7]} rowGap={spacing[6]}>
          {moods.map(({ drawer, books }) => (
            <View key={drawer.slug} style={styles.row}>
              <View style={styles.moodHeading}>
                <View style={styles.moodName}>
                  <View style={[styles.dot, { width: 10, height: 10, backgroundColor: genreColor(drawer.slug).dot }]} />
                  <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.moodTitle, { color: theme.text }]}>{drawer.name}</Text>
                </View>
                <Link href={{ pathname: '/search', params: { tags: drawer.slug } }} style={[styles.asideLink, { color: theme.accent }]}>
                  All {drawer.works} →
                </Link>
              </View>
              <Bookshelf books={books} />
            </View>
          ))}
          </Grid>
        </View>
      ) : null}

      {tropes.length || paces.length ? (
        <View style={styles.section}>
          <SectionHeading numeral={next()}>Or go by feel</SectionHeading>
          <Grid columns={md && tropes.length && paces.length ? 2 : 1} gap={spacing[7]} rowGap={spacing[6]}>
            {tropes.length ? <ChipGroup title="Tropes" blurb="The stories you can’t resist." drawers={tropes} /> : null}
            {paces.length ? <ChipGroup title="Pace" blurb="A page-turner, or something to savour." drawers={paces} /> : null}
          </Grid>
        </View>
      ) : null}
    </>
  );
}

type Drawer = DiscoverShelves['drawers'][number];

function ChipGroup({ title, blurb, drawers }: { title: string; blurb: string; drawers: Drawer[] }) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing[2] }}>
      <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.moodTitle, { color: theme.text }]}>{title}</Text>
      <Text style={{ color: theme.textSecondary }}>{blurb}</Text>
      <View style={styles.chips}>
        {drawers.map((d) => (
          <Link key={d.slug} href={{ pathname: '/search', params: { tags: d.slug } }} asChild>
            <Pressable style={StyleSheet.flatten([styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }])}>
              <View style={[styles.dot, { backgroundColor: genreColor(d.slug).dot }]} />
              <Text style={{ color: theme.text, fontWeight: '500', fontSize: 15 }}>{d.name}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{d.works}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: spacing[4], gap: spacing[8] },
  section: { gap: spacing[6] },
  row: { gap: spacing[4] },
  rowAccent: { fontFamily: DisplayFonts.italic, fontSize: 20 },
  noteText: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
  noteLink: { fontWeight: '700' },
  asideLink: { fontWeight: '700', fontSize: 14 },
  signedOut: { alignItems: 'center', gap: spacing[3], borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.lg, padding: spacing[5] },
  signedOutTitle: { fontFamily: DisplayFonts.regular, fontSize: 26, lineHeight: 30, textAlign: 'center' },
  moodHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[3] },
  moodName: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexShrink: 1 },
  moodTitle: { fontFamily: DisplayFonts.regular, fontSize: 28, lineHeight: 32 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing[3] + 2,
    paddingVertical: spacing[2],
  },
  dot: { width: 8, height: 8, borderRadius: 5 },
});
