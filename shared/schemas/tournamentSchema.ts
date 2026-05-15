import { z } from "zod";

export const tournamentSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  seasonId: z.number().nullable().optional(),
  robotId: z.string().nullable().optional(),
  ftcEventCode: z.string().nullable().optional(),
  ast: z.string().nullable().optional(),
  albumId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  rank: z.number().nullable().optional(),
  allianceRole: z.string().nullable().optional(),
  eliminationStatus: z.string().nullable().optional(),
  opr: z.number().nullable().optional(),
  isDeleted: z.number().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Tournament = z.infer<typeof tournamentSchema>;

export const tournamentPayloadSchema = tournamentSchema.omit({
  id: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  name: true,
});

export type TournamentPayload = z.infer<typeof tournamentPayloadSchema>;

export const tournamentMatchSchema = z.object({
  id: z.string(),
  tournamentId: z.string(),
  matchNumber: z.number(),
  matchType: z.string(),
  redScore: z.number().nullable().optional(),
  blueScore: z.number().nullable().optional(),
  youtubeVideoId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type TournamentMatch = z.infer<typeof tournamentMatchSchema>;

export const tournamentMatchPayloadSchema = tournamentMatchSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TournamentMatchPayload = z.infer<typeof tournamentMatchPayloadSchema>;

export const tournamentAwardSchema = z.object({
  id: z.string(),
  tournamentId: z.string(),
  name: z.string(),
  placement: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export type TournamentAward = z.infer<typeof tournamentAwardSchema>;

export const tournamentAwardPayloadSchema = tournamentAwardSchema.omit({
  id: true,
  createdAt: true,
});

export type TournamentAwardPayload = z.infer<typeof tournamentAwardPayloadSchema>;
