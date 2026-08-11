import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPhotosPage from "@/app/dashboard/photos/page";
import DashboardVideosPage from "@/app/dashboard/videos/page";
import VideosPage from "@/app/videos/page";
import { authenticatedFetch } from "@/lib/api";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "admin" }, authorizedUser: { role: "admin" }, loading: false }),
}));
vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));
vi.mock("@/lib/image", () => ({ resizeAndCompressImage: vi.fn() }));
vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => null }));

function response(body: unknown, status = 200, statusText = "OK"): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

const video = {
  id: "video_abcdefghijk",
  title: "Robot reveal",
  description: "See the new robot.",
  platform: "youtube" as const,
  videoId: "abcdefghijk",
  thumbnailUrl: "https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg",
  watchUrl: "https://www.youtube.com/watch?v=abcdefghijk",
  embedUrl: "https://www.youtube-nocookie.com/embed/abcdefghijk",
  type: "video" as const,
  status: "published" as const,
  createdAt: "2026-01-01T00:00:00Z",
  isArchived: false,
};

describe("media management pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads public videos from the bounded DTO API and never shows the internal ID", async () => {
    vi.mocked(fetch).mockResolvedValue(response({ videos: [video], hasMore: false, nextCursor: null }));
    render(<VideosPage />);
    expect(await screen.findByRole("heading", { name: "Robot reveal" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/videos/public?limit=24");
    expect(screen.queryByText("video_abcdefghijk")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play Robot reveal" })).toBeInTheDocument();
  });

  it("archives a managed video through an accessible confirmation and keeps deletion reversible", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response({ videos: [video], hasMore: false, nextCursor: null }))
      .mockResolvedValueOnce(response({ success: true, archived: true }));
    render(<DashboardVideosPage />);
    expect(await screen.findByRole("heading", { name: "Robot reveal" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive Robot reveal" }));
    expect(screen.getByRole("dialog", { name: "Archive this video?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive video" }));
    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledWith("/api/videos/video_abcdefghijk", { method: "DELETE" }));
    expect(await screen.findByText(/moved to the archive/i)).toBeInTheDocument();
  });

  it("shows only the safe team Google connection state on the photo dashboard", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/photos?")) return response({ photos: [{ id: "photo-1", publicUrl: "https://storage.googleapis.com/photo.jpg", caption: "Robot at practice", altText: "Robot driving on the field", labels: [], albumId: null, mimeType: "image/jpeg", fileSize: 10, importedAt: "2026-01-01", isSynced: true, isArchived: false }], hasMore: false, nextCursor: null });
      if (url.startsWith("/api/photos/albums?")) return response({ albums: [], hasMore: false, nextCursor: null });
      if (url === "/api/photos/auth/status") return response({ provider: "google-photos", accountOwner: "team", configured: true, credentialStorage: "secret-manager", capabilities: ["picker-import"] });
      throw new Error(`Unexpected URL ${url}`);
    });
    render(<DashboardPhotosPage />);
    expect(await screen.findByRole("heading", { name: "Robot at practice" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Google sync" }));
    expect(await screen.findByText("Team connection ready")).toBeInTheDocument();
    expect(screen.getByText(/credentials stay in Google Secret Manager/i)).toBeInTheDocument();
    expect(screen.queryByText(/client id|refresh token/i)).not.toBeInTheDocument();
  });
});
