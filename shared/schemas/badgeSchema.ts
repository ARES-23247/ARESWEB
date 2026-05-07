import { z } from "zod";

export const badgeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  icon: z.string().min(1, "Icon string is required"),
  description: z.string().optional().nullable(),
  tier: z.enum(["BRONZE", "SILVER", "GOLD", "DIAMOND", "UNIQUE"]).default("BRONZE"),
  secret_code: z.string().optional().nullable()
});

export type BadgePayload = z.infer<typeof badgeSchema>;
