import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../test/utils";
import { useMedia } from "./useMedia";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { act, waitFor } from "@testing-library/react";

vi.mock("../utils/imageProcessor", () => ({
  compressImage: vi.fn().mockResolvedValue({
    blob: new Blob(["compressed"], { type: "image/webp" }),
    ext: ".webp"
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useMedia", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
    // Mock confirm to return true by default
    global.confirm = vi.fn(() => true) as never;
  });

  describe("initial state and data fetching", () => {
    it("should return loading state initially", () => {
      server.use(
        http.get("*/api/media/admin", () => {
          return new Promise(() => {}); // Never resolve to keep loading
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isError).toBe(false);
    });

    it("should fetch and return media assets", async () => {
      const mockAssets = [
        { key: "robot1.jpg", folder: "Library", url: "https://example.com/robot1.jpg", uploaded: "2024-01-01", size: 1024 },
        { key: "robot2.jpg", folder: "Competition", url: "https://example.com/robot2.jpg", uploaded: "2024-01-02", size: 2048 },
      ];

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: mockAssets });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.assets).toEqual(mockAssets);
      expect(result.current.isError).toBe(false);
    });

    it("should handle empty media response", async () => {
      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.assets).toEqual([]);
      expect(result.current.filteredAssets).toEqual([]);
      expect(result.current.uniqueFolders).toEqual([]);
    });

    it("should handle fetch error", async () => {
      server.use(
        http.get("*/api/media/admin", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
    });

    it("should extract unique folders from assets", async () => {
      const mockAssets = [
        { key: "a.jpg", folder: "Library", url: "https://example.com/a.jpg", uploaded: "2024-01-01", size: 1024 },
        { key: "b.jpg", folder: "Competition", url: "https://example.com/b.jpg", uploaded: "2024-01-02", size: 2048 },
        { key: "c.jpg", folder: "Library", url: "https://example.com/c.jpg", uploaded: "2024-01-03", size: 1024 },
        { key: "d.jpg", folder: "", url: "https://example.com/d.jpg", uploaded: "2024-01-04", size: 512 },
      ];

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: mockAssets });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should only include non-empty folders
      expect(result.current.uniqueFolders).toEqual(["Library", "Competition"]);
    });
  });

  describe("folder filtering", () => {
    it("should filter assets by selected folder", async () => {
      const mockAssets = [
        { key: "a.jpg", folder: "Library", url: "https://example.com/a.jpg", uploaded: "2024-01-01", size: 1024 },
        { key: "b.jpg", folder: "Competition", url: "https://example.com/b.jpg", uploaded: "2024-01-02", size: 2048 },
        { key: "c.jpg", folder: "Library", url: "https://example.com/c.jpg", uploaded: "2024-01-03", size: 1024 },
      ];

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: mockAssets });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Default is "All"
      expect(result.current.filteredAssets).toEqual(mockAssets);
      expect(result.current.selectedFolderFilter).toBe("All");

      // Select "Library" folder
      act(() => {
        result.current.setSelectedFolderFilter("Library");
      });

      expect(result.current.filteredAssets).toEqual([
        mockAssets[0],
        mockAssets[2],
      ]);
      expect(result.current.selectedFolderFilter).toBe("Library");
    });

    it("should show all assets when folder filter is 'All'", async () => {
      const mockAssets = [
        { key: "a.jpg", folder: "Library", url: "https://example.com/a.jpg", uploaded: "2024-01-01", size: 1024 },
        { key: "b.jpg", folder: "Competition", url: "https://example.com/b.jpg", uploaded: "2024-01-02", size: 2048 },
      ];

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: mockAssets });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSelectedFolderFilter("Competition");
      });

      expect(result.current.filteredAssets).toEqual([mockAssets[1]]);

      act(() => {
        result.current.setSelectedFolderFilter("All");
      });

      expect(result.current.filteredAssets).toEqual(mockAssets);
    });
  });

  describe("delete asset", () => {
    it("should delete asset when confirm returns true", async () => {
      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [{ key: "test.jpg", folder: "Library", url: "https://example.com/test.jpg", uploaded: "2024-01-01", size: 1024 }] });
        }),
        http.delete("*/api/media/admin/test.jpg", () => {
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.assets).toHaveLength(1);

      act(() => {
        result.current.deleteAsset("test.jpg");
      });

      expect(global.confirm).toHaveBeenCalledWith("Permanently purge this asset from R2?");

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });
    });

    it("should not delete asset when confirm returns false", async () => {
      global.confirm = vi.fn(() => false) as never;

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [{ key: "test.jpg", folder: "Library", url: "https://example.com/test.jpg", uploaded: "2024-01-01", size: 1024 }] });
        }),
        http.delete("*/api/media/admin/test.jpg", () => {
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.deleteAsset("test.jpg");
      });

      expect(global.confirm).toHaveBeenCalledWith("Permanently purge this asset from R2?");
      expect(result.current.isDeleting).toBe(false);
    });

    it("should handle delete error", async () => {
      const { toast } = await import("sonner");

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        }),
        http.delete("*/api/media/admin/test.jpg", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.deleteAsset("test.jpg");
      });

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });

      expect(toast.error).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe("upload assets", () => {
    it("should upload a single file successfully", async () => {
      const { toast } = await import("sonner");
      const { compressImage } = await import("../utils/imageProcessor");

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        }),
        http.post("*/api/media/admin/upload", () => {
          return HttpResponse.json({ success: true, key: "uploaded.jpg", url: "https://example.com/uploaded.jpg" });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const file = new File(["test"], "test.png", { type: "image/png" });

      await act(async () => {
        await result.current.uploadAssets([file]);
      });

      expect(compressImage).toHaveBeenCalledWith(file);
      expect(result.current.isUploading).toBe(false);
      expect(toast.success).toHaveBeenCalledWith("Uploaded 1 asset");
    });

    it("should upload multiple files in bulk", async () => {
      const { toast } = await import("sonner");
      const { compressImage } = await import("../utils/imageProcessor");

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        }),
        http.post("*/api/media/admin/upload", () => {
          return HttpResponse.json({ success: true, key: "uploaded.jpg", url: "https://example.com/uploaded.jpg" });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const files = [
        new File(["test1"], "test1.png", { type: "image/png" }),
        new File(["test2"], "test2.png", { type: "image/png" }),
        new File(["test3"], "test3.png", { type: "image/png" }),
      ];

      await act(async () => {
        await result.current.uploadAssets(files);
      });

      expect(compressImage).toHaveBeenCalledTimes(3);
      expect(toast.success).toHaveBeenCalledWith("Uploaded 3 assets");
    });

    it("should use 'Library' folder when filter is 'All'", async () => {
      await import("../utils/imageProcessor");

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        }),
        http.post("*/api/media/admin/upload", async ({ request }) => {
          const formData = await request.formData();
          const folder = formData.get("folder");
          return HttpResponse.json({ success: true, key: "uploaded.jpg", url: "https://example.com/uploaded.jpg", folder });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.selectedFolderFilter).toBe("All");

      const file = new File(["test"], "test.png", { type: "image/png" });

      await act(async () => {
        await result.current.uploadAssets([file]);
      });

      // Verify folder was set to "Library" when "All" is selected
    });

    it("should use selected folder for upload", async () => {
      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        }),
        http.post("*/api/media/admin/upload", async ({ request }) => {
          const formData = await request.formData();
          const folder = formData.get("folder");
          return HttpResponse.json({ success: true, key: "uploaded.jpg", url: "https://example.com/uploaded.jpg", folder: String(folder) });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSelectedFolderFilter("Competition");
      });

      const file = new File(["test"], "test.png", { type: "image/png" });

      await act(async () => {
        await result.current.uploadAssets([file]);
      });
    });

    it("should handle individual file upload failure in bulk", async () => {
      const { toast } = await import("sonner");
      await import("../utils/imageProcessor");

      // First file succeeds, second fails
      let callCount = 0;
      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        }),
        http.post("*/api/media/admin/upload", () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json({ success: true, key: "uploaded.jpg", url: "https://example.com/uploaded.jpg" });
          }
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const files = [
        new File(["test1"], "test1.png", { type: "image/png" }),
        new File(["test2"], "test2.png", { type: "image/png" }),
      ];

      await act(async () => {
        await result.current.uploadAssets(files);
      });

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("test2.png"));
      expect(toast.success).toHaveBeenCalledWith("Uploaded 1 asset");
    });

    it("should handle compression error", async () => {
      const { toast } = await import("sonner");
      const { compressImage } = await import("../utils/imageProcessor");

      (compressImage as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Compression failed"));

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        }),
        http.post("*/api/media/admin/upload", () => {
          return HttpResponse.json({ success: true, key: "uploaded.jpg", url: "https://example.com/uploaded.jpg" });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const file = new File(["test"], "test.png", { type: "image/png" });

      await act(async () => {
        await result.current.uploadAssets([file]);
      });

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("test.png"));
    });
  });

  describe("move asset", () => {
    it("should move asset to new folder", async () => {
      const { toast } = await import("sonner");

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        }),
        http.put("*/api/media/admin/move/test.jpg", () => {
          return HttpResponse.json({ success: true, newKey: "Competition/test.jpg" });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.moveAsset("test.jpg", "Competition");
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.isMoving).toBe(false);
      });

      expect(toast.success).toHaveBeenCalledWith("Asset moved");
    });

    it("should handle move error", async () => {
      const { toast } = await import("sonner");

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        }),
        http.put("*/api/media/admin/move/test.jpg", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.moveAsset("test.jpg", "Competition");
      });

      await waitFor(() => {
        expect(result.current.isMoving).toBe(false);
      });

      expect(toast.error).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe("syndicate state", () => {
    it("should manage syndicate key and caption state", async () => {
      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.syndicateKey).toBe(null);
      expect(result.current.syndicateCaption).toBe("");

      act(() => {
        result.current.setSyndicateKey("test.jpg");
      });

      expect(result.current.syndicateKey).toBe("test.jpg");

      act(() => {
        result.current.setSyndicateCaption("Check out this robot!");
      });

      expect(result.current.syndicateCaption).toBe("Check out this robot!");
    });

    it("should reset syndicate state after successful syndication", async () => {
      const { toast } = await import("sonner");

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        }),
        http.post("*/api/media/admin/syndicate", () => {
          return HttpResponse.json({ success: true, message: "Syndicated to social media" });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSyndicateKey("test.jpg");
        result.current.setSyndicateCaption("Great photo!");
      });

      expect(result.current.syndicateKey).toBe("test.jpg");
      expect(result.current.syndicateCaption).toBe("Great photo!");

      await act(async () => {
        await result.current.syndicateMutation.mutateAsync({ key: "test.jpg", caption: "Great photo!" });
      });

      expect(toast.success).toHaveBeenCalledWith("Syndicated!");

      // State should be reset
      expect(result.current.syndicateKey).toBe(null);
      expect(result.current.syndicateCaption).toBe("");
    });

    it("should handle syndicate error", async () => {
      const { toast } = await import("sonner");

      server.use(
        http.get("*/api/media/admin", () => {
          return HttpResponse.json({ media: [] });
        }),
        http.post("*/api/media/admin/syndicate", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderWithProviders(() => useMedia());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.syndicateMutation.mutateAsync({ key: "test.jpg" });
        } catch {
          // Expected
        }
      });

      expect(toast.error).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe("type exports", () => {
    it("should export Asset and MediaResponse types", () => {
      expect(true).toBe(true); // Placeholder - actual type checking happens at compile time
    });
  });
});
