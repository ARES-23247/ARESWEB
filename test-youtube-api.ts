import { getDb } from "./functions/api/middleware";
import { settings } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const mockC = {
    env: process.env,
    get: (key: string) => undefined,
  };
  const db = getDb(mockC as any);
  
  const tokenSetting = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "youtube_refresh_token"))
    .execute()
    .then((res: any) => res[0]);

  if (!tokenSetting || !tokenSetting.value) {
    console.log("No refresh token found.");
    return;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID || "",
      client_secret: process.env.YOUTUBE_CLIENT_SECRET || "",
      refresh_token: tokenSetting.value,
      grant_type: "refresh_token",
    }).toString(),
  });

  const tokenData: any = await response.json();
  const accessToken = tokenData.access_token;
  
  if (!accessToken) {
    console.error("Failed to get access token:", tokenData);
    return;
  }

  const channelRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const channelData: any = await channelRes.json();
  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  console.log("Uploads Playlist ID:", uploadsPlaylistId);

  const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,status&maxResults=50&playlistId=${uploadsPlaylistId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const playlistData: any = await playlistRes.json();
  
  console.log(`Found ${playlistData.items?.length || 0} playlist items.`);
  const privateCount = playlistData.items?.filter((i: any) => i.status?.privacyStatus === "private").length || 0;
  console.log(`Of which ${privateCount} are marked private in playlistItems.`);

  const videoIds = (playlistData.items || []).map((item: any) => item.snippet.resourceId.videoId).join(",");
  
  if (videoIds) {
    const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoIds}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const videosData: any = await videosRes.json();
    console.log(`videos.list returned ${videosData.items?.length || 0} videos.`);
    const privateVids = videosData.items?.filter((i: any) => i.status?.privacyStatus === "private").length || 0;
    console.log(`Of which ${privateVids} are marked private in videos.list.`);
  }
}

run().catch(console.error);
