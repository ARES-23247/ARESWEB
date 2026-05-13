/* eslint-disable @typescript-eslint/no-explicit-any -- Drizzle .values() type mismatches; tracked as P3 tech debt */
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppEnv } from "../../middleware/utils";
import { ensureAdmin, getDb } from "../../middleware";
import { getSessionUser } from "../../middleware/auth";
import { getPhotosAccessToken } from "../../../utils/googleAuth";
import { ApiError } from "../../middleware/errorHandler";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  listMediaRoute,
  listAlbumsRoute,
  importPhotosRoute,
} from "../../../../shared/routes/google-photos";
import * as schema from "../../../../src/db/schema";
import {
  validateImageMagicBytes,
  downloadPhoto,
  uploadToR2,
  sanitizeAlbumName,
} from "../../../utils/imageImport";

// Health check response schema
const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("google-photos"),
  authenticated: z.boolean(),
  test: z.string(),
});

// Health check route definition
const healthRoute = createRoute({
  method: "get",
  path: "/health",
  summary: "Check Google Photos API health",
  description: "Verifies that the Google Photos API is accessible and authentication is working.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: healthResponseSchema,
        },
      },
      description: "Health check successful",
    },
    401: {
      description: "Unauthorized - Admin access required",
    },
    500: {
      description: "Internal server error - API call failed",
    },
  },
});

// Media route definition (implemented in Phase 75-02)
// Media items route uses listMediaRoute from shared contracts
const mediaRoute = listMediaRoute;

// Albums route definition (to be implemented in Phase 75-03)
const albumsRoute = listAlbumsRoute;

// Create the router
const photosApp = new OpenAPIHono<AppEnv>();

// Apply admin middleware to all routes per zero-trust security
// This ensures only authenticated admin users can access Google Photos endpoints
photosApp.use("*", ensureAdmin);

// Health check endpoint
// Tests authentication by making a minimal API call to Google Photos
const app1 = photosApp.openapi(healthRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;

  // Get access token using lazy refresh pattern (with retry logic per D-07)
  const token = await getPhotosAccessToken(db, env);

  // Test Photos API with a minimal search request
  const photosResponse = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pageSize: 1 }),
  });

  // Handle authentication failures from Photos API
  if (photosResponse.status === 401) {
    throw new ApiError("Authentication failed: Invalid or expired token.", 401, "AUTH_FAILURE");
  }

  // Handle other API errors
  if (!photosResponse.ok) {
    const errorText = await photosResponse.text();
    console.error("[google-photos] API health check failed:", errorText);
    throw new ApiError(
      `Google Photos API error: ${photosResponse.status} ${photosResponse.statusText}`,
      500,
      "API_FAILURE"
    );
  }

  // Return success response
  // Per T-73-13: Health endpoint returns only status, not access token
  return c.json(
    {
      status: "ok" as const,
      service: "google-photos" as const,
      authenticated: true,
      test: "API call successful",
    },
    200
  );
});

// Media items endpoint (Phase 75-02)
// Lists Google Photos media items with server-side video filtering
const app2 = app1.openapi(mediaRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;

  // Extract query parameters
  const { albumId, pageToken, pageSize = 25 } = c.req.valid("query");

  // Get access token using lazy refresh pattern (with retry logic per D-07)
  const token = await getPhotosAccessToken(db, env);

  // Build Photos API search request body
  const searchBody: Record<string, unknown> = { pageSize };
  if (albumId) {
    searchBody.albumId = albumId;
  }
  if (pageToken) {
    searchBody.pageToken = pageToken;
  }

  // Call Photos API mediaItems:search endpoint
  const photosResponse = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(searchBody),
  });

  // Handle authentication failures from Photos API
  if (photosResponse.status === 401) {
    throw new ApiError("Authentication failed: Invalid or expired token.", 401, "AUTH_FAILURE");
  }

  // Handle other API errors
  if (!photosResponse.ok) {
    const errorText = await photosResponse.text();
    console.error("[google-photos] Media API search failed:", errorText);
    throw new ApiError(
      `Google Photos API error: ${photosResponse.status} ${photosResponse.statusText}`,
      502,
      "API_FAILURE"
    );
  }

  const photosData = await photosResponse.json() as {
    mediaItems?: Array<{
      id: string;
      filename: string;
      mimeType: string;
      baseUrl: string;
      mediaMetadata?: {
        width?: string;
        height?: string;
        creationTime?: string;
      };
      description?: string;
    }>;
    nextPageToken?: string;
  };

  // Filter server-side to exclude video MIME types per D-01/PHOTO-02
  // Allowed MIME types: image/jpeg, image/png, image/webp, image/gif, image/heic
  // Excluded MIME types: video/mp4, video/quicktime, video/x-msvideo, video/*
  const allowedMimePrefixes = ["image/"];
  const filteredMediaItems = (photosData.mediaItems ?? []).filter(
    (item) => allowedMimePrefixes.some((prefix) => item.mimeType.startsWith(prefix))
  );

  // Transform each media item to match photoMediaItemSchema
  const mediaItems = filteredMediaItems.map((item) => ({
    id: item.id,
    filename: item.filename,
    mimeType: item.mimeType,
    baseUrl: item.baseUrl,
    width: item.mediaMetadata?.width,
    height: item.mediaMetadata?.height,
    creationTime: item.mediaMetadata?.creationTime,
    description: item.description,
  }));

  // Return response with pagination token
  return c.json({
    mediaItems,
    nextPageToken: photosData.nextPageToken,
  }, 200);
});

