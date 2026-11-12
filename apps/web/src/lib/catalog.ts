import "server-only";

import {
  createBooksydeClient,
  getMoreLikeThis,
  getRatingDistribution,
  getShelfCounts,
  getWork,
  getWorkReviews,
} from "@booksyde/shared";
import { cacheLife, cacheTag } from "next/cache";
import { supabaseKey, supabaseUrl } from "./supabase/env";

/*
 * Public catalog reads. They use a cookie-less client (what any visitor can
 * see), so results can be cached and shared between visitors. Anything
 * personal (your shelf status) is fetched in the browser instead.
 */

function publicClient() {
  return createBooksydeClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The work with authors, editions and tags; null if there's no such book. */
export async function getBook(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`work:${id}`);
  if (!UUID.test(id)) return null;
  return getWork(publicClient(), id);
}

/** Ratings, reviews and shelf counts change more often than the book itself. */
export async function getBookCommunity(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`work:${id}`, `work:${id}:community`);
  const client = publicClient();
  const [distribution, reviews, shelves] = await Promise.all([
    getRatingDistribution(client, id),
    getWorkReviews(client, id, 6),
    getShelfCounts(client, id),
  ]);
  return { distribution, reviews, shelves };
}

export async function getSimilarBooks(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`work:${id}`);
  return getMoreLikeThis(publicClient(), id, 6);
}
