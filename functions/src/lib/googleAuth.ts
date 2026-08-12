import { logger } from "./logger";

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number | null = null; // timestamp in ms

export async function getGooglePhotosAccessToken(): Promise<string> {
  if (cachedAccessToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 30000) {
    logger.info("googleAuth", "Using cached team access token");
    return cachedAccessToken;
  }

  // Cloud Functions injects these values from Secret Manager. Never place
  // credentials in Firestore, URLs, logs, or client-visible responses.
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_PHOTOS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Photos integration is not configured in Secret Manager.");
  }

  logger.info("googleAuth", "Refreshing team access token");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    logger.error("googleAuth", "Token refresh request failed", {
      httpStatus: response.status,
      statusText: response.statusText,
    });
    throw new Error(`Google token refresh failed with HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as {
    access_token?: unknown;
    expires_in?: unknown;
    scope?: unknown;
    token_type?: unknown;
  };

  if (typeof data.access_token !== "string" || !data.access_token
    || typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
    logger.error("googleAuth", "Token refresh returned an invalid response shape");
    throw new Error("Google token refresh returned an invalid response.");
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  logger.info("googleAuth", "Access token refreshed successfully");
  return data.access_token;
}
