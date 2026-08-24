import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthenticatedImage, {
  adminMediaFallbackUrl,
  isAuthenticatedMediaUrl,
} from "@/components/media/AuthenticatedImage";
import { authenticatedFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));

describe("AuthenticatedImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn(() => "blob:protected-image") },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });
  });

  it("recognizes authenticated and owner-qualified same-origin media routes", () => {
    expect(isAuthenticatedMediaUrl("/api/photos/admin/media/photo-1/original")).toBe(true);
    expect(isAuthenticatedMediaUrl("/api/photos/public/content/posts/build-log/photo-1/original")).toBe(true);
    expect(isAuthenticatedMediaUrl("/api/photos/public/media/photo-1/original")).toBe(false);
    expect(isAuthenticatedMediaUrl("https://images.example.org/photo.jpg")).toBe(false);
    expect(adminMediaFallbackUrl("/api/photos/public/content/posts/build-log/photo-1/thumbnail"))
      .toBe("/api/photos/admin/media/photo-1/thumbnail");
    expect(adminMediaFallbackUrl("/api/photos/public/media/photo-1/original")).toBeNull();
  });

  it("loads protected image bytes with authenticatedFetch and revokes the blob URL", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(new Blob(["image"], { type: "image/jpeg" }), {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    }));
    const { unmount } = render(
      <AuthenticatedImage src="/api/photos/admin/media/photo-1/original" alt="Robot progress" />,
    );
    expect(screen.getByLabelText("Robot progress (loading)")).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(screen.getByRole("img", { name: "Robot progress" })).toHaveAttribute("src", "blob:protected-image"));
    expect(authenticatedFetch).toHaveBeenCalledWith("/api/photos/admin/media/photo-1/original");
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:protected-image");
  });

  it("renders an explicit accessible failure state", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response("no", { status: 403 }));
    render(<AuthenticatedImage src="/api/photos/admin/media/photo-1/original" alt="Robot progress" />);
    expect(await screen.findByLabelText("Robot progress (image unavailable)")).toHaveTextContent("Image unavailable");
  });

  it("falls back privately when an owner-qualified draft is not public", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(new Response("not public", { status: 404 }))
      .mockResolvedValueOnce(new Response(new Blob(["draft"], { type: "image/webp" }), {
        status: 200,
        headers: { "content-type": "image/webp" },
      }));
    render(
      <AuthenticatedImage
        src="/api/photos/public/content/posts/draft-log/photo-1/medium"
        alt="Draft robot"
      />,
    );
    await waitFor(() => expect(screen.getByRole("img", { name: "Draft robot" }))
      .toHaveAttribute("src", "blob:protected-image"));
    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      1,
      "/api/photos/public/content/posts/draft-log/photo-1/medium",
    );
    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      2,
      "/api/photos/admin/media/photo-1/medium",
    );
  });

  it("uses ordinary image loading for public and external URLs", () => {
    render(<AuthenticatedImage src="/api/photos/public/media/photo-1/original" alt="Published robot" onError={vi.fn()} />);
    const image = screen.getByRole("img", { name: "Published robot" });
    expect(image).toHaveAttribute("src", "/api/photos/public/media/photo-1/original");
    fireEvent.error(image);
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });
});
