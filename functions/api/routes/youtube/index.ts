import { OpenAPIHono } from "@hono/zod-openapi";
import type { Bindings as Env, AppEnv } from "../../middleware/utils";
import { ensureAdmin } from "../../middleware";
import {
  getAuthUrlRoute,
  youtubeCallbackRoute,
  getResumableUrlRoute,
  updateYoutubeVideoRoute,
  listYoutubeVideosRoute,
  checkAuthStatusRoute,
} from "../../../../shared/routes/youtube";
import { getDb } from "../../middleware";
import { settings } from "../../../../src/db/schema";
import { eq } from "drizzle-orm";
import { ApiError } from "../../middleware/errorHandler";
import { logAuditAction } from "../../middleware";

const adminApp = new OpenAPIHono<AppEnv>();

adminApp.use("*", ensureAdmin);

// Utility to fetch Google Access Token using the Refresh Token
async function getGoogleAccessToken(env: Env, db: ReturnType<typeof getDb>): Promise<string> {
  const tokenSetting = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "youtube_refresh_token"))
    .execute()
    .then((res: Array<{ key: string; value: string | null; updatedAt: string | null }>) => res[0]);

  if (!tokenSetting || !tokenSetting.value) {
    throw new ApiError("YouTube is not connected.", 400, "YOUTUBE_NOT_CONNECTED");
  }

  const refreshToken = tokenSetting.value;

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
    console.error("Failed to get Google Access Token:", errorText);
    throw new ApiError("Failed to refresh YouTube access token.", 500, "YOUTUBE_REFRESH_FAILED");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();
  return data.access_token;
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

    return c.json({ isAuthenticated: !!tokenSetting?.value }, 200);
  })
  .openapi(getAuthUrlRoute, async (c) => {
    const env = c.env;
    if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET) {
      throw new ApiError("YouTube OAuth is not configured in the environment.", 500, "YOUTUBE_NOT_CONFIGURED");
    }

    const redirectUri = `${new URL(c.req.url).origin}/api/youtube/callback`;
    const scopes = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.force-ssl"].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.append("client_id", env.YOUTUBE_CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", scopes);
    authUrl.searchParams.append("access_type", "offline");
    authUrl.searchParams.append("prompt", "consent"); // Force consent to ensure refresh token is provided

    return c.json({ url: authUrl.toString() }, 200);
  })
  .openapi(youtubeCallbackRoute, async (c) => {
    const { code, error } = c.req.valid("query");
    const env = c.env;

    const frontendUrl = new URL(c.req.url).origin; // Can be configured if frontend and backend differ

    if (error) {
      return c.redirect(`${frontendUrl}/admin/media?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return c.redirect(`${frontendUrl}/admin/media?error=no_code`);
    }

    const redirectUri = `${new URL(c.req.url).origin}/api/youtube/callback`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error("Token Exchange Error:", tokenError);
      return c.redirect(`${frontendUrl}/admin/media?error=token_exchange_failed`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenData: any = await tokenResponse.json();

    if (tokenData.refresh_token) {
      const db = getDb(c);
      
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

      if (c.executionCtx) {
         c.executionCtx.waitUntil(logAuditAction(c, "youtube_auth", "settings", "youtube_refresh_token", "Authorized YouTube Resumable Uploads"));
      }
    } else {
        // If they already authorized but we don't have the token, we need to ask them to disconnect and reconnect in Google to get a new refresh token.
        console.warn("No refresh token received. User might have previously authorized.");
    }

    return c.redirect(`${frontendUrl}/admin/media?youtube=connected`);
  })
  .openapi(getResumableUrlRoute, async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c);
    const env = c.env;

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

    const response = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Length": body.fileSize.toString(),
        "X-Upload-Content-Type": body.mimeType,
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

    // Fetch the authenticated user's uploaded videos via the "mine=true" search parameter
    const response = await fetch("https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&maxResults=50&order=date", {
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

    // We need to fetch the status (privacyStatus) for these videos since search doesn't return it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoIds = (data.items || []).map((item: any) => item.id.videoId).join(",");
    
    let videos = [];
    if (videoIds) {
      const statusRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoIds}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      if (statusRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statusData: any = await statusRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        videos = (statusData.items || []).map((v: any) => ({
          id: v.id,
          title: v.snippet.title,
          description: v.snippet.description,
          thumbnailUrl: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
          privacyStatus: v.status.privacyStatus,
          publishedAt: v.snippet.publishedAt,
        }));
      }
    }

    return c.json({ videos }, 200);
  })
  .openapi(updateYoutubeVideoRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c);
    const env = c.env;

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
  });

export const youtubeRouter = routes;
export default youtubeRouter;
