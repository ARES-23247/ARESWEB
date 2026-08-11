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

export interface ManagedPhoto {
  id: string;
  publicUrl: string;
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
    detail = (await response.text().catch(() => "")).slice(0, 500);
  }
  return new Error(`HTTP ${response.status} ${response.statusText}: ${detail || fallback}`);
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
