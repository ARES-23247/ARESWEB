import { adminDb } from "./firebase-admin";

/**
 * Retrieves a fresh temporary access token from Google using the stored team refresh token in Firestore.
 * This completely encapsulates the token refresh logic.
 */
export async function getGooglePhotosAccessToken(): Promise<string> {
  const authRef = adminDb.collection("system_settings").doc("google_auth");
  const authDoc = await authRef.get();

  if (!authDoc.exists) {
    throw new Error("Google account integration not configured. Please link the team account first in `/api/photos/auth`.");
  }

  const authData = authDoc.data();
  const { clientId, clientSecret, refreshToken } = authData as {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Auth document is missing required configuration keys (clientId, clientSecret, refreshToken).");
  }

  console.log("[Google Auth] Refreshing team access token...");
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
    console.error("[Google Auth] Token refresh request failed:", errorText);
    throw new Error(`Google token refresh failed: ${errorText}`);
  }

  const data = await response.json() as {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };

  console.log("[Google Auth] Access token refreshed successfully.");
  return data.access_token;
}
