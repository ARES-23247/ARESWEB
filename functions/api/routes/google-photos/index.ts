/* eslint-disable @typescript-eslint/no-explicit-any -- Drizzle .values() type mismatches; tracked as P3 tech debt */
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppEnv } from "../../middleware/utils";
import { ensureAdmin, getDb } from "../../middleware";
import { getSessionUser } from "../../middleware/auth";
import { getUnifiedOAuthToken, clearCachedOAuthToken } from "../../../utils/googleAuth";
import { ApiError } from "../../middleware/errorHandler";
import { z } from "zod";
import {
  createPickerSessionRoute,
  createVideoPickerSessionRoute,
  getPickerSessionRoute,
  getPickerItemsRoute,
  deletePickerSessionRoute,
  importPhotosRoute,
  uploadGooglePhotosToYoutubeRoute,
} from "../../../../shared/routes/google-photos";
import * as schema from "../../../../src/db/schema";
import {
  validateImageMagicBytes,
  downloadPhoto,
  uploadToR2,
} from "../../../utils/imageImport";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PICKER_API_BASE = "https://photospicker.googleapis.com/v1";

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────

const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("google-photos-picker"),
  authenticated: z.boolean(),
  test: z.string(),
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  summary: "Check Google Photos Picker API health",
  description: "Verifies that the Picker API is accessible and authentication is working.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: healthResponseSchema,
        },
      },
      description: "Health check successful",
    },
    401: { description: "Unauthorized - Admin access required" },
    500: { description: "Internal server error - API call failed" },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER SETUP
// ─────────────────────────────────────────────────────────────────────────────

