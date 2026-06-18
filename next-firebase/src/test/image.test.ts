import { vi, describe, it, expect, beforeEach } from "vitest";
import { readFileAsBase64, resizeAndCompressImage } from "../lib/image";

describe("image utilities", () => {
  beforeEach(() => {
    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-blob-id");
    global.URL.revokeObjectURL = vi.fn();
  });

  describe("readFileAsBase64", () => {
    it("should read File object as base64 string", async () => {
      const blob = new Blob(["test-image-content"], { type: "image/png" });
      const file = new File([blob], "test.png", { type: "image/png" });
      const base64 = await readFileAsBase64(file);
      expect(base64).toBeTypeOf("string");
      expect(base64.length).toBeGreaterThan(0);
    });
  });

  describe("resizeAndCompressImage", () => {
    it("should pass through SVG files without resizing", async () => {
      const blob = new Blob(["<svg></svg>"], { type: "image/svg+xml" });
      const file = new File([blob], "vector.svg", { type: "image/svg+xml" });
      const result = await resizeAndCompressImage(file);
      expect(result.mimeType).toBe("image/svg+xml");
      expect(result.base64).toBeTypeOf("string");
    });

    it("should pass through GIF files without resizing", async () => {
      const blob = new Blob(["GIF89a..."], { type: "image/gif" });
      const file = new File([blob], "animated.gif", { type: "image/gif" });
      const result = await resizeAndCompressImage(file);
      expect(result.mimeType).toBe("image/gif");
      expect(result.base64).toBeTypeOf("string");
    });

    it("should resize and compress standard images", async () => {
      const blob = new Blob(["fake-image-bytes"], { type: "image/png" });
      const file = new File([blob], "photo.png", { type: "image/png" });

      // Mock Image constructor
      const mockImage = {
        naturalWidth: 4000,
        naturalHeight: 3000,
        set src(_val: string) {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        },
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      
      const originalImage = global.Image;
      global.Image = function() {
        return mockImage;
      } as any;

      // Mock canvas methods
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
        })),
        toDataURL: vi.fn(() => "data:image/jpeg;base64,mocked-base64-string"),
      };
      const originalCreateElement = document.createElement;
      document.createElement = vi.fn((tag) => {
        if (tag === "canvas") return mockCanvas as any;
        return originalCreateElement.call(document, tag);
      });

      const result = await resizeAndCompressImage(file, 2048, 2048);
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.base64).toBe("mocked-base64-string");

      // Cleanup
      global.Image = originalImage;
      document.createElement = originalCreateElement;
    });

    it("should fall back to original base64 if image onload fails", async () => {
      const blob = new Blob(["fake-image-bytes"], { type: "image/png" });
      const file = new File([blob], "photo.png", { type: "image/png" });

      // Mock Image constructor with failure trigger
      const mockImage = {
        set src(_val: string) {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 0);
        },
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };

      const originalImage = global.Image;
      global.Image = function() {
        return mockImage;
      } as any;

      const result = await resizeAndCompressImage(file);
      expect(result.mimeType).toBe("image/png");
      expect(result.base64).toBeTypeOf("string");

      global.Image = originalImage;
    });
  });
});
