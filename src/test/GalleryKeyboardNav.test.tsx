import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GalleryPage from "../app/gallery/page";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => null }));

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const mockPhotos = [
  {
    id: "photo-1",
    caption: "Robot Chassis Assembly",
    category: "Robot Specs",
    publicUrl: "https://images.example.org/photo-1.jpg",
    location: "Morgantown Lab",
    capturedAt: "2026-02-10",
  },
  {
    id: "photo-2",
    caption: "WV Regional Championship Match",
    category: "Competition",
    publicUrl: "https://images.example.org/photo-2.jpg",
    location: "Fairmont Fieldhouse",
    capturedAt: "2026-03-05",
  },
  {
    id: "photo-3",
    caption: "Community Library STEM Demo",
    category: "Outreach",
    publicUrl: "https://images.example.org/photo-3.jpg",
    location: "Morgantown Public Library",
    capturedAt: "2026-03-12",
  },
];

describe("GalleryPage Lightbox & Keyboard Navigation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("opens modal lightbox, displays photo count indicator, and cycles with ArrowLeft/ArrowRight", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ photos: mockPhotos, hasMore: false, nextCursor: null })));

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    );

    const firstCard = await screen.findByRole("button", { name: /open photo: Robot Chassis Assembly/i });
    expect(firstCard).toBeInTheDocument();

    fireEvent.click(firstCard);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("1 of 3")).toBeInTheDocument();

    // Navigate right with keyboard
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(dialog).getByRole("heading", { name: "WV Regional Championship Match" })).toBeInTheDocument();
    expect(within(dialog).getByText("2 of 3")).toBeInTheDocument();

    // Navigate right again
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(dialog).getByRole("heading", { name: "Community Library STEM Demo" })).toBeInTheDocument();
    expect(within(dialog).getByText("3 of 3")).toBeInTheDocument();

    // Navigate left with keyboard
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(within(dialog).getByRole("heading", { name: "WV Regional Championship Match" })).toBeInTheDocument();
    expect(within(dialog).getByText("2 of 3")).toBeInTheDocument();
  });
});
