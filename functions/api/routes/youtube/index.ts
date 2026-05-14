import { OpenAPIHono } from "@hono/zod-openapi";
import { Context } from "hono";
import type { AppEnv } from "../../middleware/utils";
import { ensureAdmin } from "../../middleware";
import {
  getAuthUrlRoute,
  youtubeCallbackRoute,
  getResumableUrlRoute,
  updateYoutubeVideoRoute,
  listYoutubeVideosRoute,
  checkAuthStatusRoute,
  disconnectYoutubeRoute,
} from "../../../../shared/routes/youtube";
import { getDb } from "../../middleware";
import { settings } from "../../../../src/db/schema";
import { eq } from "drizzle-orm";
import { ApiError } from "../../middleware/errorHandler";
import { logAuditAction } from "../../middleware";

import { getUnifiedOAuthToken } from "../../../utils/googleAuth";

const adminApp = new OpenAPIHono<AppEnv>();

adminApp.use("*", ensureAdmin);

// Re-export for anything that might still be importing it directly
export const getGoogleAccessToken = getUnifiedOAuthToken;


// Check if user is allowed to set videos to public (coaches and mentors only)
function canSetPublicPrivacy(c: Context<AppEnv>): boolean {
  const user = c.get("sessionUser");
  const memberType = user?.memberType;
  return memberType === "coach" || memberType === "mentor";
}