const photosApp = new OpenAPIHono<AppEnv>();
photosApp.use("*", ensureAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────

const app1 = photosApp.openapi(healthRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;

  let token = await getUnifiedOAuthToken(env, db);

  // Test Picker API by creating and immediately deleting a session
  let testResponse = await fetch(`${PICKER_API_BASE}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        include: ["PHOTO"]  // Only show photos, exclude videos
      }
    }),
  });

  // Retry on 403 with force refresh
  if (testResponse.status === 403) {
    console.warn("[google-photos] Health check got 403 — force-refreshing token...");
    await clearCachedOAuthToken(db);
    token = await getUnifiedOAuthToken(env, db, { forceRefresh: true });
    testResponse = await fetch(`${PICKER_API_BASE}/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          include: ["PHOTO"]  // Only show photos, exclude videos
        }
      }),
    });
  }

  if (testResponse.status === 401) {
    throw new ApiError("Authentication failed: Invalid or expired token.", 401, "AUTH_FAILURE");
  }

  if (!testResponse.ok) {
    const errorText = await testResponse.text();
    console.error("[google-photos] Picker health check failed:", { status: testResponse.status, body: errorText });

    // Include token scope diagnostic info
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`);
    const tokenScopes = tokenInfoRes.ok
      ? (await tokenInfoRes.json() as { scope?: string }).scope ?? "unknown"
      : "unable to introspect";

    throw new ApiError(
      `Picker API ${testResponse.status}. Token scopes: [${tokenScopes}]. Google said: ${errorText.substring(0, 200)}`,
      500,
      "API_FAILURE"
    );
  }

  // Clean up the test session
  const sessionData = await testResponse.json() as { id?: string };
  if (sessionData.id) {
    // Fire and forget cleanup
    fetch(`${PICKER_API_BASE}/sessions/${sessionData.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => { /* ignore cleanup errors */ });
  }

  return c.json(
    {
      status: "ok" as const,
      service: "google-photos-picker" as const,
      authenticated: true,
      test: "Picker API session created successfully",
    },
    200
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /picker/session — Create Picker session
// ─────────────────────────────────────────────────────────────────────────────

const app2 = app1.openapi(createPickerSessionRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;

  const token = await getUnifiedOAuthToken(env, db);

  const response = await fetch(`${PICKER_API_BASE}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        include: ["PHOTO"]  // Only show photos, exclude videos
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[google-photos] Create picker session failed:", errorText);
    throw new ApiError(
      `Picker API error: ${response.status} ${response.statusText}`,
      response.status,
      "PICKER_SESSION_CREATE_FAILED"
    );
  }

  const session = await response.json() as {
    id: string;
    pickerUri: string;
    mediaItemsSet: boolean;
    pollingConfig?: {
      pollInterval?: string;
      timeoutIn?: string;
    };
  };

  return c.json({
    id: session.id,
    pickerUri: session.pickerUri,
    mediaItemsSet: session.mediaItemsSet ?? false,
    pollingConfig: session.pollingConfig,
  }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /picker/video-session — Create video-only Picker session for YouTube
// ─────────────────────────────────────────────────────────────────────────────

const app2v = app2.openapi(createVideoPickerSessionRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;

  const token = await getUnifiedOAuthToken(env, db);

  const response = await fetch(`${PICKER_API_BASE}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        include: ["VIDEO"]  // Only show videos, exclude photos
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[google-photos] Create video picker session failed:", errorText);
    throw new ApiError(
      `Picker API error: ${response.status} ${response.statusText}`,
      response.status,
      "VIDEO_PICKER_SESSION_CREATE_FAILED"
    );
  }

  const session = await response.json() as {
    id: string;
    pickerUri: string;
    mediaItemsSet: boolean;
    pollingConfig?: {
      pollInterval?: string;
      timeoutIn?: string;
    };
  };

  return c.json({
    id: session.id,
    pickerUri: session.pickerUri,
    mediaItemsSet: session.mediaItemsSet ?? false,
    pollingConfig: session.pollingConfig,
  }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /picker/session/:sessionId — Poll session status
// ─────────────────────────────────────────────────────────────────────────────

const app3 = app2v.openapi(getPickerSessionRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;
  const { sessionId } = c.req.valid("param");

  const token = await getUnifiedOAuthToken(env, db);

  const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[google-photos] Poll picker session failed:", errorText);
    throw new ApiError(
      `Picker API error: ${response.status} ${response.statusText}`,
      response.status,
      "PICKER_SESSION_POLL_FAILED"
    );
  }

  const session = await response.json() as {
    id: string;
    pickerUri: string;
    mediaItemsSet: boolean;
    pollingConfig?: {
      pollInterval?: string;
      timeoutIn?: string;
    };
  };

  return c.json({
    id: session.id,
    pickerUri: session.pickerUri,
    mediaItemsSet: session.mediaItemsSet ?? false,
    pollingConfig: session.pollingConfig,
  }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /picker/session/:sessionId/items — Get selected media items
// ─────────────────────────────────────────────────────────────────────────────

const app4 = app3.openapi(getPickerItemsRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;
  const { sessionId } = c.req.valid("param");

  const token = await getUnifiedOAuthToken(env, db);

  const response = await fetch(`${PICKER_API_BASE}/mediaItems?sessionId=${sessionId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[google-photos] Get picker items failed:", errorText);
    throw new ApiError(
      `Picker API error: ${response.status} ${response.statusText}`,
      response.status,
      "PICKER_ITEMS_FAILED"
    );
  }

  const data = await response.json() as {
    mediaItems?: Array<{
      id: string;
      baseUrl: string;
      mimeType: string;
      mediaFile?: {
        filename?: string;
        fileSize?: string;
        mediaFileMetadata?: {
          width?: string;
          height?: string;
          cameraMake?: string;
          cameraModel?: string;
        };
      };
    }>;
  };

  return c.json({
    mediaItems: (data.mediaItems ?? []).map((item) => ({
      id: item.id,
      baseUrl: item.baseUrl,
      mimeType: item.mimeType,
      mediaFile: item.mediaFile,
    })),
  }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /picker/session/:sessionId — Delete session
// ─────────────────────────────────────────────────────────────────────────────

const app5 = app4.openapi(deletePickerSessionRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;
  const { sessionId } = c.req.valid("param");

  const token = await getUnifiedOAuthToken(env, db);

  const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // 404 is acceptable (session already expired)
  if (!response.ok && response.status !== 404) {
    console.warn("[google-photos] Delete picker session failed:", response.status);
  }

  return c.json({ success: true }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /upload — Upload to Google Photos (unchanged, uses appendonly)
// ─────────────────────────────────────────────────────────────────────────────

app5.post("/upload", async (c) => {
  const db = getDb(c);
  const env = c.env;

  const formData = await c.req.formData();
  const _title = formData.get("title") as string | null;
  const description = formData.get("description") as string | null;
  const albumId = formData.get("albumId") as string | null;

  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "files" && value instanceof File) {
      files.push(value);
    }
  }

  if (files.length === 0) {
    throw new ApiError("No files provided for upload", 400, "NO_FILES");
  }

  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  const invalidFiles: Array<{ filename: string; error: string }> = [];
  for (const file of files) {
    if (!allowedMimeTypes.includes(file.type)) {
      invalidFiles.push({ filename: file.name, error: `Invalid MIME type: ${file.type}` });
    } else if (file.size > MAX_FILE_SIZE) {
      invalidFiles.push({ filename: file.name, error: "File size exceeds 50MB limit" });
    }
  }

  if (invalidFiles.length > 0) {
    throw new ApiError(
      `Invalid files: ${invalidFiles.map((f) => `${f.filename} (${f.error})`).join(", ")}`,
      400,
      "INVALID_FILES"
    );
  }

  const token = await getUnifiedOAuthToken(env, db);

  const uploadResults: Array<{ filename: string; uploadToken?: string; error?: string }> = [];

  for (const file of files) {
    try {
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

      const uploadToken = await uploadResponse.text();
      uploadResults.push({ filename: file.name, uploadToken });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      uploadResults.push({ filename: file.name, error: errorMessage });
    }
  }

  const successfulUploads = uploadResults.filter((r) => r.uploadToken);
  const failures = uploadResults.filter((r) => r.error).map((r) => ({
    filename: r.filename,
    error: r.error ?? "Unknown error",
  }));

  if (successfulUploads.length === 0) {
    return c.json({ uploadedCount: 0, failures }, 200);
  }

  const newMediaItems = successfulUploads.map((upload) => ({
    description: description ?? "",
    simpleMediaItem: {
      uploadToken: upload.uploadToken!,
      fileName: upload.filename,
    },
  }));

  const batchCreateBody: Record<string, unknown> = { newMediaItems };
  if (albumId) {
    batchCreateBody.albumId = albumId;
  }

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
    return c.json({
      uploadedCount: 0,
      failures: [...failures, { filename: "batch", error: `Batch create failed: ${errorText}` }],
    }, 200);
  }

  const batchCreateData = await batchCreateResponse.json() as {
    newMediaItemResults?: Array<{
      uploadToken: string;
      status?: { message?: string; errors?: Array<{ message: string }> };
    }>;
  };

  if (batchCreateData.newMediaItemResults) {
    for (const result of batchCreateData.newMediaItemResults) {
      if (result.status?.errors && result.status.errors.length > 0) {
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

  const uploadedCount = successfulUploads.length - failures.filter(
    (f) => successfulUploads.some((s) => s.filename === f.filename)
  ).length;

  return c.json({
    uploadedCount: Math.max(0, uploadedCount),
    failures: failures.length > 0 ? failures : undefined,
  }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /import — Import picked photos to R2
// Updated to accept Picker items with baseUrls directly
// ─────────────────────────────────────────────────────────────────────────────

const app6 = app5.openapi(importPhotosRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;

  const { items } = await c.req.json();

  const token = await getUnifiedOAuthToken(env, db);
  const user = await getSessionUser(c);
  const userEmail = user?.id ?? "unknown";

  const results: Array<{
    mediaItemId: string;
    status: "success" | "failed";
    r2Key?: string;
    error?: string;
    filename: string;
  }> = [];

  // Sequential processing to avoid memory overflow
  for (const item of items) {
    const filename = item.filename ?? `photo-${item.id}.jpg`;
    const mimeType = item.mimeType ?? "image/jpeg";

    try {
      // Download photo from Picker baseUrl (append =d for full resolution)
      const buffer = await downloadPhoto(item.baseUrl, token);

      // Validate magic bytes
      const validation = validateImageMagicBytes(buffer);
      if (!validation.valid) {
        results.push({
          mediaItemId: item.id,
          status: "failed",
          filename,
          error: validation.error ?? "Invalid image format",
        });

        await db.insert(schema.importAuditLog).values({
          id: crypto.randomUUID(),
          mediaItemId: item.id,
          filename,
          status: "failed",
          error: validation.error ?? "Invalid image format",
          importedBy: userEmail,
          importedAt: new Date().toISOString(),
        } as any).run();

        continue;
      }

      // Upload to R2
      const r2Key = await uploadToR2(buffer, filename, mimeType, null, env as any);

      // Record in imported_photos table
      await db.insert(schema.importedPhotos).values({
        id: crypto.randomUUID(),
        r2Key,
        originalFilename: filename,
        googleMediaItemId: item.id,
        albumId: null,
        importedBy: userEmail,
        importedAt: new Date().toISOString(),
        mimeType,
        fileSize: String(buffer.byteLength),
      } as any).run();

      // Log success to audit log
      await db.insert(schema.importAuditLog).values({
        id: crypto.randomUUID(),
        mediaItemId: item.id,
        filename,
        status: "success",
        r2Key,
        importedBy: userEmail,
        importedAt: new Date().toISOString(),
      } as any).run();

      results.push({
        mediaItemId: item.id,
        status: "success",
        filename,
        r2Key,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.push({
        mediaItemId: item.id,
        status: "failed",
        filename,
        error: errorMessage,
      });

      await db.insert(schema.importAuditLog).values({
        id: crypto.randomUUID(),
        mediaItemId: item.id,
        filename,
        status: "failed",
        error: errorMessage,
        importedBy: userEmail,
        importedAt: new Date().toISOString(),
      } as any).run();
    }
  }

  const imported = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return c.json({ imported, failed, results } as any, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /picker/videos-to-youtube — Upload Google Photos videos to YouTube
// ─────────────────────────────────────────────────────────────────────────────

const { handler: uploadGooglePhotosToYoutubeHandler } = await import("./video-upload");

const app7 = app6.openapi(uploadGooglePhotosToYoutubeRoute, uploadGooglePhotosToYoutubeHandler);

// Export the router for registration in the main app
export const photosRouter = app7;
export default photosRouter;
