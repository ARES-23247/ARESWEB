import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPhotosPage from "@/app/dashboard/photos/page";
import DashboardVideosPage from "@/app/dashboard/videos/page";
import VideosPage from "@/app/videos/page";
import { authenticatedFetch } from "@/lib/api";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "admin" },
    authorizedUser: { role: "admin" },
    loading: false,
  }),
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

const photo = {
  id: "photo-1",
  publicUrl: "https://storage.googleapis.com/photo.jpg",
  caption: "Robot at practice",
  altText: "Robot driving on the field",
  labels: [] as string[],
  albumId: null,
  mimeType: "image/jpeg",
  fileSize: 10,
  importedAt: "2026-01-01",
  isSynced: true,
  isArchived: false,
};

describe("media management pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads public videos from the bounded DTO API and never shows the internal ID", async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({ videos: [video], hasMore: false, nextCursor: null }),
    );
    render(<VideosPage />);
    expect(
      await screen.findByRole("heading", { name: "Robot reveal" }),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/videos/public?limit=24");
    expect(screen.queryByText("video_abcdefghijk")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Play Robot reveal" }),
    ).toBeInTheDocument();
  });

  it("reports an invalid public video response without inventing an empty library", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<!doctype html>", { status: 200, statusText: "OK" }),
    );
    render(<VideosPage />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "HTTP 200 OK: The video API returned invalid JSON.",
    );
    expect(
      screen.queryByText("No videos match this filter."),
    ).not.toBeInTheDocument();
  });

  it("archives a managed video through an accessible confirmation and keeps deletion reversible", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(
        response({ videos: [video], hasMore: false, nextCursor: null }),
      )
      .mockResolvedValueOnce(response({ success: true, archived: true }));
    render(<DashboardVideosPage />);
    expect(
      await screen.findByRole("heading", { name: "Robot reveal" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Archive Robot reveal" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Archive this video?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive video" }));
    await waitFor(() =>
      expect(authenticatedFetch).toHaveBeenCalledWith(
        "/api/videos/video_abcdefghijk",
        { method: "DELETE" },
      ),
    );
    expect(
      await screen.findByText(/moved to the archive/i),
    ).toBeInTheDocument();
  });

  it("shows only the safe team Google connection state on the photo dashboard", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/photos?"))
        return response({ photos: [photo], hasMore: false, nextCursor: null });
      if (url.startsWith("/api/photos/albums?"))
        return response({ albums: [], hasMore: false, nextCursor: null });
      if (url === "/api/photos/auth/status")
        return response({
          provider: "google-photos",
          accountOwner: "team",
          configured: true,
          credentialStorage: "secret-manager",
          capabilities: ["picker-import"],
        });
      throw new Error(`Unexpected URL ${url}`);
    });
    render(<DashboardPhotosPage />);
    expect(
      await screen.findByRole("heading", { name: "Robot at practice" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Google sync" }));
    expect(
      await screen.findByText("Team connection ready"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/credentials stay in Google Secret Manager/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/client id|refresh token/i),
    ).not.toBeInTheDocument();
  });

  it("keeps photo editing and reversible archiving wired through the extracted dialogs", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith("/api/photos?")) {
        return response({ photos: [photo], hasMore: false, nextCursor: null });
      }
      if (url.startsWith("/api/photos/albums?")) {
        return response({ albums: [], hasMore: false, nextCursor: null });
      }
      if (url === "/api/photos/auth/status") {
        return response({
          provider: "google-photos",
          accountOwner: "team",
          configured: true,
          credentialStorage: "secret-manager",
          capabilities: ["picker-import"],
        });
      }
      if (url === "/api/photos/photo-1" && init?.method === "PATCH") {
        return response({ photo: { ...photo, caption: "Updated caption" } });
      }
      if (url === "/api/photos/photo-1" && init?.method === "DELETE") {
        return response({ success: true, archived: true });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    render(<DashboardPhotosPage />);
    expect(
      await screen.findByRole("heading", { name: "Robot at practice" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit photo details" }));
    const caption = screen.getByLabelText("Caption");
    fireEvent.change(caption, { target: { value: "Updated caption" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() =>
      expect(authenticatedFetch).toHaveBeenCalledWith(
        "/api/photos/photo-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            caption: "Updated caption",
            altText: photo.altText,
            labels: [],
            albumId: null,
          }),
        }),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Updated caption" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archive photo" }));
    expect(
      screen.getByRole("dialog", { name: "Archive this photo?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(authenticatedFetch).toHaveBeenCalledWith("/api/photos/photo-1", {
        method: "DELETE",
      }),
    );
    expect(
      await screen.findByText(/moved to the archive/i),
    ).toBeInTheDocument();
  });

  it("passes the explicit page cursor when loading more photos", async () => {
    let photoRequestCount = 0;
    vi.mocked(authenticatedFetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/photos?")) {
        photoRequestCount += 1;
        return photoRequestCount === 1
          ? response({ photos: [photo], hasMore: true, nextCursor: "cursor-2" })
          : response({ photos: [], hasMore: false, nextCursor: null });
      }
      if (url.startsWith("/api/photos/albums?")) {
        return response({ albums: [], hasMore: false, nextCursor: null });
      }
      if (url === "/api/photos/auth/status") {
        return response({
          provider: "google-photos",
          accountOwner: "team",
          configured: true,
          credentialStorage: "secret-manager",
          capabilities: ["picker-import"],
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    render(<DashboardPhotosPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Load more photos" }),
    );

    await waitFor(() =>
      expect(authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining("cursor=cursor-2"),
      ),
    );
  });

  it("creates an album through the extracted editor dialog", async () => {
    const album = {
      id: "album-1",
      title: "Competition 2026",
      description: "Event photos",
      category: "Competition" as const,
      coverImageUrl: "",
      isPublic: true,
      mediaCount: 0,
      createdAt: "2026-01-01",
      isArchived: false,
    };
    vi.mocked(authenticatedFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith("/api/photos?")) {
        return response({ photos: [photo], hasMore: false, nextCursor: null });
      }
      if (url.startsWith("/api/photos/albums?")) {
        return response({ albums: [], hasMore: false, nextCursor: null });
      }
      if (url === "/api/photos/auth/status") {
        return response({
          provider: "google-photos",
          accountOwner: "team",
          configured: true,
          credentialStorage: "secret-manager",
          capabilities: ["picker-import"],
        });
      }
      if (url === "/api/photos/albums" && init?.method === "POST") {
        return response({ album });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    render(<DashboardPhotosPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Albums" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Create album" }),
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Competition 2026" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Event photos" },
    });
    fireEvent.click(
      screen.getByLabelText("Show this album in the public gallery"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save album" }));

    await waitFor(() =>
      expect(authenticatedFetch).toHaveBeenCalledWith(
        "/api/photos/albums",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            title: "Competition 2026",
            description: "Event photos",
            category: "Competition",
            coverImageUrl: "",
            isPublic: true,
          }),
        }),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Competition 2026" }),
    ).toBeInTheDocument();
  });
});
