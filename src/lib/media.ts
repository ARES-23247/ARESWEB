export interface ManagedVideo {
  id: string;
  title: string;
  description: string;
  platform: "youtube";
  videoId: string;
  thumbnailUrl: string;
  watchUrl: string;
  embedUrl: string;
  type: "video" | "short";
  status: "draft" | "published";
  createdAt: string;
  updatedAt?: string;
  isArchived: boolean;
  archivedAt?: string;
}

export interface PublicVideoPage {
  videos: ManagedVideo[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ManagedPhoto {
  id: string;
  publicUrl: string;
  thumbnailUrl?: string | null;
  thumbnailWidth?: number | null;
  thumbnailHeight?: number | null;
  mediumUrl?: string | null;
  mediumWidth?: number | null;
  mediumHeight?: number | null;
  width?: number | null;
  height?: number | null;
  caption: string;
  altText: string;
  labels: string[];
  albumId: string | null;
  mimeType: string;
  fileSize: number;
  importedAt: string;
  capturedAt?: string;
  isSynced: boolean;
  isArchived: boolean;
  archivedAt?: string;
}

export type AlbumCategory = "Robot Specs" | "Outreach" | "Competition" | "CAD Design" | "Practice";

export interface ManagedAlbum {
  id: string;
  title: string;
  description: string;
  category: AlbumCategory;
  coverImageUrl: string;
  coverPhotoId?: string | null;
  isPublic: boolean;
  mediaCount: number;
  createdAt: string;
  updatedAt?: string;
  isArchived: boolean;
  archivedAt?: string;
}

export interface GooglePhotosConnection {
  provider: "google-photos";
  accountOwner: "team";
  configured: boolean;
  credentialStorage: "secret-manager";
  capabilities: string[];
  message?: string;
}

export async function apiFailure(response: Response, fallback: string): Promise<Error> {
  let detail = "";
  try {
    const payload = await response.clone().json() as { error?: unknown; message?: unknown };
    if (typeof payload.error === "string") detail = payload.error;
    else if (typeof payload.message === "string") detail = payload.message;
  } catch {
    try {
      detail = (await response.text()).slice(0, 500);
    } catch {
      detail = "";
    }
  }
  return new Error(`HTTP ${response.status} ${response.statusText}: ${detail || fallback}`);
}

export function parsePublicVideoPage(value: unknown): PublicVideoPage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The video API returned an invalid response.");
  }

  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.videos) || typeof record.hasMore !== "boolean") {
    throw new Error("The video API returned an invalid response.");
  }
  if (record.nextCursor !== null && typeof record.nextCursor !== "string") {
    throw new Error("The video API returned an invalid response.");
  }

  const videos = record.videos.filter((candidate): candidate is ManagedVideo => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const video = candidate as Record<string, unknown>;
    const videoId = typeof video.videoId === "string" ? video.videoId : "";
    return typeof video.id === "string"
      && typeof video.title === "string"
      && typeof video.description === "string"
      && video.platform === "youtube"
      && /^[A-Za-z0-9_-]{11}$/.test(videoId)
      && typeof video.thumbnailUrl === "string"
      && video.watchUrl === `https://www.youtube.com/watch?v=${videoId}`
      && video.embedUrl === `https://www.youtube-nocookie.com/embed/${videoId}`
      && (video.type === "video" || video.type === "short")
      && video.status === "published"
      && typeof video.createdAt === "string"
      && video.isArchived === false;
  });

  return {
    videos,
    hasMore: record.hasMore,
    nextCursor: record.nextCursor as string | null,
  };
}

export function parseYouTubeVideoId(value: string): string | null {
  const input = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  let url: URL;
  try { url = new URL(input); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let id = "";
  if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
  if (["youtube.com", "m.youtube.com"].includes(host)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
    else {
      const [route, routeId] = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(route)) id = routeId || "";
    }
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
