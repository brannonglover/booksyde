import {
  type BookLike,
  bookSeries,
  type CatalogBook,
  compactCount,
  formatRating,
  type BrowseDrawer,
  getBrowseDrawers,
  getTagDrawers,
  heldAlready,
  lifeYears,
  type OpenLibraryBook,
  searchAuthors,
  searchCatalog,
  searchOpenLibrary,
  searchReaders,
  seriesLabel,
  tagBlurbs,
} from '@booksyde/shared';
import { genreColor, mixHex, palette, radii, spacing } from '@booksyde/theme';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BookCover } from '@/components/book-cover';
import { CoverFan } from '@/components/cover-fan';
import { RequestSlip } from '@/components/request-slip';
import { SeriesLine } from '@/components/series-line';
import { ThemedView } from '@/components/themed-view';
import { TintWash } from '@/components/tint-wash';
import { BottomTabInset, DisplayFonts, Fonts, MaxContentWidth, DisplayMaxScale } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useQuickShelf } from '@/hooks/use-quick-shelf';
import { Grid } from '@/components/grid';
import { useBreakpoint, useColumns } from '@/hooks/use-breakpoint';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// On web the tab bar floats over the top of the screen; start below it.
const WebTabBarHeight = 72;
const mono = Fonts.mono;

type Drawer = Awaited<ReturnType<typeof getTagDrawers>>[number];
type Found = {
  key: string;
  books: CatalogBook[];
  authors: Awaited<ReturnType<typeof searchAuthors>>;
  readers: Awaited<ReturnType<typeof searchReaders>>;
  error?: boolean;
};

const suggestions = ['Jane Austen', 'frankenstien', '978-0-14-143951-8', 'gothic'];

function parseTags(raw: string | string[] | undefined) {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return (s ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => /^[a-z0-9-]{1,40}$/.test(t))
    .slice(0, 5);
}

