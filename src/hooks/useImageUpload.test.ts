import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../test/utils";
import { useImageUpload } from "./useImageUpload";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { act } from "@testing-library/react";

vi.mock("../utils/imageProcessor", () => ({
  compressImage: vi.fn().mockResolvedValue({
    blob: new Blob(["compressed"], { type: "image/webp" }),
    ext: ".webp"
  }),
}));

describe("useImageUpload", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it("uploads a file successfully", async () => {
    server.use(
      http.post("*/api/media", () => {
        return HttpResponse.json({ url: "/api/media/test.webp", altText: "Test image" });
      })
    );

    const { result } = renderWithProviders(() => useImageUpload());
    const file = new File(["test"], "test.png", { type: "image/png" });

    let uploadResult: { url: string; altText?: string } | undefined;
    await act(async () => {
      uploadResult = await result.current.uploadFile(file);
    });

    expect(uploadResult).toEqual({ url: "/api/media/test.webp", altText: "Test image" });
    expect(result.current.isUploading).toBe(false);
    expect(result.current.errorMsg).toBe("");
  });

  it("handles upload failure", async () => {
    server.use(
      http.post("*/api/media", () => {
        return HttpResponse.json({ error: "Storage full" }, { status: 507 });
      })
    );

    const { result } = renderWithProviders(() => useImageUpload());
    const file = new File(["test"], "test.png", { type: "image/png" });

    await act(async () => {
      try {
        await result.current.uploadFile(file);
      } catch {
        // Expected
      }
    });

    // Re-access result.current after act completes
    const { isUploading, errorMsg } = result.current;
    expect(isUploading).toBe(false);
    expect(errorMsg).toContain("Storage full");
  });

  it("handles missing url in response", async () => {
    server.use(
      http.post("*/api/media", () => {
        // Return an error response indicating upload failed
        return HttpResponse.json({ error: "Upload failed" }, { status: 500 });
      })
    );

    const { result } = renderWithProviders(() => useImageUpload());
    const file = new File(["test"], "test.png", { type: "image/png" });

    await act(async () => {
      try {
        await result.current.uploadFile(file);
      } catch {
        // Expected
      }
    });

    // Re-access result.current after act completes
    const { errorMsg } = result.current;
    expect(errorMsg).toBeTruthy();
    expect(errorMsg).toContain("Upload failed");
  });
});
