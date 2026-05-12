import { z } from "zod";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  listGalleriesRoute,
  getGalleryRoute,
  createGalleryRoute,
  updateGalleryRoute,
  deleteGalleryRoute,
  getGalleryMediaRoute,
  type gallerySchema,
} from "@shared/routes/galleries";
import { AppEnv, ensureAdmin } from "../../middleware";
import { eq } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { findOne, findMany, insertOne, updateOne, deleteOneAndReturn, logAudit } from "../../utils/drizzle-helpers";

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
  const galleries = await findMany(c, schema.galleries, {
    orderBy: schema.galleries.createdAt,
  });

  return c.json({ galleries: galleries.map(serializeGallery) }, 200);
})

// GET /galleries/:id - Get a single gallery (public)
.openapi(getGalleryRoute, async (c) => {
  const { id } = c.req.valid("param");
  const gallery = await findOne(c, schema.galleries, id);

  return c.json({ gallery: serializeGallery(gallery) }, 200);
})

// GET /galleries/:id/media - Get all media for a specific gallery
.openapi(getGalleryMediaRoute, async (c) => {
  const { id } = c.req.valid("param");

  // Verify gallery exists
  await findOne(c, schema.galleries, id);

  // Get all media tags for this gallery ID
  const tags = await findMany(c, schema.mediaTags, {
    where: eq(schema.mediaTags.folder, id),
  });

  const publicKeys = new Set(tags.map((t) => t.key));

  const objects = await c.env.ARES_STORAGE.list();

  const media = objects.objects
    .filter((obj: any) => publicKeys.has(obj.key))
    .map((obj: any) => {
      const tagInfo = tags.find((t) => t.key === obj.key);
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
    .sort((a: any, b: any) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime());

  return c.json({ media }, 200);
})

// POST /galleries/admin - Create a gallery (admin only)
.openapi(createGalleryRoute, async (c) => {
  const body = c.req.valid("json");

  const gallery = await insertOne(c, schema.galleries, {
    title: body.title,
    description: body.description ?? null,
    googlePhotosUrl: body.googlePhotosUrl ?? null,
    heroImageKey: body.heroImageKey ?? null,
  }, { idPrefix: "gal_" });

  logAudit(c, "gallery_create", "gallery", gallery.id, `Created gallery: ${body.title}`);

  return c.json({ gallery: serializeGallery(gallery) }, 200);
})

// PUT /galleries/admin/:id - Update a gallery (admin only)
.openapi(updateGalleryRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const updates: Record<string, unknown> = {
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description ?? null }),
    ...(body.googlePhotosUrl !== undefined && { googlePhotosUrl: body.googlePhotosUrl ?? null }),
    ...(body.heroImageKey !== undefined && { heroImageKey: body.heroImageKey ?? null }),
    updatedAt: new Date().toISOString(),
  };

  const gallery = await updateOne(c, schema.galleries, id, updates);

  logAudit(c, "gallery_update", "gallery", id, `Updated gallery: ${body.title || gallery.title}`);

  return c.json({ gallery: serializeGallery(gallery) }, 200);
})

// DELETE /galleries/admin/:id - Delete a gallery (admin only)
.openapi(deleteGalleryRoute, async (c) => {
  const { id } = c.req.valid("param");

  const gallery = await deleteOneAndReturn(c, schema.galleries, id);

  logAudit(c, "gallery_delete", "gallery", id, `Deleted gallery: ${gallery.title}`);

  return c.json({ success: true }, 200);
});

export default finalGalleriesRouter;
