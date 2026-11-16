import { createBooksydeClient } from "@booksyde/shared";
import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { siteUrl } from "@/lib/site";

/*
 * Every public page a search engine should know about: the front pages, every
 * book, and the readers and clubs that chose to be public. Uses the cookie-less
 * client, so it lists exactly what a signed-out visitor can see.
 * (A single sitemap holds 50,000 URLs; split with generateSitemaps past that.)
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("hours");

  const client = createBooksydeClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const [works, profiles, clubs] = await Promise.all([
    client.from("works").select("id, updated_at").order("shelved_count", { ascending: false }).limit(45000),
    client.from("profiles").select("username, updated_at").eq("is_private", false).limit(2000),
    client.from("clubs").select("slug, updated_at").eq("is_private", false).limit(2000),
  ]);

  const pages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/discover`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/clubs`, changeFrequency: "daily", priority: 0.6 },
  ];

  return [
    ...pages,
    ...(works.data ?? []).map((w) => ({
      url: `${siteUrl}/books/${w.id}`,
      lastModified: w.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...(clubs.data ?? []).map((c) => ({
      url: `${siteUrl}/clubs/${c.slug}`,
      lastModified: c.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...(profiles.data ?? []).map((p) => ({
      url: `${siteUrl}/u/${p.username}`,
      lastModified: p.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
