/*
 * Runs the daily author job by hand (see src/lib/author-refresh.ts): portraits
 * for authors with none, and the books of theirs we don't hold yet.
 *
 *   npm run authors:refresh                          # dry run: prints what would change
 *   npm run authors:refresh -- --apply               # one day's run, for real
 *   npm run authors:refresh -- --author=<id> --apply # just that author (repeatable)
 *   npm run authors:refresh -- --limit=10            # only the first 10 authors in line
 *   npm run authors:refresh -- --books-only          # leave portraits alone
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from apps/web/.env.local.
 */
import { refreshAuthors } from "../src/lib/author-refresh";

const arg = (name: string) => process.argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.split("=")[1]);
const apply = process.argv.includes("--apply");
const authorIds = arg("author");
const limit = Number(arg("limit")[0]) || undefined;
const photos = !process.argv.includes("--books-only");

console.log(`${apply ? "Applying" : "Dry run"}: ${authorIds.length ? authorIds.join(", ") : "authors in line"}\n`);
const result = await refreshAuthors({ apply, authorIds, limit, photos, budgetMs: 30 * 60_000, log: console.log });
console.log("\n", result);
if (!apply) console.log("Dry run: re-run with --apply to write these.");
