import { extendSchema } from "@shared/db/schema-extensions";
import { insertSponsorSchema } from "@shared/db/schema-zod";
import { z } from "zod";

export const sponsorSchema = extendSchema(insertSponsorSchema)
  .overrideField("id", z.string().max(255).optional())
  .overrideField("name", z.string().min(1, "Name is required").max(255))
  .overrideField("tier", z.enum(["Titanium", "Gold", "Silver", "Bronze", "In-Kind"]))
  .overrideField("logoUrl", z.string().max(255).optional().nullable().or(z.literal("")))
  .overrideField("websiteUrl", z.string().url("Must be a valid URL").max(255).optional().nullable().or(z.literal("")))
  .overrideField("isActive", z.number().default(1))
  .omitField("createdAt")
  .build();

export type SponsorPayload = z.infer<typeof sponsorSchema>;
