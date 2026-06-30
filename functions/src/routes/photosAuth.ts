import express from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { adminDb, adminAuth } from "../lib/firebase-admin";
import { getGooglePhotosAccessToken } from "../lib/googleAuth";
import { ensureAdmin } from "../middleware/auth";
import { encrypt, getEncryptionSecret } from "../lib/crypto";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);
const PICKER_API_BASE = "https://photospicker.googleapis.com/v1";

// GET /api/photos/auth/init
// Handle deprecated GET request gracefully if browser cache is stale
router.get("/auth/init", asyncHandler(async (req, res) => {
  const origin = `${req.protocol}://${req.get("host")}`;
  res.redirect(`${origin}/dashboard/photos?auth_status=error&error_msg=Stale%20browser%20cache%20detected.%20Please%20refresh%20the%20page%20and%20try%20again.`);
}));

// POST /api/photos/auth/init
// Secure route to generate anti-CSRF token and return redirect URL
router.post("/auth/init", ensureAdmin, asyncHandler(async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ApiError(500, "Google OAuth credentials not configured.");
  }

  const host = (req.headers["x-forwarded-host"] as string) || req.get("host");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const origin = `${proto}://${host}`;
  const redirectUri = `${origin}/api/photos/auth`;

  // Generate secure state token
  const state = crypto.randomBytes(16).toString("hex");
  
  // Save to Firestore with a 10 minute expiration
  await adminDb.collection("oauth_states").doc(state).set({
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  });

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "https://www.googleapis.com/auth/photospicker.mediaitems.readonly https://www.googleapis.com/auth/photoslibrary.appendonly https://www.googleapis.com/auth/photoslibrary.readonly");
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "consent");
  googleAuthUrl.searchParams.set("state", state);

  res.json({ redirectUrl: googleAuthUrl.toString() });
}));

// GET /api/photos/auth (callback URL)
router.get("/auth", asyncHandler(async (req, res) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;
  const state = req.query.state as string | undefined;
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const origin = `${proto}://${host}`;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new ApiError(500, "Google OAuth credentials not configured.");
  }

  const redirectUri = `${origin}/api/photos/auth`;

  if (error) {
    logger.error("photos", "Google OAuth callback error", error);
    res.redirect(`${origin}/dashboard/photos?auth_status=error&error_msg=${encodeURIComponent(error)}`);
    return;
  }

  // SEC-F01: Verify State Parameter against database to prevent CSRF hijacking
  if (!state) {
    throw new ApiError(400, "State parameter missing. Anti-CSRF check failed.");
  }
  const stateDocRef = adminDb.collection("oauth_states").doc(state);
  const stateSnap = await stateDocRef.get();
  if (!stateSnap.exists) {
    throw new ApiError(400, "Invalid or expired state parameter. Anti-CSRF check failed.");
  }
  
  // Clean up state parameter
  await stateDocRef.delete();

  if (code) {
    logger.info("photos", "Received auth code, exchanging for tokens");
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      logger.error("photos", "Token exchange failed", errorText);
      res.redirect(
        `${origin}/dashboard/photos?auth_status=error&error_msg=${encodeURIComponent("Token exchange failed")}`
      );
      return;
    }

    interface GoogleTokenResponse {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      scope: string;
      token_type: string;
    }
    const tokens = (await tokenRes.json()) as GoogleTokenResponse;
    const authRef = adminDb.collection("system_settings").doc("google_auth");
    const existingDoc = await authRef.get();
    const existingData = existingDoc.exists ? existingDoc.data() : null;
    const finalRefreshToken = tokens.refresh_token || existingData?.refreshToken;

    if (!finalRefreshToken) {
      res.redirect(
        `${origin}/dashboard/photos?auth_status=error&error_msg=${encodeURIComponent("No refresh token received.")}`
      );
      return;
    }

    const secret = getEncryptionSecret();
    const encryptedClientId = await encrypt(clientId, secret);
    const encryptedClientSecret = await encrypt(clientSecret, secret);
    const encryptedRefreshToken = await encrypt(finalRefreshToken, secret);

    await authRef.set({
      clientId: encryptedClientId,
      clientSecret: encryptedClientSecret,
      refreshToken: encryptedRefreshToken,
      linkedAt: new Date().toISOString(),
      scopes: tokens.scope.split(" "),
      tokenType: tokens.token_type,
    }, { merge: true });

    res.redirect(`${origin}/dashboard/photos?auth_status=success`);
    return;
  }

  throw new ApiError(400, "Invalid OAuth handshake requests.");
}));

