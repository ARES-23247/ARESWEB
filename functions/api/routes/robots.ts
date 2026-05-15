import { OpenAPIHono } from "@hono/zod-openapi";
import { eq, desc, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, ensureAdmin, getDb } from "../middleware";
import {
  getRobotsRoute,
  getRobotRoute,
  createRobotRoute,
  updateRobotRoute,
  deleteRobotRoute
} from "../../../shared/routes/robots";
import { ApiError } from "../middleware/errorHandler";

const serializeRobot = (r: typeof schema.robots.$inferSelect) => ({
  id: r.id,
  name: r.name,
  seasonId: r.seasonId ?? null,
  ast: r.ast ?? null,
  albumId: r.albumId ?? null,
  onshapeUrl: r.onshapeUrl ?? null,
  cadViewerUrl: r.cadViewerUrl ?? null,
  revealVideoId: r.revealVideoId ?? null,
  weightLbs: r.weightLbs ?? null,
  drivetrainType: r.drivetrainType ?? null,
  programmingLanguage: r.programmingLanguage ?? null,
  primaryMechanism: r.primaryMechanism ?? null,
  isDeleted: r.isDeleted ?? 0,
  createdAt: r.createdAt ?? new Date().toISOString(),
  updatedAt: r.updatedAt ?? new Date().toISOString(),
});

const _robotsRouter = new OpenAPIHono<AppEnv>();

_robotsRouter.use("*", async (c, next) => {
  if (c.req.method !== "GET") {
    return ensureAdmin(c, next);
  }
  return next();
});

export const robotsRouter = _robotsRouter
.openapi(getRobotsRoute, async (c) => {
  const db = getDb(c);
  const allRobots = await db.select().from(schema.robots).where(eq(schema.robots.isDeleted, 0)).orderBy(desc(schema.robots.createdAt)).execute();
  return c.json({ robots: allRobots.map(serializeRobot) }, 200);
})
.openapi(getRobotRoute, async (c) => {
  const db = getDb(c);
  const { id } = c.req.valid("param");
  
  const records = await db.select().from(schema.robots).where(and(eq(schema.robots.id, id), eq(schema.robots.isDeleted, 0))).execute();
  const record = records[0];

  if (!record) {
    throw new ApiError("Robot not found", 404, "ROBOT_NOT_FOUND");
  }

  return c.json({ robot: serializeRobot(record) }, 200);
})
.openapi(createRobotRoute, async (c) => {
  const db = getDb(c);
  const payload = c.req.valid("json");
  const id = crypto.randomUUID();

  await db.insert(schema.robots).values({
    id,
    name: payload.name ?? "New Robot",
    ...payload,
  }).execute();

  return c.json({ success: true, id }, 200);
})
.openapi(updateRobotRoute, async (c) => {
  const db = getDb(c);
  const { id } = c.req.valid("param");
  const payload = c.req.valid("json");

  const records = await db.select({ id: schema.robots.id }).from(schema.robots).where(eq(schema.robots.id, id)).execute();
  if (records.length === 0) throw new ApiError("Robot not found", 404, "ROBOT_NOT_FOUND");

  await db.update(schema.robots).set({
    ...payload,
    updatedAt: new Date().toISOString()
  }).where(eq(schema.robots.id, id)).execute();

  return c.json({ success: true }, 200);
})
.openapi(deleteRobotRoute, async (c) => {
  const db = getDb(c);
  const { id } = c.req.valid("param");

  const records = await db.select({ id: schema.robots.id }).from(schema.robots).where(eq(schema.robots.id, id)).execute();
  if (records.length === 0) throw new ApiError("Robot not found", 404, "ROBOT_NOT_FOUND");

  await db.update(schema.robots).set({
    isDeleted: 1,
    updatedAt: new Date().toISOString()
  }).where(eq(schema.robots.id, id)).execute();

  return c.json({ success: true }, 200);
});
