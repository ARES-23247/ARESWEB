import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMedia } from "./useMedia";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";

// Mock the imageProcessor
vi.mock("../utils/imageProcessor", () => ({
  compressImage: vi.fn().mockImplementation(async (file: File) => ({ blob: file, ext: "png" }))
}));

// Mock Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe("useMedia hook", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Mock fetch for API calls
    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ media: [] }),
    } as unknown as Response));
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("should initialize with default states and extract assets correctly", async () => {
    const mockAssets = [
      { key: "img1.png", folder: "Events" },
      { key: "img2.png", folder: "Events" }
    ];

    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockAssets,
    } as unknown as Response);

    const { result } = renderHook(() => useMedia(), { wrapper });

    // Wait for query to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.assets).toHaveLength(2);
    expect(result.current.uniqueFolders).toEqual(["Events"]);
    expect(result.current.filteredAssets).toHaveLength(2);
    expect(result.current.isLoading).toBe(false);
  });

  it("should handle nested array in media response", async () => {
    const mockMedia = { media: [{ key: "img1.png", folder: "Library" }] };

    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockMedia,
    } as unknown as Response);

    const { result } = renderHook(() => useMedia(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.assets).toHaveLength(1);
    expect(result.current.uniqueFolders).toEqual(["Library"]);
  });

  it("should call delete mutation when deleteAsset is called and confirmed", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockImplementation(() => true);

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ media: [] }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as unknown as Response);

    const { result } = renderHook(() => useMedia(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    result.current.deleteAsset("test-key");

    expect(confirmSpy).toHaveBeenCalled();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(toast.success).toHaveBeenCalledWith("Asset deleted");

    confirmSpy.mockRestore();
  });

  it("should call move mutation when moveAsset is called", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ media: [] }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as unknown as Response);

    const { result } = renderHook(() => useMedia(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    result.current.moveAsset("test-key", "new-folder");

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(toast.success).toHaveBeenCalledWith("Asset moved");
  });

  it("should call syndicate mutation callbacks", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ media: [] }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as unknown as Response);

    const { result } = renderHook(() => useMedia(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Trigger syndicate mutation
    await act(async () => {
      result.current.syndicateMutation.mutate({ key: "test-key", platforms: ["twitter"], caption: "test" });
    });

    expect(toast.success).toHaveBeenCalledWith("Syndicated!");
    expect(result.current.syndicateKey).toBeNull();
  });

  it("should execute bulkUpload successfully", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ media: [] }),
      } as unknown as Response)
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as unknown as Response);

    const { result } = renderHook(() => useMedia(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Create dummy files
    const file1 = new File(["dummy"], "test1.png", { type: "image/png" });
    const file2 = new File(["dummy"], "test2.png", { type: "image/png" });

    await act(async () => {
      await result.current.uploadAssets([file1, file2]);
    });

    expect(toast.success).toHaveBeenCalledWith("Uploaded 2 assets");

    vi.clearAllMocks();
  });

  it("should handle bulkUpload errors gracefully", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ media: [] }),
      } as unknown as Response)
      .mockRejectedValueOnce(new Error("Network Error"));

    const { result } = renderHook(() => useMedia(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const file1 = new File(["dummy"], "test1.png", { type: "image/png" });

    await act(async () => {
      await result.current.uploadAssets([file1]);
    });

    // It should not call success toast because successCount is 0
    expect(toast.success).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    // Verbose error toast should include error name and message
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Network Error"));

    vi.clearAllMocks();
  });

  it("should filter assets by selectedFolderFilter", async () => {
    const mockAssets = [
      { key: "img1.png", folder: "Events" },
      { key: "img2.png", folder: "Library" }
    ];

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAssets,
    } as unknown as Response);

    const { result } = renderHook(() => useMedia(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.filteredAssets).toHaveLength(2); // "All" is default

    act(() => {
      result.current.setSelectedFolderFilter("Events");
    });

    expect(result.current.filteredAssets).toHaveLength(1);
    expect(result.current.filteredAssets[0].folder).toBe("Events");
  });
});