// Albums endpoint (Phase 75-03)
// Lists Google Photos albums with cover photos and item counts
const app3 = app2.openapi(albumsRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;

  // Extract query parameters
  const { pageToken, pageSize = 25 } = c.req.valid("query");

  // Get access token using lazy refresh pattern (with retry logic per D-07)
  const token = await getPhotosAccessToken(db, env);

  // Build search params for albums API
  const searchParams = new URLSearchParams({
    pageSize: String(pageSize),
  });
  if (pageToken) {
    searchParams.append("pageToken", pageToken);
  }

  // Call Photos API albums:list endpoint
  const photosResponse = await fetch(
    `https://photoslibrary.googleapis.com/v1/albums?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  // Handle authentication failures from Photos API
  if (photosResponse.status === 401) {
    throw new ApiError("Authentication failed: Invalid or expired token.", 401, "AUTH_FAILURE");
  }

  // Handle other API errors
  if (!photosResponse.ok) {
    const errorText = await photosResponse.text();
    console.error("[google-photos] Albums API list failed:", errorText);
    throw new ApiError(
      `Google Photos API error: ${photosResponse.status} ${photosResponse.statusText}`,
      502,
      "API_FAILURE"
    );
  }

  const photosData = await photosResponse.json() as {
    albums?: Array<{
      id: string;
      title: string;
      mediaItemsCount?: string;
      coverPhotoBaseUrl?: string;
    }>;
    nextPageToken?: string;
  };

  // Transform Photos API response to match listAlbumsResponseSchema
  const albums = (photosData.albums ?? []).map((album) => ({
    id: album.id,
    title: album.title,
    mediaItemsCount: album.mediaItemsCount,
    coverPhotoBaseUrl: album.coverPhotoBaseUrl,
  }));

  // Return response with pagination token
  return c.json({
    albums,
    nextPageToken: photosData.nextPageToken,
  }, 200);
});

// Upload endpoint (Phase 75-05)
// Uploads photos to Google Photos using mediaItems:batchCreate endpoint
app3.post("/upload", async (c) => {
  const db = getDb(c);
  const env = c.env;

  // Parse multipart/form-data from request
  const formData = await c.req.formData();

  // Extract metadata fields
  const _title = formData.get("title") as string | null;
  const description = formData.get("description") as string | null;
  const albumId = formData.get("albumId") as string | null;

  // Extract files array from formData
  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "files" && value instanceof File) {
      files.push(value);
    }
  }

  // Validate files exist
  if (files.length === 0) {
    throw new ApiError("No files provided for upload", 400, "NO_FILES");
  }

  // Allowed MIME types per D-01/D-11: images only (no videos)
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
  ];

  // File size limit: 50MB per file
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  // Validate each file type and size
  const invalidFiles: Array<{ filename: string; error: string }> = [];
  for (const file of files) {
    if (!allowedMimeTypes.includes(file.type)) {
      invalidFiles.push({ filename: file.name, error: `Invalid MIME type: ${file.type}` });
    } else if (file.size > MAX_FILE_SIZE) {
      invalidFiles.push({ filename: file.name, error: "File size exceeds 50MB limit" });
    }
  }

  // If any files are invalid, return error with details
  if (invalidFiles.length > 0) {
    throw new ApiError(
      `Invalid files: ${invalidFiles.map((f) => `${f.filename} (${f.error})`).join(", ")}`,
      400,
      "INVALID_FILES"
    );
  }

  // Get access token using lazy refresh pattern
  const token = await getPhotosAccessToken(db, env);

  // Upload each file to Photos API uploads endpoint
  const uploadResults: Array<{
    filename: string;
    uploadToken?: string;
    error?: string;
  }> = [];

  for (const file of files) {
    try {
      // POST to Photos API uploads endpoint
      const uploadResponse = await fetch("https://photoslibrary.googleapis.com/v1/uploads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "X-Goog-Upload-File-Name": file.name,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
      }

      // Parse upload token from response (raw text, not JSON)
      const uploadToken = await uploadResponse.text();
      uploadResults.push({ filename: file.name, uploadToken });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      uploadResults.push({ filename: file.name, error: errorMessage });
    }
  }

  // Filter successful uploads and prepare batchCreate request
  const successfulUploads = uploadResults.filter((r) => r.uploadToken);
  const failures = uploadResults.filter((r) => r.error).map((r) => ({
    filename: r.filename,
    error: r.error ?? "Unknown error",
  }));

  // If all uploads failed, return failures
  if (successfulUploads.length === 0) {
    return c.json(
      {
        uploadedCount: 0,
        failures,
      },
      200
    );
  }

  // Build batchCreate request body
  const newMediaItems = successfulUploads.map((upload) => ({
    description: description ?? "",
    simpleMediaItem: {
      uploadToken: upload.uploadToken!,
      fileName: upload.filename,
    },
  }));

  const batchCreateBody: Record<string, unknown> = {
    newMediaItems,
  };

  if (albumId) {
    batchCreateBody.albumId = albumId;
  }

  // Call Photos API batchCreate endpoint
  const batchCreateResponse = await fetch(
    "https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batchCreateBody),
    }
  );

  if (!batchCreateResponse.ok) {
    const errorText = await batchCreateResponse.text();
    console.error("[google-photos] Batch create failed:", errorText);
    // Return partial success with failures
    return c.json(
      {
        uploadedCount: 0,
        failures: [...failures, { filename: "batch", error: `Batch create failed: ${errorText}` }],
      },
      200
    );
  }

  const batchCreateData = await batchCreateResponse.json() as {
    newMediaItemResults?: Array<{
      uploadToken: string;
      status?: {
        message?: string;
        errors?: Array<{ message: string }>;
      };
    }>;
  };

  // Process batchCreate response for additional failures
  if (batchCreateData.newMediaItemResults) {
    for (const result of batchCreateData.newMediaItemResults) {
      if (result.status?.errors && result.status.errors.length > 0) {
        // Find the filename for this upload token
        const uploadResult = successfulUploads.find((r) => r.uploadToken === result.uploadToken);
        if (uploadResult) {
          failures.push({
            filename: uploadResult.filename,
            error: result.status.errors.map((e) => e.message).join(", "),
          });
        }
      }
    }
  }

  // Return success response
  const uploadedCount = successfulUploads.length - failures.filter(
    (f) => successfulUploads.some((s) => s.filename === f.filename)
  ).length;

  return c.json(
    {
      uploadedCount: Math.max(0, uploadedCount),
      failures: failures.length > 0 ? failures : undefined,
    },
    200
  );
});

// Import endpoint (Phase 76-02)
// Imports selected Google Photos media items to R2 storage
// Per D-22: Accepts mediaItemIds array and optional albumId
// Per IMG-03: Downloads from Photos API with =d suffix
// Per IMG-04: Validates magic bytes before upload
// Per IMG-06: Tracks imports in imported_photos and audit log
// Per D-06: Sequential processing to avoid memory overflow
const app4 = app3.openapi(importPhotosRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;

  // Parse request body
  const { mediaItemIds, albumId } = await c.req.json();

  // Get access token
  const token = await getPhotosAccessToken(db, env);

  // Get user email for audit tracking
  const user = await getSessionUser(c);
  const userEmail = user?.id ?? "unknown";

  // Fetch album details if albumId provided
  let albumName: string | null = null;
  let albumRecord: { id: string; googleAlbumId: string; name: string; r2Folder: string; syncedAt: string } | null = null;

  if (albumId) {
    // Fetch album details from Google Photos API
    const albumResponse = await fetch(
      `https://photoslibrary.googleapis.com/v1/albums/${albumId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (albumResponse.ok) {
      const albumData = await albumResponse.json() as {
        id: string;
        title: string;
        mediaItemsCount?: string;
      };

      albumName = albumData.title;
      const sanitizedFolder = sanitizeAlbumName(albumName);
      const now = new Date().toISOString();

      // Check if album already exists in D1
      const existingAlbum = await db
        .select({
          id: schema.photoAlbums.id,
          googleAlbumId: schema.photoAlbums.googleAlbumId,
          name: schema.photoAlbums.name,
          r2Folder: schema.photoAlbums.r2Folder,
          syncedAt: schema.photoAlbums.syncedAt,
        })
        .from(schema.photoAlbums)
        .where(eq(schema.photoAlbums.googleAlbumId, albumId))
        .get();

      if (existingAlbum) {
        albumRecord = existingAlbum;
      } else {
        // Create new album record
        const albumId_uuid = crypto.randomUUID();
        await db
          .insert(schema.photoAlbums)
          .values({
            id: albumId_uuid,
            googleAlbumId: albumId,
            name: albumName,
            r2Folder: sanitizedFolder,
            syncedAt: now,
            mediaItemsCount: albumData.mediaItemsCount ?? null,
          } as any)
          .run();

        albumRecord = {
          id: albumId_uuid,
          googleAlbumId: albumId,
          name: albumName,
          r2Folder: sanitizedFolder,
          syncedAt: now,
        };
      }
    }
  }

  // Results tracking
  const results: Array<{
    mediaItemId: string;
    status: "success" | "failed";
    r2Key?: string;
    error?: string;
    filename: string;
  }> = [];

  // Per D-06: Sequential processing to avoid memory overflow
  for (const mediaItemId of mediaItemIds) {
    try {
      // Fetch media item details from Google Photos API
      const mediaResponse = await fetch(
        `https://photoslibrary.googleapis.com/v1/mediaItems/${mediaItemId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!mediaResponse.ok) {
        results.push({
          mediaItemId,
          status: "failed",
          filename: "unknown",
          error: `Failed to fetch media item: ${mediaResponse.status}`,
        });

        // Log failure to audit log
        await db
          .insert(schema.importAuditLog)
          .values({
            id: crypto.randomUUID(),
            mediaItemId,
            filename: "unknown",
            status: "failed",
            error: `Failed to fetch media item: ${mediaResponse.status}`,
            importedBy: userEmail,
            importedAt: new Date().toISOString(),
          } as any)
          .run();

        continue;
      }

      const mediaData = await mediaResponse.json() as {
        id: string;
        filename: string;
        mimeType: string;
        baseUrl: string;
      };

      const { filename, mimeType, baseUrl } = mediaData;

      // Download photo from Google Photos (Per IMG-03: =d for full resolution)
      const buffer = await downloadPhoto(baseUrl, token);

      // Validate magic bytes (Per IMG-04)
      const validation = validateImageMagicBytes(buffer);
      if (!validation.valid) {
        results.push({
          mediaItemId,
          status: "failed",
          filename,
          error: validation.error ?? "Invalid image format",
        });

        // Log failure to audit log
        await db
          .insert(schema.importAuditLog)
          .values({
            id: crypto.randomUUID(),
            mediaItemId,
            filename,
            status: "failed",
            error: validation.error ?? "Invalid image format",
            importedBy: userEmail,
            importedAt: new Date().toISOString(),
          } as any)
          .run();

        continue;
      }

      // Upload to R2
      const r2Key = await uploadToR2(buffer, filename, mimeType, albumName ?? null, env as any);

      // Record in imported_photos table (Per IMG-06)
      await db
        .insert(schema.importedPhotos)
        .values({
          id: crypto.randomUUID(),
          r2Key,
          originalFilename: filename,
          googleMediaItemId: mediaItemId,
          albumId: albumRecord?.id ?? null,
          importedBy: userEmail,
          importedAt: new Date().toISOString(),
          mimeType,
          fileSize: String(buffer.byteLength),
        } as any)
        .run();

      // Log success to audit log (Per D-16/D-17)
      await db
        .insert(schema.importAuditLog)
        .values({
          id: crypto.randomUUID(),
          mediaItemId,
          filename,
          status: "success",
          r2Key,
          importedBy: userEmail,
          importedAt: new Date().toISOString(),
        } as any)
        .run();

      results.push({
        mediaItemId,
        status: "success",
        filename,
        r2Key,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.push({
        mediaItemId,
        status: "failed",
        filename: "unknown",
        error: errorMessage,
      });

      // Log failure to audit log
      await db
        .insert(schema.importAuditLog)
        .values({
          id: crypto.randomUUID(),
          mediaItemId,
          filename: "unknown",
          status: "failed",
          error: errorMessage,
          importedBy: userEmail,
          importedAt: new Date().toISOString(),
        } as any)
        .run();
    }
  }

  // Calculate counts
  const imported = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return c.json(
    {
      imported,
      failed,
      results,
    } as any,
    200
  );
});

// Export the router for registration in the main app
export const photosRouter = app4;
export default photosRouter;
