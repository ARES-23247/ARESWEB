import { z } from "zod";

export const sponsorSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  tier: z.enum(["Titanium", "Gold", "Silver", "Bronze"], { required_error: "Tier is required" }),
  logo_url: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  website_url: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  is_active: z.number().default(1)
});

export type SponsorPayload = z.infer<typeof sponsorSchema>;
