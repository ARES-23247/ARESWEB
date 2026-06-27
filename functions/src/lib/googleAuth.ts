import { adminDb } from "./firebase-admin";
import { decrypt, getEncryptionSecret } from "./crypto";
import { logger } from "./logger";

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number | null = null; // timestamp in ms

export async function getGooglePhotosAccessToken(): Promise<string> {
  if (cachedAccessToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 30000) {
    logger.info("googleAuth", "Using cached team access token");
    return cachedAccessToken;
  }

  const authRef = adminDb.collection("system_settings").doc("google_auth");
  const authDoc = await authRef.get();

  if (!authDoc.exists) {
    throw new Error("Google account integration not configured. Please link the team account first in `/api/photos/auth`.");
  }

  const authData = authDoc.data();
  const encryptedClientId = authData?.clientId;
  const encryptedClientSecret = authData?.clientSecret;
  const encryptedRefreshToken = authData?.refreshToken;

  if (!encryptedClientId || !encryptedClientSecret || !encryptedRefreshToken) {
    throw new Error("Google Auth document is missing required configuration keys.");
  }

  const secret = getEncryptionSecret();
  const clientId = await decrypt(encryptedClientId, secret);
  const clientSecret = await decrypt(encryptedClientSecret, secret);
  const refreshToken = await decrypt(encryptedRefreshToken, secret);

  if (clientId.includes("[Decryption Failed]") || clientSecret.includes("[Decryption Failed]") || refreshToken.includes("[Decryption Failed]")) {
    throw new Error("Failed to decrypt Google Auth credentials. Verify your ENCRYPTION_SECRET configuration.");
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
    const errorText = await response.text();
    logger.error("googleAuth", "Token refresh request failed", errorText);
    throw new Error(`Google token refresh failed: ${errorText}`);
  }

  const data = await response.json() as {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };

  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  logger.info("googleAuth", "Access token refreshed successfully");
  return data.access_token;
}
