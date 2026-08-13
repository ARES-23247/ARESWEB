import { logger } from "./logger";

interface CachedGoogleAccessToken {
  value: string;
  expiresAt: number;
}

const accessTokenCache = new Map<string, CachedGoogleAccessToken>();

interface GoogleTokenConfiguration {
  integration: "Google Photos" | "Google Drive";
  refreshTokenEnvironmentVariable: "GOOGLE_PHOTOS_REFRESH_TOKEN" | "GOOGLE_DRIVE_REFRESH_TOKEN";
}

async function getGoogleAccessToken(configuration: GoogleTokenConfiguration): Promise<string> {
  const cached = accessTokenCache.get(configuration.refreshTokenEnvironmentVariable);
  if (cached && Date.now() < cached.expiresAt - 30_000) {
    logger.info("googleAuth", `Using cached ${configuration.integration} access token`);
    return cached.value;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env[configuration.refreshTokenEnvironmentVariable];
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(`${configuration.integration} integration is not configured in Secret Manager.`);
  }

  logger.info("googleAuth", `Refreshing ${configuration.integration} access token`);
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

  accessTokenCache.set(configuration.refreshTokenEnvironmentVariable, {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  });

  logger.info("googleAuth", `${configuration.integration} access token refreshed successfully`);
  return data.access_token;
}

/** Obtain the dedicated team Photos credential. */
export function getGooglePhotosAccessToken(): Promise<string> {
  return getGoogleAccessToken({
    integration: "Google Photos",
    refreshTokenEnvironmentVariable: "GOOGLE_PHOTOS_REFRESH_TOKEN",
  });
}

/** Obtain the independently scoped Drive credential. */
export function getGoogleDriveAccessToken(): Promise<string> {
  return getGoogleAccessToken({
    integration: "Google Drive",
    refreshTokenEnvironmentVariable: "GOOGLE_DRIVE_REFRESH_TOKEN",
  });
}
