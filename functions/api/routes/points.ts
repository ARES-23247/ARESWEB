import { OpenAPIHono } from "@hono/zod-openapi";
import { eq, sum, desc } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, getSessionUser, ensureAuth, getDb, ApiError } from "../middleware";
import { getPointsBalanceRoute, awardPointsRoute, getPointsLeaderboardRoute, getPointsHistoryRoute } from "../../../shared/routes/points";

const _pointsRouter = new OpenAPIHono<AppEnv>();

_pointsRouter.use("/balance/*", ensureAuth);
_pointsRouter.use("/history/*", ensureAuth);

// Get user points
export const pointsRouter = _pointsRouter
    .openapi(getPointsBalanceRoute, async (c) => {
      const { user_id: userId } = c.req.valid("param");
      const sessionUser = await getSessionUser(c);
      if (!sessionUser) throw new ApiError("Unauthorized", 401);
      if (sessionUser.id !== userId && sessionUser.role !== "admin") {
        throw new ApiError("Forbidden", 403);
      }

      const db = getDb(c);

      const result = await db
        .select({
          total: sum(schema.pointsLedger.pointsDelta)
        })
        .from(schema.pointsLedger)
        .where(eq(schema.pointsLedger.userId, userId))
        .get();

      return c.json({
        userId,
        balance: Number(result?.total || 0)
      }, 200);
    })
    .openapi(getPointsHistoryRoute, async (c) => {
      const { user_id: userId } = c.req.valid("param");
      
      // Note: ensureAuth handles login check.
      // We should also check if the user is requesting their own history, or if they are admin.
      const sessionUser = await getSessionUser(c);
      if (!sessionUser) throw new ApiError("Unauthorized", 401);
      if (sessionUser.id !== userId && sessionUser.role !== "admin") {
        throw new ApiError("Forbidden", 403);
      }

      const db = getDb(c);
      const history = await db
        .select()
        .from(schema.pointsLedger)
        .where(eq(schema.pointsLedger.userId, userId))
        .orderBy(desc(schema.pointsLedger.createdAt))
        .all();

      const formattedHistory = history.map((item) => ({
        id: item.id,
        userId: item.userId,
        pointsDelta: item.pointsDelta,
        reason: item.reason,
        createdBy: item.createdBy || "",
        createdAt: item.createdAt,
      }));

      return c.json(formattedHistory, 200);
    })
    .openapi(awardPointsRoute, async (c) => {
      const sessionUser = await getSessionUser(c);
      if (!sessionUser) throw new ApiError("Unauthorized", 401);
      if (sessionUser.role !== "admin") throw new ApiError("Forbidden", 403);

      const body = c.req.valid("json");
      const db = getDb(c);
      const id = crypto.randomUUID();

      await db.insert(schema.pointsLedger).values({
        id,
        userId: body.userId,
        pointsDelta: body.pointsDelta,
        reason: body.reason,
        createdAt: new Date().toISOString(),
        createdBy: sessionUser.id
      }).run();

      return c.json({ success: true, transactionId: id }, 201);
    })
    .openapi(getPointsLeaderboardRoute, async (c) => {
      const db = getDb(c);

      const results = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          nickname: schema.userProfiles.nickname,
          memberType: schema.userProfiles.memberType,
          pointsBalance: sum(schema.pointsLedger.pointsDelta),
          avatar: schema.user.image
        })
        .from(schema.user)
        .innerJoin(schema.pointsLedger, eq(schema.user.id, schema.pointsLedger.userId))
        .leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
        .groupBy(schema.user.id)
        .orderBy(desc(sum(schema.pointsLedger.pointsDelta)))
        .limit(20)
        .all();

      const leaderboard = results.map(r => ({
        id: r.id,
        name: r.name || "ARES Member",
        nickname: r.nickname || null,
        memberType: r.memberType || "student",
        pointsBalance: Number(r.pointsBalance || 0),
        avatar: r.avatar || null
      }));

      return c.json({ leaderboard }, 200);
    });
// Get user points history
// Add points (admin only)
// Get leaderboard
export default pointsRouter;
