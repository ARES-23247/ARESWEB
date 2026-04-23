import { z } from "zod";

export const eventSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  dateStart: z.string().min(1, "Start date is required"),
  dateEnd: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  coverImage: z.string().optional().or(z.literal("")),
  category: z.enum(["internal", "outreach", "external"]).default("internal"),
  tbaEventKey: z.string().optional().or(z.literal("")),
  isPotluck: z.boolean().default(false),
  isVolunteer: z.boolean().default(false),
  publishedAt: z.string().optional(),
  isDraft: z.boolean().optional(),
  seasonId: z.string().optional(),
  socials: z.record(z.string(), z.boolean()).optional(),
});

export type EventPayload = z.infer<typeof eventSchema>;
