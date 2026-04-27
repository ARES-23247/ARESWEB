import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMedia } from "./useMedia";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { api } from "../api/client";
import { toast } from "sonner";

// Mock the API client
vi.mock("../api/client", () => ({
  api: {
    media: {
      adminList: {
        useQuery: vi.fn(),
      },
      upload: {
        useMutation: vi.fn(),
      },
      delete: {
        useMutation: vi.fn(),
      },
      move: {
        useMutation: vi.fn(),
      },
      syndicate: {
        useMutation: vi.fn(),
      },
    },
  },
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

  // Variables to hold the mutation options passed to useMutation so we can trigger callbacks manually
  let uploadMutationOptions: any;
  let deleteMutationOptions: any;
  let moveMutationOptions: any;
  let syndicateMutationOptions: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Capture the options passed to useMutation
    (api.media.upload.useMutation as any).mockImplementation((options: any) => {
      uploadMutationOptions = options;
      return { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
    });
    (api.media.delete.useMutation as any).mockImplementation((options: any) => {
      deleteMutationOptions = options;
      return { mutate: vi.fn(), isPending: false };
    });
    (api.media.move.useMutation as any).mockImplementation((options: any) => {
      moveMutationOptions = options;
      return { mutate: vi.fn(), isPending: false };
    });
    (api.media.syndicate.useMutation as any).mockImplementation((options: any) => {
      syndicateMutationOptions = options;
      return { mutate: vi.fn(), isPending: false };
    });

    (api.media.adminList.useQuery as any).mockReturnValue({
      data: { body: { assets: [] } },
      isLoading: false,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("should initialize with default states and extract assets correctly", () => {
    (api.media.adminList.useQuery as any).mockReturnValue({
      data: { body: [{ key: "img1.png", folder: "Events" }, { key: "img2.png", folder: "Events" }] },
      isLoading: false,
    });

    const { result } = renderHook(() => useMedia(), { wrapper });
    
    expect(result.current.assets).toHaveLength(2);
    expect(result.current.uniqueFolders).toEqual(["Events"]);
    expect(result.current.filteredAssets).toHaveLength(2);
    expect(result.current.isLoading).toBe(false);
  });

  it("should handle nested array in media response", () => {
    (api.media.adminList.useQuery as any).mockReturnValue({
      data: { body: { media: [{ key: "img1.png", folder: "Library" }] } },
      isLoading: false,
    });

    const { result } = renderHook(() => useMedia(), { wrapper });
    expect(result.current.assets).toHaveLength(1);
    expect(result.current.uniqueFolders).toEqual(["Library"]);
  });

  it("should call delete mutation when deleteAsset is called and confirmed", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockImplementation(() => true);
    const { result } = renderHook(() => useMedia(), { wrapper });
    
    result.current.deleteAsset("test-key");
    
    expect(confirmSpy).toHaveBeenCalled();
    // Simulate onSuccess
    act(() => deleteMutationOptions.onSuccess());
    expect(toast.success).toHaveBeenCalledWith("Asset deleted");
    
    // Simulate onError
    act(() => deleteMutationOptions.onError(new Error("Fail")));
    expect(toast.error).toHaveBeenCalledWith("Fail");
    
    confirmSpy.mockRestore();
  });

  it("should call move mutation when moveAsset is called", () => {
    const { result } = renderHook(() => useMedia(), { wrapper });
    
    result.current.moveAsset("test-key", "new-folder");
    
    // Simulate onSuccess
    act(() => moveMutationOptions.onSuccess());
    expect(toast.success).toHaveBeenCalledWith("Asset moved");
    
    // Simulate onError
    act(() => moveMutationOptions.onError(new Error("Move fail")));
    expect(toast.error).toHaveBeenCalledWith("Move fail");
  });

  it("should call syndicate mutation callbacks", () => {
    const { result } = renderHook(() => useMedia(), { wrapper });
    
    // Simulate onSuccess
    act(() => syndicateMutationOptions.onSuccess());
    expect(toast.success).toHaveBeenCalledWith("Syndicated!");
    expect(result.current.syndicateKey).toBeNull();
    
    // Simulate onError
    act(() => syndicateMutationOptions.onError(new Error("Sync fail")));
    expect(toast.error).toHaveBeenCalledWith("Sync fail");
  });

  it("should execute bulkUpload successfully", async () => {
    const { result } = renderHook(() => useMedia(), { wrapper });
    
    // Create dummy files
    const file1 = new File(["dummy"], "test1.png", { type: "image/png" });
    const file2 = new File(["dummy"], "test2.png", { type: "image/png" });
    
    await act(async () => {
      await result.current.uploadAssets([file1, file2]);
    });
    
    expect(toast.success).toHaveBeenCalledWith("Uploaded 2 assets");

    // Test upload success and error callbacks
    act(() => uploadMutationOptions.onSuccess());
    // Invalidate query shouldn't throw.
    
    act(() => uploadMutationOptions.onError(new Error("Upload failed msg")));
    expect(toast.error).toHaveBeenCalledWith("Upload failed msg");
  });

  it("should handle bulkUpload errors gracefully", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    // Mock mutateAsync to reject
    (api.media.upload.useMutation as any).mockImplementation((options: any) => {
      uploadMutationOptions = options;
      return { mutateAsync: vi.fn().mockRejectedValue(new Error("Network Error")), isPending: false };
    });

    const { result } = renderHook(() => useMedia(), { wrapper });
    
    const file1 = new File(["dummy"], "test1.png", { type: "image/png" });
    
    await act(async () => {
      await result.current.uploadAssets([file1]);
    });
    
    // It should not call success toast because successCount is 0
    expect(toast.success).not.toHaveBeenCalledWith("Uploaded 1 assets");
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    consoleErrorSpy.mockRestore();
  });

  it("should filter assets by selectedFolderFilter", () => {
    (api.media.adminList.useQuery as any).mockReturnValue({
      data: { body: [
        { key: "img1.png", folder: "Events" }, 
        { key: "img2.png", folder: "Library" }
      ]},
      isLoading: false,
    });

    const { result } = renderHook(() => useMedia(), { wrapper });
    
    expect(result.current.filteredAssets).toHaveLength(2); // "All" is default

    act(() => {
      result.current.setSelectedFolderFilter("Events");
    });

    expect(result.current.filteredAssets).toHaveLength(1);
    expect(result.current.filteredAssets[0].folder).toBe("Events");
  });
});
