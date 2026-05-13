import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../middleware";
import { ensureAdmin, getDb } from "../middleware";
import { getDriveAccessToken, getPhotosAccessToken } from "../../utils/googleAuth";

/**
 * Test authentication router for verifying Google service account tokens.
 *
 * This router provides endpoints to test token generation for Google Drive
 * and Photos APIs. All routes require admin authentication.
 *
 * NOTE: This router is NOT registered in the main [[route]].ts by default.
 * To use this router for testing, import it manually in your local dev environment.
 */
const authTestApp = new OpenAPIHono<AppEnv>();

// Apply admin middleware to all routes
authTestApp.use("*", ensureAdmin);

/**
 * GET /drive - Get a fresh Drive API access token
 *
 * Returns the access token for Google Drive API along with metadata
 * about whether the token was cached or freshly generated.
 */
authTestApp.openapi(
  {
    method: "get",
    path: "/drive",
    summary: "Get Drive access token",
    description: "Generates or retrieves a cached access token for Google Drive API. Requires admin authentication.",
    tags: ["Test", "Google Auth"],
    responses: {
      200: {
        description: "Successfully retrieved Drive access token",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                service: { type: "string", example: "drive" },
                accessToken: { type: "string", description: "OAuth2 access token for Drive API" },
                cached: { type: "boolean", description: "Whether token was retrieved from cache" },
                expiresAt: { type: "string", description: "ISO timestamp when token expires" },
              },
            },
          },
        },
      },
      401: {
        description: "Unauthorized - admin authentication required",
      },
    },
  },
  async (c) => {
    const db = getDb(c);
    const env = c.env;

    const accessToken = await getDriveAccessToken(db, env);

    // Calculate expiry time (tokens are valid for 1 hour from generation)
    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    // Note: In a real implementation, we would track whether the token was cached
    // For now, we return false since we don't have that visibility in the current implementation
    return c.json({
      service: "drive",
      accessToken,
      cached: false, // Could be enhanced to return actual cached status
      expiresAt,
    } as any, 200);
  }
);

/**
 * GET /photos - Get a fresh Photos API access token
 *
 * Returns the access token for Google Photos Library API along with metadata
 * about whether the token was cached or freshly generated.
 */
authTestApp.openapi(
  {
    method: "get",
    path: "/photos",
    summary: "Get Photos access token",
    description: "Generates or retrieves a cached access token for Google Photos Library API. Requires admin authentication.",
    tags: ["Test", "Google Auth"],
    responses: {
      200: {
        description: "Successfully retrieved Photos access token",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                service: { type: "string", example: "photos" },
                accessToken: { type: "string", description: "OAuth2 access token for Photos API" },
                cached: { type: "boolean", description: "Whether token was retrieved from cache" },
                expiresAt: { type: "string", description: "ISO timestamp when token expires" },
              },
            },
          },
        },
      },
      401: {
        description: "Unauthorized - admin authentication required",
      },
    },
  },
  async (c) => {
    const db = getDb(c);
    const env = c.env;

    const accessToken = await getPhotosAccessToken(db, env);

    // Calculate expiry time (tokens are valid for 1 hour from generation)
    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    // Note: In a real implementation, we would track whether the token was cached
    // For now, we return false since we don't have that visibility in the current implementation
    return c.json({
      service: "photos",
      accessToken,
      cached: false, // Could be enhanced to return actual cached status
      expiresAt,
    } as any, 200);
  }
);

/**
 * Export the auth test router
 *
 * To use this router in development, add the following to functions/api/[[route]].ts:
 *
 *   import { authTestRouter } from "./routes/test-auth";
 *   app.route("/api/test-auth", authTestRouter);
 */
export { authTestApp as authTestRouter };
export default authTestApp;
