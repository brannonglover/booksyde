"use server";

import { revalidateTag, updateTag } from "next/cache";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * After a reader votes on a book's moods: show the new tally on this page right
 * away, and let the search and browse pages catch up in the background.
 */
export async function moodsChanged(workId: string) {
  if (!UUID.test(workId)) return;
  updateTag(`work:${workId}`);
  revalidateTag("catalog-drawers", "max");
  revalidateTag("catalog-search", "max");
}
