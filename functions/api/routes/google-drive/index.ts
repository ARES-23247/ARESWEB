import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppEnv } from "../../middleware/utils";
import { ensureAdmin, getDb } from "../../middleware";
import { getDriveAccessToken } from "../../../utils/googleAuth";
import { ApiError } from "../../middleware/errorHandler";
import { z } from "zod";

// Health check response schema
const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("google-drive"),
  authenticated: z.boolean(),
  test: z.string(),
});

// Health check route definition
const healthRoute = createRoute({
  method: "get",
  path: "/health",
  summary: "Check Google Drive API health",
  description: "Verifies that the Google Drive API is accessible and authentication is working.",
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

// Files placeholder response schema (to be implemented in Phase 74)
const filesResponseSchema = z.object({
  files: z.array(z.any()).optional(),
  message: z.string().optional(),
});

// Files route definition (placeholder for Phase 74)
const filesRoute = createRoute({
  method: "get",
  path: "/files",
  summary: "List Google Drive files",
  description: "PLACEHOLDER: This endpoint will be implemented in Phase 74 to browse Google Drive files.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: filesResponseSchema,
        },
      },
      description: "Files list (placeholder)",
    },
  },
});

// Create the router
const driveApp = new OpenAPIHono<AppEnv>();

// Apply admin middleware to all routes per zero-trust security
// This ensures only authenticated admin users can access Google Drive endpoints
driveApp.use("*", ensureAdmin);

// Health check endpoint
// Tests authentication by making a minimal API call to Google Drive
driveApp.openapi(healthRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;

  // Get access token using lazy refresh pattern (with retry logic per D-07)
  const token = await getDriveAccessToken(db, env);

  // Test Drive API with a minimal files list request
  const driveResponse = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=1", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Handle authentication failures from Drive API
  if (driveResponse.status === 401) {
    throw new ApiError("Authentication failed: Invalid or expired token.", 401, "AUTH_FAILURE");
  }

  // Handle other API errors
  if (!driveResponse.ok) {
    const errorText = await driveResponse.text();
    console.error("[google-drive] API health check failed:", errorText);
    throw new ApiError(
      `Google Drive API error: ${driveResponse.status} ${driveResponse.statusText}`,
      500,
      "API_FAILURE"
    );
  }

  // Return success response
  // Per T-73-13: Health endpoint returns only status, not access token
  return c.json(
    {
      status: "ok" as const,
      service: "google-drive" as const,
      authenticated: true,
      test: "API call successful",
    },
    200
  );
});

// Files endpoint (placeholder for Phase 74)
// This route is established now to avoid breaking changes when file browsing is added later
driveApp.openapi(filesRoute, async (c) => {
  // TODO: Implement Google Drive file listing in Phase 74
  // This endpoint will:
  // - Fetch files and folders from Google Drive API v3
  // - Support pagination for large file collections
  // - Return file metadata (id, name, mimeType, modifiedTime, webViewLink)
  // - Support filtering by folder/mime type
  return c.json([], 200);
});

// Export the router for registration in the main app
export const driveRouter = driveApp;
export default driveRouter;