const routes = adminApp
  .openapi(checkAuthStatusRoute, async (c) => {
    const db = getDb(c);
    const tokenSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "youtube_refresh_token"))
      .execute()
      .then((res: Array<{ key: string; value: string | null; updatedAt: string | null }>) => res[0]);

    const user = c.get("sessionUser");
    return c.json({ isAuthenticated: !!tokenSetting?.value, memberType: user?.memberType as "student" | "mentor" | "coach" | undefined }, 200);
  })
  .openapi(getAuthUrlRoute, async (c) => {
    const env = c.env;
    if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET) {
      throw new ApiError("YouTube OAuth is not configured in the environment.", 500, "YOUTUBE_NOT_CONFIGURED");
    }

    const redirectUri = `${new URL(c.req.url).origin}/api/youtube/callback`;
    const scopes = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/photoslibrary.readonly",
      "https://www.googleapis.com/auth/photoslibrary.appendonly",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send"
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.append("client_id", env.YOUTUBE_CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", scopes);
    authUrl.searchParams.append("access_type", "offline");
    authUrl.searchParams.append("prompt", "consent"); // Force consent to ensure refresh token is provided
    authUrl.searchParams.append("login_hint", env.AUTHORIZED_GOOGLE_ACCOUNT || "ares23247wv@gmail.com");
    authUrl.searchParams.append("include_granted_scopes", "true");

    return c.json({ url: authUrl.toString() }, 200);
  })
  .openapi(youtubeCallbackRoute, async (c) => {
    const { code, error } = c.req.valid("query");
    const env = c.env;

    const frontendUrl = new URL(c.req.url).origin;
    const dashboardPath = "/dashboard/youtube";

    console.log("[OAuth Callback] Starting callback handler", { hasCode: !!code, hasError: !!error });

    if (error) {
      console.error("[OAuth Callback] Google returned error:", error);
      return c.redirect(`${frontendUrl}${dashboardPath}?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      console.error("[OAuth Callback] No authorization code received");
      return c.redirect(`${frontendUrl}${dashboardPath}?error=no_code`);
    }

    const redirectUri = `${new URL(c.req.url).origin}/api/youtube/callback`;
    console.log("[OAuth Callback] Exchanging code for tokens", { redirectUri, hasClientId: !!env.YOUTUBE_CLIENT_ID, hasClientSecret: !!env.YOUTUBE_CLIENT_SECRET });

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: env.YOUTUBE_CLIENT_ID || "",
          client_secret: env.YOUTUBE_CLIENT_SECRET || "",
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });
    } catch (fetchErr) {
      console.error("[OAuth Callback] Token exchange fetch failed:", fetchErr);
      return c.redirect(`${frontendUrl}${dashboardPath}?error=${encodeURIComponent("token_fetch_exception: " + String(fetchErr))}`);
    }

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error("[OAuth Callback] Token exchange failed:", { status: tokenResponse.status, body: tokenError });
      return c.redirect(`${frontendUrl}${dashboardPath}?error=${encodeURIComponent("token_exchange_failed_" + tokenResponse.status + ": " + tokenError.substring(0, 200))}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenData: any = await tokenResponse.json();
    console.log("[OAuth Callback] Token exchange successful", {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      tokenType: tokenData.token_type,
    });

    if (tokenData.access_token) {
      // Verify the authorized email matches the authorized team account
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      
      if (!userInfoRes.ok) {
        const userInfoError = await userInfoRes.text();
        console.error("[OAuth Callback] User info fetch failed:", { status: userInfoRes.status, body: userInfoError });
        return c.redirect(`${frontendUrl}${dashboardPath}?error=${encodeURIComponent("user_verification_failed_" + userInfoRes.status)}`);
      }
      
      const userInfo = await userInfoRes.json() as { email?: string };
      const authorizedEmail = env.AUTHORIZED_GOOGLE_ACCOUNT || "ares23247wv@gmail.com";
      console.log("[OAuth Callback] Email verification", { receivedEmail: userInfo.email, expectedEmail: authorizedEmail, match: userInfo.email === authorizedEmail });
      
      if (userInfo.email !== authorizedEmail) {
        console.warn(`[OAuth Callback] BLOCKED: Unauthorized account ${userInfo.email}. Expected ${authorizedEmail}.`);
        return c.redirect(`${frontendUrl}${dashboardPath}?error=${encodeURIComponent("unauthorized_email_" + (userInfo.email || "unknown"))}`);
      }
    } else {
      console.error("[OAuth Callback] No access token in response — cannot verify email");
      return c.redirect(`${frontendUrl}${dashboardPath}?error=no_access_token_received`);
    }

    const db = getDb(c);

    if (tokenData.refresh_token) {
      console.log("[OAuth Callback] Storing refresh token in D1...");
      // Upsert the refresh token in the settings table
      await db
        .insert(settings)
        .values({
          key: "youtube_refresh_token",
          value: tokenData.refresh_token,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: tokenData.refresh_token,
            updatedAt: new Date().toISOString(),
          },
        })
        .execute();
      console.log("[OAuth Callback] Refresh token stored successfully");

      if (c.executionCtx) {
         c.executionCtx.waitUntil(logAuditAction(c, "youtube_auth", "settings", "youtube_refresh_token", "Authorized YouTube Resumable Uploads"));
      }
    } else {
      console.warn("[OAuth Callback] WARNING: No refresh_token in response. Status will show disconnected. User may need to revoke app access at https://myaccount.google.com/permissions and re-authorize.");
    }

    // Store the initial access token so the status check immediately shows "connected"
    if (tokenData.access_token) {
      const expiresInSec = tokenData.expires_in || 3600;
      const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
      console.log("[OAuth Callback] Caching access token", { expiresAt });
      
      await db
        .insert(settings)
        .values({ key: "oauth_access_token", value: tokenData.access_token, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: settings.key, set: { value: tokenData.access_token, updatedAt: new Date().toISOString() } })
        .execute();
      
      await db
        .insert(settings)
        .values({ key: "oauth_token_expires_at", value: expiresAt, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: settings.key, set: { value: expiresAt, updatedAt: new Date().toISOString() } })
        .execute();
    }

    console.log("[OAuth Callback] Complete — redirecting to dashboard with success");
    return c.redirect(`${frontendUrl}${dashboardPath}?youtube=connected`);
  })
  .openapi(getResumableUrlRoute, async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c);
    const env = c.env;

    // Privacy validation: only coaches and mentors can set videos to public
    if (body.privacyStatus === "public" && !canSetPublicPrivacy(c)) {
      throw new ApiError("Only coaches and mentors can set videos to public.", 403, "FORBIDDEN_PUBLIC_PRIVACY");
    }

    const accessToken = await getGoogleAccessToken(env, db);

    const metadata = {
      snippet: {
        title: body.title,
        description: body.description || "",
      },
      status: {
        privacyStatus: body.privacyStatus,
      },
    };

    const clientOrigin = c.req.header("origin") || new URL(c.req.url).origin;

    const response = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Length": body.fileSize.toString(),
        "X-Upload-Content-Type": body.mimeType,
        "Origin": clientOrigin,
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to initiate resumable upload session:", errorText);
      throw new ApiError("Failed to initiate YouTube upload session.", 500, "YOUTUBE_SESSION_FAILED");
    }

    const uploadUrl = response.headers.get("Location");
    if (!uploadUrl) {
      throw new ApiError("YouTube did not provide a resumable upload URL.", 500, "YOUTUBE_SESSION_FAILED");
    }

    return c.json({ uploadUrl }, 200);
  })
  .openapi(listYoutubeVideosRoute, async (c) => {
    const db = getDb(c);
    const env = c.env;

    const accessToken = await getGoogleAccessToken(env, db);

    // The YouTube search API with forMine=true does not reliably return private/unlisted videos.
    // The officially recommended approach is to fetch the channel's "uploads" playlist instead.
    const channelRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!channelRes.ok) {
      const errorText = await channelRes.text();
      console.error("Failed to fetch YouTube channel details:", errorText);
      throw new ApiError("Failed to fetch channel details from YouTube.", 500, "YOUTUBE_CHANNEL_FAILED");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channelData: any = await channelRes.json();
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      return c.json({ videos: [] }, 200);
    }

    // Fetch the authenticated user's uploaded videos via their uploads playlist
    // We request 'status' directly here so we don't need a separate videos.list call
    const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,status&maxResults=50&playlistId=${uploadsPlaylistId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to list YouTube videos:", errorText);
      throw new ApiError("Failed to list videos from YouTube.", 500, "YOUTUBE_LIST_FAILED");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    // Map directly from playlistItems since it contains all necessary info including privacyStatus
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videos = (data.items || []).map((item: any) => ({
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      privacyStatus: item.status?.privacyStatus || "public",
      publishedAt: item.snippet.publishedAt,
    }));

    return c.json({ videos }, 200);
  })
  .openapi(updateYoutubeVideoRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c);
    const env = c.env;

    // Privacy validation: only coaches and mentors can set videos to public
    if (body.privacyStatus === "public" && !canSetPublicPrivacy(c)) {
      throw new ApiError("Only coaches and mentors can set videos to public.", 403, "FORBIDDEN_PUBLIC_PRIVACY");
    }

    const accessToken = await getGoogleAccessToken(env, db);

    // YouTube requires you to send back the entire snippet and status object, so we must first fetch the existing one.
    const getRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!getRes.ok) {
      throw new ApiError("Failed to fetch existing video metadata from YouTube.", 500, "YOUTUBE_FETCH_FAILED");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getData: any = await getRes.json();
    if (!getData.items || getData.items.length === 0) {
      throw new ApiError("Video not found on YouTube.", 404, "YOUTUBE_VIDEO_NOT_FOUND");
    }

    const video = getData.items[0];

    const metadata = {
      id: video.id,
      snippet: {
        ...video.snippet,
        title: body.title !== undefined ? body.title : video.snippet.title,
        description: body.description !== undefined ? body.description : video.snippet.description,
      },
      status: {
        ...video.status,
        privacyStatus: body.privacyStatus !== undefined ? body.privacyStatus : video.status.privacyStatus,
      },
    };

    const updateRes = await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet,status", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.error("Failed to update video metadata:", errorText);
      throw new ApiError("Failed to update video metadata on YouTube.", 500, "YOUTUBE_UPDATE_FAILED");
    }

    if (c.executionCtx) {
        c.executionCtx.waitUntil(logAuditAction(c, "youtube_video_update", "video", id, `Updated YouTube video: ${metadata.snippet.title}`));
    }

    return c.json({ success: true }, 200);
  })
  .openapi(disconnectYoutubeRoute, async (c) => {
    const db = getDb(c);
    
    // Check if connected first
    const tokenSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "youtube_refresh_token"))
      .execute()
      .then((res: Array<{ key: string; value: string | null }>) => res[0]);

    if (!tokenSetting) {
      return c.json({ success: true }, 200);
    }

    // Delete refresh token and cached access token
    await db.delete(settings).where(eq(settings.key, "youtube_refresh_token")).execute();
    await db.delete(settings).where(eq(settings.key, "oauth_access_token")).execute();
    await db.delete(settings).where(eq(settings.key, "oauth_token_expires_at")).execute();

    if (c.executionCtx) {
        c.executionCtx.waitUntil(logAuditAction(c, "youtube_disconnect", "system", "youtube", "Disconnected YouTube integration"));
    }

    return c.json({ success: true }, 200);
  });

export const youtubeRouter = routes;
export default youtubeRouter;
