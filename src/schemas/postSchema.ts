import { z } from "zod";

export const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  coverImageUrl: z.string().optional().or(z.literal("")),
  ast: z.record(z.string(), z.any()), // JSON AST from Tiptap
  socials: z.record(z.string(), z.boolean()).optional(),
  isDraft: z.boolean().optional(),
  publishedAt: z.string().optional(),
  seasonId: z.string().optional(),
});

export type PostPayload = z.infer<typeof postSchema>;
