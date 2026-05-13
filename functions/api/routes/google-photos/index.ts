import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppEnv } from "../../middleware/utils";
import { ensureAdmin, getDb } from "../../middleware";
import { getPhotosAccessToken } from "../../../utils/googleAuth";
import { ApiError } from "../../middleware/errorHandler";
import { z } from "zod";

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

// Albums placeholder response schema (to be implemented in Phase 75)
const albumsResponseSchema = z.object({
  albums: z.array(z.any()).optional(),
  message: z.string().optional(),
});

// Albums route definition (placeholder for Phase 75)
const albumsRoute = createRoute({
  method: "get",
  path: "/albums",
  summary: "List Google Photos albums",
  description: "PLACEHOLDER: This endpoint will be implemented in Phase 75 to browse Google Photos albums.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: albumsResponseSchema,
        },
      },
      description: "Albums list (placeholder)",
    },
  },
});

// Create the router
const photosApp = new OpenAPIHono<AppEnv>();

// Apply admin middleware to all routes per zero-trust security
// This ensures only authenticated admin users can access Google Photos endpoints
photosApp.use("*", ensureAdmin);

// Health check endpoint
// Tests authentication by making a minimal API call to Google Photos
photosApp.openapi(healthRoute, async (c) => {
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

// Albums endpoint (placeholder for Phase 75)
// This route is established now to avoid breaking changes when albums are added later
photosApp.openapi(albumsRoute, async (c) => {
  // TODO: Implement Google Photos album listing in Phase 75
  // This endpoint will:
  // - Fetch albums from Google Photos Library API
  // - Support pagination for large album collections
  // - Return album metadata (id, title, mediaItemsCount, coverPhotoBaseUrl)
  return c.json([], 200);
});

// Export the router for registration in the main app
export const photosRouter = photosApp;
export default photosRouter;
