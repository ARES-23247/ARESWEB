import { z } from "zod";

export const locationSchema = z.object({
  id: z.string().max(255).optional(),
  name: z.string().min(1, "Name is required").max(255),
  address: z.string().max(5000).optional().nullable(),
  coordinates: z.string().max(255).optional().nullable(),
  contact_info: z.string().max(5000).optional().nullable(),
  is_deleted: z.number().default(0)
});

export type LocationPayload = z.infer<typeof locationSchema>;
