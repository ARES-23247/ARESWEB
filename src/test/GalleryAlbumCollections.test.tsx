import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GalleryPage from "../app/gallery/page";
import {
  ALBUM_CATEGORIES,
  GALLERY_ALBUMS,
  GALLERY_PHOTOS,
  GALLERY_SEASONS,
  getCuratedAlbums,
  getCuratedPhotos,
  isSafePublicTag,
  sanitizePhotoTags,
  sanitizeExif,
  filterAlbums,
  filterPhotos,
  groupPhotosByAlbum,
  groupPhotosBySeason,
  getAvailableSeasons,
  getAvailableCategories,
  resolveGalleryMedia,
  mergeApiPhotosWithCurated,
  ZERO_PII_DISCLAIMER,
  type GalleryPhoto,
  type GalleryAlbum,
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
    // Valid tags
    expect(isSafePublicTag("Autonomous")).toBe(true);
    expect(isSafePublicTag("Drive Team")).toBe(true);
    expect(isSafePublicTag("Odometry")).toBe(true);
    expect(isSafePublicTag("Control Award")).toBe(true);

    // Invalid / Edge cases
    expect(isSafePublicTag("")).toBe(false);
    expect(isSafePublicTag("   ")).toBe(false);
    expect(isSafePublicTag("a".repeat(51))).toBe(false);
    // @ts-expect-error test non-string
    expect(isSafePublicTag(null)).toBe(false);
    // @ts-expect-error test non-string
    expect(isSafePublicTag(123)).toBe(false);

    // Reject PII
    expect(isSafePublicTag("john.doe@example.com")).toBe(false);
    expect(isSafePublicTag("@johndoe")).toBe(false);
    expect(isSafePublicTag("555-123-4567")).toBe(false);
    expect(isSafePublicTag("student: Alex Smith")).toBe(false);
    expect(isSafePublicTag("name: Sarah")).toBe(false);
    expect(isSafePublicTag("minor: Timmy")).toBe(false);
    expect(isSafePublicTag("person: Bob")).toBe(false);
    expect(isSafePublicTag("id: 9982")).toBe(false);

    // Test sanitizePhotoTags
    expect(sanitizePhotoTags(undefined)).toEqual([]);
    expect(sanitizePhotoTags(null as unknown as unknown[])).toEqual([]);
    const dirtyTags = [
      "Autonomous",
      "john.smith@gmail.com",
      "@student_handle",
      "Chassis Rigging",
      "555-432-1098",
      "student: John",
      "Drive Team",
      123,
      null,
      "   ",
    ];
    const cleanTags = sanitizePhotoTags(dirtyTags);
    expect(cleanTags).toEqual(["Autonomous", "Chassis Rigging", "Drive Team"]);

    // Test sanitizeExif
    expect(sanitizeExif(undefined)).toBeUndefined();
    expect(sanitizeExif(null as unknown as undefined)).toBeUndefined();
    expect(sanitizeExif({})).toBeUndefined();

    const fullExif = {
      camera: "Sony Alpha 7 IV",
      lens: "FE 24-70mm f/2.8",
      focalLength: "35mm",
      aperture: "f/2.8",
      shutterSpeed: "1/500s",
      iso: "ISO 800",
      dimensions: "6000 x 4000",
    };
    expect(sanitizeExif(fullExif)).toEqual(fullExif);

    expect(ZERO_PII_DISCLAIMER).toContain("Strict Zero-PII Protection");
  });

  it("verifies all galleryData helper functions, filters, and groups", () => {
    const albums = getCuratedAlbums();
    const photos = getCuratedPhotos();

    expect(albums.length).toBeGreaterThan(0);
    expect(photos.length).toBeGreaterThan(0);

    // Test getAvailableSeasons
    const seasons = getAvailableSeasons(albums, photos);
    expect(seasons).toContain("2025-2026");
    expect(seasons).toContain("2024-2025");
    expect(seasons).toContain("2023-2024");
    expect(getAvailableSeasons()).toBeDefined();

    // Test getAvailableCategories
    const categories = getAvailableCategories(albums, photos);
    expect(categories).toContain("Competitions");
    expect(categories).toContain("Outreach");
    expect(categories).toContain("Robot Build");
    expect(categories).toContain("Team Culture");
    expect(getAvailableCategories()).toBeDefined();

    // Test filterAlbums
    const allAlbums = filterAlbums(albums, {});
    expect(allAlbums.length).toBe(albums.length);

    const compAlbums = filterAlbums(albums, { category: "Competitions" });
    expect(compAlbums.every((a) => a.category === "Competitions")).toBe(true);

    const s2025Albums = filterAlbums(albums, { season: "2025-2026" });
    expect(s2025Albums.every((a) => a.season === "2025-2026")).toBe(true);

    const searchAlbums1 = filterAlbums(albums, { query: "Fairmont" });
    expect(searchAlbums1.length).toBeGreaterThan(0);

    const searchAlbums2 = filterAlbums(albums, { query: "STEM" });
    expect(searchAlbums2.length).toBeGreaterThan(0);

    const searchAlbums3 = filterAlbums(albums, { query: "nonexistent-query-xyz" });
    expect(searchAlbums3.length).toBe(0);

    // Test filterPhotos
    const allFilteredPhotos = filterPhotos(photos, {});
    expect(allFilteredPhotos.length).toBe(photos.length);

    const albumPhotos = filterPhotos(photos, { albumId: "wv-state-championship-2026" });
    expect(albumPhotos.length).toBe(4);

    const searchPhotos1 = filterPhotos(photos, { query: "Autonomous" });
    expect(searchPhotos1.length).toBeGreaterThan(0);

    const searchPhotos2 = filterPhotos(photos, { query: "Fairmont" });
    expect(searchPhotos2.length).toBeGreaterThan(0);

    const searchPhotos3 = filterPhotos(photos, { query: "WV State Championship" });
    expect(searchPhotos3.length).toBeGreaterThan(0);

    const searchPhotos4 = filterPhotos(photos, { query: "Odometry" });
    expect(searchPhotos4.length).toBeGreaterThan(0);

    const searchPhotos5 = filterPhotos(photos, { query: "nonexistent-keyword-999" });
    expect(searchPhotos5.length).toBe(0);

    // Group photos by album
    const albumGroupMap = groupPhotosByAlbum(photos);
    expect(albumGroupMap.has("wv-state-championship-2026")).toBe(true);
    const orphanPhoto: GalleryPhoto = { key: "orph-1", category: "Competitions" };
    const orphanGroupMap = groupPhotosByAlbum([orphanPhoto]);
    expect(orphanGroupMap.has("uncategorized-album")).toBe(true);

    // Group photos by season
    const seasonGroupMap = groupPhotosBySeason(photos);
    expect(seasonGroupMap["2025-2026"]).toBeDefined();
    const orphanSeasonMap = groupPhotosBySeason([orphanPhoto]);
    expect(orphanSeasonMap["2025-2026"]).toBeDefined();

    // Test resolveGalleryMedia & mergeApiPhotosWithCurated
    const emptyResolved = resolveGalleryMedia([]);
    expect(emptyResolved.albums.length).toBe(4);
    expect(emptyResolved.photos.length).toBe(12);

    const sampleApiPhoto: GalleryPhoto = {
      key: "api-1",
      title: "Api Test Photo",
      category: "Robot Build",
      season: "2025-2026",
      tags: ["CAD", "Testing"],
      location: "Lab",
      date: "2026-03-01",
    };
    const apiResolved = mergeApiPhotosWithCurated([sampleApiPhoto]);
    expect(apiResolved.photos.length).toBe(1);
    expect(apiResolved.photos[0].title).toBe("Api Test Photo");

    const customCategoryPhoto: GalleryPhoto = {
      key: "api-custom",
      title: "Custom Category Photo",
      category: "CustomCategory",
      tags: ["Custom"],
    };
    const customResolved = resolveGalleryMedia([customCategoryPhoto]);
    expect(customResolved.photos.length).toBe(1);
    expect(customResolved.albums.length).toBeGreaterThan(0);
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
