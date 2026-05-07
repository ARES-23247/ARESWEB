import { z } from "zod";

export const outreachSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required").max(255),
  date: z.string().min(1, "Date is required").max(255),
  location: z.string().max(255).nullable().optional(),
  students_count: z.number().int().min(0).default(0),
  hours_logged: z.number().min(0).default(0),
  reach_count: z.number().int().min(0).default(0),
  description: z.string().max(5000).nullable().optional(),
  is_mentoring: z.boolean().default(false),
  mentored_team_number: z.string().max(50).nullable().optional(),
  season_id: z.number().int().nullable().optional(),
  event_id: z.string().nullable().optional(),
  mentor_count: z.number().int().min(0).optional(),
  mentor_hours: z.number().min(0).optional(),
  is_dynamic: z.boolean().optional()
});

export type OutreachPayload = z.infer<typeof outreachSchema>;
