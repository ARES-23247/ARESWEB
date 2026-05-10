import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";

import { eq, desc } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, getSessionUser, ensureAdmin, getDb } from "../middleware";
import {
  listNewsRoute,
  getNewsByIdRoute,
  createNewsRoute,
  updateNewsRoute,
  deleteNewsRoute,
} from "../../../shared/routes/communications";
import { createTypedHandler } from "../utils/handler-native";
import { ApiError } from "../middleware/errorHandler";

export const communicationsRouter = new OpenAPIHono<AppEnv>();

// News Routes
communicationsRouter.openapi(listNewsRoute, createTypedHandler(listNewsRoute, async (c, { query }) => {
    const { category, limit = 10, offset = 0 } = query;
    const db = getDb(c);
    let q = db.select().from(schema.news);

    if (category) {
      q = q.where(eq(schema.news.category, category)) as any;
    }

    const results = await q.orderBy(desc(schema.news.publishDate)).limit(limit).offset(offset).all();

    const news = results.map((n) => ({
      ...n,
      content: n.content || "",
      imageUrl: n.imageUrl || null,
      publishDate: n.publishDate || new Date().toISOString(),
      category: (n.category as any) || "general",
    }));

    return c.json({ news }, 200);
}));

communicationsRouter.openapi(getNewsByIdRoute, createTypedHandler(getNewsByIdRoute, async (c, { params }) => {
    const { id } = params;
    const db = getDb(c);
    const result = await db.select().from(schema.news).where(eq(schema.news.id, id)).get();

    if (!result) {
      throw new ApiError("News item not found", 404);
    }

    const news = {
      ...result,
      content: result.content || "",
      imageUrl: result.imageUrl || null,
      publishDate: result.publishDate || new Date().toISOString(),
      category: (result.category as any) || "general",
    };

    return c.json({ news }, 200);
}));

// Admin Routes
communicationsRouter.use("*", ensureAdmin);

communicationsRouter.openapi(createNewsRoute, createTypedHandler(createNewsRoute, async (c, { body }) => {
    const db = getDb(c);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(schema.news).values({
        id,
        ...body,
        publishDate: body.publishDate || now,
        createdAt: now,
        updatedAt: now,
    }).run();

    return c.json({ success: true, id }, 200);
}));

communicationsRouter.openapi(updateNewsRoute, createTypedHandler(updateNewsRoute, async (c, { params, body }) => {
    const { id } = params;
    const db = getDb(c);
    await db.update(schema.news).set({
        ...body,
        updatedAt: new Date().toISOString(),
    }).where(eq(schema.news.id, id)).run();
    return c.json({ success: true }, 200);
}));

communicationsRouter.openapi(deleteNewsRoute, createTypedHandler(deleteNewsRoute, async (c, { params }) => {
    const { id } = params;
    const db = getDb(c);
    await db.delete(schema.news).where(eq(schema.news.id, id)).run();
    return c.json({ success: true }, 200);
}));

export default communicationsRouter;
