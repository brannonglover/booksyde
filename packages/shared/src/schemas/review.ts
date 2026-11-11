import { z } from "zod";

/** Half-star ratings from 0.5 to 5. */
export const ratingSchema = z
  .number()
  .min(0.5)
  .max(5)
  .refine((n) => Number.isInteger(n * 2), "Ratings go in half-star steps");

export const reviewInputSchema = z
  .object({
    workId: z.string().uuid(),
    editionId: z.string().uuid().optional(),
    rating: ratingSchema.optional(),
    body: z.string().trim().max(20000).optional(),
    hasSpoilers: z.boolean().default(false),
  })
  .refine((r) => r.rating !== undefined || (r.body && r.body.length > 0), {
    message: "Add a rating or write a review",
  });

export type ReviewInput = z.input<typeof reviewInputSchema>;
