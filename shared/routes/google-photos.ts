import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS PICKER API SCHEMAS
 * ─────────────────────────────────────────────────────────────────────────────
 * Schemas for Google Photos Picker API session management.
 * Replaces deprecated Library API (photoslibrary.readonly) as of March 2025.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Picker session response schema
 * Returned when creating or polling a Picker session
 */
export const pickerSessionSchema = z.object({
  id: z.string().openapi({
    description: "Picker session ID",
    example: "AKcSession123456",
  }),
  pickerUri: z.string().url().openapi({
    description: "URI to open the Google Photos picker (append /autoclose for web)",
    example: "https://photos.google.com/picker/AKcSession123456",
  }),
  mediaItemsSet: z.boolean().openapi({
    description: "Whether user has finished selecting media items",
    example: false,
  }),
  pollingConfig: z.object({
    pollInterval: z.string().optional().openapi({
      description: "Recommended polling interval (duration string)",
      example: "5s",
    }),
    timeoutIn: z.string().optional().openapi({
      description: "Session timeout duration",
      example: "3600s",
    }),
  }).optional().openapi({
    description: "Polling configuration for session monitoring",
  }),
});

/**
 * Picked media item schema
 * Represents a photo selected by the user in the Picker
 */
export const pickedMediaItemSchema = z.object({
  id: z.string().openapi({
    description: "Media item ID from the Picker API",
    example: "AKcPickerItem789",
  }),
  baseUrl: z.string().url().openapi({
    description: "Base URL for photo access (valid for 60 minutes)",
    example: "https://lh3.googleusercontent.com/pw/abc123",
  }),
  mimeType: z.string().openapi({
    description: "MIME type of the media item",
    example: "image/jpeg",
  }),
  mediaFile: z.object({
    filename: z.string().optional().openapi({
      description: "Original filename",
      example: "IMG_20240115.jpg",
    }),
    fileSize: z.string().optional().openapi({
      description: "File size in bytes",
      example: "2048576",
    }),
    mediaFileMetadata: z.object({
      width: z.string().optional(),
      height: z.string().optional(),
      cameraMake: z.string().optional(),
      cameraModel: z.string().optional(),
    }).optional(),
  }).optional(),
});

/**
 * Response schema for listing picked media items
 */
export const pickerItemsResponseSchema = z.object({
  mediaItems: z.array(pickedMediaItemSchema).openapi({
    description: "Array of media items selected by the user",
  }),
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS UPLOAD SCHEMAS (unchanged — appendonly still works)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Upload failure detail schema
 * Represents a single file upload failure per D-21/D-22
 */
export const uploadFailureSchema = z.object({
  filename: z.string().openapi({
    description: "Name of the file that failed to upload",
    example: "large-photo.jpg",
  }),
  error: z.string().openapi({
    description: "Error message describing why the upload failed",
    example: "File size exceeds 50MB limit",
  }),
});

/**
 * Response schema for photo upload
 * Per UPLOAD-01, UPLOAD-03: Returns success count and per-file failures
 */
export const uploadPhotosResponseSchema = z.object({
  uploadedCount: z.number().openapi({
    description: "Number of photos successfully uploaded",
    example: 3,
  }),
  failures: z.array(uploadFailureSchema).optional().openapi({
    description: "Upload failures per file (D-21/D-22)",
  }),
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS IMPORT SCHEMAS (Phase 76 — works with Picker items too)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Import photos request body schema
 * Now accepts Picker media item IDs and their baseUrls
 */
export const importPhotosQuerySchema = z.object({
  items: z.array(z.object({
    id: z.string().openapi({
      description: "Picker media item ID",
    }),
    baseUrl: z.string().url().openapi({
      description: "Base URL from the Picker API (valid 60min)",
    }),
    filename: z.string().optional().openapi({
      description: "Original filename",
    }),
    mimeType: z.string().optional().openapi({
      description: "MIME type",
    }),
  })).min(1).openapi({
    description: "Picked media items to import to R2",
  }),
});

/**
 * Import result schema for a single media item
 */
export const importResultSchema = z.object({
  mediaItemId: z.string().openapi({
    description: "Picker media item ID",
    example: "AKcPickerItem789",
  }),
  status: z.enum(["success", "failed"]).openapi({
    description: "Import status for this media item",
  }),
  r2Key: z.string().optional().openapi({
    description: "R2 storage key (present on success)",
    example: "photos/imported/robot-match.jpg",
  }),
  error: z.string().optional().openapi({
    description: "Error message (present on failure)",
    example: "Invalid image format",
  }),
  filename: z.string().openapi({
    description: "Original filename",
    example: "robot-match.jpg",
  }),
});

/**
 * Import photos response schema
 */
export const importPhotosResponseSchema = z.object({
  imported: z.number().openapi({
    description: "Count of successfully imported photos",
    example: 5,
  }),
  failed: z.number().openapi({
    description: "Count of failed imports",
    example: 1,
  }),
  results: z.array(importResultSchema).openapi({
    description: "Per-item import results",
  }),
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS API ROUTES
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * POST /picker/session — Create a new Picker session (photos only)
 * Returns pickerUri for the user to open and select photos
 */
export const createPickerSessionRoute = createRoute({
  method: "post",
  path: "/picker/session",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: pickerSessionSchema,
        },
      },
      description: "Picker session created successfully",
    },
  },
  tags: ["google-photos", "admin"],
});

/**
 * POST /picker/video-session — Create a new Picker session for videos only
 * Returns pickerUri for the user to open and select videos for YouTube upload
 */
export const createVideoPickerSessionRoute = createRoute({
  method: "post",
  path: "/picker/video-session",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: pickerSessionSchema,
        },
      },
      description: "Video picker session created successfully",
    },
  },
  tags: ["google-photos", "admin"],
});

