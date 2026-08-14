import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GalleryPage from "../app/gallery/page";
import {
  GALLERY_ALBUMS,
  GALLERY_PHOTOS,
  isSafePublicTag,
  sanitizePhotoTags,
  sanitizeExif,
  filterAlbums,
  filterPhotos,
  groupPhotosByAlbum,
  groupPhotosBySeason,
  mergeApiPhotosWithCurated,
} from "@/lib/galleryData";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => <div data-testid="greek-meander" /> }));

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("GalleryAlbumCollections & Interactive Lightbox Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ photos: [], hasMore: false, nextCursor: null })));
  });

  it("renders page header, season chips, category filters, and curated albums", async () => {
    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /Team Media & Albums/i })).toBeInTheDocument();
    expect(screen.getByText(/Published Team Media Vault/i)).toBeInTheDocument();

    // Verify filter buttons exist
    expect(screen.getByRole("button", { name: "All Seasons" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2025-2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2024-2025" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2023-2024" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "All Categories" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Competitions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Outreach" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Robot Build" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Team Culture" })).toBeInTheDocument();
  });

  it("switches to event albums view and supports album drill-down and back navigation", async () => {
    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    );

    // Switch to Albums view
    const albumsViewBtn = await screen.findByRole("button", { name: /Event Albums/i });
    fireEvent.click(albumsViewBtn);

    // Verify curated event albums are rendered
    expect(await screen.findByText("WV State Championship 2026")).toBeInTheDocument();
    expect(screen.getByText("Spark! STEM Expo")).toBeInTheDocument();
    expect(screen.getByText("World Championship Houston Pit")).toBeInTheDocument();
    expect(screen.getByText("Centerstage Legacy")).toBeInTheDocument();

    // Drill down into WV State Championship album
    const wvAlbumCard = (await screen.findByText("WV State Championship 2026")).closest("button");
    expect(wvAlbumCard).toBeInTheDocument();
    fireEvent.click(wvAlbumCard!);

    // Should show album header and back button
    expect(await screen.findByRole("button", { name: /Back to all albums/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "WV State Championship 2026" })).toBeInTheDocument();

    // Navigate back to albums grid
    fireEvent.click(screen.getByRole("button", { name: /Back to all albums/i }));
    expect(await screen.findByText("Spark! STEM Expo")).toBeInTheDocument();
  });

  it("filters albums and photos when clicking season and category filter chips", async () => {
    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    );

    // Wait for initial render
    await screen.findByRole("heading", { name: /Team Media & Albums/i });

    // Filter by season: 2023-2024
    const season2023Btn = screen.getByRole("button", { name: "2023-2024" });
    fireEvent.click(season2023Btn);

    expect(await screen.findByText("Centerstage Active Roller Intake CAD")).toBeInTheDocument();
    expect(screen.queryByText("Match Playoff Autonomous Sequence")).not.toBeInTheDocument();

    // Reset season to All Seasons
    fireEvent.click(screen.getByRole("button", { name: "All Seasons" }));

    // Filter by category: Outreach
    const outreachBtn = screen.getByRole("button", { name: "Outreach" });
    fireEvent.click(outreachBtn);

    expect(await screen.findByText("Youth Hands-On Driving Station")).toBeInTheDocument();
    expect(screen.queryByText("Centerstage Active Roller Intake CAD")).not.toBeInTheDocument();
  });

  it("filters items by search keyword input", async () => {
    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    );

    const searchInput = await screen.findByPlaceholderText(/Search albums, subsystems, tags, or venues…/i);
    fireEvent.change(searchInput, { target: { value: "AprilTag" } });

    expect(await screen.findByText("Sensory & Vision Demo Station")).toBeInTheDocument();
    expect(screen.queryByText("Centerstage Active Roller Intake CAD")).not.toBeInTheDocument();
  });

  it("opens interactive lightbox modal, displays EXIF details, and navigates with keyboard", async () => {
    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    );

    // Open first photo
    const firstPhotoCard = await screen.findByRole("button", { name: /Open photo: Match Playoff Autonomous Sequence/i });
    fireEvent.click(firstPhotoCard);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Match Playoff Autonomous Sequence")).toBeInTheDocument();

    // Verify EXIF metadata is displayed
    expect(within(dialog).getByText("Sony Alpha 7 IV")).toBeInTheDocument();
    expect(within(dialog).getByText("FE 70-200mm f/2.8 GM OSS II")).toBeInTheDocument();
    expect(within(dialog).getByText("f/2.8")).toBeInTheDocument();
    expect(within(dialog).getByText("1/1000s")).toBeInTheDocument();
    expect(within(dialog).getByText("ISO 1600")).toBeInTheDocument();

    // Cycle right using keyboard ArrowRight
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(dialog).getByText("Drive Team Queueing at Division Field")).toBeInTheDocument();

    // Cycle left using keyboard ArrowLeft
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(within(dialog).getByText("Match Playoff Autonomous Sequence")).toBeInTheDocument();

    // Close using close button
    const closeBtn = within(dialog).getByRole("button", { name: /Close photo/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("supports photo zoom in/out/reset controls in lightbox modal", async () => {
    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    );

    const photoCard = await screen.findByRole("button", { name: /Open photo: Match Playoff Autonomous Sequence/i });
    fireEvent.click(photoCard);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Initial zoom is 100%
    expect(within(dialog).getByText("100%")).toBeInTheDocument();

    // Zoom in via button
    const zoomInBtn = within(dialog).getByRole("button", { name: /Zoom in/i });
    fireEvent.click(zoomInBtn);
    expect(within(dialog).getByText("150%")).toBeInTheDocument();

    // Zoom in via keyboard '+'
    fireEvent.keyDown(window, { key: "+" });
    expect(within(dialog).getByText("200%")).toBeInTheDocument();

    // Zoom out via button
    const zoomOutBtn = within(dialog).getByRole("button", { name: /Zoom out/i });
    fireEvent.click(zoomOutBtn);
    expect(within(dialog).getByText("150%")).toBeInTheDocument();

    // Zoom out via keyboard '-'
    fireEvent.keyDown(window, { key: "-" });
    expect(within(dialog).getByText("100%")).toBeInTheDocument();

    // Zoom in and reset via Reset button
    fireEvent.click(zoomInBtn);
    expect(within(dialog).getByText("150%")).toBeInTheDocument();
    const resetBtn = within(dialog).getByRole("button", { name: /Reset zoom/i });
    fireEvent.click(resetBtn);
    expect(within(dialog).getByText("100%")).toBeInTheDocument();

    // Keyboard reset via '0'
    fireEvent.click(zoomInBtn);
    fireEvent.keyDown(window, { key: "0" });
    expect(within(dialog).getByText("100%")).toBeInTheDocument();
  });

  it("enforces strict Zero-PII youth photo tagging protections", () => {
    // Test helper functions directly
    expect(isSafePublicTag("Autonomous")).toBe(true);
    expect(isSafePublicTag("Drive Team")).toBe(true);
    expect(isSafePublicTag("Odometry")).toBe(true);
    expect(isSafePublicTag("Control Award")).toBe(true);

    // Reject PII
    expect(isSafePublicTag("john.doe@example.com")).toBe(false);
    expect(isSafePublicTag("@johndoe")).toBe(false);
    expect(isSafePublicTag("555-123-4567")).toBe(false);
    expect(isSafePublicTag("student: Alex Smith")).toBe(false);
    expect(isSafePublicTag("name: Sarah")).toBe(false);
    expect(isSafePublicTag("minor: Timmy")).toBe(false);

    // Test sanitizePhotoTags
    const dirtyTags = [
      "Autonomous",
      "john.smith@gmail.com",
      "@student_handle",
      "Chassis Rigging",
      "555-432-1098",
      "student: John",
      "Drive Team",
    ];
    const cleanTags = sanitizePhotoTags(dirtyTags);
    expect(cleanTags).toEqual(["Autonomous", "Chassis Rigging", "Drive Team"]);

    // Test sanitizeExif
    const cleanExif = sanitizeExif({
      camera: "Sony Alpha 7 IV",
      lens: "FE 24-70mm f/2.8",
      iso: "ISO 800",
    });
    expect(cleanExif).toEqual({
      camera: "Sony Alpha 7 IV",
      lens: "FE 24-70mm f/2.8",
      iso: "ISO 800",
    });
  });

  it("verifies galleryData helper functions for grouping and filtering", () => {
    const albums = GALLERY_ALBUMS;
    const photos = GALLERY_PHOTOS;

    // Filter albums by category
    const compAlbums = filterAlbums(albums, { category: "Competitions" });
    expect(compAlbums.length).toBeGreaterThan(0);
    expect(compAlbums.every((a) => a.category === "Competitions")).toBe(true);

    // Filter photos by season
    const s2025Photos = filterPhotos(photos, { season: "2025-2026" });
    expect(s2025Photos.length).toBeGreaterThan(0);
    expect(s2025Photos.every((p) => p.season === "2025-2026")).toBe(true);

    // Group photos by album
    const albumGroupMap = groupPhotosByAlbum(photos);
    expect(albumGroupMap.has("wv-state-championship-2026")).toBe(true);

    // Group photos by season
    const seasonGroupMap = groupPhotosBySeason(photos);
    expect(seasonGroupMap["2025-2026"]).toBeDefined();

    // Merge API photos
    const merged = mergeApiPhotosWithCurated([
      {
        key: "custom-api-1",
        title: "Custom Field Photo",
        category: "Competitions",
        season: "2025-2026",
      },
    ]);
    expect(merged.photos.some((p) => p.key === "custom-api-1")).toBe(true);
  });

  it("renders the Zero-PII Youth Privacy Notice banner on page", async () => {
    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Strict Zero-PII Policy:/i)).toBeInTheDocument();
    expect(screen.getByText(/All media tagged exclusively by robot subsystems/i)).toBeInTheDocument();
  });
});
