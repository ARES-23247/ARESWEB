import { z } from "zod";

export const robotSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  seasonId: z.number().nullable().optional(),
  ast: z.string().nullable().optional(),
  albumId: z.string().nullable().optional(),
  onshapeUrl: z.string().nullable().optional(),
  cadViewerUrl: z.string().nullable().optional(),
  revealVideoId: z.string().nullable().optional(),
  weightLbs: z.number().nullable().optional(),
  drivetrainType: z.string().nullable().optional(),
  programmingLanguage: z.string().nullable().optional(),
  primaryMechanism: z.string().nullable().optional(),
  isDeleted: z.number().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Robot = z.infer<typeof robotSchema>;

export const robotPayloadSchema = robotSchema.omit({
  id: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  name: true,
});

export type RobotPayload = z.infer<typeof robotPayloadSchema>;
