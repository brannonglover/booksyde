import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, "3–30 characters: letters, numbers and underscores");

export const profileUpdateSchema = z.object({
  username: usernameSchema.optional(),
  display_name: z.string().trim().max(60).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  theme_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  is_private: z.boolean().optional(),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