/** The card catalogue: search by title, author, ISBN or feeling, or browse the drawers. */
export default function SearchScreen() {
  const theme = useTheme();
  const quick = useQuickShelf();
  const router = useRouter();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { contentWidth } = useBreakpoint();
  const bookColumns = useColumns(1, { md: 2, xl: 3 });
  const params = useLocalSearchParams<{ q?: string; tags?: string }>();

  // Start from (and follow) the route params, e.g. a search from the home screen.
  const paramKey = `${params.q ?? ''}|${params.tags ?? ''}`;
  const [seenParams, setSeenParams] = useState(paramKey);
  const [q, setQ] = useState(params.q ?? '');
  const [tags, setTags] = useState(() => parseTags(params.tags));
  if (paramKey !== seenParams) {
    setSeenParams(paramKey);
    setQ(params.q ?? '');
    setTags(parseTags(params.tags));
  }

  const [drawers, setDrawers] = useState<Drawer[]>([]);
  const [browse, setBrowse] = useState<BrowseDrawer[]>([]);
  useEffect(() => {
    if (!supabase) return;
    getTagDrawers(supabase)
      .then(setDrawers)
      .catch(() => {});
    getBrowseDrawers(supabase)
      .then(setBrowse)
      .catch(() => {});
  }, []);

  const term = q.trim();
  const key = `${term}|${tags.join(',')}`;
  const browsing = !term && tags.length === 0;
  const [found, setFound] = useState<Found | null>(null);
  useEffect(() => {
    const client = supabase;
    if (!client || (!term && tags.length === 0)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all([
        searchCatalog(client, { q: term, tags, limit: 40 }),
        term ? searchAuthors(client, term) : [],
        term ? searchReaders(client, term) : [],
      ])
        .then(([books, authors, readers]) => !cancelled && setFound({ key, books, authors, readers }))
        .catch(() => !cancelled && setFound({ key, books: [], authors: [], readers: [], error: true }));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, term, tags]);

  const results = found?.key === key ? found : null;

  // The wider stacks (Open Library) for books we don't hold yet: plain text searches only.
  const [stacks, setStacks] = useState<{ term: string; books: OpenLibraryBook[] | null } | null>(null);
  const stacksWanted = term.length >= 2 && tags.length === 0;
  useEffect(() => {
    if (!stacksWanted) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchOpenLibrary(term, 9, undefined, { skipForgotten: true })
        .then((books) => !cancelled && setStacks({ term, books }))
        .catch(() => !cancelled && setStacks({ term, books: null }));
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, stacksWanted]);
  const stacksNow = stacksWanted && stacks?.term === term ? stacks : null;
  const tagName = (slug: string) => drawers.find((d) => d.slug === slug)?.name ?? slug;
  const toggleTag = (slug: string) => setTags((t) => (t.includes(slug) ? t.filter((x) => x !== slug) : [...t, slug]));

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // Keep the search slip above the iPhone keyboard (and let results scroll clear of it).
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: (Platform.OS === 'web' ? WebTabBarHeight : insets.top) + spacing[6],
            paddingBottom: insets.bottom + BottomTabInset + spacing[7],
          },
        ]}
      >
        <View style={[styles.content, { maxWidth: contentWidth }]}>
          <Text style={[styles.kicker, { color: theme.accent }]}>THE CARD CATALOGUE</Text>
          <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.title, { color: theme.text }]}>
            {/* A no-break space keeps "looking for" together: on a phone it drops to the second line whole. */}
            What are you <Text style={{ fontFamily: DisplayFonts.italic, color: theme.accent }}>{'looking for'}</Text>?
          </Text>
          <Text style={[styles.lede, { color: theme.textSecondary }]}>
            A title, an author, an ISBN off the back cover, or just a feeling. We forgive typos.
          </Text>

          {/* Brass label holder with a typed slip inside */}
          <View style={styles.brass}>
            <View style={styles.slip}>
              <View accessibilityElementsHidden importantForAccessibility="no" style={styles.lens}>
                <View style={styles.lensRing} />
                <View style={styles.lensHandle} />
              </View>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Title, author, ISBN, feeling…"
                placeholderTextColor="#8A7F72"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
                accessibilityLabel="Search the catalogue"
                style={styles.input}
              />
              {q && Platform.OS !== 'ios' ? (
                <Pressable onPress={() => setQ('')} accessibilityLabel="Clear search" hitSlop={10}>
                  <Text style={{ color: '#8A7F72', fontSize: 16 }}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {browsing ? (
            <Browse drawers={browse} onAsk={setQ} onDrawer={(slug) => setTags([slug])} />
          ) : (
            <View style={{ gap: spacing[6] }}>
              <View style={[styles.summary, { borderBottomColor: theme.border }]}>
                <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                  {results
                    ? `${results.books.length ? `${results.books.length} ${results.books.length === 1 ? 'CARD' : 'CARDS'}` : 'NO CARDS'} FILED UNDER `
                    : 'LEAFING THROUGH THE DRAWERS… '}
                  <Text style={{ color: theme.text }}>
                    {[term ? `“${term.toUpperCase()}”` : null, ...tags.map((t) => tagName(t).toUpperCase())]
                      .filter(Boolean)
                      .join(' + ')}
                  </Text>
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {drawers
                    .filter((d) => (d.kind === 'mood' || d.kind === 'genre') && (d.works > 0 || tags.includes(d.slug)))
                    .sort((a, b) => Number(tags.includes(b.slug)) - Number(tags.includes(a.slug)))
                    .map((d) => {
                      const on = tags.includes(d.slug);
                      const ink = genreColor(d.slug);
                      return (
                        <Pressable
                          key={d.slug}
                          onPress={() => toggleTag(d.slug)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          style={[
                            styles.chip,
                            on
                              ? { backgroundColor: ink.bg, borderColor: ink.bg }
                              : { backgroundColor: 'transparent', borderColor: theme.border },
                          ]}
                        >
                          <View style={[styles.chipDot, { backgroundColor: ink.dot }]} />
                          <Text style={[styles.chipLabel, { color: on ? ink.fg : theme.textSecondary, fontWeight: on ? '700' : '500' }]}>
                            {d.name}
                            {on ? '  ✕' : ''}
                          </Text>
                        </Pressable>
                      );
                    })}
                </ScrollView>
              </View>

              {!results ? (
                <ActivityIndicator color={theme.accent} style={{ marginTop: spacing[6] }} />
              ) : results.books.length + results.authors.length + results.readers.length === 0 ? (
                // Plain text searches go straight to the wider stacks, which show the empty card if they come up dry.
                stacksWanted && !results.error ? null : <EmptyDrawer
                  term={term}
                  error={results.error}
                  onClear={() => (tags.length ? setTags([]) : setQ(''))}
                  hasTags={tags.length > 0}
                />
              ) : (
                <>
                  {/* One card a row on a phone; two or three across on iPad, as on the web. */}
                  <Grid columns={bookColumns} gap={spacing[4]}>
                    {results.books.map((book) => (
                      <CatalogueCard key={book.id} book={book} onLongPress={() => quick.open(book)} />
                    ))}
                  </Grid>
                  {results.authors.length ? (
                    <View style={{ gap: spacing[3] }}>
                      <AsideHeading>AUTHORS</AsideHeading>
                      {results.authors.map((a) => (
                        <Pressable
                          key={a.id}
                          onPress={() => router.push({ pathname: '/author/[id]', params: { id: a.id } })}
                          accessibilityRole="link"
                          style={({ pressed }) => [styles.authorRow, pressed && { opacity: 0.7 }]}
                        >
                          <View style={[styles.authorBadge, { borderColor: palette.gilt, backgroundColor: theme.backgroundElement }]}>
                            <Text style={[styles.authorInitials, { color: theme.text }]}>
                              {a.name
                                .split(/\s+/)
                                .map((p) => p[0])
                                .slice(0, 2)
                                .join('')}
                            </Text>
                            {/* The portrait sits over the initials, so a photo that fails to load still leaves them. */}
                            {a.photo_url ? (
                              <Image
                                source={{ uri: a.photo_url }}
                                style={StyleSheet.absoluteFill}
                                contentFit="cover"
                                contentPosition="top"
                                transition={150}
                                cachePolicy="memory-disk"
                                accessible={false}
                              />
                            ) : null}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.authorName, { color: theme.text }]}>{a.name}</Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                              {[lifeYears(a.birth_date, a.death_date), `${a.works} ${a.works === 1 ? 'book' : 'books'} on file`]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {results.readers.length ? (
                    <View style={{ gap: spacing[3] }}>
                      <AsideHeading>READERS</AsideHeading>
                      {results.readers.map((r) => (
                        <ReaderPlate key={r.id} reader={r} />
                      ))}
                    </View>
                  ) : null}
                </>
              )}

              {results && stacksWanted ? (
                <WiderStacks
                  stacks={stacksNow}
                  onFile={results.books.map((b) => ({ title: b.title, authors: authorNames(b) }))}
                  headline={results.books.length === 0}
                  empty={
                    results.authors.length + results.readers.length === 0 ? (
                      <EmptyDrawer term={term} stacksChecked hasTags={false} onClear={() => setQ('')} />
                    ) : null
                  }
                />
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
      {quick.sheet}
    </ThemedView>
  );
}

function authorNames(book: CatalogBook) {
  return [...book.work_contributors]
    .filter((c) => c.role === 'author')
    .sort((a, b) => a.position - b.position)
    .map((c) => c.authors.name);
}

function WiderStacks({
  stacks,
  onFile,
  headline,
  empty,
}: {
  stacks: { books: OpenLibraryBook[] | null } | null;
  onFile: BookLike[];
  headline: boolean;
  /** Shown instead when nothing turned up here or in the stacks. */
  empty: React.ReactNode;
}) {
  const theme = useTheme();
  const books = (stacks?.books ?? []).filter((b) => !heldAlready(b, onFile)).slice(0, 6);
  if (stacks?.books && books.length === 0) return headline ? empty : null;
  return (
    <View style={[{ gap: spacing[4] }, !headline && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: spacing[6] }]}>
      <View style={{ gap: spacing[1] }}>
        <Text style={[styles.summaryText, { color: theme.textSecondary }]}>NOT ON BOOKSYDE YET</Text>
        <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.cabinetTitle, { color: theme.text }]}>
          From the <Text style={{ fontFamily: DisplayFonts.italic, color: theme.accent }}>wider stacks</Text>
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 22 }}>
          {headline ? 'We don’t have it on our shelves yet, but these are out there. ' : ''}
          Add one and it joins the catalogue, ready to shelve and review. Courtesy of Open Library.
        </Text>
      </View>
      {!stacks ? (
        <ActivityIndicator color={theme.accent} />
      ) : stacks.books === null ? (
        <Text style={{ color: theme.textSecondary }}>The wider stacks aren’t answering right now. Try again in a moment.</Text>
      ) : (
        books.map((b) => <RequestSlip key={b.olid} book={b} />)
      )}
    </View>
  );
}

function AsideHeading({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <View style={styles.asideHeading}>
      <Text style={[styles.asideLabel, { color: theme.textSecondary }]}>{children}</Text>
      <View style={[styles.asideRule, { backgroundColor: theme.border }]} />
    </View>
  );
}

function CatalogueCard({ book, onLongPress }: { book: CatalogBook; onLongPress: () => void }) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  const authors = [...book.work_contributors]
    .filter((x) => x.role === 'author')
    .sort((a, b) => a.position - b.position)
    .map((x) => x.authors);
  const byline = authors.map((a) => a.name).join(' & ') || 'Unknown';
  const subjects = [...book.work_tags]
    .filter((t) => t.votes > 0 && (t.tags.kind === 'genre' || t.tags.kind === 'mood'))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 3)
    .map((t) => t.tags);
  const tint = book.cover_color ?? (subjects[0] ? genreColor(subjects[0].slug).dot : null) ?? palette.gilt;
  const series = bookSeries(book);
  const rating = formatRating(Number(book.avg_rating));

  return (
    <Link href={{ pathname: '/book/[id]', params: { id: book.id } }} asChild>
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={400}
        accessibilityHint="Press and hold to put it on a shelf"
        // Link (asChild) only passes a plain style through, so the pressed look is tracked by hand.
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={StyleSheet.flatten([
          styles.card,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: pressed ? mixHex(theme.border, theme.text, 0.25) : theme.border,
            transform: [{ translateY: pressed ? -2 : 0 }],
          },
        ])}
      >
        <TintWash color={tint} />
        <BookCover title={book.title} author={byline} src={book.cover_url} color={book.cover_color} width={96} />
        <View style={styles.cardBody}>
          {book.first_published_year ? (
            <Text style={[styles.cardYear, { color: theme.textSecondary }]}>{book.first_published_year}</Text>
          ) : null}
          <Text numberOfLines={2} maxFontSizeMultiplier={DisplayMaxScale} style={[styles.cardTitle, { color: theme.text }]}>
            {book.title}
          </Text>
          {book.subtitle ? (
            <Text numberOfLines={1} style={[styles.cardSubtitle, { color: theme.textSecondary }]}>{book.subtitle}</Text>
          ) : null}
          <Text numberOfLines={1} style={[styles.cardByline, { color: theme.text }]}>
            <Text style={{ color: theme.textSecondary }}>by </Text>
            <Text style={{ fontWeight: '500' }}>{byline}</Text>
          </Text>
          {series ? <SeriesLine label={seriesLabel(series)} /> : null}

          {book.ratings_count > 0 || subjects.length ? (
            <View style={styles.cardTags}>
              {book.ratings_count > 0 ? (
                <View
                  style={[styles.ratingPill, { backgroundColor: mixHex(theme.backgroundElement, theme.highlight, 0.15) }]}
                  accessibilityLabel={`Rated ${rating} from ${book.ratings_count} ${book.ratings_count === 1 ? 'rating' : 'ratings'}`}
                >
                  <Text style={[styles.pillText, { color: theme.text, fontWeight: '600' }]}>
                    <Text style={{ color: theme.highlight }}>★</Text> {rating}{' '}
                    <Text style={{ color: theme.textSecondary, fontWeight: '400' }}>({compactCount(book.ratings_count)})</Text>
                  </Text>
                </View>
              ) : null}
              {subjects.map((t) => (
                <View key={t.slug} style={[styles.subjectPill, { borderColor: theme.border }]}>
                  <View style={[styles.subjectDot, { backgroundColor: genreColor(t.slug).dot }]} />
                  <Text style={[styles.pillText, { color: theme.textSecondary }]}>{t.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

function ReaderPlate({ reader }: { reader: Found['readers'][number] }) {
  const dark = useColorScheme() === 'dark';
  const theme = useTheme();
  const ink = reader.theme_color ?? palette.green;
  const name = reader.display_name || reader.username;
  return (
    <Link href={{ pathname: '/u/[username]', params: { username: reader.username } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.plate, { borderColor: ink, backgroundColor: dark ? '#2F2822' : '#FBF5E8' }])}>
        <Avatar name={name} src={reader.avatar_url} ink={ink} size={40} style={styles.plateBadge} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.authorName, { color: dark ? palette.paper : palette.ink }]}>{name}</Text>
          <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 12 }}>
            @{reader.username}
            {reader.is_private ? ' · 🔒' : ''} · {compactCount(reader.followers_count)}{' '}
            {reader.followers_count === 1 ? 'follower' : 'followers'}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

/** Nothing turned up: three blank covers fanned like books just pulled off a shelf, and a way back out. */
function EmptyDrawer({
  term,
  error,
  hasTags,
  stacksChecked = false,
  onClear,
}: {
  term: string;
  error?: boolean;
  hasTags: boolean;
  stacksChecked?: boolean;
  onClear: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.empty, { borderColor: theme.border }]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.fan}>
        <View style={[styles.fanSide, { backgroundColor: 'rgba(139,58,43,0.7)', transform: [{ translateX: 12 }, { rotate: '-12deg' }] }]} />
        <View style={styles.fanMiddle}>
          <Text maxFontSizeMultiplier={DisplayMaxScale} style={styles.fanMark}>?</Text>
        </View>
        <View style={[styles.fanSide, { backgroundColor: 'rgba(184,137,58,0.8)', transform: [{ translateX: -12 }, { rotate: '12deg' }] }]} />
      </View>
      <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.emptyTitle, { color: theme.text }]}>{error ? 'The catalogue is stuck' : 'Nothing turned up'}</Text>
      <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
        {error
          ? 'We couldn’t reach the catalogue. Check your connection and try again.'
          : `${term ? `We couldn’t find “${term}” ${stacksChecked ? 'here or on Open Library' : 'on Booksyde'}. ` : ''}${
              hasTags ? 'Try removing a filter or two, or browse by mood and genre.' : 'Try a shorter word, an author’s surname, or the ISBN on the back.'
            }`}
      </Text>
      <Pressable onPress={onClear} style={[styles.emptyButton, { borderColor: theme.border }]}>
        <Text style={{ color: theme.text, fontWeight: '600' }}>
          {hasTags && term ? `Search “${term}” without filters` : 'Browse by mood & genre'}
        </Text>
      </Pressable>
    </View>
  );
}

function Browse({ drawers, onAsk, onDrawer }: { drawers: BrowseDrawer[]; onAsk: (q: string) => void; onDrawer: (slug: string) => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing[7] }}>
      <View style={styles.suggestions}>
        <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Try asking for</Text>
        {suggestions.map((s) => (
          <Pressable key={s} onPress={() => onAsk(s)} style={[styles.suggestion, { borderColor: theme.border }]}>
            <Text style={[styles.mono, { color: theme.text }]}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <ShelfRow title="Browse by mood" blurb="Start with how you want a book to feel." drawers={drawers.filter((d) => d.kind === 'mood')} onDrawer={onDrawer} />
      <ShelfRow title="Browse by genre" blurb="Or pick a genre you already love." drawers={drawers.filter((d) => d.kind === 'genre')} onDrawer={onDrawer} />
    </View>
  );
}

/**
 * A mood or genre shelf: one row of cards that scrolls sideways, so the whole
 * catalogue of moods and genres fits on a phone in about one screen. Each card
 * is the web's browse card stood upright: a fan of covers, the name and count,
 * and a line on what it's like.
 */
function ShelfRow({ title, blurb, drawers, onDrawer }: { title: string; blurb: string; drawers: BrowseDrawer[]; onDrawer: (slug: string) => void }) {
  const theme = useTheme();
  const { md } = useBreakpoint();
  const columns = useColumns(1, { md: 4, lg: 5, xl: 6 });
  if (drawers.length === 0) return null;
  // iPad has room for the whole shelf at once, so the cards stand in a grid instead of scrolling sideways.
  if (md) {
    return (
      <View style={{ gap: spacing[2] }}>
        <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.cabinetTitle, { color: theme.text }]}>{title}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{blurb}</Text>
        <Grid columns={columns} gap={10} style={{ paddingTop: spacing[3] }}>
          {drawers.map((d) => (
            <ShelfCard key={d.slug} drawer={d} onPress={() => onDrawer(d.slug)} fill />
          ))}
        </Grid>
      </View>
    );
  }
  return (
    <View style={{ gap: spacing[2] }}>
      <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.cabinetTitle, { color: theme.text }]}>{title}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{blurb}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shelfScroll} contentContainerStyle={styles.shelfRow}>
        {drawers.map((d) => (
          <ShelfCard key={d.slug} drawer={d} onPress={() => onDrawer(d.slug)} />
        ))}
      </ScrollView>
    </View>
  );
}

