import {
  addClubRead,
  type CatalogBook,
  type ClubDetail,
  type ClubMember,
  type ClubPost,
  type ClubRead,
  type ClubRole,
  createClubPost,
  deleteClubPost,
  finishReading,
  formatRating,
  getClubBySlug,
  getClubPosts,
  getMembersProgress,
  joinClub,
  leaveClub,
  type ReaderProgress,
  removeClubRead,
  searchCatalog,
  setReadingPage,
} from '@booksyde/shared';
import type { ReadingStatus } from '@booksyde/types';
import { mixHex, palette, radii, spacing } from '@booksyde/theme';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BookCover } from '@/components/book-cover';
import { confirm, EmptyNote, Loading, notify, Ornament, Pill, SectionHeading } from '@/components/page-chrome';
import { DEFAULT_INK } from '@/constants/inks';
import { DisplayFonts, MaxContentWidth, DisplayMaxScale } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/*
 * A club: its name and colour, the book it's reading now, where each reader
 * is with it, and its discussion, with spoilers past your page hidden.
 * Mirrors apps/web/src/app/clubs/[slug].
 */

const POSTS_PER_PAGE = 20;
/** Members listed before the rest fold away under "Show all". */
const MEMBERS_SHOWN = 8;

const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const postDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function dateRange(read: ClubRead) {
  const fmt = (d: string) => dateFormat.format(new Date(d));
  if (read.startsOn && read.endsOn) return `${fmt(read.startsOn)} – ${fmt(read.endsOn)}`;
  if (read.startsOn) return `From ${fmt(read.startsOn)}`;
  if (read.endsOn) return `Finish by ${fmt(read.endsOn)}`;
  return null;
}

type Data = { club: ClubDetail; progress: Map<string, ReaderProgress>; posts: ClubPost[] };

async function loadClub(slug: string, viewerId: string | null): Promise<Data | null> {
  const client = supabase!;
  const club = await getClubBySlug(client, slug);
  if (!club) return null;
  const isMember = club.members.some((m) => m.userId === viewerId);
  const current = club.reads.current;
  const [progress, posts] = await Promise.all([
    current
      ? getMembersProgress(
          client,
          current.work.id,
          club.members.map((m) => m.userId),
        ).catch(() => new Map<string, ReaderProgress>())
      : new Map<string, ReaderProgress>(),
    // Only members can read the discussion (RLS agrees).
    isMember ? getClubPosts(client, club.id, { limit: POSTS_PER_PAGE }).catch(() => []) : [],
  ]);
  return { club, progress, posts };
}

export default function ClubScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const viewerId = session?.user.id ?? null;
  const { data, error, loading, reload } = useAsync(
    supabase && !sessionLoading ? () => loadClub(String(slug), viewerId) : null,
    [String(slug), viewerId, sessionLoading],
  );

  if (!supabase || error || data === null) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.sideTitle, { color: theme.text, textAlign: 'center' }]}>
          {data === null ? 'No club by that name.' : 'Something went wrong.'}
        </Text>
        <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
          {data === null ? 'It may be private, or it may have closed.' : 'Couldn’t load this club. Try again in a moment.'}
        </Text>
      </View>
    );
  }
  if (!data || (loading && !data)) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Loading />
      </View>
    );
  }
  return <ClubView data={data} viewerId={viewerId} onChange={reload} />;
}

