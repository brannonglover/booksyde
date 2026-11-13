import type { Enums, ReadingStatus } from "@booksyde/types";
import type { BooksydeClient } from "../client";
import {
  type ClubInput,
  clubInputSchema,
  type ClubPostInput,
  clubPostInputSchema,
  type ClubReadInput,
  clubReadInputSchema,
  clubSlug,
  readingPageSchema,
} from "../schemas/club";

export type ClubRole = Enums<"club_role">;

async function requireUserId(client: BooksydeClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("You need to be signed in.");
  return data.user.id;
}

const READ_FIELDS = `id, starts_on, ends_on, created_at,
  works ( id, title, cover_url, cover_color, avg_rating, work_contributors ( role, position, authors ( name ) ) )`;

const CARD_FIELDS = `id, name, slug, description, cover_color, is_private, created_at,
  club_members ( count ),
  club_reads ( ${READ_FIELDS} )`;

type RawRead = {
  id: string;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
  works: {
    id: string;
    title: string;
    cover_url: string | null;
    cover_color: string | null;
    avg_rating: number | string | null;
    work_contributors: {
      role: string;
      position: number;
      authors: { name: string } | null;
    }[];
  } | null;
};

export type ClubRead = {
  id: string;
  startsOn: string | null;
  endsOn: string | null;
  createdAt: string;
  work: {
    id: string;
    title: string;
    author: string;
    cover_url: string | null;
    cover_color: string | null;
    avg_rating: number;
  };
};

function toRead(raw: RawRead): ClubRead | null {
  if (!raw.works) return null;
  const { work_contributors, avg_rating, ...work } = raw.works;
  const author =
    [...work_contributors].filter((c) => c.role === "author").sort((a, b) => a.position - b.position)[0]?.authors
      ?.name ?? "";
  return {
    id: raw.id,
    startsOn: raw.starts_on,
    endsOn: raw.ends_on,
    createdAt: raw.created_at,
    work: { ...work, author, avg_rating: Number(avg_rating ?? 0) },
  };
}

/** Today as YYYY-MM-DD, to compare against club_reads' plain dates. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Split a club's reads into the one it's on now, the next one lined up and
 * the ones it has moved on from. Later reads beyond the next are left out. "Now" is the most recently added read whose dates
 * cover today (an undated read counts as ongoing until a newer one replaces it).
 */
export function sortClubReads(reads: ClubRead[], on = today()) {
  const newestFirst = [...reads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const started = (r: ClubRead) => !r.startsOn || r.startsOn <= on;
  const ended = (r: ClubRead) => !!r.endsOn && r.endsOn < on;
  const current = newestFirst.find((r) => started(r) && !ended(r)) ?? null;
  const upcoming =
    reads
      .filter((r) => r.startsOn && r.startsOn > on)
      .sort((a, b) => (a.startsOn ?? "").localeCompare(b.startsOn ?? ""))[0] ?? null;
  // Everything else: finished reads, and ones a newer pick has superseded.
  const past = newestFirst.filter((r) => r !== current && r !== upcoming && started(r));
  return { current, upcoming, past };
}

type RawCard = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_color: string | null;
  is_private: boolean;
  created_at: string;
  club_members: { count: number }[];
  club_reads: RawRead[];
};

function toCard(raw: RawCard) {
  const { club_members, club_reads, ...club } = raw;
  const reads = club_reads.flatMap((r) => toRead(r) ?? []);
  const { current, upcoming } = sortClubReads(reads);
  return {
    ...club,
    memberCount: club_members[0]?.count ?? 0,
    currentRead: current ?? upcoming,
  };
}

export type ClubCard = ReturnType<typeof toCard>;

/** Clubs the signed-in reader belongs to, most recently joined first. */
export async function getMyClubs(client: BooksydeClient) {
  const userId = await requireUserId(client);
  const { data, error } = await client
    .from("club_members")
    .select(`role, joined_at, clubs ( ${CARD_FIELDS} )`)
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).flatMap((m) => (m.clubs ? [{ ...toCard(m.clubs as unknown as RawCard), role: m.role }] : []));
}

/** Public clubs anyone can join, newest first. */
export async function getPublicClubs(client: BooksydeClient, limit = 24) {
  const { data, error } = await client
    .from("clubs")
    .select(CARD_FIELDS)
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((c) => toCard(c as unknown as RawCard));
}

