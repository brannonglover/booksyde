import {
  bookIdentity,
  type CatalogBook,
  callNumber,
  catalogName,
  compactCount,
  getTagDrawers,
  lifeYears,
  type OpenLibraryBook,
  searchAuthors,
  searchCatalog,
  searchOpenLibrary,
  searchReaders,
} from '@booksyde/shared';
import { genreColor, palette, radii, spacing } from '@booksyde/theme';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { Stars } from '@/components/stars';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, DisplayFonts, Fonts, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// On web the tab bar floats over the top of the screen; start below it.
const WebTabBarHeight = 72;
const mono = Fonts.mono;
const webUrl = process.env.EXPO_PUBLIC_WEB_URL;

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
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
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
  useEffect(() => {
    if (!supabase) return;
    getTagDrawers(supabase)
      .then(setDrawers)
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
      searchOpenLibrary(term, 9)
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
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: (Platform.OS === 'web' ? WebTabBarHeight : insets.top) + spacing[6],
            paddingBottom: insets.bottom + BottomTabInset + spacing[7],
          },
        ]}
      >
        <View style={styles.content}>
          <Text style={[styles.kicker, { color: theme.accent }]}>THE CARD CATALOGUE</Text>
          <Text style={[styles.title, { color: theme.text }]}>
            What are you <Text style={{ fontFamily: DisplayFonts.italic, color: theme.accent }}>looking for</Text>?
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
            <Browse drawers={drawers} onAsk={setQ} onDrawer={(slug) => setTags([slug])} />
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
                <EmptyDrawer
                  term={term}
                  error={results.error}
                  onClear={() => (tags.length ? setTags([]) : setQ(''))}
                  hasTags={tags.length > 0}
                />
              ) : (
                <>
                  {results.books.map((book, i) => (
                    <CatalogueCard key={book.id} book={book} tilt={i % 3 === 1 ? '0.5deg' : i % 3 === 2 ? '-0.4deg' : '0deg'} />
                  ))}
                  {results.authors.length ? (
                    <View style={{ gap: spacing[3] }}>
                      <AsideHeading>AUTHORS</AsideHeading>
                      {results.authors.map((a) => (
                        <Pressable key={a.id} onPress={() => setQ(a.name)} style={styles.authorRow}>
                          <View style={[styles.authorBadge, { borderColor: palette.gilt, backgroundColor: theme.backgroundElement }]}>
                            <Text style={[styles.authorInitials, { color: theme.text }]}>
                              {a.name
                                .split(/\s+/)
                                .map((p) => p[0])
                                .slice(0, 2)
                                .join('')}
                            </Text>
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
                  onFile={results.books.map((b) => bookIdentity(b.title, leadAuthor(b)?.name))}
                  headline={results.books.length === 0}
                />
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function leadAuthor(book: CatalogBook) {
  return [...book.work_contributors].filter((c) => c.role === 'author').sort((a, b) => a.position - b.position)[0]
    ?.authors;
}

function WiderStacks({
  stacks,
  onFile,
  headline,
}: {
  stacks: { books: OpenLibraryBook[] | null } | null;
  onFile: string[];
  headline: boolean;
}) {
  const theme = useTheme();
  const held = new Set(onFile);
  const books = (stacks?.books ?? []).filter((b) => !held.has(bookIdentity(b.title, b.authors[0]?.name))).slice(0, 6);
  if (stacks?.books && books.length === 0) return null;
  return (
    <View style={[{ gap: spacing[4] }, !headline && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: spacing[6] }]}>
      <View style={{ gap: spacing[1] }}>
        <Text style={[styles.summaryText, { color: theme.textSecondary }]}>NOT ON FILE YET</Text>
        <Text style={[styles.cabinetTitle, { color: theme.text }]}>
          From the <Text style={{ fontFamily: DisplayFonts.italic, color: theme.accent }}>wider stacks</Text>
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 22 }}>
          {headline ? 'We don’t have it on our shelves yet, but these are out there. ' : ''}
          Fill in a request slip and we’ll add the book to the catalogue. Courtesy of Open Library.
        </Text>
      </View>
      {!stacks ? (
        <ActivityIndicator color={theme.accent} />
      ) : stacks.books === null ? (
        <Text style={{ color: theme.textSecondary }}>The wider stacks aren’t answering right now. Try again in a moment.</Text>
      ) : (
        books.map((b, i) => <RequestSlip key={b.olid} book={b} tilt={i % 2 ? '-0.5deg' : '0.4deg'} />)
      )}
    </View>
  );
}

function RequestSlip({ book, tilt }: { book: OpenLibraryBook; tilt: string }) {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const [state, setState] = useState<'idle' | 'adding' | 'error'>('idle');
  const ink = dark ? palette.paper : palette.ink;
  const label = dark ? '#A9C29A' : '#4A6040';
  const byline = book.authors.map((a) => a.name).join(', ') || 'Unknown';

  async function add() {
    if (!webUrl) return setState('error');
    setState('adding');
    try {
      const res = await fetch(`${webUrl}/api/books/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olid: book.olid }),
      });
      const json = (await res.json()) as { id?: string };
      if (!res.ok || !json.id) throw new Error('Import failed');
      setState('idle');
      router.push({ pathname: '/book/[id]', params: { id: json.id } });
    } catch {
      setState('error');
    }
  }

  const fields: [string, string | number | null][] = [
    ['Title', book.subtitle ? `${book.title}: ${book.subtitle}` : book.title],
    ['Author', byline],
    ['Year', book.year],
  ];
  return (
    <View style={[styles.slipCard, { backgroundColor: dark ? '#2C3529' : '#EEF3E8', transform: [{ rotate: tilt }] }]}>
      <View style={[styles.slipHeader, { borderBottomColor: 'rgba(126,154,110,0.6)' }]}>
        <Text style={[styles.slipHeaderText, { color: label }]}>REQUEST SLIP</Text>
        <Text style={[styles.slipHeaderText, { color: label }]}>NO. {book.olid.replace(/\D/g, '').slice(-5)}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={{ flex: 1, gap: 6 }}>
          {fields.map(([name, value]) =>
            value ? (
              <View key={name} style={styles.slipField}>
                <Text style={[styles.mono, { color: label, width: 58 }]}>{name}:</Text>
                <Text style={[name === 'Title' ? styles.slipTitle : styles.mono, { color: ink, flex: 1 }]}>{value}</Text>
              </View>
            ) : null,
          )}
        </View>
        <BookCover title={book.title} author={byline} coverId={book.coverId} width={56} />
      </View>
      {state === 'error' ? (
        <Text style={{ color: palette.oxblood, fontSize: 13 }}>
          {webUrl ? 'The stacks are stuck right now. Try again in a moment.' : 'Set EXPO_PUBLIC_WEB_URL to add books.'}
        </Text>
      ) : null}
      <Pressable
        onPress={add}
        disabled={state === 'adding'}
        accessibilityRole="button"
        style={[styles.slipButton, { opacity: state === 'adding' ? 0.7 : 1 }]}
      >
        <Text style={styles.slipButtonText}>{state === 'adding' ? 'Fetching it from the stacks…' : 'Add to the catalogue →'}</Text>
      </Pressable>
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

/** The punched hole at the foot of every catalogue card. */
function Hole() {
  const theme = useTheme();
  return <View style={[styles.hole, { backgroundColor: theme.background }]} />;
}

function useCardColors() {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  return {
    paper: dark ? theme.backgroundSelected : '#FFFDF6',
    ink: dark ? theme.text : palette.ink,
    muted: dark ? theme.textSecondary : '#6F655A',
    rule: dark ? 'rgba(201,123,107,0.5)' : 'rgba(139,58,43,0.5)',
  };
}

function CatalogueCard({ book, tilt }: { book: CatalogBook; tilt: string }) {
  const theme = useTheme();
  const c = useCardColors();
  const authors = [...book.work_contributors]
    .filter((x) => x.role === 'author')
    .sort((a, b) => a.position - b.position)
    .map((x) => x.authors);
  const lead = authors[0];
  const byline = authors.map((a) => a.name).join(' & ') || 'Unknown';
  const subjects = [...book.work_tags]
    .filter((t) => t.votes > 0 && (t.tags.kind === 'genre' || t.tags.kind === 'mood'))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 4)
    .map((t) => t.tags);

  return (
    <Link href={{ pathname: '/book/[id]', params: { id: book.id } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.card, { backgroundColor: c.paper, transform: [{ rotate: tilt }] }])}>
        <View style={[styles.cardHeading, { borderBottomColor: c.rule }]}>
          <Text style={[styles.callNumber, { color: theme.accent }]}>{callNumber(book, lead?.name)}</Text>
          <Text numberOfLines={1} style={[styles.mono, { color: c.muted, flex: 1 }]}>
            {lead
              ? `${[catalogName(lead.name), lifeYears(lead.birth_date, lead.death_date)].filter(Boolean).join(', ')}.`
              : 'Anonymous.'}
          </Text>
        </View>
        <View style={styles.cardBody}>
          <View style={{ flex: 1, gap: spacing[2] }}>
            <Text style={[styles.cardTitle, { color: c.ink }]}>{book.title}</Text>
            {book.subtitle ? <Text style={[styles.mono, { color: c.muted }]}>{book.subtitle}</Text> : null}
            <Text style={[styles.mono, { color: c.ink }]}>
              / by {byline}.{book.first_published_year ? ` — First published ${book.first_published_year}.` : ''}
            </Text>
            {book.ratings_count > 0 ? (
              <View style={styles.ratingRow}>
                <Stars rating={Number(book.avg_rating)} size={12} />
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {Number(book.avg_rating).toFixed(1)} · {compactCount(book.ratings_count)} ratings
                </Text>
              </View>
            ) : null}
            {subjects.length ? (
              <Text style={[styles.mono, { color: c.muted }]}>
                {subjects.map((t, i) => `${i + 1}. ${t.name}${t.kind === 'genre' ? ' — Fiction' : ''}.`).join(' ')}
              </Text>
            ) : null}
          </View>
          <BookCover title={book.title} author={byline} src={book.cover_url} color={book.cover_color} width={64} />
        </View>
        <Hole />
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
        <View style={[styles.plateBadge, { backgroundColor: ink }]}>
          <Text style={styles.plateInitial}>{name.charAt(0).toUpperCase()}</Text>
        </View>
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

function EmptyDrawer({ term, error, hasTags, onClear }: { term: string; error?: boolean; hasTags: boolean; onClear: () => void }) {
  const theme = useTheme();
  const c = useCardColors();
  return (
    <View style={[styles.card, { backgroundColor: c.paper, transform: [{ rotate: '-0.6deg' }] }]}>
      <Text style={[styles.callNumber, { color: theme.accent, letterSpacing: 2 }]}>NOT ON FILE</Text>
      <Text style={[styles.cardTitle, { color: c.ink }]}>{error ? 'The catalogue is stuck.' : 'This drawer is empty.'}</Text>
      <Text style={[styles.mono, { color: c.ink, lineHeight: 22 }]}>
        {error
          ? 'We couldn’t reach the catalogue. Check your connection and try again.'
          : `${term ? `Nothing answers to “${term}”. ` : ''}${hasTags ? 'Try lifting a filter or two.' : 'Try a shorter word, a surname, or the ISBN on the back.'}`}
      </Text>
      <Pressable onPress={onClear} style={[styles.emptyButton, { borderColor: theme.border }]}>
        <Text style={{ color: c.ink, fontWeight: '600' }}>{hasTags ? 'Clear the filters' : 'Browse the drawers'}</Text>
      </Pressable>
      <Hole />
    </View>
  );
}

function Browse({ drawers, onAsk, onDrawer }: { drawers: Drawer[]; onAsk: (q: string) => void; onDrawer: (slug: string) => void }) {
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
      <Cabinet title="By feeling" blurb="Pull out a drawer for the mood you’re in." drawers={drawers.filter((d) => d.kind === 'mood')} onDrawer={onDrawer} />
      <Cabinet title="By shelf" blurb="The old-fashioned way: genre by genre." drawers={drawers.filter((d) => d.kind === 'genre')} onDrawer={onDrawer} />
    </View>
  );
}

function Cabinet({ title, blurb, drawers, onDrawer }: { title: string; blurb: string; drawers: Drawer[]; onDrawer: (slug: string) => void }) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  return (
    <View style={{ gap: spacing[2] }}>
      <Text style={[styles.cabinetTitle, { color: theme.text }]}>{title}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{blurb}</Text>
      <View style={[styles.cabinet, { backgroundColor: dark ? '#3A2A1F' : '#4A3426' }]}>
        {drawers.map((d) => {
          const empty = d.works === 0;
          return (
            <Pressable
              key={d.slug}
              disabled={empty}
              onPress={() => onDrawer(d.slug)}
              accessibilityLabel={`${d.name}, ${d.works} ${d.works === 1 ? 'book' : 'books'}`}
              style={({ pressed }) => [styles.drawer, { opacity: empty ? 0.55 : 1, transform: [{ translateY: pressed ? 2 : 0 }] }]}
            >
              <View style={styles.labelHolder}>
                <View style={styles.label}>
                  <View style={[styles.chipDot, { backgroundColor: genreColor(d.slug).dot }]} />
                  <Text style={[styles.labelText]} numberOfLines={2}>
                    {d.name}
                  </Text>
                </View>
              </View>
              <View style={styles.pull} />
              <Text style={styles.drawerCount}>{empty ? 'EMPTY' : `${d.works} ${d.works === 1 ? 'CARD' : 'CARDS'}`}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: spacing[5], gap: spacing[5] },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 3, textAlign: 'center' },
  title: { fontFamily: DisplayFonts.regular, fontSize: 46, lineHeight: 48, textAlign: 'center' },
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
    borderRadius: 3,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[7],
    gap: spacing[3],
    shadowColor: '#1F1B16',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardHeading: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[3], paddingBottom: 6, borderBottomWidth: 1 },
  callNumber: { fontFamily: mono, fontSize: 12, fontWeight: '700' },
  mono: { fontFamily: mono, fontSize: 13, lineHeight: 20 },
  cardBody: { flexDirection: 'row', gap: spacing[4], alignItems: 'flex-start' },
  cardTitle: { fontFamily: DisplayFonts.regular, fontSize: 28, lineHeight: 30 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  hole: {
    position: 'absolute',
    bottom: 12,
    left: '50%',
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderTopWidth: 2,
    borderTopColor: 'rgba(31,27,22,0.25)',
  },
  asideHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[4] },
  asideLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  asideRule: { flex: 1, height: StyleSheet.hairlineWidth },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[1] },
  authorBadge: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  authorInitials: { fontFamily: DisplayFonts.regular, fontSize: 20 },
  authorName: { fontFamily: DisplayFonts.regular, fontSize: 21, lineHeight: 24 },
  plate: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderWidth: 3, borderStyle: 'solid', borderRadius: 3, padding: spacing[3] },
  plateBadge: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: palette.gilt, alignItems: 'center', justifyContent: 'center' },
  plateInitial: { color: palette.paper, fontFamily: DisplayFonts.regular, fontSize: 20 },
  emptyButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  suggestion: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: spacing[3], paddingVertical: 4 },
  cabinetTitle: { fontFamily: DisplayFonts.regular, fontSize: 36, lineHeight: 38 },
  cabinet: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8, borderRadius: 6, marginTop: spacing[3] },
  drawer: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 4,
    backgroundColor: '#6B4A2E',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    alignItems: 'stretch',
  },
  labelHolder: { borderRadius: 3, padding: 2, backgroundColor: '#B8893A' },
  label: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 2,
    backgroundColor: '#FFFDF6',
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
  },
  labelText: { fontFamily: mono, fontSize: 12, color: palette.ink, textAlign: 'center', flexShrink: 1 },
  pull: {
    alignSelf: 'center',
    marginTop: spacing[3],
    width: 40,
    height: 12,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: '#C9A35A',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  slipCard: {
    borderRadius: 3,
    padding: spacing[4],
    gap: spacing[3],
    shadowColor: '#1F1B16',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  slipHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, borderBottomWidth: 1, borderStyle: 'dashed' },
  slipHeaderText: { fontFamily: mono, fontSize: 10, letterSpacing: 2 },
  slipField: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  slipTitle: { fontFamily: DisplayFonts.regular, fontSize: 19, lineHeight: 22 },
  slipButton: { alignSelf: 'flex-start', backgroundColor: palette.green, borderRadius: radii.pill, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  slipButtonText: { color: palette.paper, fontWeight: '600', fontSize: 14 },
  drawerCount: { marginTop: spacing[2], textAlign: 'center', fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,217,191,0.7)' },
});
