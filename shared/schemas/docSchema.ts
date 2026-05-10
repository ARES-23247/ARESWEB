import { extendSchema } from "@shared/db/schema-extensions";
import { insertDocSchema } from "@shared/db/schema-zod";
import { z } from "zod";
import { slugSchema } from "./validators";

export const docSchema = extendSchema(insertDocSchema)
  .overrideField("slug", slugSchema)
  .overrideField("title", z.string().min(1, "Title is required").max(255))
  .overrideField("category", z.string().min(1, "Category is required").max(255))
  .overrideField("sortOrder", z.number().int().default(10))
  .overrideField("description", z.string().max(5000).optional())
  .overrideField("content", z.string().min(1, "Content is required").max(200000))
  .overrideField("isPortfolio", z.boolean().default(false))
  .overrideField("isExecutiveSummary", z.boolean().default(false))
  .overrideField("isDraft", z.boolean().optional())
  .overrideField("displayInAreslib", z.boolean().default(false))
  .overrideField("displayInMathCorner", z.boolean().default(false))
  .overrideField("displayInScienceCorner", z.boolean().default(false))
  .omitField("contentDraft")
  .omitField("cfEmail")
  .omitField("updatedAt")
  .omitField("isDeleted")
  .omitField("status")
  .omitField("revisionOf")
  .omitField("zulipStream")
  .omitField("zulipTopic")
  .build();

export type DocPayload = z.infer<typeof docSchema>;