function ClubView({ data, viewerId, onChange }: { data: Data; viewerId: string | null; onChange: () => void }) {
  const theme = useTheme();
  const { club, progress, posts } = data;
  const role = club.members.find((m) => m.userId === viewerId)?.role ?? null;
  const isAdmin = role === 'owner' || role === 'moderator';
  const isMember = role !== null;
  const owner = club.members.find((m) => m.role === 'owner');
  const ink = club.cover_color ?? DEFAULT_INK;
  const { current, upcoming, past } = club.reads;
  const mine = viewerId ? progress.get(viewerId) : undefined;
  const titles = new Map([current, upcoming, ...past].flatMap((r) => (r ? [[r.id, r.work.title] as const] : [])));
  const [showAll, setShowAll] = useState(false);
  const members = showAll ? club.members : club.members.slice(0, MEMBERS_SHOWN);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.background }} keyboardVerticalOffset={96}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing[8] }}>
        {/* The club's own colour, washed into the page behind its name */}
        <View style={[styles.hero, { backgroundColor: mixHex(theme.background, ink, 0.14), borderBottomColor: theme.border }]}>
          <View style={styles.heroInner}>
            <Text style={[styles.kicker, { color: mixHex(ink, theme.text, 0.3) }]}>
              {club.is_private ? '🔒 PRIVATE CLUB' : 'BOOK CLUB'}
            </Text>
            <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.clubName, { color: theme.text }]}>{club.name}</Text>
            <Ornament center />
            {club.description ? <Text style={[styles.description, { color: theme.textSecondary }]}>{club.description}</Text> : null}
            <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center' }}>
              {club.members.length} {club.members.length === 1 ? 'reader' : 'readers'}
              {owner ? (
                <>
                  {' · started by '}
                  <Link href={{ pathname: '/u/[username]', params: { username: owner.username } }} style={{ color: theme.text, fontWeight: '700' }}>
                    @{owner.username}
                  </Link>
                </>
              ) : null}
              {` · since ${monthYear.format(new Date(club.created_at))}`}
            </Text>
            <MembershipButton clubId={club.id} role={role} signedIn={viewerId !== null} onChange={onChange} />
            {role === 'owner' ? <Text style={{ color: theme.textSecondary, fontStyle: 'italic' }}>You started this club.</Text> : null}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <SectionHeading numeral="I">Reading now</SectionHeading>
            {current ? (
              <>
                <CurrentRead read={current} members={club.members} progress={progress} isAdmin={isAdmin} onChange={onChange} />
                {isMember ? (
                  <ProgressForm workId={current.work.id} page={mine?.page ?? null} status={mine?.status ?? null} onChange={onChange} />
                ) : null}
                {isAdmin ? <ReadPicker clubId={club.id} label="Pick another book" onChange={onChange} /> : null}
              </>
            ) : (
              <EmptyNote>
                <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                  {upcoming
                    ? 'Nothing on the go right now. The next book is lined up under Up next.'
                    : isAdmin
                      ? 'Your club hasn’t picked a book yet. Choose the first one.'
                      : 'This club hasn’t picked a book yet.'}
                </Text>
                {isAdmin ? <ReadPicker clubId={club.id} label="Choose a book" onChange={onChange} /> : null}
              </EmptyNote>
            )}
          </View>

          {upcoming ? (
            <View style={styles.side}>
              <SideHeading>Up next</SideHeading>
              <ReadRow read={upcoming} isAdmin={isAdmin} onChange={onChange} />
            </View>
          ) : null}

          <View style={styles.side}>
            <SideHeading aside={`${club.members.length}`}>The readers</SideHeading>
            {members.map((m) => (
              <MemberRow key={m.userId} member={m} progress={current ? (progress.get(m.userId) ?? null) : undefined} />
            ))}
            {club.members.length > MEMBERS_SHOWN ? (
              <Pressable onPress={() => setShowAll((s) => !s)} hitSlop={8}>
                <Text style={{ color: theme.accent, fontWeight: '700' }}>
                  {showAll ? 'Show fewer' : `Show all ${club.members.length} readers`}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {past.length ? (
            <View style={styles.side}>
              <SideHeading>Read together</SideHeading>
              {past.map((read) => (
                <ReadRow key={read.id} read={read} isAdmin={isAdmin} onChange={onChange} />
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeading numeral="II">The talk</SectionHeading>
            {isMember ? (
              <Talk
                clubId={club.id}
                firstPage={posts}
                titles={titles}
                read={current ? { id: current.id, title: current.work.title } : null}
                viewerId={viewerId}
                isAdmin={isAdmin}
                myPage={mine?.page ?? null}
                finished={mine?.status === 'read' && mine.page === null}
                onChange={onChange}
              />
            ) : (
              <EmptyNote>
                <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                  {viewerId ? 'Join the club to read the discussion and add your own thoughts.' : 'Sign in and join the club to read the discussion.'}
                </Text>
              </EmptyNote>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A quieter heading for the smaller sections. */
function SideHeading({ children, aside }: { children: string; aside?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.sideHeading, { borderBottomColor: theme.border }]}>
      <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.sideTitle, { color: theme.text }]}>{children}</Text>
      {aside ? <Text style={{ color: theme.textSecondary }}>{aside}</Text> : null}
    </View>
  );
}

/** Join / Member ✓ (tap to leave). Owners can't leave the club they started. */
function MembershipButton({
  clubId,
  role,
  signedIn,
  onChange,
}: {
  clubId: string;
  role: ClubRole | null;
  signedIn: boolean;
  onChange: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const theme = useTheme();
  if (!signedIn) return <Pill label="Sign in to join" onPress={() => router.push('/sign-in')} style={{ alignSelf: 'center' }} />;
  if (role === 'owner') return null;
  const member = role !== null;

  async function toggle() {
    if (member && !(await confirm('Leave this club?', 'Leave'))) return;
    setFailed(false);
    setBusy(true);
    try {
      if (member) await leaveClub(supabase!, clubId);
      else await joinClub(supabase!, clubId);
      onChange();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ alignItems: 'center', gap: spacing[1] }}>
      <Pill label={member ? 'Member ✓ · Leave' : 'Join the club'} kind={member ? 'outline' : 'primary'} busy={busy} onPress={toggle} />
      {failed ? <Text style={{ color: theme.accent }}>That didn’t work. Try again?</Text> : null}
    </View>
  );
}

function CurrentRead({
  read,
  members,
  progress,
  isAdmin,
  onChange,
}: {
  read: ClubRead;
  members: ClubMember[];
  progress: Map<string, ReaderProgress>;
  isAdmin: boolean;
  onChange: () => void;
}) {
  const theme = useTheme();
  const reading = members.filter((m) => progress.get(m.userId)?.status === 'reading').length;
  const finished = members.filter((m) => progress.get(m.userId)?.status === 'read').length;
  const range = dateRange(read);
  return (
    <View style={styles.currentRead}>
      <Link href={{ pathname: '/book/[id]', params: { id: read.work.id } }} asChild>
        <Pressable>
          <BookCover title={read.work.title} author={read.work.author} src={read.work.cover_url} color={read.work.cover_color} width={120} />
        </Pressable>
      </Link>
      <View style={{ flex: 1, gap: spacing[2] }}>
        <Link href={{ pathname: '/book/[id]', params: { id: read.work.id } }} style={[styles.readTitle, { color: theme.text }]}>
          {read.work.title}
        </Link>
        {read.work.author ? <Text style={{ color: theme.textSecondary, fontSize: 16 }}>{read.work.author}</Text> : null}
        {read.work.avg_rating > 0 ? (
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>★ {formatRating(read.work.avg_rating)} on Booksyde</Text>
        ) : null}
        {range ? <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>{range}</Text> : null}
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          {reading} reading · {finished} finished · {members.length} in the club
        </Text>
        {isAdmin ? <RemoveReadButton readId={read.id} title={read.work.title} onChange={onChange} /> : null}
      </View>
    </View>
  );
}

function ReadRow({ read, isAdmin, onChange }: { read: ClubRead; isAdmin: boolean; onChange: () => void }) {
  const theme = useTheme();
  const range = dateRange(read);
  return (
    <View style={[styles.rowCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Link href={{ pathname: '/book/[id]', params: { id: read.work.id } }} asChild>
        <Pressable style={styles.rowLink}>
          <BookCover title={read.work.title} author={read.work.author} src={read.work.cover_url} color={read.work.cover_color} width={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text }]}>
              {read.work.title}
            </Text>
            <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 13 }}>
              {[read.work.author, range].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Pressable>
      </Link>
      {isAdmin ? <RemoveReadButton readId={read.id} title={read.work.title} onChange={onChange} /> : null}
    </View>
  );
}

function RemoveReadButton({ readId, title, onChange }: { readId: string; title: string; onChange: () => void }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!(await confirm(`Take “${title}” off the club’s list?`, 'Remove'))) return;
    setBusy(true);
    try {
      await removeClubRead(supabase!, readId);
      onChange();
    } catch {
      notify('We couldn’t remove that book. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Pressable onPress={remove} disabled={busy} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
      <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 14 }}>{busy ? 'Removing…' : 'Remove'}</Text>
    </Pressable>
  );
}

const statusLabels: Record<ReadingStatus, string> = {
  reading: 'Reading',
  read: 'Finished',
  want_to_read: 'On their list',
  did_not_finish: 'Set it aside',
};

/** Where a member is with the current book, as a short badge. */
function progressLabel(p: ReaderProgress | null) {
  if (!p?.status && p?.page == null) return 'Not started';
  // A page from an open session wins: they're partway through (perhaps a reread).
  if (p.page != null && p.status !== 'did_not_finish') return `Page ${p.page}`;
  return p.status ? statusLabels[p.status] : 'Not started';
}

/** `progress` is undefined when the club has no current book, null when we can't see theirs. */
function MemberRow({ member, progress }: { member: ClubMember; progress: ReaderProgress | null | undefined }) {
  const theme = useTheme();
  const status = progress?.status ?? null;
  const name = member.display_name || member.username;
  const done = status === 'read' && progress?.page == null;
  const going = status === 'reading' || progress?.page != null;
  return (
    <Link href={{ pathname: '/u/[username]', params: { username: member.username } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.rowCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }])}>
        <Avatar name={name} src={member.avatar_url} ink={member.theme_color ?? DEFAULT_INK} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
            {name}
          </Text>
          <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 13 }}>
            @{member.username}
            {member.role !== 'member' ? ` · ${member.role}` : ''}
          </Text>
        </View>
        {progress !== undefined ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: done ? 'rgba(74,124,89,0.15)' : going ? `${palette.gilt}33` : `${theme.border}88`,
              },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: done ? '#4A7C59' : going ? theme.text : theme.textSecondary }}>
              {progressLabel(progress)}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