/**
 * GET /picker/session/:sessionId — Poll session status
 * Returns current session state including mediaItemsSet flag
 */
export const getPickerSessionRoute = createRoute({
  method: "get",
  path: "/picker/session/{sessionId}",
  request: {
    params: z.object({
      sessionId: z.string().openapi({
        description: "Picker session ID",
        example: "AKcSession123456",
      }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: pickerSessionSchema,
        },
      },
      description: "Current session status",
    },
  },
  tags: ["google-photos", "admin"],
});

/**
 * GET /picker/session/:sessionId/items — Get selected media items
 * Call after mediaItemsSet is true to get the user's selections
 */
export const getPickerItemsRoute = createRoute({
  method: "get",
  path: "/picker/session/{sessionId}/items",
  request: {
    params: z.object({
      sessionId: z.string().openapi({
        description: "Picker session ID",
        example: "AKcSession123456",
      }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: pickerItemsResponseSchema,
        },
      },
      description: "List of selected media items",
    },
  },
  tags: ["google-photos", "admin"],
});

/**
 * DELETE /picker/session/:sessionId — Delete a completed session
 * Cleanup resources after importing selected items
 */
export const deletePickerSessionRoute = createRoute({
  method: "delete",
  path: "/picker/session/{sessionId}",
  request: {
    params: z.object({
      sessionId: z.string().openapi({
        description: "Picker session ID",
        example: "AKcSession123456",
      }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Session deleted",
    },
  },
  tags: ["google-photos", "admin"],
});

/**
 * POST /upload — Upload photos to Google Photos
 * Unchanged — still uses photoslibrary.appendonly scope
 */
export const uploadPhotosRoute = createRoute({
  method: "post",
  path: "/upload",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: uploadPhotosResponseSchema,
        },
      },
      description: "Upload completed with success count and per-file failures",
    },
  },
  tags: ["google-photos", "admin"],
});

/**
 * POST /import — Import picked photos to R2
 * Updated to accept Picker media items with baseUrls
 */
export const importPhotosRoute = createRoute({
  method: "post",
  path: "/import",
  request: {
    body: {
      content: {
        "application/json": {
          schema: importPhotosQuerySchema,
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: importPhotosResponseSchema,
        },
      },
      description: "Import completed with success/failure counts and per-item results",
    },
  },
  tags: ["google-photos", "admin"],
});

/**
 * Request schema for uploading Google Photos videos to YouTube
 */
