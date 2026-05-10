import { OpenAPIHono } from "@hono/zod-openapi";
import { eq, sum, desc, and, ne, gte } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, getSessionUser, ensureAdmin, getDb, ApiError } from "../middleware";
import { getUserPointsRoute, addPointsRoute, getPointsLeaderboardRoute } from "../../../shared/routes/points";

export const pointsRouter = new OpenAPIHono<AppEnv>();

pointsRouter.use("/add", ensureAdmin);

// Get user points
pointsRouter.openapi(getUserPointsRoute, async (c) => {
  const { user_id: userId } = c.req.valid("param");
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
    pointsBalance: Number(result?.total || 0)
  });
});

// Add points (admin only)
pointsRouter.openapi(addPointsRoute, async (c) => {
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

  return c.json({ success: true, transactionId: id } as const, 201);
});

// Get leaderboard
pointsRouter.openapi(getPointsLeaderboardRoute, async (c) => {
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

  return c.json({ leaderboard } as const);
});

export default pointsRouter;
