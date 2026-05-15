import { OpenAPIHono } from "@hono/zod-openapi";
import { eq, desc, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, ensureAdmin, getDb } from "../middleware";
import {
  getTournamentsRoute,
  getTournamentRoute,
  createTournamentRoute,
  updateTournamentRoute,
  deleteTournamentRoute,
  syncTournamentMatchesRoute,
  updateTournamentMatchVideoRoute,
  updateTournamentAwardRoute,
  deleteTournamentAwardRoute
} from "../../../shared/routes/tournaments";
import { ApiError } from "../middleware/errorHandler";
import { getFtcData } from "./ftc";
import type { HonoContext } from "@shared/types/api";

const serializeTournament = (t: typeof schema.tournaments.$inferSelect) => ({
  id: t.id,
  name: t.name,
  seasonId: t.seasonId ?? null,
  robotId: t.robotId ?? null,
  ftcEventCode: t.ftcEventCode ?? null,
  ast: t.ast ?? null,
  albumId: t.albumId ?? null,
  startDate: t.startDate ?? null,
  endDate: t.endDate ?? null,
  location: t.location ?? null,
  rank: t.rank ?? null,
  allianceRole: t.allianceRole ?? null,
  eliminationStatus: t.eliminationStatus ?? null,
  opr: t.opr ?? null,
  isDeleted: t.isDeleted ?? 0,
  createdAt: t.createdAt ?? new Date().toISOString(),
  updatedAt: t.updatedAt ?? new Date().toISOString(),
});

const _tournamentsRouter = new OpenAPIHono<AppEnv>();

_tournamentsRouter.use("*", async (c, next) => {
  if (c.req.method !== "GET") {
    return ensureAdmin(c, next);
  }
  return next();
});

