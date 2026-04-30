import { z } from "zod";

export const sponsorSchema = z.object({
  id: z.string().max(255).optional(),
  name: z.string().min(1, "Name is required").max(255),
  tier: z.enum(["Titanium", "Gold", "Silver", "Bronze", "In-Kind"]),
  logo_url: z.string().max(255).optional().nullable().or(z.literal("")),
  website_url: z.string().url("Must be a valid URL").max(255).optional().nullable().or(z.literal("")),
  is_active: z.number().default(1)
});

export type SponsorPayload = z.input<typeof sponsorSchema>;
