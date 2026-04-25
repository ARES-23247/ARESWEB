import { z } from "zod";

export const docSchema = z.object({
  slug: z.string().min(1, "Slug is required").max(255).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  title: z.string().min(1, "Title is required").max(255),
  category: z.string().min(1, "Category is required").max(255),
  sortOrder: z.number().int().default(10),
  description: z.string().max(5000).optional(),
  content: z.string().min(1, "Content is required").max(200000), // Stringified JSON AST
  isPortfolio: z.boolean().default(false),
  isExecutiveSummary: z.boolean().default(false),
  isDraft: z.boolean().optional(),
});

export type DocPayload = z.infer<typeof docSchema>;