// GET /api/photos/picker/media-proxy
router.get("/picker/media-proxy", asyncHandler(async (req, res) => {
  const url = req.query.url as string | undefined;
  if (!url) {
    throw new ApiError(400, "Missing 'url' query parameter");
  }

  if (!url.match(/^https:\/\/(lh3\.googleusercontent\.com|photospicker\.googleapis.com)\/.*$/)) {
    throw new ApiError(400, "Forbidden: Target URL host is not authorized");
  }

  // Authenticate: support header or query parameter
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split("Bearer ")[1];
  } else if (req.query.token && typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    throw new ApiError(401, "Unauthorized: Missing token");
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("authorized_users").doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      throw new ApiError(403, "Forbidden: User not authorized");
    }
    const userData = userDoc.data();
    if (userData?.role !== "admin" && userData?.role !== "coach" && userData?.role !== "mentor") {
      throw new ApiError(403, "Forbidden: Insufficient privileges");
    }
  } catch (authErr: any) {
    if (authErr instanceof ApiError) throw authErr;
    logger.error("photos", "Media proxy token verification failed", authErr.message);
    throw new ApiError(401, "Unauthorized: Invalid token");
  }
  let safeUrl: string;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:") {
      throw new ApiError(400, "Invalid URL protocol");
    }
    let safeHost: string;
    if (parsedUrl.hostname === "lh3.googleusercontent.com") {
      safeHost = "lh3.googleusercontent.com";
    } else if (parsedUrl.hostname === "photospicker.googleapis.com") {
      safeHost = "photospicker.googleapis.com";
    } else {
      logger.error("photos", `Forbidden target host: '${parsedUrl.hostname}'`);
      throw new ApiError(400, "Forbidden: Target URL host is not authorized");
    }
    safeUrl = `https://${safeHost}${parsedUrl.pathname}`;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    logger.error("photos", "Invalid URL format provided", err.message);
    throw new ApiError(400, "Invalid URL format");
  }

  const googleToken = await getGooglePhotosAccessToken();
  const response = await fetch(safeUrl, {
    headers: { Authorization: `Bearer ${googleToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("photos", `Failed to fetch raw media from url: ${url}. Status: ${response.status}`, errorText);
    throw new ApiError(response.status, `Failed to proxy media: ${errorText}`);
  }

  const contentType = response.headers.get("Content-Type") || "image/jpeg";
  const buffer = await response.arrayBuffer();

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(Buffer.from(buffer));
}));

// GET /api/photos/picker/:sessionId/items
router.get("/picker/:sessionId/items", ensureAdmin, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId.match(/^[a-zA-Z0-9\-_]+$/)) {
    throw new ApiError(400, "Invalid session ID format");
  }
  const googleToken = await getGooglePhotosAccessToken();
  const response = await fetch(`${PICKER_API_BASE}/mediaItems?sessionId=${sessionId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${googleToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, `Picker API failed: ${errorText}`);
  }

  const data = await response.json();
  res.json(data);
}));

// GET /api/photos/picker/:sessionId
router.get("/picker/:sessionId", ensureAdmin, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId.match(/^[a-zA-Z0-9\-_]+$/)) {
    throw new ApiError(400, "Invalid session ID format");
  }
  const googleToken = await getGooglePhotosAccessToken();
  const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${googleToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, `Picker API failed: ${errorText}`);
  }

  const data = await response.json();
  res.json(data);
}));

// POST /api/photos/picker
router.post("/picker", ensureAdmin, asyncHandler(async (req, res) => {
  const googleToken = await getGooglePhotosAccessToken();
  const response = await fetch(`${PICKER_API_BASE}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${googleToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, `Picker API failed: ${errorText}`);
  }

  const data = await response.json();
  res.json(data);
}));

// DELETE /api/photos/picker/:sessionId
router.delete("/picker/:sessionId", ensureAdmin, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId.match(/^[a-zA-Z0-9\-_]+$/)) {
    throw new ApiError(400, "Invalid session ID format");
  }
  const googleToken = await getGooglePhotosAccessToken();
  const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${googleToken}` },
  });

  if (!response.ok && response.status !== 404) {
    logger.warn("photos", "Picker API delete session got unexpected status", response.status);
  }

  res.json({ success: true });
}));

export default router;
