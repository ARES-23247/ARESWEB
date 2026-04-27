import { z } from "zod";

export const postSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  slug: z.string().max(255).optional(),
  thumbnail: z.string().max(255).optional().or(z.literal("")),
  ast: z.record(z.string().max(255), z.any()), // JSON AST from Tiptap
  socials: z.record(z.string().max(255), z.boolean()).optional(),
  isDraft: z.boolean().optional(),
  publishedAt: z.string().max(255).optional(),
  seasonId: z.union([z.string(), z.number()]).transform(v => v === "" ? undefined : Number(v)).optional(),
});

export type PostPayload = z.infer<typeof postSchema>;