const roleOrder: Record<ClubRole, number> = {
  owner: 0,
  moderator: 1,
  member: 2,
};

/** A club with its members and reads, or null if it doesn't exist or is private to you. */
export async function getClubBySlug(client: BooksydeClient, slug: string) {
  const { data, error } = await client
    .from("clubs")
    .select(
      `*,
       club_reads ( ${READ_FIELDS} ),
       club_members ( role, joined_at, user_id, profiles ( username, display_name, avatar_url, theme_color ) )`,
    )
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { club_reads, club_members, ...club } = data;
  const reads = (club_reads as unknown as RawRead[]).flatMap((r) => toRead(r) ?? []);
  const members = club_members
    .flatMap((m) =>
      m.profiles
        ? [
            {
              userId: m.user_id,
              role: m.role,
              joinedAt: m.joined_at,
              ...m.profiles,
            },
          ]
        : [],
    )
    .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.joinedAt.localeCompare(b.joinedAt));
  return { ...club, members, reads: sortClubReads(reads) };
}

export type ClubDetail = NonNullable<Awaited<ReturnType<typeof getClubBySlug>>>;
export type ClubMember = ClubDetail["members"][number];

/**
 * Start a club. The creator becomes its owner (a database trigger adds them).
 * If the name's slug is taken, a short suffix keeps the address unique.
 */
export async function createClub(client: BooksydeClient, input: ClubInput) {
  const parsed = clubInputSchema.parse(input);
  const userId = await requireUserId(client);
  const base = clubSlug(parsed.name);
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    // No `.select()`: a private club isn't visible to its creator until the
    // owner trigger has run, so asking for the row back would trip RLS.
    const { error } = await client.from("clubs").insert({
      owner_id: userId,
      name: parsed.name,
      slug,
      description: parsed.description || null,
      cover_color: parsed.cover_color ?? null,
      is_private: parsed.is_private,
    });
    if (!error) return { slug };
    if (error.code !== "23505") throw error;
  }
  throw new Error("Couldn’t find a free address for that club name. Try a different name?");
}

/** Join a public club as a member. */
export async function joinClub(client: BooksydeClient, clubId: string) {
  const userId = await requireUserId(client);
  const { error } = await client.from("club_members").insert({ club_id: clubId, user_id: userId, role: "member" });
  if (error && error.code !== "23505") throw error;
}

/** Leave a club. Owners can't leave their own club. */
export async function leaveClub(client: BooksydeClient, clubId: string) {
  const userId = await requireUserId(client);
  const { error } = await client.from("club_members").delete().match({ club_id: clubId, user_id: userId });
  if (error) throw error;
}

/** Put a book on the club's reading list (owners and moderators only). */
export async function addClubRead(client: BooksydeClient, input: ClubReadInput) {
  const parsed = clubReadInputSchema.parse(input);
  const { error } = await client.from("club_reads").insert({
    club_id: parsed.clubId,
    work_id: parsed.workId,
    starts_on: parsed.startsOn || null,
    ends_on: parsed.endsOn || null,
  });
  if (error) throw error;
}

/** Take a book off the club's reading list (owners and moderators only). */
export async function removeClubRead(client: BooksydeClient, readId: string) {
  const { error } = await client.from("club_reads").delete().eq("id", readId);
  if (error) throw error;
}

export type ReaderProgress = {
  status: ReadingStatus | null;
  /** Their page in their latest unfinished session, if they've logged one. */
  page: number | null;
};

/** Where each member is with a book, for those whose shelves you can see. */
export async function getMembersProgress(client: BooksydeClient, workId: string, userIds: string[]) {
  const out = new Map<string, ReaderProgress>();
  if (!userIds.length) return out;
  const [books, sessions] = await Promise.all([
    client.from("user_books").select("user_id, status").eq("work_id", workId).in("user_id", userIds),
    client
      .from("reading_sessions")
      .select("user_id, current_page, finished_at")
      .eq("work_id", workId)
      .in("user_id", userIds)
      .order("started_at", { ascending: false }),
  ]);
  if (books.error) throw books.error;
  if (sessions.error) throw sessions.error;
  for (const b of books.data ?? []) out.set(b.user_id, { status: b.status, page: null });
  const seen = new Set<string>();
  for (const s of sessions.data ?? []) {
    // Newest first: only each reader's latest session counts.
    if (seen.has(s.user_id)) continue;
    seen.add(s.user_id);
    if (s.finished_at || s.current_page == null) continue;
    out.set(s.user_id, { status: out.get(s.user_id)?.status ?? null, page: s.current_page });
  }
  return out;
}

