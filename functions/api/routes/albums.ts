import { OpenAPIHono } from "@hono/zod-openapi";
import { eq, desc, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, ensureAdmin, getDb } from "../middleware";
import { 
  getAlbumsRoute, 
  getAlbumRoute, 
  createAlbumRoute, 
  updateAlbumRoute, 
  deleteAlbumRoute, 
  addAlbumMediaRoute, 
  removeAlbumMediaRoute, 
  reorderAlbumMediaRoute 
} from "../../../shared/routes/albums";
import { ApiError } from "../middleware/errorHandler";

const serializeAlbum = (a: typeof schema.albums.$inferSelect) => ({
  id: a.id,
  title: a.title,
  description: a.description ?? null,
  coverImageId: a.coverImageId ?? null,
  displayMode: (a.displayMode as "masonry" | "moving") ?? "masonry",
  isDeleted: a.isDeleted ?? 0,
  createdAt: a.createdAt ?? new Date().toISOString(),
  updatedAt: a.updatedAt ?? new Date().toISOString(),
  createdBy: a.createdBy,
});

export const albumsRouter = new OpenAPIHono<AppEnv>()
.openapi(getAlbumsRoute, async (c) => {
  const db = getDb(c);
  const allAlbums = await db.select().from(schema.albums).where(eq(schema.albums.isDeleted, 0)).orderBy(desc(schema.albums.createdAt)).execute();
  return c.json({ albums: allAlbums.map(serializeAlbum) }, 200);
})
.openapi(getAlbumRoute, async (c) => {
  const db = getDb(c);
  const { id } = c.req.valid("param");
  
  const albumRecords = await db.select().from(schema.albums).where(and(eq(schema.albums.id, id), eq(schema.albums.isDeleted, 0))).execute();
  const albumRecord = albumRecords[0];

  if (!albumRecord) {
    throw new ApiError("Album not found", 404, "ALBUM_NOT_FOUND");
  }

  const mediaRecords = await db
    .select({
      id: schema.albumMedia.mediaId,
      sortOrder: schema.albumMedia.sortOrder,
      photo: schema.importedPhotos,
    })
    .from(schema.albumMedia)
    .leftJoin(schema.importedPhotos, eq(schema.albumMedia.mediaId, schema.importedPhotos.r2Key))
    .where(eq(schema.albumMedia.albumId, id))
    .orderBy(schema.albumMedia.sortOrder)
    .execute();

  return c.json({
    album: {
      ...serializeAlbum(albumRecord),
      media: mediaRecords.map(m => ({
        id: m.id,
        sortOrder: m.sortOrder ?? 0,
        photo: {
          id: m.photo?.id ?? m.id,
          r2Key: m.id,
          filename: m.photo?.originalFilename ?? m.id.split('/').pop() ?? null,
          mimeType: m.photo?.mimeType ?? "image/jpeg",
          createdAt: m.photo?.importedAt ?? new Date().toISOString()
        }
      })),
    }
  }, 200);
})
// NOTE: Admin routes should technically use a separate middleware or path prefix, 
// but we'll enforce ensureAdmin inline for these specific openapi definitions
.openapi(createAlbumRoute, async (c) => {
  await ensureAdmin(c, async () => {});
  const db = getDb(c);
  const body = c.req.valid("json");
  const id = crypto.randomUUID();

  await db.insert(schema.albums).values({
    id,
    title: body.title,
    description: body.description ?? null,
    coverImageId: body.coverImageId ?? null,
    displayMode: body.displayMode ?? "masonry",
    createdBy: c.get("sessionUser")?.id ?? "unknown",
  }).execute();

  return c.json({ success: true, id }, 200);
})
.openapi(updateAlbumRoute, async (c) => {
  await ensureAdmin(c, async () => {});
  const db = getDb(c);
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  await db.update(schema.albums).set({
    title: body.title,
    description: body.description,
    coverImageId: body.coverImageId,
    displayMode: body.displayMode,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.albums.id, id)).execute();

  return c.json({ success: true }, 200);
})
.openapi(deleteAlbumRoute, async (c) => {
  await ensureAdmin(c, async () => {});
  const db = getDb(c);
  const { id } = c.req.valid("param");

  await db.update(schema.albums).set({
    isDeleted: 1,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.albums.id, id)).execute();

  return c.json({ success: true }, 200);
})
.openapi(addAlbumMediaRoute, async (c) => {
  await ensureAdmin(c, async () => {});
  const db = getDb(c);
  const { id } = c.req.valid("param");
  const { mediaIds } = c.req.valid("json");

  const existingMedia = await db.select({ sortOrder: schema.albumMedia.sortOrder })
    .from(schema.albumMedia)
    .where(eq(schema.albumMedia.albumId, id))
    .orderBy(desc(schema.albumMedia.sortOrder))
    .limit(1)
    .execute();
  
  let nextSortOrder = existingMedia.length > 0 ? (existingMedia[0].sortOrder ?? 0) + 1 : 0;

  const values = mediaIds.map((mediaId: string) => ({
    albumId: id,
    mediaId,
    sortOrder: nextSortOrder++,
  }));

  if (values.length > 0) {
    await db.insert(schema.albumMedia).values(values).onConflictDoNothing().execute();
  }

  return c.json({ success: true, added: values.length }, 200);
})
.openapi(removeAlbumMediaRoute, async (c) => {
  await ensureAdmin(c, async () => {});
  const db = getDb(c);
  const { id, mediaId } = c.req.valid("param");

  await db.delete(schema.albumMedia).where(
    and(
      eq(schema.albumMedia.albumId, id),
      eq(schema.albumMedia.mediaId, mediaId)
    )
  ).execute();

  return c.json({ success: true }, 200);
})
.openapi(reorderAlbumMediaRoute, async (c) => {
  await ensureAdmin(c, async () => {});
  const db = getDb(c);
  const { id } = c.req.valid("param");
  const { mediaIds } = c.req.valid("json");

  const statements = mediaIds.map((mediaId: string, index: number) => {
    return db.update(schema.albumMedia)
      .set({ sortOrder: index })
      .where(and(eq(schema.albumMedia.albumId, id), eq(schema.albumMedia.mediaId, mediaId)));
  });

  if (statements.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.batch(statements as any);
  }

  return c.json({ success: true }, 200);
});
