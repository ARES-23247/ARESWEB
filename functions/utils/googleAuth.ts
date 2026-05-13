import { getGcalAccessToken, type GCalConfig } from "./gcalSync";
import type { DrizzleDB } from "../../src/db/types";
import { settings } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { ApiError } from "../shared/errors/api";

/**
 * Token cache entry stored in D1 settings
 */
interface TokenCache {
  accessToken: string;
  expiresAt: string; // ISO timestamp
}

/**
 * Expiry buffer in milliseconds (5 minutes per D-05)
 * Tokens are refreshed if they expire within this window
 */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Retry configuration per D-07
 */
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 100;

/**
 * Helper function to sleep with exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get or refresh an OAuth token for the specified Google API
 *
 * This function implements lazy refresh with D1 caching per D-03/D-04:
 * - Checks D1 settings for cached token
 * - Returns cached token if valid (not within 5-minute expiry buffer)
 * - Refreshes token if missing, expired, or expiring soon
 * - Stores new token in D1 settings with upsert pattern
 * - Implements retry logic with exponential backoff (3 retries per D-07)
 *
 * @param type - The API type ("drive" or "photos")
 * @param db - Drizzle database instance
 * @param env - Cloudflare environment bindings
 * @returns The access token string
 * @throws ApiError if token refresh fails after retries
 */
export async function getOrRefreshToken(
  type: "drive" | "photos",
  db: DrizzleDB,
  env: { GCAL_SERVICE_ACCOUNT_EMAIL?: string; GCAL_PRIVATE_KEY?: string }
): Promise<string> {
  const tokenKey = `${type}_access_token`;
  const expiryKey = `${type}_token_expires_at`;

  // Validate credentials before attempting token generation (CR-02)
  if (!env.GCAL_SERVICE_ACCOUNT_EMAIL || !env.GCAL_PRIVATE_KEY) {
    throw new ApiError(
      `Missing Google service account credentials. Cannot refresh ${type} token.`,
      500,
      "MISSING_CREDENTIALS"
    );
  }

  // Step 1: Check D1 settings for cached token
  const cachedEntries = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(eq(settings.key, tokenKey))
    .execute();

  // Step 2: Check if cached token is valid (not within expiry buffer)
  if (cachedEntries.length > 0) {
    const tokenEntry = cachedEntries[0];
    if (tokenEntry.value) {
      // Fetch expiry timestamp
      const expiryEntries = await db
        .select({ key: settings.key, value: settings.value })
        .from(settings)
        .where(eq(settings.key, expiryKey))
        .execute();

      if (expiryEntries.length > 0 && expiryEntries[0].value) {
        const expiresAt = new Date(expiryEntries[0].value).getTime();
        const now = Date.now();

        // Return cached token if not expiring within buffer
        if (expiresAt > now + EXPIRY_BUFFER_MS) {
          console.log(`[googleAuth] Using cached ${type} token (expires at ${new Date(expiresAt).toISOString()})`);
          return tokenEntry.value;
        }

        console.log(`[googleAuth] Cached ${type} token expiring soon (expires at ${new Date(expiresAt).toISOString()}), refreshing...`);
      }
    }
  }

  // Step 3: Fetch new token with retry logic
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Build GCal config from environment
      const config: GCalConfig = {
        email: env.GCAL_SERVICE_ACCOUNT_EMAIL || "",
        privateKey: env.GCAL_PRIVATE_KEY || "",
        calendarId: "", // Not needed for token generation
      };

      // Get new access token from Google
      const accessToken = await getGcalAccessToken(config);

      // Calculate new expiry: 1 hour from now (Google's default)
      const expiresAt = new Date(Date.now() + 3600000).toISOString();

      // Step 4: Store new token in D1 with upsert pattern
      await db
        .insert(settings)
        .values({
          key: tokenKey,
          value: accessToken,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: accessToken,
            updatedAt: new Date().toISOString(),
          },
        })
        .run();

      // Store expiry timestamp
      await db
        .insert(settings)
        .values({
          key: expiryKey,
          value: expiresAt,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: expiresAt,
            updatedAt: new Date().toISOString(),
          },
        })
        .run();

      console.log(`[googleAuth] Refreshed ${type} token (expires at ${expiresAt})`);
      return accessToken;
    } catch (error) {
      lastError = error as Error;
      console.error(`[googleAuth] Token refresh attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error);

      // If not last attempt, wait with exponential backoff before retry
      if (attempt < MAX_RETRIES - 1) {
        const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.log(`[googleAuth] Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  // All retries exhausted - throw error per D-08
  throw new ApiError(
    `Failed to refresh ${type} access token after ${MAX_RETRIES} attempts: ${lastError?.message || "Unknown error"}`,
    503,
    "TOKEN_REFRESH_FAILED"
  );
}

/**
 * Get a valid access token for Google Drive API
 *
 * Uses lazy refresh pattern: checks D1 cache first, refreshes only if
 * token is missing or expiring within 5-minute buffer.
 *
 * @param db - Drizzle database instance
 * @param env - Cloudflare environment bindings
 * @returns The access token string
 * @throws ApiError if token refresh fails after retries
 */
export async function getDriveAccessToken(
  db: DrizzleDB,
  env: { GCAL_SERVICE_ACCOUNT_EMAIL?: string; GCAL_PRIVATE_KEY?: string }
): Promise<string> {
  return getOrRefreshToken("drive", db, env);
}

/**
 * Get a valid access token for Google Photos Library API
 *
 * Uses lazy refresh pattern: checks D1 cache first, refreshes only if
 * token is missing or expiring within 5-minute buffer.
 *
 * @param db - Drizzle database instance
 * @param env - Cloudflare environment bindings
 * @returns The access token string
 * @throws ApiError if token refresh fails after retries
 */
export async function getPhotosAccessToken(
  db: DrizzleDB,
  env: { GCAL_SERVICE_ACCOUNT_EMAIL?: string; GCAL_PRIVATE_KEY?: string }
): Promise<string> {
  return getOrRefreshToken("photos", db, env);
}
