import {
  bookVibe,
  formatRating,
  getMoreLikeThis,
  getRatingDistribution,
  getShelfCounts,
  getWork,
  getMyReadingStatus,
  getWorkReviews,
  ratingVerdict,
  READING_STATUS_LABELS,
  setReadingStatus,
} from '@booksyde/shared';
import { genreColor, mixHex, palette, radii, spacing } from '@booksyde/theme';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Stars } from '@/components/stars';
import { BottomTabInset, DisplayFonts, Fonts, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/*
 * A book screen laid out like a book: a title page, then chapters — the
 * vibe, the marginalia (reviews), the catalogue card (details) — and an
 * epilogue of books shelved nearby. Mirrors apps/web/src/app/books/[id].
 */

type Work = NonNullable<Awaited<ReturnType<typeof getWork>>>;
type BookData = {
  work: Work;
  distribution: Awaited<ReturnType<typeof getRatingDistribution>>;
  reviews: Awaited<ReturnType<typeof getWorkReviews>>;
  shelves: Awaited<ReturnType<typeof getShelfCounts>>;
  similar: Awaited<ReturnType<typeof getMoreLikeThis>>;
};

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const formatLabels: Record<string, string> = {
  hardcover: 'Hardcover',
  paperback: 'Paperback',
  mass_market: 'Mass market',
  ebook: 'Ebook',
  audiobook: 'Audiobook',
  other: 'Edition',
};
const segmentShades = ['#B8893A', '#CFA75E', '#C9B79A', '#B9A58C', '#A08E7A'];
const stickerStyles = [
  { bg: palette.oxblood, fg: palette.paper, rotate: '-2deg' },
  { bg: palette.gilt, fg: palette.ink, rotate: '1deg' },
  { bg: palette.aubergine, fg: palette.paper, rotate: '-1deg' },
  { bg: palette.paper, fg: palette.ink, rotate: '2deg' },
];

/** "Austen, Jane": how a card catalogue files an author. */
function catalogueName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? name : `${parts.at(-1)}, ${parts.slice(0, -1).join(' ')}`;
}

function useBook(id: string) {
  const [state, setState] = useState<{ data?: BookData | null; error?: string }>({});
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const client = supabase;
    (async () => {
      const work = await getWork(client, id);
      if (!work) return null;
      const [distribution, reviews, shelves, similar] = await Promise.all([
        getRatingDistribution(client, id),
        getWorkReviews(client, id, 6),
        getShelfCounts(client, id),
        getMoreLikeThis(client, id, 6),
      ]);
      return { work, distribution, reviews, shelves, similar };
    })()
      .then((data) => !cancelled && setState({ data }))
      .catch(() => !cancelled && setState({ error: 'Couldn’t load this book. Is Supabase running?' }));
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (!supabase) return { error: 'Supabase isn’t configured. Copy .env.example to .env.local.' };
  return state;
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { data, error } = useBook(id);

  if (error || data === null) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {data === null ? 'This book seems to have been misshelved.' : 'Something went wrong.'}
        </Text>
        <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>{error ?? 'We couldn’t find it.'}</Text>
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
  return <BookDetail data={data} />;
}

