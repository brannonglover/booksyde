import { z } from "zod";

export const clubInputSchema = z.object({
  name: z.string().trim().min(1, "Give your club a name").max(80, "Keep it under 80 characters"),
  description: z.string().trim().max(1000, "Keep it under 1,000 characters").nullable().optional(),
  cover_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
  is_private: z.boolean().default(false),
});

export type ClubInput = z.input<typeof clubInputSchema>;

export const clubReadInputSchema = z
  .object({
    clubId: z.string().uuid(),
    workId: z.string().uuid(),
    startsOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    endsOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
  })
  .refine((r) => !r.startsOn || !r.endsOn || r.startsOn <= r.endsOn, {
    message: "The finish date comes before the start",
    path: ["endsOn"],
  });

export type ClubReadInput = z.infer<typeof clubReadInputSchema>;

/** "The Thursday Night Readers!" → "the-thursday-night-readers". */
export function clubSlug(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "club"
  );
}

export const clubPostInputSchema = z.object({
  clubId: z.string().uuid(),
  /** The club read the post is about; null for general chat. */
  clubReadId: z.string().uuid().nullable().optional(),
  body: z.string().trim().min(1, "Write something first").max(10000, "Keep it under 10,000 characters"),
  /** Hide the post from readers who haven't reached this page yet. */
  spoilerPage: z.number().int().min(1, "Pages start at 1").nullable().optional(),
});

export type ClubPostInput = z.input<typeof clubPostInputSchema>;

export const readingPageSchema = z.number().int().min(0, "Pages start at 0").max(100000, "That’s a very long book");
