import { extendSchema } from "@shared/db/schema-extensions";
import { insertInquirySchema } from "@shared/db/schema-zod";
import { z } from "zod";

export const inquirySchema = extendSchema(insertInquirySchema)
  .overrideField("type", z.string().min(1, "Type is required").max(255))
  .overrideField("name", z.string().min(1, "Name is required").max(255))
  .overrideField("email", z.string().email("Invalid email address").max(255))
  .overrideField("metadata", z.record(z.string().max(255), z.any()).optional())
  .omitField("id")
  .omitField("status")
  .omitField("isDeleted")
  .omitField("createdAt")
  .omitField("zulipMessageId")
  .omitField("notes")
  .build();

export type InquiryPayload = z.infer<typeof inquirySchema>;
