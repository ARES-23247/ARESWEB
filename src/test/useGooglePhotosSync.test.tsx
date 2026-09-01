import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGooglePhotosSync } from "@/app/dashboard/photos/useGooglePhotosSync";
import { authenticatedFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));

const connection = {
  provider: "google-photos" as const,
  accountOwner: "team" as const,
  configured: true,
  credentialStorage: "secret-manager" as const,
  capabilities: ["picker-import"] as const,
};
const album = {
  id: "album-1",
  title: "Practice",
  description: "Build season progress",
  category: "Practice" as const,
  coverImageUrl: "",
  coverPhotoId: null,
  isPublic: false,
  isArchived: false,
  mediaCount: 0,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("useGooglePhotosSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads connection state and completes the picker import lifecycle", async () => {
    let poll: (() => Promise<void>) | undefined;
    const popup = {
      close: vi.fn(),
      location: { href: "about:blank" },
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    const loadPhotos = vi.fn().mockResolvedValue(undefined);
    const loadAlbums = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();

    vi.mocked(authenticatedFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/photos/auth/status") {
        return new Response(JSON.stringify(connection), { status: 200 });
      }
      if (url === "/api/photos/picker" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            sessionId: "picker-1",
            pickerUri: "https://photos.google.com/picker/session",
          }),
          { status: 200 },
        );
      }
      if (url === "/api/photos/picker/picker-1" && !init?.method) {
        return new Response(JSON.stringify({ mediaItemsSet: true }), {
          status: 200,
        });
      }
      if (url === "/api/photos/picker/picker-1/items") {
        return new Response(
          JSON.stringify({
            mediaItems: [
              { id: "photo-1", mediaFile: { baseUrl: "https://example.test" } },
            ],
            count: 1,
          }),
          { status: 200 },
        );
      }
      if (url === "/api/photos/import" && init?.method === "POST") {
        return new Response(JSON.stringify({ imported: 1, failed: 0 }), {
          status: 200,
        });
      }
      if (url === "/api/photos/picker/picker-1" && init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const { result, unmount } = renderHook(() =>
      useGooglePhotosSync({
        canManage: true,
        albums: [album],
        loadPhotos,
        loadAlbums,
        onError,
      }),
    );

    await waitFor(() => expect(result.current.connection).toEqual(connection));
    expect(result.current.connectionLoading).toBe(false);
    vi.spyOn(window, "setInterval").mockImplementation((handler) => {
      poll = handler as () => Promise<void>;
      return 17 as unknown as ReturnType<typeof window.setInterval>;
    });
    const clearInterval = vi.spyOn(window, "clearInterval");

    await act(async () => {
      await result.current.startPicker();
    });
    expect(popup.location.href).toBe(
      "https://photos.google.com/picker/session",
    );
    expect(result.current.pickerStatus).toMatch(/Choose photos/i);
    expect(poll).toBeTypeOf("function");

    await act(async () => {
      await poll?.();
    });
    expect(result.current.pickerItemCount).toBe(1);
    expect(result.current.pickerStatus).toMatch(/1 photo selected/i);
    expect(clearInterval).toHaveBeenCalledWith(17);

    act(() => result.current.setSyncAlbum("album-1"));
    await act(async () => {
      await result.current.importPickerItems();
    });
    expect(result.current.pickerItemCount).toBe(0);
    expect(result.current.pickerStatus).toMatch(/Imported 1 photo/i);
    expect(loadPhotos).toHaveBeenCalledWith(false);
    expect(loadAlbums).toHaveBeenCalledWith(false);
    expect(onError).toHaveBeenCalledWith("");
    expect(popup.close).not.toHaveBeenCalled();

    unmount();
    expect(clearInterval).toHaveBeenCalledWith(17);
  });

  it("does not expose picker operations to users without management access", async () => {
    const loadPhotos = vi.fn();
    const loadAlbums = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useGooglePhotosSync({
        canManage: false,
        albums: [],
        loadPhotos,
        loadAlbums,
        onError,
      }),
    );

    await act(async () => {
      await result.current.loadConnection();
      await result.current.startPicker();
      await result.current.importPickerItems();
    });

    expect(authenticatedFetch).not.toHaveBeenCalled();
    expect(result.current.connection).toBeNull();
    expect(loadPhotos).not.toHaveBeenCalled();
    expect(loadAlbums).not.toHaveBeenCalled();
  });

  it("reports connection and picker start failures and closes the placeholder popup", async () => {
    const popup = {
      close: vi.fn(),
      location: { href: "about:blank" },
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    const onError = vi.fn();
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }),
    );

    const { result } = renderHook(() =>
      useGooglePhotosSync({
        canManage: true,
        albums: [],
        loadPhotos: vi.fn(),
        loadAlbums: vi.fn(),
        onError,
      }),
    );

    await waitFor(() => expect(onError).toHaveBeenCalled());
    await act(async () => {
      await result.current.startPicker();
    });
    expect(popup.close).toHaveBeenCalledOnce();
    expect(result.current.pickerBusy).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("unavailable"));
  });
});
