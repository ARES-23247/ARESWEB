import { z } from "zod";

export const eventSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Event title is required").max(255),
  dateStart: z.string().min(1, "Start date is required").max(255),
  dateEnd: z.string().max(255).optional(),
  location: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  coverImage: z.string().max(255).optional().or(z.literal("")),
  category: z.enum(["internal", "outreach", "external"]).default("internal"),
  tbaEventKey: z.string().max(255).optional().or(z.literal("")),
  isPotluck: z.boolean().default(false),
  isVolunteer: z.boolean().default(false),
  publishedAt: z.string().max(255).optional(),
  isDraft: z.boolean().optional(),
  seasonId: z.union([z.string(), z.number()]).transform(v => v === "" ? undefined : Number(v)).optional(),
  meetingNotes: z.string().max(200000).optional(),
  socials: z.record(z.string().max(255), z.boolean()).optional(),
  rrule: z.string().max(1000).optional().or(z.literal("")),
  recurringGroupId: z.string().optional(),
  recurringException: z.boolean().optional(),
  updateMode: z.enum(["single", "following"]).optional(),
  deleteMode: z.enum(["single", "following"]).optional(),
});

export type EventPayload = z.infer<typeof eventSchema>;
