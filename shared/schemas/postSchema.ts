import { extendSchema } from "@shared/db/schema-extensions";
import { insertPostSchema } from "@shared/db/schema-zod";
import { z } from "zod";

// Define a more specific schema for Tiptap AST nodes
const tiptapNodeSchema: z.ZodType<{
  type?: string;
  content?: unknown[];
  attrs?: Record<string, unknown>;
  marks?: unknown[];
  text?: string;
}> = z.object({
  type: z.string().optional(),
  content: z.array(z.lazy(() => tiptapNodeSchema)).optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  marks: z.array(z.unknown()).optional(),
  text: z.string().optional(),
});

export const postSchema = extendSchema(insertPostSchema)
  .overrideField("title", z.string().min(1, "Title is required").max(255))
  .overrideField("slug", z.string().max(255).optional())
  .overrideField("thumbnail", z.string().max(255).optional().or(z.literal("")))
  .overrideField("ast", tiptapNodeSchema)
  .overrideField("socials", z.record(z.string().max(255), z.boolean()).optional())
  .overrideField("isDraft", z.boolean().optional())
  .overrideField("publishedAt", z.string().max(255).optional())
  .overrideField("seasonId", z.union([z.string(), z.number()]).transform(v => v === "" ? undefined : Number(v)).optional())
  .omitField("date")
  .omitField("snippet")
  .omitField("author")
  .omitField("cfEmail")
  .omitField("contentDraft")
  .omitField("isDeleted")
  .omitField("status")
  .omitField("revisionOf")
  .omitField("isPortfolio")
  .omitField("updatedAt")
  .omitField("zulipStream")
  .omitField("zulipTopic")
  .omitField("authorAvatar")
  .build();

export type PostPayload = z.infer<typeof postSchema>;
