"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { importOpenLibraryWork } from "@/lib/open-library-import";

export type ImportState = { error?: string };

/** "Fill in a request slip": add an Open Library work to the catalogue, then open its page. */
export async function addToCatalogue(_prev: ImportState, form: FormData): Promise<ImportState> {
  const olid = String(form.get("olid") ?? "");
  let workId: string | null;
  try {
    workId = await importOpenLibraryWork(olid);
  } catch (e) {
    console.error("Open Library import failed", olid, e);
    return { error: "The stacks are stuck right now. Try again in a moment." };
  }
  if (!workId) return { error: "Open Library couldn’t find that one after all." };
  updateTag("catalog-search");
  updateTag("catalog-drawers");
  redirect(`/books/${workId}`);
}
