import { z } from "zod";
import { OpenAPIHono } from "@hono/zod-openapi";
import { ApiError } from "../../middleware/errorHandler";
import {
  listGalleriesRoute,
  getGalleryRoute,
  createGalleryRoute,
  updateGalleryRoute,
  deleteGalleryRoute,
  getGalleryMediaRoute,
  type gallerySchema,
} from "@shared/routes/galleries";
import { AppEnv, ensureAdmin, getDb, audit } from "../../middleware";
import { eq } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { findOneById, insertAndFetch, updateAndFetch } from "../../../../src/db/query-helpers";

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
  const gallery = await findOneById(db, schema.galleries, id, "Gallery not found");

  return c.json({ gallery: serializeGallery(gallery) }, 200);
})

// GET /galleries/:id/media - Get all media for a specific gallery
.openapi(getGalleryMediaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c);

  const existing = await db.select().from(schema.galleries).where(eq(schema.galleries.id, id)).execute();
  if (existing.length === 0) {
    throw new ApiError("Gallery not found", 404, "NOT_FOUND");
  }

  // Get all media tags for this gallery ID
  const tags = await db
    .select({
      key: schema.mediaTags.key,
      folder: schema.mediaTags.folder,
      tags: schema.mediaTags.tags
    })
    .from(schema.mediaTags)
    .where(eq(schema.mediaTags.folder, id))
    .execute();

  const publicKeys = new Set(tags.map(t => t.key));

  const objects = await c.env.ARES_STORAGE.list();

  const media = objects.objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((obj: any) => publicKeys.has(obj.key))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((obj: any) => {
      const tagInfo = tags.find(t => t.key === obj.key);
      return {
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
        httpEtag: obj.httpEtag,
        url: `/api/media/${obj.key}`,
        folder: tagInfo?.folder ?? null,
        tags: tagInfo?.tags ?? null,
      };
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime());

  return c.json({ media }, 200);
})

// POST /galleries/admin - Create a gallery (admin only)
.openapi(createGalleryRoute, async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);

  const gallery = await insertAndFetch(db, schema.galleries, {
    title: body.title,
    description: body.description ?? null,
    googlePhotosUrl: body.googlePhotosUrl ?? null,
    heroImageKey: body.heroImageKey ?? null,
  }, "gal_");

  audit(c, "gallery_create", "gallery", gallery.id, `Created gallery: ${body.title}`);

  return c.json({ gallery: serializeGallery(gallery) }, 200);
})

// PUT /galleries/admin/:id - Update a gallery (admin only)
.openapi(updateGalleryRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const db = getDb(c);

  const updates: Record<string, unknown> = {
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description ?? null }),
    ...(body.googlePhotosUrl !== undefined && { googlePhotosUrl: body.googlePhotosUrl ?? null }),
    ...(body.heroImageKey !== undefined && { heroImageKey: body.heroImageKey ?? null }),
    updatedAt: new Date().toISOString(),
  };

  const gallery = await updateAndFetch(db, schema.galleries, id, updates);

  audit(c, "gallery_update", "gallery", id, `Updated gallery: ${body.title || gallery.title}`);

  return c.json({ gallery: serializeGallery(gallery) }, 200);
})

// DELETE /galleries/admin/:id - Delete a gallery (admin only)
.openapi(deleteGalleryRoute, async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c);

  const existing = await findOneById(db, schema.galleries, id, "Gallery not found");

  await db.delete(schema.galleries).where(eq(schema.galleries.id, id)).execute();
  audit(c, "gallery_delete", "gallery", id, `Deleted gallery: ${existing.title}`);

  return c.json({ success: true }, 200);
});

export default finalGalleriesRouter;
