import { z } from "zod";
import { OpenAPIHono } from "@hono/zod-openapi";
import { ApiError } from "../../middleware/errorHandler";
import {
  listGalleriesRoute,
  getGalleryRoute,
  createGalleryRoute,
  updateGalleryRoute,
  deleteGalleryRoute,
  type gallerySchema,
} from "@shared/routes/galleries";
import { AppEnv, ensureAdmin, getDb, logAuditAction } from "../../middleware";
import { eq } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";

export const galleriesRouter = new OpenAPIHono<AppEnv>();

// Protections
galleriesRouter.use("/admin/*", ensureAdmin);
galleriesRouter.use("/admin", ensureAdmin);

const serializeGallery = (g: typeof schema.galleries.$inferSelect): z.infer<typeof gallerySchema> => ({
  id: g.id,
  title: g.title,
  description: g.description ?? null,
  googlePhotosUrl: g.googlePhotosUrl ?? null,
  heroImageKey: g.heroImageKey ?? null,
  heroImageUrl: g.heroImageKey ? `/api/media/${g.heroImageKey}` : null,
  createdAt: g.createdAt ?? new Date().toISOString(),
  updatedAt: g.updatedAt ?? new Date().toISOString(),
});

// GET /galleries - List all galleries (public)
export const finalGalleriesRouter = galleriesRouter.openapi(listGalleriesRoute, async (c) => {
  const db = getDb(c);
  const results = await db.select().from(schema.galleries).orderBy(schema.galleries.createdAt).execute();

  const galleries = results.map(serializeGallery);

  return c.json({ galleries }, 200);
})

// GET /galleries/:id - Get a single gallery (public)
.openapi(getGalleryRoute, async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c);

  const result = await db.select().from(schema.galleries).where(eq(schema.galleries.id, id)).execute();

  if (result.length === 0) {
    throw new ApiError("Gallery not found", 404, "NOT_FOUND");
  }

  return c.json({ gallery: serializeGallery(result[0]) }, 200);
})

// POST /galleries/admin - Create a gallery (admin only)
.openapi(createGalleryRoute, async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);

  const id = `gal_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`;

  const newGallery = {
    id,
    title: body.title,
    description: body.description ?? null,
    googlePhotosUrl: body.googlePhotosUrl ?? null,
    heroImageKey: body.heroImageKey ?? null,
  };

  await db.insert(schema.galleries).values(newGallery).execute();

  if (c.executionCtx) {
    c.executionCtx.waitUntil(logAuditAction(c, "gallery_create", "gallery", id, `Created gallery: ${body.title}`));
  }

  const result = await db.select().from(schema.galleries).where(eq(schema.galleries.id, id)).execute();

  return c.json({ gallery: serializeGallery(result[0]) }, 200);
})

// PUT /galleries/admin/:id - Update a gallery (admin only)
.openapi(updateGalleryRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const db = getDb(c);

  const existing = await db.select().from(schema.galleries).where(eq(schema.galleries.id, id)).execute();

  if (existing.length === 0) {
    throw new ApiError("Gallery not found", 404, "NOT_FOUND");
  }

  const updates: Record<string, unknown> = {
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description ?? null }),
    ...(body.googlePhotosUrl !== undefined && { googlePhotosUrl: body.googlePhotosUrl ?? null }),
    ...(body.heroImageKey !== undefined && { heroImageKey: body.heroImageKey ?? null }),
    updatedAt: new Date().toISOString(),
  };

  await db.update(schema.galleries).set(updates).where(eq(schema.galleries.id, id)).execute();

  if (c.executionCtx) {
    c.executionCtx.waitUntil(logAuditAction(c, "gallery_update", "gallery", id, `Updated gallery: ${body.title || existing[0].title}`));
  }

  const result = await db.select().from(schema.galleries).where(eq(schema.galleries.id, id)).execute();

  return c.json({ gallery: serializeGallery(result[0]) }, 200);
})

// DELETE /galleries/admin/:id - Delete a gallery (admin only)
.openapi(deleteGalleryRoute, async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c);

  const existing = await db.select().from(schema.galleries).where(eq(schema.galleries.id, id)).execute();

  if (existing.length === 0) {
    throw new ApiError("Gallery not found", 404, "NOT_FOUND");
  }

  await db.delete(schema.galleries).where(eq(schema.galleries.id, id)).execute();

  if (c.executionCtx) {
    c.executionCtx.waitUntil(logAuditAction(c, "gallery_delete", "gallery", id, `Deleted gallery: ${existing[0].title}`));
  }

  return c.json({ success: true }, 200);
});

export default finalGalleriesRouter;