/** `fill` stretches the card to its grid cell (iPad) instead of the phone row's fixed width. */
function ShelfCard({ drawer, onPress, fill }: { drawer: BrowseDrawer; onPress: () => void; fill?: boolean }) {
  const theme = useTheme();
  const tint = genreColor(drawer.slug).dot;
  const empty = drawer.works === 0;
  return (
    <Pressable
      disabled={empty}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${drawer.name}, ${drawer.works} ${drawer.works === 1 ? 'book' : 'books'}`}
      style={(state) => {
        // react-native-web adds `hovered`; native only knows `pressed`.
        const active = state.pressed || (state as { hovered?: boolean }).hovered;
        return [
          styles.shelfCard,
          fill && styles.shelfCardFill,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: active ? tint : theme.border,
            opacity: empty ? 0.6 : 1,
            transform: [{ translateY: active ? -2 : 0 }],
          },
        ];
      }}
    >
      <CoverFan covers={drawer.covers} tint={tint} edge={theme.backgroundElement} />
      {/* Up to two lines, so "Historical Fiction 340" isn't cut short; the row's cards stretch to match. */}
      <Text numberOfLines={2} style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: spacing[3] }}>
        {drawer.name}
        {empty ? null : <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '400' }}>{`  ${compactCount(drawer.works)}`}</Text>}
      </Text>
      <Text numberOfLines={2} style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 17, marginTop: 2 }}>
        {empty ? 'Nothing tagged yet' : (tagBlurbs[drawer.slug] ?? `${drawer.works} books`)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: spacing[5], gap: spacing[5] },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 3, textAlign: 'center' },
  title: { fontFamily: DisplayFonts.regular, fontSize: 46, lineHeight: 54, textAlign: 'center' },
  lede: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  brass: {
    borderRadius: 14,
    padding: 3,
    backgroundColor: '#B8893A',
    borderTopColor: '#D9B46A',
    borderBottomColor: '#8E6827',
    shadowColor: '#1F1B16',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  slip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: 11,
    backgroundColor: '#FFFDF6',
    paddingHorizontal: spacing[4],
    paddingVertical: Platform.OS === 'ios' ? spacing[4] : spacing[2],
  },
  lens: { width: 22, height: 22 },
  lensRing: { position: 'absolute', top: 1, left: 1, width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: '#8E6827' },
  lensHandle: {
    position: 'absolute',
    top: 15,
    left: 13,
    width: 8,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#8E6827',
    transform: [{ rotate: '45deg' }],
  },
  input: { flex: 1, minWidth: 0, fontFamily: mono, fontSize: 17, color: palette.ink, paddingVertical: spacing[1] },
  summary: { gap: spacing[3], paddingBottom: spacing[4], borderBottomWidth: StyleSheet.hairlineWidth },
  summaryText: { fontFamily: mono, fontSize: 12, letterSpacing: 1.2 },
  chips: { gap: spacing[2], paddingRight: spacing[5] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipLabel: { fontSize: 14 },
  card: {
    flexDirection: 'row',
    // Fills its grid cell on iPad, so cards side by side match heights.
    flexGrow: 1,
    gap: spacing[4],
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing[4],
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardYear: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  cardTitle: { fontFamily: DisplayFonts.regular, fontSize: 26, lineHeight: 28, marginTop: 2 },
  cardSubtitle: { fontSize: 14, marginTop: 4 },
  cardByline: { fontSize: 14, marginTop: 6 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: spacing[4] },
  ratingPill: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subjectDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12 },
  mono: { fontFamily: mono, fontSize: 13, lineHeight: 20 },
  asideHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[4] },
  asideLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  asideRule: { flex: 1, height: StyleSheet.hairlineWidth },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[1] },
  authorBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  authorInitials: { fontFamily: DisplayFonts.regular, fontSize: 20 },
  authorName: { fontFamily: DisplayFonts.regular, fontSize: 21, lineHeight: 24 },
  plate: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderWidth: 3, borderStyle: 'solid', borderRadius: 3, padding: spacing[3] },
  plateBadge: { borderWidth: 2, borderColor: palette.gilt },
  empty: {
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[7],
    gap: spacing[2],
    marginTop: spacing[4],
  },
  fan: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: 80, marginBottom: spacing[4] },
  fanSide: { width: 44, height: 64, borderRadius: 3 },
  fanMiddle: {
    zIndex: 1,
    width: 56,
    height: 80,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.green,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  fanMark: { fontFamily: DisplayFonts.regular, fontSize: 28, color: palette.gilt },
  emptyTitle: { fontFamily: DisplayFonts.regular, fontSize: 30, lineHeight: 34, textAlign: 'center' },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 360 },
  emptyButton: { marginTop: spacing[3], borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  suggestion: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: spacing[3], paddingVertical: 4 },
  cabinetTitle: { fontFamily: DisplayFonts.regular, fontSize: 36, lineHeight: 38 },
  shelfScroll: { marginHorizontal: -spacing[5] },
  shelfRow: { gap: 10, paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[1] },
  shelfCard: { width: 156, borderWidth: 1, borderRadius: 16, padding: spacing[3] },
  shelfCardFill: { width: 'auto', flexGrow: 1 },
});