export const tournamentsRouter = _tournamentsRouter
.openapi(getTournamentsRoute, async (c) => {
  const db = getDb(c);
  const allTournaments = await db.select().from(schema.tournaments).where(eq(schema.tournaments.isDeleted, 0)).orderBy(desc(schema.tournaments.createdAt)).execute();
  return c.json({ tournaments: allTournaments.map(serializeTournament) }, 200);
})
.openapi(getTournamentRoute, async (c) => {
  const db = getDb(c);
  const { id } = c.req.valid("param");
  
  const records = await db.select().from(schema.tournaments).where(and(eq(schema.tournaments.id, id), eq(schema.tournaments.isDeleted, 0))).execute();
  const record = records[0];

  if (!record) {
    throw new ApiError("Tournament not found", 404, "TOURNAMENT_NOT_FOUND");
  }

  const matches = await db.select({
    id: schema.tournamentMatches.id,
    tournamentId: schema.tournamentMatches.tournamentId,
    matchNumber: schema.tournamentMatches.matchNumber,
    matchType: schema.tournamentMatches.matchType,
    redScore: schema.tournamentMatches.redScore,
    blueScore: schema.tournamentMatches.blueScore,
    youtubeVideoId: schema.tournamentMatches.youtubeVideoId,
    createdAt: schema.tournamentMatches.createdAt,
    updatedAt: schema.tournamentMatches.updatedAt
  }).from(schema.tournamentMatches).where(eq(schema.tournamentMatches.tournamentId, id)).orderBy(schema.tournamentMatches.matchNumber).execute();
  
  const awards = await db.select({
    id: schema.tournamentAwards.id,
    tournamentId: schema.tournamentAwards.tournamentId,
    name: schema.tournamentAwards.name,
    placement: schema.tournamentAwards.placement,
    createdAt: schema.tournamentAwards.createdAt
  }).from(schema.tournamentAwards).where(eq(schema.tournamentAwards.tournamentId, id)).execute();

  return c.json({
    tournament: serializeTournament(record),
    matches: matches.map(m => ({
      id: m.id,
      tournamentId: m.tournamentId,
      matchNumber: m.matchNumber,
      matchType: m.matchType,
      redScore: m.redScore ?? null,
      blueScore: m.blueScore ?? null,
      youtubeVideoId: m.youtubeVideoId ?? null,
      createdAt: m.createdAt ?? undefined,
      updatedAt: m.updatedAt ?? undefined,
    })),
    awards: awards.map(a => ({
      id: a.id,
      tournamentId: a.tournamentId,
      name: a.name,
      placement: a.placement ?? null,
      createdAt: a.createdAt ?? undefined,
    }))
  }, 200);
})
.openapi(createTournamentRoute, async (c) => {
  const db = getDb(c);
  const payload = c.req.valid("json");
  const id = crypto.randomUUID();

  await db.insert(schema.tournaments).values({
    id,
    name: payload.name ?? "New Tournament",
    ...payload,
  }).execute();

  return c.json({ success: true, id }, 200);
})
.openapi(updateTournamentRoute, async (c) => {
  const db = getDb(c);
  const { id } = c.req.valid("param");
  const payload = c.req.valid("json");

  const records = await db.select({ id: schema.tournaments.id }).from(schema.tournaments).where(eq(schema.tournaments.id, id)).execute();
  if (records.length === 0) throw new ApiError("Tournament not found", 404, "TOURNAMENT_NOT_FOUND");

  await db.update(schema.tournaments).set({
    ...payload,
    updatedAt: new Date().toISOString()
  }).where(eq(schema.tournaments.id, id)).execute();

  return c.json({ success: true }, 200);
})
.openapi(deleteTournamentRoute, async (c) => {
  const db = getDb(c);
  const { id } = c.req.valid("param");

  const records = await db.select({ id: schema.tournaments.id }).from(schema.tournaments).where(eq(schema.tournaments.id, id)).execute();
  if (records.length === 0) throw new ApiError("Tournament not found", 404, "TOURNAMENT_NOT_FOUND");

  await db.update(schema.tournaments).set({
    isDeleted: 1,
    updatedAt: new Date().toISOString()
  }).where(eq(schema.tournaments.id, id)).execute();

  return c.json({ success: true }, 200);
})
.openapi(syncTournamentMatchesRoute, async (c) => {
  const db = getDb(c);
  const { id } = c.req.valid("param");

  const records = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, id)).execute();
  const tournament = records[0];
  if (!tournament) throw new ApiError("Tournament not found", 404, "TOURNAMENT_NOT_FOUND");
  if (!tournament.ftcEventCode || !tournament.seasonId) {
    throw new ApiError("Tournament is missing FTC Event Code or Season ID", 400, "MISSING_FTC_CONFIG");
  }

  try {
    const data = await getFtcData(`/${tournament.seasonId}/matches/${tournament.ftcEventCode}`, c as unknown as HonoContext);
    
    if (data && (data as any).matches && Array.isArray((data as any).matches)) {
      for (const match of (data as any).matches) {
        const matchNumber = match.matchNumber;
        const matchType = match.description || "Match";
        const redScore = match.scoreRedFinal;
        const blueScore = match.scoreBlueFinal;

        const existingMatches = await db.select({ id: schema.tournamentMatches.id })
          .from(schema.tournamentMatches)
          .where(and(
            eq(schema.tournamentMatches.tournamentId, id),
            eq(schema.tournamentMatches.matchNumber, matchNumber)
          ))
          .execute();

        if (existingMatches.length > 0) {
          await db.update(schema.tournamentMatches).set({
            matchType,
            redScore,
            blueScore,
            updatedAt: new Date().toISOString()
          }).where(eq(schema.tournamentMatches.id, existingMatches[0].id)).execute();
        } else {
          await db.insert(schema.tournamentMatches).values({
            id: crypto.randomUUID(),
            tournamentId: id,
            matchNumber,
            matchType,
            redScore,
            blueScore
          }).execute();
        }
      }
    }
    return c.json({ success: true }, 200);
  } catch (error: any) {
    throw new ApiError(`Failed to sync matches: ${error.message}`, 500, "SYNC_FAILED");
  }
})
.openapi(updateTournamentMatchVideoRoute, async (c) => {
  const db = getDb(c);
  const { id, matchId } = c.req.valid("param");
  const { youtubeVideoId } = c.req.valid("json");

  await db.update(schema.tournamentMatches)
    .set({ youtubeVideoId, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.tournamentMatches.id, matchId), eq(schema.tournamentMatches.tournamentId, id)))
    .execute();

  return c.json({ success: true }, 200);
})
.openapi(updateTournamentAwardRoute, async (c) => {
  const db = getDb(c);
  const { id } = c.req.valid("param");
  const payload = c.req.valid("json");

  const awardId = crypto.randomUUID();
  await db.insert(schema.tournamentAwards).values({
    id: awardId,
    tournamentId: id,
    name: payload.name,
    placement: payload.placement
  }).execute();

  return c.json({ success: true, id: awardId }, 200);
})
.openapi(deleteTournamentAwardRoute, async (c) => {
  const db = getDb(c);
  const { id, awardId } = c.req.valid("param");

  await db.delete(schema.tournamentAwards)
    .where(and(eq(schema.tournamentAwards.id, awardId), eq(schema.tournamentAwards.tournamentId, id)))
    .execute();

  return c.json({ success: true }, 200);
});