/**
 * "Where are you?": the member's page in the club's book. It decides which
 * spoiler-tagged posts they can read, so saving reloads the discussion.
 */
function ProgressForm({
  workId,
  page,
  status,
  onChange,
}: {
  workId: string;
  page: number | null;
  status: ReadingStatus | null;
  onChange: () => void;
}) {
  const theme = useTheme();
  const finished = status === 'read' && page === null;
  const [editing, setEditing] = useState(!finished);
  const [value, setValue] = useState(page?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Follow the server after a save: show the finished note, or the new page.
  const [syncedFrom, setSyncedFrom] = useState({ page, finished });
  if (syncedFrom.page !== page || syncedFrom.finished !== finished) {
    setSyncedFrom({ page, finished });
    setEditing(!finished);
    setValue(page?.toString() ?? '');
  }

  async function run(work: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await work();
      onChange();
    } catch {
      setError('That didn’t save. Try again?');
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const n = Number(value);
    if (value.trim() === '' || !Number.isInteger(n) || n < 0) {
      setError('Enter the page you’re on, like 142.');
      return;
    }
    run(() => setReadingPage(supabase!, workId, n));
  }

  if (finished && !editing) {
    return (
      <View style={[styles.progress, { backgroundColor: 'rgba(74,124,89,0.12)', borderColor: 'transparent' }]}>
        <Text style={{ color: theme.text, fontSize: 15 }}>
          <Text style={{ fontWeight: '700' }}>You’ve finished it.</Text> Every post is open to you.
        </Text>
        <Pressable onPress={() => setEditing(true)} hitSlop={8}>
          <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Reading it again?</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.progress, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Text style={{ color: theme.text, fontSize: 15, lineHeight: 21 }}>
        <Text style={{ fontWeight: '700' }}>Where are you?</Text>{' '}
        <Text style={{ color: theme.textSecondary }}>We hide posts about pages you haven’t reached.</Text>
      </Text>
      <View style={styles.progressRow}>
        <Text style={{ color: theme.textSecondary }}>Page</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={`${theme.textSecondary}88`}
          accessibilityLabel="The page you’re on"
          onSubmitEditing={save}
          returnKeyType="done"
          style={[styles.pageInput, { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}
        />
        <Pill label={busy ? 'Saving…' : 'Save'} small busy={busy} onPress={save} />
        <Pill label="I’ve finished" kind="quiet" small disabled={busy} onPress={() => run(() => finishReading(supabase!, workId))} />
      </View>
      {error ? <Text style={{ color: theme.accent, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

function firstAuthor(book: CatalogBook) {
  return (
    [...book.work_contributors].filter((c) => c.role === 'author').sort((a, b) => a.position - b.position)[0]?.authors?.name ?? ''
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * For club owners and moderators: search the catalogue, pick a book and
 * (optionally) the dates the club will read it between.
 */
function ReadPicker({ clubId, label, onChange }: { clubId: string; label: string; onChange: () => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogBook[] | null>(null);
  const [chosen, setChosen] = useState<CatalogBook | null>(null);
  const [startsOn, setStartsOn] = useState(todayIso);
  const [endsOn, setEndsOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchCatalog(supabase!, { q, limit: 8 })
        .then((books) => !cancelled && setResults(books))
        .catch(() => !cancelled && setResults([]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function reset() {
    setOpen(false);
    setQuery('');
    setResults(null);
    setChosen(null);
    setStartsOn(todayIso());
    setEndsOn('');
    setError(null);
  }

  async function save() {
    if (!chosen) return;
    const start = startsOn.trim();
    const end = endsOn.trim();
    if ((start && !ISO_DATE.test(start)) || (end && !ISO_DATE.test(end))) {
      setError('Write dates as year-month-day, like 2026-12-01.');
      return;
    }
    if (start && end && end < start) {
      setError('The finish date comes before the start.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await addClubRead(supabase!, { clubId, workId: chosen.id, startsOn: start || null, endsOn: end || null });
      reset();
      onChange();
    } catch {
      setError('We couldn’t add that book. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <Pill label={label} kind="outline" small onPress={() => setOpen(true)} style={{ alignSelf: 'center' }} />;

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border }];
  return (
    <View style={[styles.picker, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {chosen ? (
        <View style={{ gap: spacing[4] }}>
          <View style={styles.rowLink}>
            <BookCover title={chosen.title} author={firstAuthor(chosen)} src={chosen.cover_url} color={chosen.cover_color} width={52} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>{chosen.title}</Text>
              <Text style={{ color: theme.textSecondary }}>{firstAuthor(chosen)}</Text>
            </View>
          </View>
          <DateField label="START READING" value={startsOn} onChange={setStartsOn} />
          <DateField label="FINISH BY (OPTIONAL)" value={endsOn} onChange={setEndsOn} />
          {error ? <Text style={{ color: theme.accent, fontSize: 13 }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <Pill label={busy ? 'Adding…' : 'Add to the club'} small busy={busy} onPress={save} />
            <Pill label="Choose another" kind="quiet" small onPress={() => setChosen(null)} />
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing[3] }}>
          <View style={styles.pickerHead}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>FIND A BOOK</Text>
            <Pressable onPress={reset} hitSlop={8}>
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>
          <TextInput
            autoFocus
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              if (t.trim().length < 2) setResults(null);
            }}
            placeholder="Title, author or ISBN"
            placeholderTextColor={`${theme.textSecondary}88`}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={inputStyle}
          />
          {results === null ? null : results.length === 0 ? (
            <Text style={{ color: theme.textSecondary }}>Nothing in the catalogue matches that yet.</Text>
          ) : (
            results.map((book) => (
              <Pressable key={book.id} onPress={() => setChosen(book)} style={styles.rowLink}>
                <BookCover title={book.title} author={firstAuthor(book)} src={book.cover_url} color={book.cover_color} width={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: theme.text, fontWeight: '700' }}>
                    {book.title}
                  </Text>
                  <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {[firstAuthor(book), book.first_published_year].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={`${theme.textSecondary}88`}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        accessibilityLabel={label.toLowerCase()}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}
      />
    </View>
  );
}

/** The composer and the posts, newest first, with older pages loaded on request. */
function Talk({
  clubId,
  firstPage,
  titles,
  read,
  viewerId,
  isAdmin,
  myPage,
  finished,
  onChange,
}: {
  clubId: string;
  firstPage: ClubPost[];
  titles: Map<string, string>;
  read: { id: string; title: string } | null;
  viewerId: string | null;
  isAdmin: boolean;
  myPage: number | null;
  finished: boolean;
  onChange: () => void;
}) {
  const theme = useTheme();
  // Older pages, appended below the first; dropped whenever the first page reloads.
  const [older, setOlder] = useState<{ from: ClubPost[]; posts: ClubPost[]; more: boolean }>({ from: firstPage, posts: [], more: true });
  const extra = older.from === firstPage ? older : { from: firstPage, posts: [], more: true };
  const posts = [...firstPage, ...extra.posts];
  const [loadingMore, setLoadingMore] = useState(false);
  const canLoadMore = firstPage.length === POSTS_PER_PAGE && extra.more;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await getClubPosts(supabase!, clubId, { limit: POSTS_PER_PAGE, before: posts[posts.length - 1].createdAt });
      setOlder({ from: firstPage, posts: [...extra.posts, ...next], more: next.length === POSTS_PER_PAGE });
    } catch {
      notify('Couldn’t load older posts. Try again in a moment.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <PostComposer clubId={clubId} read={read} myPage={myPage} finished={finished} onPosted={onChange} />
      {posts.length === 0 ? (
        <Text style={{ color: theme.textSecondary, textAlign: 'center', paddingVertical: spacing[3] }}>No posts yet. Start the conversation.</Text>
      ) : (
        <View>
          {posts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              title={post.clubReadId ? titles.get(post.clubReadId) : undefined}
              canDelete={post.userId === viewerId || isAdmin}
              myPage={myPage}
              onChange={onChange}
            />
          ))}
        </View>
      )}
      {canLoadMore ? <Pill label={loadingMore ? 'Loading…' : 'Older posts'} kind="outline" small busy={loadingMore} onPress={loadMore} style={{ alignSelf: 'center' }} /> : null}
    </View>
  );
}

/**
 * Write to the club. A post about the current book is tagged with a spoiler
 * page (your own page by default), so readers behind you can't read it yet.
 */
function PostComposer({
  clubId,
  read,
  myPage,
  finished,
  onPosted,
}: {
  clubId: string;
  read: { id: string; title: string } | null;
  myPage: number | null;
  finished: boolean;
  onPosted: () => void;
}) {
  const theme = useTheme();
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(read !== null && (finished || (myPage ?? 0) > 0));
  const [page, setPage] = useState(myPage ? String(myPage) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // When you log a new page (or finish), move the default spoiler page along with you.
  const [syncedFrom, setSyncedFrom] = useState({ myPage, finished });
  if (syncedFrom.myPage !== myPage || syncedFrom.finished !== finished) {
    setSyncedFrom({ myPage, finished });
    setPage(myPage ? String(myPage) : '');
    if (read && (finished || (myPage ?? 0) > 0)) setSpoiler(true);
  }

  async function submit() {
    const text = body.trim();
    if (!text) {
      setError('Write something first.');
      return;
    }
    const spoilerPage = read && spoiler ? Number(page) : null;
    if (spoilerPage !== null && (!Number.isInteger(spoilerPage) || spoilerPage < 1)) {
      setError('Which page does your post give away? Or switch off spoilers.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await createClubPost(supabase!, { clubId, clubReadId: read?.id ?? null, body: text, spoilerPage });
      setBody('');
      onPosted();
    } catch {
      setError('We couldn’t post that. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.picker, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={10000}
        placeholder={read ? `What do you make of ${read.title} so far?` : 'Say hello to the club…'}
        placeholderTextColor={`${theme.textSecondary}88`}
        accessibilityLabel="Write to the club"
        style={[styles.input, styles.composer, { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}
      />
      <View style={styles.composerRow}>
        {read ? (
          <View style={styles.spoilerRow}>
            <Switch value={spoiler} onValueChange={setSpoiler} trackColor={{ true: theme.primary }} accessibilityLabel="Spoilers" />
            <Text style={{ color: theme.text, fontSize: 14 }}>Spoilers up to p.</Text>
            <TextInput
              value={page}
              onChangeText={setPage}
              editable={spoiler}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={`${theme.textSecondary}88`}
              accessibilityLabel="Spoiler page"
              style={[styles.spoilerInput, { color: theme.text, borderColor: theme.border, opacity: spoiler ? 1 : 0.5 }]}
            />
          </View>
        ) : null}
        <Pill label={busy ? 'Posting…' : 'Post'} small busy={busy} onPress={submit} style={{ marginLeft: 'auto' }} />
      </View>
      {read && spoiler && page ? (
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
          Readers who haven’t reached page {page} won’t see what you wrote until they do.
        </Text>
      ) : null}
      {error ? <Text style={{ color: theme.accent, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

function PostItem({
  post,
  title,
  canDelete,
  myPage,
  onChange,
}: {
  post: ClubPost;
  title: string | undefined;
  canDelete: boolean;
  myPage: number | null;
  onChange: () => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const name = post.displayName || post.username;
  const about = [title, post.spoilerPage ? `up to p. ${post.spoilerPage}` : null].filter(Boolean).join(' · ');

  async function remove() {
    if (!(await confirm('Delete this post?', 'Delete'))) return;
    setBusy(true);
    try {
      await deleteClubPost(supabase!, post.id);
      onChange();
    } catch {
      notify('We couldn’t delete that post. Please try again.');
      setBusy(false);
    }
  }

  return (
    <View style={[styles.post, { borderBottomColor: theme.border }]}>
      <Link href={{ pathname: '/u/[username]', params: { username: post.username } }} asChild>
        <Pressable accessibilityLabel={name}>
          <Avatar name={name} src={post.avatarUrl} ink={post.themeColor ?? DEFAULT_INK} size={36} />
        </Pressable>
      </Link>
      <View style={{ flex: 1, minWidth: 0, gap: spacing[1] }}>
        <View style={styles.postMeta}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>{name}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{postDate.format(new Date(post.createdAt))}</Text>
          {about ? <Text style={{ color: theme.textSecondary, fontSize: 12, flexShrink: 1 }}>· {about}</Text> : null}
          {canDelete ? (
            <Pressable onPress={remove} disabled={busy} hitSlop={8} style={{ marginLeft: 'auto' }}>
              <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>{busy ? 'Deleting…' : 'Delete'}</Text>
            </Pressable>
          ) : null}
        </View>
        {post.isHidden ? (
          <View style={[styles.hidden, { borderColor: theme.border }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
              🔒{' '}
              {post.workId
                ? `Spoilers up to page ${post.spoilerPage}. ${myPage ? `You’re on page ${myPage}. ` : ''}Update your page above to read it.`
                : 'Spoilers about a book the club has since taken off its list.'}
            </Text>
          </View>
        ) : (
          <Text style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>{post.body}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3] },
  hero: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing[4], paddingTop: spacing[5], paddingBottom: spacing[7] },
  heroInner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', alignItems: 'center', gap: spacing[3] },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  clubName: { fontFamily: DisplayFonts.regular, fontSize: 48, lineHeight: 56, textAlign: 'center' },
  description: { fontSize: 17, lineHeight: 25, textAlign: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: spacing[4], paddingTop: spacing[7], gap: spacing[7] },
  section: { gap: spacing[5] },
  side: { gap: spacing[3] },
  sideHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing[2] },
  sideTitle: { fontFamily: DisplayFonts.regular, fontSize: 28, lineHeight: 32 },
  noteText: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
  currentRead: { flexDirection: 'row', gap: spacing[4], alignItems: 'flex-start' },
  readTitle: { fontFamily: DisplayFonts.regular, fontSize: 30, lineHeight: 32 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  rowLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rowTitle: { fontFamily: DisplayFonts.regular, fontSize: 21, lineHeight: 24 },
  badge: { borderRadius: radii.pill, paddingHorizontal: spacing[3], paddingVertical: 4 },
  progress: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.lg, padding: spacing[4], gap: spacing[3] },
  progressRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2] },
  pageInput: { width: 76, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 16 },
  picker: { alignSelf: 'stretch', borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.lg, padding: spacing[4], gap: spacing[3] },
  pickerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  input: { borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: 16 },
  composer: { minHeight: 88, textAlignVertical: 'top' },
  composerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2] },
  spoilerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  spoilerInput: { width: 60, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing[2], paddingVertical: 6, fontSize: 15 },
  post: { flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[4], borderBottomWidth: StyleSheet.hairlineWidth },
  postMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing[2] },
  hidden: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radii.md, padding: spacing[3], marginTop: spacing[1] },
});
