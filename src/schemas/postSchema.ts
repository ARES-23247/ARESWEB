import { z } from "zod";

export const postSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  coverImageUrl: z.string().max(255).optional().or(z.literal("")),
  ast: z.record(z.string().max(255), z.any()), // JSON AST from Tiptap
  socials: z.record(z.string().max(255), z.boolean()).optional(),
  isDraft: z.boolean().optional(),
  publishedAt: z.string().max(255).optional(),
  seasonId: z.string().max(255).optional(),
});

export type PostPayload = z.infer<typeof postSchema>;
