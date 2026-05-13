/* eslint-disable @typescript-eslint/no-explicit-any */
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppEnv } from "../../middleware/utils";
import { ensureAdmin, getDb } from "../../middleware";
import { getDriveAccessToken } from "../../../utils/googleAuth";
import { ApiError } from "../../middleware/errorHandler";
import { z } from "zod";
import { listDriveFilesRoute } from "../../../../shared/routes/google-drive";

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

// Create the router and apply middleware
const driveApp = new OpenAPIHono<AppEnv>();
driveApp.use("*", ensureAdmin);

// Health check endpoint
const app1 = driveApp.openapi(healthRoute, async (c) => {
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

// Files endpoint - List Google Workspace documents
// Returns Google Workspace files (Docs, Sheets, Slides, Drawings) from the configured folder
// Supports name search, pagination, and MIME type filtering per D-02/D-03/D-12
const driveRouter = app1.openapi(listDriveFilesRoute, async (c) => {
  const db = getDb(c);
  const env = c.env;
  const query = c.req.valid("query");

  // Get access token using lazy refresh pattern
  const token = await getDriveAccessToken(db, env);

  // Check for required environment variable
  const folderId = (env as any).GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new ApiError(
      "GOOGLE_DRIVE_FOLDER_ID environment variable is not configured",
      500,
      "MISSING_CONFIG"
    );
  }

  // Build Drive API query with folder, MIME type, and search filters
  // Per D-03: Only Google Workspace MIME types (document, spreadsheet, presentation, drawing)
  // Per D-04: Search filters by name using 'name contains'
  const googleWorkspaceMimeTypes = [
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
    "application/vnd.google-apps.drawing",
  ];

  let driveQuery = `'${folderId}' in parents and trashed=false and mimeType in ('${googleWorkspaceMimeTypes.join("','")}')`;

  // Add name search filter if provided (per D-04)
  if (query.q) {
    // Escape single quotes in user query to prevent injection (per T-74-07)
    const escapedQuery = query.q.replace(/'/g, "\\'");
    driveQuery += ` and name contains '${escapedQuery}'`;
  }

  // Build URL parameters
  const urlParams = new URLSearchParams({
    q: driveQuery,
    fields: "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,owners)",
    pageSize: String(query.pageSize ?? 50),
  });

  // Add pageToken if provided for pagination
  if (query.pageToken) {
    urlParams.append("pageToken", query.pageToken);
  }

  // Call Drive API v3 files.list endpoint
  const driveUrl = `https://www.googleapis.com/drive/v3/files?${urlParams.toString()}`;
  const driveResponse = await fetch(driveUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Handle API errors
  if (!driveResponse.ok) {
    const errorText = await driveResponse.text();
    console.error("[google-drive] Files API error:", driveResponse.status, errorText);
    throw new ApiError(
      `Google Drive API error: ${driveResponse.status} ${driveResponse.statusText}`,
      driveResponse.status,
      "DRIVE_API_ERROR"
    );
  }

  const driveData = await driveResponse.json() as {
    files?: Array<{
      id: string;
      name: string;
      mimeType: string;
      modifiedTime: string;
      webViewLink?: string;
      owners?: Array<{ displayName?: string; emailAddress?: string }>;
    }>;
    nextPageToken?: string;
  };

  // Transform Drive API response to match our schema
  // Map owners[0].displayName to owner field (per plan)
  const files = (driveData.files ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    owner: file.owners?.[0]?.displayName ?? file.owners?.[0]?.emailAddress,
    webViewLink: file.webViewLink,
  }));

  // Return response with files array and nextPageToken
  return c.json({
    files,
    nextPageToken: driveData.nextPageToken,
  } as any, 200);
});

export { driveRouter };
export default driveRouter;