function BookDetail({ data }: { data: BookData }) {
  const theme = useTheme();
  const { work, distribution, reviews, shelves, similar } = data;
  const authors = [...work.work_contributors]
    .filter((c) => c.role === 'author' && c.authors)
    .sort((a, b) => a.position - b.position)
    .map((c) => c.authors!);
  const authorNames = authors.map((a) => a.name).join(' & ') || 'Unknown author';
  const vibe = bookVibe(work.work_tags);
  const verdict = ratingVerdict(distribution);
  const editions = [...work.editions].sort((a, b) => (b.page_count ?? 0) - (a.page_count ?? 0));
  const main = editions.find((e) => e.isbn_13) ?? editions[0];
  const avg = Number(work.avg_rating);
  const tint = work.cover_color ? mixHex(theme.background, work.cover_color, 0.14) : theme.backgroundElement;
  const paragraphs = (work.description ?? '').split(/\n{2,}/).filter(Boolean);
  const lovedPct = Math.round(verdict.lovedShare * 100);
  const headerHeight = useHeaderHeight();

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      {/* The back button floats over the title page instead of sitting on a coloured bar. */}
      <Stack.Screen options={{ title: '', headerTransparent: true, headerStyle: { backgroundColor: 'transparent' } }} />

      {/* Title page */}
      <View style={[styles.titlePage, { backgroundColor: tint, borderBottomColor: theme.border, paddingTop: headerHeight + spacing[2] }]}>
        <View style={{ transform: [{ rotate: '-1.5deg' }] }}>
          <BookCover title={work.title} author={authorNames} src={work.cover_url} color={work.cover_color} width={168} />
        </View>
        {vibe.genres.length > 0 ? (
          <Text style={[styles.kicker, { color: theme.accent, marginTop: spacing[6] }]}>
            {vibe.genres.map((g) => g.name.toUpperCase()).join(' · ')}
          </Text>
        ) : null}
        <Text style={[styles.title, { color: theme.text }]}>{work.title}</Text>
        {work.subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{work.subtitle}</Text> : null}
        <Ornament />
        <Text style={[styles.byline, { color: theme.text }]}>by {authorNames}</Text>
        {work.first_published_year ? (
          <Text style={[styles.kicker, { color: theme.textSecondary, letterSpacing: 1.6 }]}>
            FIRST PRINTED IN {work.first_published_year}
          </Text>
        ) : null}
        <View style={styles.statsRow}>
          <Stars rating={avg} size={16} />
          <Text style={[styles.avg, { color: theme.text }]}>{formatRating(avg)}</Text>
          {verdict.total > 0 ? (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              · loved by {lovedPct}% of {plural(verdict.total, 'reader')}
            </Text>
          ) : null}
        </View>
        {shelves.reading + shelves.wantToRead > 0 ? (
          <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
            {[
              shelves.reading > 0 ? `📖 ${shelves.reading} reading it now` : null,
              shelves.wantToRead > 0 ? `🔖 ${shelves.wantToRead} saving it for later` : null,
            ]
              .filter(Boolean)
              .join('  ·  ')}
          </Text>
        ) : null}
        <ShelfButton workId={work.id} />
      </View>

      <View style={styles.content}>
        {/* The blurb */}
        {paragraphs.map((p, i) => (
          <Text key={i} style={[styles.body, { color: theme.text }]}>
            {i === 0 ? <Text style={[styles.dropCap, { color: theme.accent }]}>{p.charAt(0)}</Text> : null}
            {i === 0 ? p.slice(1) : p}
          </Text>
        ))}

        {/* Chapter one: the vibe */}
        {vibe.moods.length > 0 || vibe.pace !== null || vibe.tropes.length > 0 ? (
          <>
            <ChapterHeading kicker="CHAPTER ONE" title="The vibe" />
            {vibe.bestEnjoyed ? (
              <View style={styles.bestEnjoyed}>
                <View style={styles.bestEnjoyedBorder} />
                <Text style={[styles.kicker, { color: palette.gilt }]}>BEST ENJOYED</Text>
                <Text style={styles.bestEnjoyedText}>{vibe.bestEnjoyed}.</Text>
              </View>
            ) : null}
            {vibe.moods.length > 0 ? (
              <Card>
                <Text style={[styles.cardTitle, { color: theme.text }]}>How it feels</Text>
                {vibe.moods.map((m) => (
                  <View key={m.slug} style={styles.moodRow}>
                    <Text style={[styles.moodName, { color: theme.text }]}>{m.name}</Text>
                    <View style={[styles.track, { backgroundColor: theme.border }]}>
                      <View
                        style={[styles.fill, { width: `${Math.max(8, m.strength * 100)}%`, backgroundColor: genreColor(m.slug).dot }]}
                      />
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}
            {vibe.pace !== null ? (
              <Card>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Pace</Text>
                <View style={[styles.paceTrack, { backgroundColor: theme.border }]}>
                  <View style={[styles.paceMarker, { left: `${vibe.pace * 50}%`, backgroundColor: theme.accent }]}>
                    <Text style={{ color: palette.paper, fontSize: 12 }}>✦</Text>
                  </View>
                </View>
                <View style={styles.paceLabels}>
                  {['A slow simmer', 'Steady', 'A page-turner'].map((label, i) => (
                    <Text
                      key={label}
                      style={{
                        flex: 1,
                        fontSize: 13,
                        textAlign: i === 0 ? 'left' : i === 1 ? 'center' : 'right',
                        color: i === vibe.pace ? theme.text : theme.textSecondary,
                        fontWeight: i === vibe.pace ? '700' : '400',
                      }}
                    >
                      {label}
                    </Text>
                  ))}
                </View>
              </Card>
            ) : null}
            {vibe.tropes.length > 0 ? (
              <Card>
                <Text style={[styles.cardTitle, { color: theme.text }]}>You’ll find</Text>
                <View style={styles.stickers}>
                  {vibe.tropes.map((t, i) => {
                    const s = stickerStyles[i % stickerStyles.length];
                    return (
                      <Text key={t.slug} style={[styles.sticker, { backgroundColor: s.bg, color: s.fg, transform: [{ rotate: s.rotate }] }]}>
                        {t.name}
                      </Text>
                    );
                  })}
                </View>
              </Card>
            ) : null}
          </>
        ) : null}

        {/* Chapter two: marginalia */}
        <ChapterHeading kicker="CHAPTER TWO" title="Marginalia" />
        <Text style={[styles.verdict, { color: theme.text }]}>{verdict.headline}.</Text>
        {verdict.total > 0 ? (
          <>
            <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
              {lovedPct}% of {plural(verdict.total, 'reader')} gave it four stars or more · average {formatRating(avg)}
            </Text>
            <View style={[styles.stacked, { backgroundColor: theme.border }]}>
              {verdict.segments.map((s, i) =>
                s.ratings > 0 ? (
                  <View key={s.stars} style={{ width: `${(s.ratings / verdict.total) * 100}%`, backgroundColor: segmentShades[i] }} />
                ) : null,
              )}
            </View>
            <View style={styles.legend}>
              {verdict.segments.map((s, i) => (
                <View key={s.stars} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: segmentShades[i] }]} />
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    {s.stars}★ {s.ratings}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
        {reviews.map((r, i) => (
          <IndexCard key={r.id} review={r} tilt={i % 2 ? '0.6deg' : '-0.6deg'} />
        ))}

        {/* Chapter three: the catalogue card */}
        <ChapterHeading kicker="CHAPTER THREE" title="The catalogue card" />
        <CatalogueCard
          rows={[
            ['AUTHOR', catalogueName(authorNames)],
            ['TITLE', work.title],
            ['FIRST PRINTED', work.first_published_year?.toString()],
            ['LANGUAGE', work.original_language ? languageNames.of(work.original_language) : null],
            ['PAGES', main?.page_count ? String(main.page_count) : null],
            ['ISBN', main?.isbn_13],
          ]}
          number={work.id.slice(-4).toUpperCase()}
          readers={work.shelved_count}
          editions={editions.map((e) =>
            [formatLabels[e.format], e.publisher, e.published_date?.slice(0, 4), e.page_count ? `${e.page_count} pp` : null]
              .filter(Boolean)
              .join(' · '),
          )}
        />
        {authors.map((a) => (
          <Card key={a.id} style={{ alignItems: 'center' }}>
            <View style={styles.cameo}>
              <Text style={styles.cameoInitial}>{a.name.charAt(0)}</Text>
            </View>
            <Text style={[styles.kicker, { color: theme.textSecondary }]}>ABOUT THE AUTHOR</Text>
            <Text style={[styles.authorName, { color: theme.text }]}>{a.name}</Text>
            {a.birth_date || a.death_date ? (
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                {a.birth_date?.slice(0, 4) ?? '?'}–{a.death_date?.slice(0, 4) ?? ''}
              </Text>
            ) : null}
            {a.bio ? <Text style={[styles.authorBio, { color: theme.textSecondary }]}>{a.bio}</Text> : null}
          </Card>
        ))}

        {/* Epilogue: shelved nearby */}
        {similar.length > 0 ? <ChapterHeading kicker="EPILOGUE" title="Shelved nearby" /> : null}
      </View>

      {similar.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfScroll}>
          <View>
            <View style={styles.shelfRow}>
              {similar.map((w) => (
                <Link key={w.id} href={{ pathname: '/book/[id]', params: { id: w.id } }} push asChild>
                  <Pressable>
                    <BookCover title={w.title} author="" src={w.cover_url} color={w.cover_color} width={104} />
                  </Pressable>
                </Link>
              ))}
            </View>
            <View style={styles.shelfBoard} />
            <View style={styles.shelfRow}>
              {similar.map((w) => (
                <View key={w.id} style={{ width: 104 }}>
                  <Text numberOfLines={2} style={[styles.shelfTitle, { color: theme.text }]}>
                    {w.title}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: 'center' }}>
                    ★ {formatRating(Number(w.avg_rating))}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : null}
    </ScrollView>
  );
}

function Ornament() {
  const theme = useTheme();
  return (
    <View style={styles.ornament}>
      <View style={[styles.rule, { backgroundColor: theme.highlight }]} />
      <Text style={{ color: theme.highlight }}>❦</Text>
      <View style={[styles.rule, { backgroundColor: theme.highlight }]} />
    </View>
  );
}

function ChapterHeading({ kicker, title }: { kicker: string; title: string }) {
  const theme = useTheme();
  return (
    <View style={styles.chapter}>
      <Text style={[styles.kicker, { color: theme.accent, letterSpacing: 3 }]}>{kicker}</Text>
      <Text style={[styles.chapterTitle, { color: theme.text }]}>{title}</Text>
      <Ornament />
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>{children}</View>;
}

function ShelfButton({ workId }: { workId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const [status, setStatus] = useState<keyof typeof READING_STATUS_LABELS | null>(null);
  const [failed, setFailed] = useState(false);

  // Show what's already on the reader's shelves once we know who they are.
  useEffect(() => {
    if (!supabase || !session) return;
    let cancelled = false;
    getMyReadingStatus(supabase, workId)
      .then((s) => !cancelled && setStatus(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workId, session]);

  const onPress = async () => {
    if (!supabase) return;
    if (!session) return router.push('/sign-in');
    setFailed(false);
    try {
      await setReadingStatus(supabase, workId, 'want_to_read');
      setStatus('want_to_read');
    } catch {
      setFailed(true);
    }
  };
  const shelved = session && status;
  return (
    <View style={styles.shelfButtonWrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.shelfButton,
          { backgroundColor: shelved ? theme.backgroundElement : theme.primary, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={{ color: shelved ? theme.text : theme.primaryText, fontWeight: '700', fontSize: 16 }}>
          {shelved ? `✓ ${READING_STATUS_LABELS[status]}` : 'Want to read'}
        </Text>
      </Pressable>
      {!session ? (
        <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 13 }}>Sign in to keep track of your books.</Text>
      ) : failed ? (
        <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>Something went wrong. Try again?</Text>
      ) : null}
    </View>
  );
}

function IndexCard({ review, tilt }: { review: BookData['reviews'][number]; tilt: string }) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const [revealed, setRevealed] = useState(!review.has_spoilers);
  const name = review.profiles?.display_name || review.profiles?.username || 'A reader';
  const ink = dark ? theme.text : palette.ink;
  const muted = dark ? theme.textSecondary : '#6F655A';
  return (
    <View style={[styles.indexCard, { backgroundColor: dark ? theme.backgroundSelected : '#FFFDF6', transform: [{ rotate: tilt }] }]}>
      <View style={styles.indexHeader}>
        <View style={[styles.reviewAvatar, { backgroundColor: review.profiles?.theme_color ?? palette.green }]}>
          <Text style={styles.reviewInitial}>{name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {review.profiles?.username ? (
            <Link href={{ pathname: '/u/[username]', params: { username: review.profiles.username } }} push style={[styles.reviewName, { color: ink }]}>
              {name}
            </Link>
          ) : (
            <Text style={[styles.reviewName, { color: ink }]}>{name}</Text>
          )}
          {review.profiles?.username ? <Text style={{ color: muted, fontSize: 12 }}>@{review.profiles.username}</Text> : null}
        </View>
        {review.rating ? <Stars rating={Number(review.rating)} size={12} /> : null}
      </View>
      {revealed ? (
        <Text style={[styles.reviewBody, { color: ink }]}>{review.body}</Text>
      ) : (
        <Pressable onPress={() => setRevealed(true)} style={[styles.spoiler, { borderColor: dark ? theme.border : '#DCD1BE' }]}>
          <Text style={{ color: ink, fontWeight: '600' }}>Contains spoilers · Show anyway</Text>
        </Pressable>
      )}
    </View>
  );
}

function CatalogueCard({
  rows,
  number,
  readers,
  editions,
}: {
  rows: [string, string | null | undefined][];
  number: string;
  readers: number;
  editions: string[];
}) {
  const dark = useColorScheme() === 'dark';
  const ink = dark ? palette.paper : palette.ink;
  const stamp = dark ? '#E6957C' : palette.oxblood;
  return (
    <View style={[styles.libraryCard, { backgroundColor: dark ? '#3A3124' : '#F6EBD3', borderColor: dark ? '#5A4C35' : '#D8C7A3' }]}>
      <View style={[styles.libraryHeader, { borderBottomColor: stamp }]}>
        <Text style={[styles.libraryLabel, { color: ink }]}>BOOKSYDE CARD CATALOGUE</Text>
        <Text style={[styles.mono, { color: ink, opacity: 0.7, fontSize: 11 }]}>No. {number}</Text>
      </View>
      {rows
        .filter(([, v]) => v)
        .map(([label, value]) => (
          <View key={label} style={styles.libraryRow}>
            <Text style={[styles.mono, { color: ink, opacity: 0.7, fontSize: 10, letterSpacing: 1.2 }]}>{label}</Text>
            <View style={[styles.leader, { borderBottomColor: ink }]} />
            <Text style={[styles.mono, { color: ink, fontSize: 13, flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
          </View>
        ))}
      <View style={[styles.stamp, { borderColor: stamp }]}>
        <Text style={[styles.mono, styles.stampText, { color: stamp }]}>ON THE SHELVES OF</Text>
        <Text style={[styles.mono, styles.stampText, { color: stamp }]}>{plural(readers, 'reader').toUpperCase()}</Text>
      </View>
      {editions.length > 0 ? (
        <View style={{ gap: spacing[2] }}>
          <Text style={[styles.libraryLabel, { color: ink }]}>EDITIONS</Text>
          {editions.map((e) => (
            <Text key={e} style={[styles.mono, { color: ink, fontSize: 11 }]}>
              {e}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], padding: spacing[6] },
  emptyTitle: { fontFamily: DisplayFonts.regular, fontSize: 30, textAlign: 'center' },
  scroll: { paddingBottom: BottomTabInset + spacing[8] },
  titlePage: {
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[7],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2.4, textAlign: 'center' },
  title: { fontFamily: DisplayFonts.regular, fontSize: 52, lineHeight: 54, textAlign: 'center' },
  subtitle: { fontFamily: DisplayFonts.italic, fontSize: 22, textAlign: 'center', marginTop: -spacing[2] },
  byline: { fontFamily: DisplayFonts.italic, fontSize: 26 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  avg: { fontFamily: DisplayFonts.regular, fontSize: 22 },
  shelfButtonWrap: { alignSelf: 'stretch', maxWidth: 320, width: '100%', marginHorizontal: 'auto', gap: spacing[2], marginTop: spacing[3] },
  shelfButton: { alignItems: 'center', borderRadius: radii.pill, paddingVertical: spacing[3] + 2, borderWidth: StyleSheet.hairlineWidth },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginVertical: spacing[1] },
  rule: { height: 1, width: 36, opacity: 0.6 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: spacing[4], paddingTop: spacing[6], gap: spacing[5] },
  body: { fontSize: 18, lineHeight: 29 },
  dropCap: { fontFamily: DisplayFonts.regular, fontSize: 46, lineHeight: 29 },
  chapter: { alignItems: 'center', gap: spacing[2], marginTop: spacing[7] },
  chapterTitle: { fontFamily: DisplayFonts.regular, fontSize: 42, lineHeight: 46, textAlign: 'center' },
  bestEnjoyed: { backgroundColor: palette.green, borderRadius: radii.xl, paddingVertical: spacing[6], paddingHorizontal: spacing[5], gap: spacing[2] },
  bestEnjoyedBorder: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(184,137,58,0.4)',
  },
  bestEnjoyedText: { color: palette.paper, fontFamily: DisplayFonts.italic, fontSize: 30, lineHeight: 36, textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[5], gap: spacing[3] },
  cardTitle: { fontFamily: DisplayFonts.regular, fontSize: 28 },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  moodName: { width: 96, fontWeight: '600' },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  paceTrack: { height: 8, borderRadius: 4, marginHorizontal: spacing[4], marginVertical: spacing[3] },
  paceMarker: { position: 'absolute', top: -12, width: 32, height: 32, marginLeft: -16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  paceLabels: { flexDirection: 'row' },
  stickers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  sticker: { overflow: 'hidden', borderRadius: radii.pill, paddingHorizontal: spacing[4], paddingVertical: spacing[2], fontWeight: '700' },
  verdict: { fontFamily: DisplayFonts.italic, fontSize: 34, lineHeight: 38, textAlign: 'center' },
  stacked: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[3] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  indexCard: {
    borderRadius: 3,
    padding: spacing[5],
    gap: spacing[3],
    shadowColor: '#1F1B16',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  indexHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingBottom: spacing[3], borderBottomWidth: 2, borderBottomColor: 'rgba(139,58,43,0.45)' },
  reviewAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  reviewInitial: { color: palette.paper, fontFamily: DisplayFonts.regular, fontSize: 18 },
  reviewName: { fontFamily: DisplayFonts.regular, fontSize: 20 },
  reviewBody: { fontSize: 15, lineHeight: 26 },
  spoiler: { alignItems: 'center', borderWidth: 1, borderRadius: radii.md, paddingVertical: spacing[4] },
  libraryCard: { borderWidth: 1, borderRadius: 6, padding: spacing[5], gap: spacing[3] },
  libraryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: spacing[3], borderBottomWidth: 2 },
  libraryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2.4 },
  libraryRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  leader: { flex: 1, minWidth: 12, borderBottomWidth: 1, borderStyle: 'dotted', opacity: 0.35, marginBottom: 4 },
  mono: { fontFamily: Fonts?.mono },
  stamp: { alignSelf: 'center', borderWidth: 3, borderRadius: 6, paddingHorizontal: spacing[3], paddingVertical: spacing[2], transform: [{ rotate: '-8deg' }], marginVertical: spacing[2], opacity: 0.85 },
  stampText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textAlign: 'center' },
  cameo: {
    width: 88,
    height: 112,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: palette.gilt,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameoInitial: { color: palette.paper, fontFamily: DisplayFonts.regular, fontSize: 44 },
  authorName: { fontFamily: DisplayFonts.regular, fontSize: 30 },
  authorBio: { lineHeight: 22, textAlign: 'center' },
  shelfScroll: { paddingHorizontal: spacing[4], paddingTop: spacing[5] },
  shelfRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[4], paddingHorizontal: spacing[3] },
  shelfBoard: {
    height: 12,
    borderRadius: 2,
    backgroundColor: '#8A6A4A',
    shadowColor: '#1F1B16',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    marginBottom: spacing[3],
  },
  shelfTitle: { fontFamily: DisplayFonts.regular, fontSize: 16, lineHeight: 18, textAlign: 'center' },
});
