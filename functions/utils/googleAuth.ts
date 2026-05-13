import type { DrizzleDB } from "../../src/db/types";
import { settings } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { ApiError } from "../api/middleware/errorHandler";

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
 * Get a unified OAuth access token for all Google services (YouTube, Photos, Drive, Calendar)
 *
 * Implements lazy refresh with D1 caching:
 * - Checks D1 settings for cached access token
 * - Returns cached token if valid (not within 5-minute expiry buffer)
 * - Refreshes token if missing, expired, or expiring soon using the stored youtube_refresh_token
 * - Stores new token in D1 settings with upsert pattern
 * - Implements retry logic with exponential backoff
 *
 * @param env - Cloudflare environment bindings
 * @param db - Drizzle database instance
 * @returns The access token string
 * @throws ApiError if token refresh fails
 */
export async function getUnifiedOAuthToken(
  env: { YOUTUBE_CLIENT_ID?: string; YOUTUBE_CLIENT_SECRET?: string },
  db: DrizzleDB
): Promise<string> {
  const tokenKey = "oauth_access_token";
  const expiryKey = "oauth_token_expires_at";

  // Validate credentials
  if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET) {
    throw new ApiError(
      "Missing Google OAuth credentials. Cannot generate access token.",
      500,
      "MISSING_OAUTH_CREDENTIALS"
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
          console.debug(`[googleAuth] Using cached unified OAuth token (expires at ${new Date(expiresAt).toISOString()})`);
          return tokenEntry.value;
        }

        console.debug(`[googleAuth] Cached unified OAuth token expiring soon (expires at ${new Date(expiresAt).toISOString()}), refreshing...`);
      }
    }
  }

  // Step 3: Fetch refresh token from D1
  const tokenSetting = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "youtube_refresh_token"))
    .execute()
    .then((res) => res[0]);

  if (!tokenSetting || !tokenSetting.value) {
    throw new ApiError("Google Account is not connected.", 400, "GOOGLE_NOT_CONNECTED");
  }

  const refreshToken = tokenSetting.value;

  // Step 4: Fetch new token with retry logic
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: env.YOUTUBE_CLIENT_ID || "",
          client_secret: env.YOUTUBE_CLIENT_SECRET || "",
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google API returned ${response.status}: ${errorText}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await response.json();
      const accessToken = data.access_token;
      
      // Calculate new expiry: Google returns expires_in (usually 3599 seconds)
      // Default to 1 hour from now if not provided
      const expiresInSec = data.expires_in || 3600;
      const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

      // Step 5: Store new token in D1 with upsert pattern
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

      console.debug(`[googleAuth] Refreshed unified OAuth token (expires at ${expiresAt})`);
      return accessToken;
    } catch (error) {
      lastError = error as Error;
      console.error(`[googleAuth] Token refresh attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error);

      // If not last attempt, wait with exponential backoff before retry
      if (attempt < MAX_RETRIES - 1) {
        const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.debug(`[googleAuth] Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  // All retries exhausted
  throw new ApiError(
    `Failed to refresh unified access token after ${MAX_RETRIES} attempts: ${lastError?.message || "Unknown error"}`,
    503,
    "TOKEN_REFRESH_FAILED"
  );
}