/** The signed-in reader's place in a book (null when signed out). */
export async function getMyProgress(client: BooksydeClient, workId: string): Promise<ReaderProgress | null> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  return (await getMembersProgress(client, workId, [auth.user.id])).get(auth.user.id) ?? { status: null, page: null };
}

/** Latest reading session for a book, if there is one still open. */
async function openSession(client: BooksydeClient, userId: string, workId: string) {
  const { data, error } = await client
    .from("reading_sessions")
    .select("id, finished_at")
    .match({ user_id: userId, work_id: workId })
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data && !data.finished_at ? data : null;
}

/**
 * Log the page you've reached. Puts the book on your Reading shelf if it isn't
 * already (a finished book stays on Read: you're rereading).
 */
export async function setReadingPage(client: BooksydeClient, workId: string, page: number) {
  const current = readingPageSchema.parse(page);
  const userId = await requireUserId(client);
  const session = await openSession(client, userId, workId);
  const { error } = session
    ? await client.from("reading_sessions").update({ current_page: current }).eq("id", session.id)
    : await client.from("reading_sessions").insert({ user_id: userId, work_id: workId, current_page: current });
  if (error) throw error;

  const { data: shelf, error: shelfError } = await client
    .from("user_books")
    .select("status")
    .match({ user_id: userId, work_id: workId })
    .maybeSingle();
  if (shelfError) throw shelfError;
  if (shelf?.status !== "reading" && shelf?.status !== "read") {
    const { error: upsertError } = await client
      .from("user_books")
      .upsert({ user_id: userId, work_id: workId, status: "reading" }, { onConflict: "user_id,work_id" });
    if (upsertError) throw upsertError;
  }
}

/** Mark a book finished: close the open session and shelve it as Read. */
export async function finishReading(client: BooksydeClient, workId: string) {
  const userId = await requireUserId(client);
  const session = await openSession(client, userId, workId);
  if (session) {
    const { error } = await client
      .from("reading_sessions")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", session.id);
    if (error) throw error;
  }
  const { error } = await client
    .from("user_books")
    .upsert({ user_id: userId, work_id: workId, status: "read" }, { onConflict: "user_id,work_id" });
  if (error) throw error;
}

export type ClubPost = {
  id: string;
  clubReadId: string | null;
  workId: string | null;
  userId: string;
  username: string;
  displayName: string | null;
  themeColor: string | null;
  /** Null when it's hidden from you as a spoiler. */
  body: string | null;
  spoilerPage: number | null;
  isHidden: boolean;
  createdAt: string;
};

/**
 * A club's posts, newest first, with spoilers past your page blanked out
 * (the database does the hiding, so the text never reaches you). Members only.
 */
export async function getClubPosts(
  client: BooksydeClient,
  clubId: string,
  opts: { limit?: number; before?: string } = {},
): Promise<ClubPost[]> {
  const { data, error } = await client.rpc("get_club_posts", {
    p_club_id: clubId,
    max_results: opts.limit ?? 50,
    ...(opts.before ? { before: opts.before } : {}),
  });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    clubReadId: p.club_read_id ?? null,
    workId: p.work_id ?? null,
    userId: p.user_id,
    username: p.username,
    displayName: p.display_name ?? null,
    themeColor: p.theme_color ?? null,
    body: p.is_hidden ? null : p.body,
    spoilerPage: p.spoiler_page ?? null,
    isHidden: p.is_hidden,
    createdAt: p.created_at,
  }));
}

/** Post to a club's discussion (members only). */
export async function createClubPost(client: BooksydeClient, input: ClubPostInput) {
  const parsed = clubPostInputSchema.parse(input);
  const userId = await requireUserId(client);
  const { error } = await client.from("club_posts").insert({
    club_id: parsed.clubId,
    club_read_id: parsed.clubReadId ?? null,
    user_id: userId,
    body: parsed.body,
    // A spoiler page only means something for a post about a book.
    spoiler_page: parsed.clubReadId ? (parsed.spoilerPage ?? null) : null,
  });
  if (error) throw error;
}

/** Delete your own post, or any post if you moderate the club. */
export async function deleteClubPost(client: BooksydeClient, postId: string) {
  const { error } = await client.from("club_posts").delete().eq("id", postId);
  if (error) throw error;
}