const googlePhotosToYoutubeSchema = z.object({
  videos: z.array(z.object({
    id: z.string().openapi({ description: "Google Photos media item ID" }),
    baseUrl: z.string().url().openapi({ description: "Base URL for video download (valid for 60 minutes)" }),
    filename: z.string().openapi({ description: "Original filename" }),
    mimeType: z.string().openapi({ description: "MIME type of the video" }),
  })).min(1).openapi({ description: "Videos to upload from Google Photos" }),
  title: z.string().min(1).openapi({ description: "YouTube video title (will be numbered for batch)" }),
  description: z.string().optional().openapi({ description: "YouTube video description" }),
  privacyStatus: z.enum(["public", "unlisted", "private"]).optional().default("private").openapi({
    description: "Privacy status for uploaded videos",
  }),
  mediaType: z.enum(["video", "short"]).optional().default("video").openapi({
    description: "Media type (standard video or YouTube Short)",
  }),
});

/**
 * Response schema for Google Photos to YouTube upload
 */
const googlePhotosToYoutubeResponseSchema = z.object({
  results: z.array(z.object({
    googlePhotosId: z.string().openapi({ description: "Original Google Photos media item ID" }),
    filename: z.string().openapi({ description: "Original filename" }),
    status: z.enum(["success", "failed"]).openapi({ description: "Upload status" }),
    youtubeVideoId: z.string().optional().openapi({ description: "YouTube video ID (on success)" }),
    error: z.string().optional().openapi({ description: "Error message (on failure)" }),
  })).openapi({ description: "Per-video upload results" }),
  summary: z.object({
    total: z.number().openapi({ description: "Total videos processed" }),
    successful: z.number().openapi({ description: "Number of successful uploads" }),
    failed: z.number().openapi({ description: "Number of failed uploads" }),
  }).openapi({ description: "Upload summary" }),
});

/**
 * POST /picker/videos-to-youtube — Upload Google Photos videos to YouTube
 */
export const uploadGooglePhotosToYoutubeRoute = createRoute({
  method: "post",
  path: "/picker/videos-to-youtube",
  request: {
    body: {
      content: {
        "application/json": {
          schema: googlePhotosToYoutubeSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: googlePhotosToYoutubeResponseSchema,
        },
      },
      description: "Videos uploaded successfully with per-video results",
    },
  },
  tags: ["google-photos", "youtube", "admin"],
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS ALBUM API SCHEMAS & ROUTES (Phase 76)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const googleAlbumSchema = z.object({
  id: z.string().openapi({ description: "Google Photos Album ID" }),
  title: z.string().openapi({ description: "Album title" }),
  productUrl: z.string().url().openapi({ description: "Link to view album on Google Photos" }),
  coverPhotoBaseUrl: z.string().url().optional().openapi({ description: "Cover photo URL" }),
  mediaItemsCount: z.string().optional().openapi({ description: "Number of media items" }),
});

export const getAlbumsResponseSchema = z.object({
  albums: z.array(googleAlbumSchema).openapi({ description: "List of albums" }),
  nextPageToken: z.string().optional().openapi({ description: "Token for next page of results" }),
});

export const getAlbumsRoute = createRoute({
  method: "get",
  path: "/albums",
  request: {
    query: z.object({
      pageToken: z.string().optional().openapi({ description: "Pagination token" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: { "application/json": { schema: getAlbumsResponseSchema } },
      description: "List of Google Photos albums",
    },
  },
  tags: ["google-photos", "admin"],
});

export const getAlbumMediaRoute = createRoute({
  method: "get",
  path: "/albums/{albumId}/media",
  request: {
    params: z.object({
      albumId: z.string().openapi({ description: "Google Photos Album ID" }),
    }),
    query: z.object({
      pageToken: z.string().optional().openapi({ description: "Pagination token" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: { "application/json": { schema: pickerItemsResponseSchema } },
      description: "List of media items inside the album",
    },
  },
  tags: ["google-photos", "admin"],
});

export const syncAlbumResponseSchema = z.object({
  album: z.object({
    id: z.string(),
    name: z.string(),
    r2Folder: z.string(),
    mediaItemsCount: z.string().optional(),
  }),
  importResults: importPhotosResponseSchema,
});

export const syncAlbumRoute = createRoute({
  method: "post",
  path: "/albums/{albumId}/sync",
  request: {
    params: z.object({
      albumId: z.string().openapi({ description: "Google Photos Album ID" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: { "application/json": { schema: syncAlbumResponseSchema } },
      description: "Album synced and media imported to R2",
    },
  },
  tags: ["google-photos", "admin"],
});
