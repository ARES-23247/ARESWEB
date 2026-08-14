"use client";

import { logger } from "@/utils/logger";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Eye,
  FolderArchive,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { GreekMeander } from "@/components/GreekMeander";
import { PublicDataState } from "@/components/PublicDataState";
import SEO from "@/components/SEO";
import {
  ALBUM_CATEGORIES,
  GALLERY_SEASONS,
  type AlbumCategory,
  type GalleryPhoto,
  getCuratedAlbums,
  mergeApiPhotosWithCurated,
  sanitizeExif,
  sanitizePhotoTags,
  ZERO_PII_DISCLAIMER,
} from "@/lib/galleryData";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getCategory(value?: string): AlbumCategory {
  const match = ALBUM_CATEGORIES.find((category) => category.toLowerCase() === value?.toLowerCase());
  return match ?? "Competitions";
}

function safeImageUrl(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("/")) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parsePhoto(value: unknown, index: number): GalleryPhoto | null {
  if (!isRecord(value)) return null;
  const rawId = value.id;
  const capturedDate = readText(value, "capturedAt") ?? readText(value, "date");
  const rawTags = Array.isArray(value.labels) ? value.labels : Array.isArray(value.tags) ? value.tags : [];

  return {
    key: typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : `published-photo-${index}`,
    id: typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : undefined,
    title: readText(value, "caption") ?? readText(value, "title"),
    altText: readText(value, "altText"),
    category: getCategory(readText(value, "category")),
    season: readText(value, "season") ?? "2025-2026",
    albumId: readText(value, "albumId"),
    albumTitle: readText(value, "albumTitle"),
    date: capturedDate,
    dateKind: capturedDate ? "Captured" : undefined,
    location: readText(value, "location"),
    description: readText(value, "description"),
    imageUrl: safeImageUrl(readText(value, "publicUrl") ?? readText(value, "imageUrl")),
    thumbnailUrl: safeImageUrl(readText(value, "thumbnailUrl") ?? readText(value, "publicUrl")),
    thumbnailWidth: typeof value.thumbnailWidth === "number" && value.thumbnailWidth > 0 ? value.thumbnailWidth : undefined,
    thumbnailHeight: typeof value.thumbnailHeight === "number" && value.thumbnailHeight > 0 ? value.thumbnailHeight : undefined,
    tags: sanitizePhotoTags(rawTags),
    exif: sanitizeExif(isRecord(value.exif) ? (value.exif as Record<string, unknown>) : undefined),
  };
}

export default function GalleryPage() {
  const [apiPhotos, setApiPhotos] = useState<GalleryPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"all" | "albums">("all");
  const [activeCategory, setActiveCategory] = useState<"all" | AlbumCategory>("all");
  const [activeSeason, setActiveSeason] = useState<"all" | string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadPhotos = useCallback(async (cursor?: string, isRefresh = false) => {
    const append = Boolean(cursor);
    if (append) setIsLoadingMore(true);
    else if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const url = cursor
        ? `/api/photos/public?limit=30&cursor=${encodeURIComponent(cursor)}`
        : "/api/photos/public?limit=30";
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !Array.isArray(payload.photos)) {
        throw new Error("HTTP 502: Invalid photo response");
      }
      const mappedPhotos = payload.photos.map(parsePhoto).filter((photo): photo is GalleryPhoto => photo !== null);
      setApiPhotos((current) => {
        if (!append) return mappedPhotos;
        const merged = new Map(current.map((photo) => [photo.key, photo]));
        mappedPhotos.forEach((photo) => merged.set(photo.key, photo));
        return Array.from(merged.values());
      });
      const responseCursor = typeof payload.nextCursor === "string" && payload.nextCursor.trim()
        ? payload.nextCursor.trim()
        : null;
      setNextCursor(responseCursor);
      setHasMore(payload.hasMore === true && responseCursor !== null);
      setLoadError(null);
    } catch (error) {
      logger.error("Failed to load published photos from the public API:", error);
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  // Merge API photos with curated event collections
  const { albums: allAlbums, photos: allPhotos } = useMemo(() => {
    return mergeApiPhotosWithCurated(apiPhotos, getCuratedAlbums());
  }, [apiPhotos]);

  // Filtered albums
  const filteredAlbums = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allAlbums.filter((album) => {
      if (activeSeason !== "all" && album.season !== activeSeason) return false;
      if (activeCategory !== "all" && album.category !== activeCategory) return false;
      if (q) {
        const matchTitle = album.title.toLowerCase().includes(q);
        const matchDesc = album.description.toLowerCase().includes(q);
        const matchLoc = album.location.toLowerCase().includes(q);
        const matchCat = album.category.toLowerCase().includes(q);
        const matchSeason = album.season.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchLoc && !matchCat && !matchSeason) return false;
      }
      return true;
    });
  }, [allAlbums, activeSeason, activeCategory, searchQuery]);

  // Selected Album Object (if drilling down)
  const currentAlbum = useMemo(() => {
    if (!selectedAlbumId) return null;
    return allAlbums.find((a) => a.id === selectedAlbumId) ?? null;
  }, [allAlbums, selectedAlbumId]);

  // Photos to display based on filters, active album, and search query
  const filteredPhotos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allPhotos.filter((photo) => {
      if (selectedAlbumId && photo.albumId !== selectedAlbumId) return false;
      if (activeSeason !== "all" && photo.season !== activeSeason) return false;
      if (activeCategory !== "all" && photo.category !== activeCategory) return false;
      if (q) {
        const matchTitle = (photo.title ?? "").toLowerCase().includes(q);
        const matchDesc = (photo.description ?? "").toLowerCase().includes(q);
        const matchLoc = (photo.location ?? "").toLowerCase().includes(q);
        const matchCat = photo.category.toLowerCase().includes(q);
        const matchTags = (photo.tags ?? []).some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchLoc && !matchCat && !matchTags) return false;
      }
      return true;
    });
  }, [allPhotos, selectedAlbumId, activeSeason, activeCategory, searchQuery]);

  // Cycle photos in Lightbox
  const selectAdjacentPhoto = useCallback((direction: -1 | 1) => {
    if (!selectedPhoto || filteredPhotos.length === 0) return;
    const currentIndex = filteredPhotos.findIndex((photo) => photo.key === selectedPhoto.key);
    const nextIndex = (Math.max(currentIndex, 0) + direction + filteredPhotos.length) % filteredPhotos.length;
    setSelectedPhoto(filteredPhotos[nextIndex]);
    setZoomLevel(1); // Reset zoom on photo change
  }, [filteredPhotos, selectedPhoto]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 1));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
  }, []);

  const toggleZoom = useCallback(() => {
    setZoomLevel((prev) => (prev > 1 ? 1 : 2));
  }, []);

  // Keyboard navigation & zoom shortcuts
  useEffect(() => {
    if (!selectedPhoto) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        selectAdjacentPhoto(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        selectAdjacentPhoto(1);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        handleZoomIn();
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        handleZoomOut();
      } else if (event.key === "0") {
        event.preventDefault();
        handleResetZoom();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPhoto, selectAdjacentPhoto, handleZoomIn, handleZoomOut, handleResetZoom]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-obsidian text-marble selection:bg-ares-red selection:text-white">
      <SEO
        title="Photo Gallery & Event Album Collections"
        description="Explore high-resolution FIRST Tech Challenge event albums, robot build archives, and community STEM demonstrations from ARES 23247."
      />

      {/* Hero Section */}
      <section className="relative flex min-h-[45vh] items-center overflow-hidden bg-obsidian py-24">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute left-0 top-0" />
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ares-gold/30 bg-ares-gold/10 px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-ares-gold">
            <Camera aria-hidden="true" size={13} />
            <span>Published Team Media Vault</span>
          </div>
          <h1 className="mb-6 font-heading text-4xl font-black uppercase tracking-tight text-white md:text-6xl lg:text-7xl">
            Team <span className="ares-cut-sm inline-block bg-ares-red px-4 py-1 pb-3 text-white shadow-xl sm:px-6">Media</span> & Albums
          </h1>
          <p className="mx-auto max-w-2xl border-t border-white/10 pt-6 text-base leading-relaxed text-marble/85 md:text-lg">
            High-resolution event albums, CAD build milestones, and community STEM outreach from our FIRST Tech Challenge seasons.
          </p>

          {/* Zero-PII Youth Privacy Notice */}
          <div className="mx-auto mt-6 flex max-w-xl items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-marble/75">
            <ShieldCheck aria-hidden="true" size={16} className="shrink-0 text-ares-gold" />
            <span className="text-left font-sans">
              <strong>Strict Zero-PII Policy:</strong> All media tagged exclusively by robot subsystems, competition roles, and technical EXIF details. Minor privacy is guaranteed.
            </span>
          </div>
        </div>
      </section>

      {/* Main Gallery Workspace */}
      <section aria-labelledby="gallery-heading" className="min-h-[60vh] border-y border-white/5 bg-black/10 py-10">
        <div className="mx-auto max-w-7xl px-6">
          <h2 id="gallery-heading" className="sr-only">Published Media Archive</h2>

          {/* Filter Bar & Controls */}
          <div className="mb-8 space-y-5 border-b border-white/10 pb-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search aria-hidden="true" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-marble/50" />
                <input
                  type="text"
                  placeholder="Search albums, subsystems, tags, or venues…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder-marble/45 transition-colors focus:border-ares-gold focus:outline-none focus:ring-1 focus:ring-ares-gold"
                />
              </div>

              {/* View Switcher and Refresh */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("all");
                    setSelectedAlbumId(null);
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                    viewMode === "all" && !selectedAlbumId
                      ? "bg-ares-red text-white shadow-md"
                      : "border border-white/10 bg-white/5 text-marble/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Layers aria-hidden="true" size={13} />
                  All Photos ({allPhotos.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("albums");
                    setSelectedAlbumId(null);
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                    viewMode === "albums" && !selectedAlbumId
                      ? "bg-ares-gold text-obsidian font-bold shadow-md"
                      : "border border-white/10 bg-white/5 text-marble/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <FolderArchive aria-hidden="true" size={13} />
                  Event Albums ({allAlbums.length})
                </button>
                <button
                  type="button"
                  onClick={() => void loadPhotos(undefined, true)}
                  disabled={isLoading || isRefreshing}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-marble/80 hover:bg-white/10 hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
                >
                  <RefreshCw aria-hidden="true" size={12} className={isRefreshing ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Filter Chips: Seasons and Categories */}
            <div className="space-y-3">
              {/* Season Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-ares-gold/90 shrink-0">Season:</span>
                <button
                  type="button"
                  onClick={() => setActiveSeason("all")}
                  className={`rounded-md px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors shrink-0 ${
                    activeSeason === "all"
                      ? "bg-ares-gold text-obsidian font-extrabold"
                      : "border border-white/10 bg-white/5 text-marble/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  All Seasons
                </button>
                {GALLERY_SEASONS.map((season) => (
                  <button
                    key={season}
                    type="button"
                    onClick={() => setActiveSeason(season)}
                    className={`rounded-md px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors shrink-0 ${
                      activeSeason === season
                        ? "bg-ares-gold text-obsidian font-extrabold"
                        : "border border-white/10 bg-white/5 text-marble/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {season}
                  </button>
                ))}
              </div>

              {/* Category Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-ares-red/90 shrink-0">Category:</span>
                <button
                  type="button"
                  onClick={() => setActiveCategory("all")}
                  className={`rounded-md px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors shrink-0 ${
                    activeCategory === "all"
                      ? "bg-ares-red text-white"
                      : "border border-white/10 bg-white/5 text-marble/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  All Categories
                </button>
                {ALBUM_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-md px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors shrink-0 ${
                      activeCategory === category
                        ? "bg-ares-red text-white"
                        : "border border-white/10 bg-white/5 text-marble/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Drill-down Album Header if inside an album */}
          {currentAlbum && (
            <div className="mb-8 rounded-2xl border border-white/10 bg-gradient-to-r from-obsidian via-charcoal/60 to-obsidian p-6">
              <button
                type="button"
                onClick={() => setSelectedAlbumId(null)}
                className="mb-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-marble/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <ArrowLeft aria-hidden="true" size={14} />
                Back to all albums
              </button>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-ares-red px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                      {currentAlbum.category}
                    </span>
                    <span className="rounded border border-ares-gold/30 bg-ares-gold/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-ares-gold">
                      {currentAlbum.season}
                    </span>
                    <span className="text-xs text-marble/60">{filteredPhotos.length} Photos</span>
                  </div>
                  <h3 className="mt-2 font-heading text-2xl font-black uppercase text-white md:text-3xl">
                    {currentAlbum.title}
                  </h3>
                  <p className="mt-1 max-w-3xl text-sm text-marble/80 leading-relaxed">
                    {currentAlbum.description}
                  </p>
                </div>
                <div className="space-y-1 text-xs text-marble/70">
                  <p className="flex items-center gap-2">
                    <MapPin aria-hidden="true" size={14} className="text-ares-gold" />
                    {currentAlbum.location}
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarDays aria-hidden="true" size={14} className="text-ares-gold" />
                    {currentAlbum.date}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Loading / Error States */}
          {isLoading ? (
            <p role="status" className="py-24 text-center text-sm font-bold text-ares-gold">
              Loading published media & albums…
            </p>
          ) : (
            <>
              {loadError && (
                <div className="mb-8">
                  <PublicDataState
                    title={apiPhotos.length > 0 ? "The gallery could not refresh live photos" : "Unable to load the live photo feed"}
                    message={apiPhotos.length > 0 ? "Curated event archives remain visible below." : "The published photo archive could not be reached."}
                    diagnostic={loadError}
                    onRetry={() => void loadPhotos()}
                  />
                </div>
              )}
              {isRefreshing && (
                <p role="status" className="mb-6 text-center text-sm text-ares-gold">
                  Refreshing published photos…
                </p>
              )}

              {/* View 1: Event Albums Collection Grid */}
              {viewMode === "albums" && !selectedAlbumId ? (
                filteredAlbums.length === 0 ? (
                  <div className="hero-card border border-white/10 bg-black/20 p-12 text-center">
                    <h3 className="text-xl font-black text-white">No album collections match your filter</h3>
                    <p className="mt-2 text-sm text-marble/75">Try selecting "All Seasons" or clearing your search keywords.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredAlbums.map((album) => (
                      <button
                        key={album.id}
                        type="button"
                        onClick={() => setSelectedAlbumId(album.id)}
                        className="hero-card group flex min-h-[22rem] w-full flex-col overflow-hidden border border-white/10 bg-black/20 text-left transition-all hover:border-ares-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
                      >
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/45">
                          <img
                            src={album.coverImageUrl}
                            alt={album.title}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-obsidian/30 to-transparent" />
                          <div className="absolute top-3 left-3 flex items-center gap-1.5">
                            <span className="rounded bg-ares-red px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow">
                              {album.category}
                            </span>
                            <span className="rounded border border-ares-gold/40 bg-black/60 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-ares-gold shadow">
                              {album.season}
                            </span>
                          </div>
                          <span className="absolute bottom-3 right-3 rounded-md bg-black/80 px-2.5 py-1 text-xs font-bold text-white shadow flex items-center gap-1.5">
                            <FolderArchive aria-hidden="true" size={13} className="text-ares-gold" />
                            {album.photoCount} Photos
                          </span>
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <h3 className="font-heading text-lg font-black uppercase text-white group-hover:text-ares-gold transition-colors">
                            {album.title}
                          </h3>
                          <p className="mt-2 text-xs leading-relaxed text-marble/75 line-clamp-2">
                            {album.description}
                          </p>
                          <div className="mt-auto space-y-1.5 pt-4 text-xs text-marble/70">
                            <p className="flex items-center gap-2">
                              <MapPin aria-hidden="true" size={13} className="text-ares-gold shrink-0" />
                              <span className="truncate">{album.location}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              <CalendarDays aria-hidden="true" size={13} className="text-ares-gold shrink-0" />
                              <span>{album.date}</span>
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                /* View 2: Photos Grid (All or in Selected Album) */
                filteredPhotos.length === 0 && !loadError ? (
                  <div className="hero-card border border-white/10 bg-black/20 p-12 text-center">
                    <h3 className="text-xl font-black text-white">No published photos match your filter</h3>
                    <p className="mt-2 text-sm text-marble/75">Photos will appear here as the team publishes new media.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredPhotos.map((photo) => {
                      const title = photo.title ?? "Title not provided";
                      const imageAlt = photo.altText ?? photo.title ?? "Published team photo; description not provided";
                      const displayImg = photo.thumbnailUrl ?? photo.imageUrl;

                      return (
                        <button
                          key={photo.key}
                          type="button"
                          onClick={() => {
                            setSelectedPhoto(photo);
                            setZoomLevel(1);
                          }}
                          aria-label={`Open photo: ${title}`}
                          className="hero-card group flex min-h-[22rem] w-full flex-col overflow-hidden border border-white/10 bg-black/20 text-left transition-colors hover:border-ares-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
                        >
                          <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/45">
                            {displayImg ? (
                              <img
                                src={displayImg}
                                alt={imageAlt}
                                loading="lazy"
                                decoding="async"
                                fetchPriority="low"
                                width={photo.thumbnailWidth ?? 4}
                                height={photo.thumbnailHeight ?? 3}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-marble/70">
                                Image URL not provided
                              </div>
                            )}
                            <span className="absolute right-4 top-4 rounded-full bg-black/70 p-2 text-white">
                              <Eye aria-hidden="true" size={16} />
                            </span>
                            {photo.albumTitle && (
                              <span className="absolute bottom-3 left-3 rounded bg-black/80 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-marble/80 shadow">
                                {photo.albumTitle}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col p-5">
                            <div className="flex items-center gap-2">
                              <span className="w-fit rounded bg-ares-red px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                                {photo.category}
                              </span>
                              {photo.season && (
                                <span className="w-fit rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-marble/70">
                                  {photo.season}
                                </span>
                              )}
                            </div>
                            <h3 className="mt-3 font-heading text-lg font-black uppercase text-white">
                              {title}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-marble/75 line-clamp-2">
                              {photo.description ?? "Description not provided"}
                            </p>

                            {/* Safe Tags */}
                            {photo.tags && photo.tags.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1">
                                {photo.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[8px] font-semibold text-marble/70"
                                  >
                                    <Tag aria-hidden="true" size={9} className="text-ares-gold" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="mt-auto space-y-1.5 pt-5 text-xs text-marble/70">
                              <p className="flex items-center gap-2">
                                <MapPin aria-hidden="true" size={14} className="text-ares-gold shrink-0" />
                                <span className="truncate">{photo.location ?? "Location not provided"}</span>
                              </p>
                              <p className="flex items-center gap-2">
                                <CalendarDays aria-hidden="true" size={14} className="text-ares-gold shrink-0" />
                                <span>{photo.dateKind && photo.date ? `${photo.dateKind}: ${photo.date}` : "Date not provided"}</span>
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              )}

              {hasMore && nextCursor && filteredPhotos.length > 0 && (
                <div className="mt-10 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadPhotos(nextCursor)}
                    disabled={isLoadingMore}
                    className="rounded-lg border border-ares-gold/40 bg-ares-gold/10 px-5 py-3 text-xs font-black uppercase tracking-wider text-ares-gold hover:bg-ares-gold/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
                  >
                    {isLoadingMore ? "Loading more photos…" : "Load more photos"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Interactive Lightbox Modal */}
      <Dialog.Root open={selectedPhoto !== null} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm transition-opacity" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[95vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/15 bg-obsidian p-6 shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold md:p-8">
            {selectedPhoto && (
              <>
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded bg-ares-red px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                        {selectedPhoto.category}
                      </span>
                      {selectedPhoto.season && (
                        <span className="rounded border border-ares-gold/30 bg-ares-gold/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-ares-gold">
                          {selectedPhoto.season}
                        </span>
                      )}
                      {filteredPhotos.length > 1 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
                          {filteredPhotos.findIndex((p) => p.key === selectedPhoto.key) + 1} of {filteredPhotos.length}
                        </span>
                      )}
                      {selectedPhoto.albumTitle && (
                        <span className="text-[10px] font-semibold text-ares-gold/90">
                          • {selectedPhoto.albumTitle}
                        </span>
                      )}
                    </div>
                    <Dialog.Title className="mt-3 font-heading text-2xl font-black uppercase text-white md:text-3xl">
                      {selectedPhoto.title ?? "Title not provided"}
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm text-marble/80 leading-relaxed">
                      {selectedPhoto.description ?? "Description not provided"}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close photo"
                      className="rounded-lg border border-white/10 bg-white/5 p-2 text-marble/75 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
                    >
                      <X aria-hidden="true" size={20} />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Lightbox Media Container & Zoom Controls */}
                <div className="mt-6 flex flex-col items-center">
                  <div className="relative flex min-h-[300px] w-full max-h-[60vh] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/60 select-none">
                    {selectedPhoto.imageUrl ? (
                      <div
                        className="flex h-full w-full items-center justify-center overflow-auto p-2"
                        onDoubleClick={toggleZoom}
                      >
                        <img
                          src={selectedPhoto.imageUrl}
                          alt={selectedPhoto.altText ?? selectedPhoto.title ?? "Published team photo; description not provided"}
                          style={{ transform: `scale(${zoomLevel})`, transition: "transform 0.2s ease-out" }}
                          className="max-h-[55vh] max-w-full object-contain cursor-zoom-in"
                        />
                      </div>
                    ) : (
                      <p className="p-8 text-sm text-marble/70">Image URL not provided</p>
                    )}

                    {/* Floating Zoom Toolbar */}
                    <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/80 p-1.5 shadow-lg backdrop-blur-md">
                      <button
                        type="button"
                        onClick={handleZoomIn}
                        aria-label="Zoom in"
                        className="rounded p-1.5 text-marble/80 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ares-gold"
                      >
                        <ZoomIn aria-hidden="true" size={16} />
                      </button>
                      <span className="px-1 text-[10px] font-mono font-bold text-ares-gold">
                        {Math.round(zoomLevel * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 1}
                        aria-label="Zoom out"
                        className="rounded p-1.5 text-marble/80 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ares-gold"
                      >
                        <ZoomOut aria-hidden="true" size={16} />
                      </button>
                      {zoomLevel > 1 && (
                        <button
                          type="button"
                          onClick={handleResetZoom}
                          aria-label="Reset zoom"
                          className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-marble/80 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ares-gold"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Photo Metadata, Safe Tags & Camera EXIF Details */}
                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 border-t border-white/10 pt-6">
                  {/* Basic Metadata & Safe Tags */}
                  <div className="space-y-4">
                    <dl className="grid grid-cols-2 gap-4 text-xs text-marble/80">
                      <div>
                        <dt className="font-black uppercase tracking-wider text-white">Location</dt>
                        <dd className="mt-1 flex items-center gap-1.5 text-marble/90">
                          <MapPin aria-hidden="true" size={13} className="text-ares-gold shrink-0" />
                          {selectedPhoto.location ?? "Not provided"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-black uppercase tracking-wider text-white">Date</dt>
                        <dd className="mt-1 flex items-center gap-1.5 text-marble/90">
                          <CalendarDays aria-hidden="true" size={13} className="text-ares-gold shrink-0" />
                          {selectedPhoto.dateKind && selectedPhoto.date ? `${selectedPhoto.dateKind}: ${selectedPhoto.date}` : "Not provided"}
                        </dd>
                      </div>
                    </dl>

                    {/* Safe Zero-PII Tags */}
                    {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-ares-gold">
                          Subsystem & Event Tags
                        </h4>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedPhoto.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-marble/90"
                            >
                              <Tag aria-hidden="true" size={11} className="text-ares-gold" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Camera EXIF Details */}
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ares-gold">
                      <Camera aria-hidden="true" size={14} />
                      Camera & EXIF Metadata
                    </h4>
                    {selectedPhoto.exif ? (
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-marble/80">
                        {selectedPhoto.exif.camera && (
                          <div className="col-span-2">
                            <dt className="text-[10px] font-bold uppercase text-marble/50">Camera Body</dt>
                            <dd className="font-medium text-white">{selectedPhoto.exif.camera}</dd>
                          </div>
                        )}
                        {selectedPhoto.exif.lens && (
                          <div className="col-span-2">
                            <dt className="text-[10px] font-bold uppercase text-marble/50">Lens</dt>
                            <dd className="font-medium text-white">{selectedPhoto.exif.lens}</dd>
                          </div>
                        )}
                        {selectedPhoto.exif.aperture && (
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-marble/50">Aperture</dt>
                            <dd className="font-mono text-white">{selectedPhoto.exif.aperture}</dd>
                          </div>
                        )}
                        {selectedPhoto.exif.shutterSpeed && (
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-marble/50">Shutter Speed</dt>
                            <dd className="font-mono text-white">{selectedPhoto.exif.shutterSpeed}</dd>
                          </div>
                        )}
                        {selectedPhoto.exif.iso && (
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-marble/50">ISO</dt>
                            <dd className="font-mono text-white">{selectedPhoto.exif.iso}</dd>
                          </div>
                        )}
                        {selectedPhoto.exif.focalLength && (
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-marble/50">Focal Length</dt>
                            <dd className="font-mono text-white">{selectedPhoto.exif.focalLength}</dd>
                          </div>
                        )}
                        {selectedPhoto.exif.dimensions && (
                          <div className="col-span-2">
                            <dt className="text-[10px] font-bold uppercase text-marble/50">Resolution</dt>
                            <dd className="font-mono text-white">{selectedPhoto.exif.dimensions}</dd>
                          </div>
                        )}
                      </dl>
                    ) : (
                      <p className="mt-3 text-xs text-marble/50">
                        Camera EXIF metadata not archived for this capture.
                      </p>
                    )}
                  </div>
                </div>

                {/* Zero-PII Compliance Notice */}
                <div className="mt-6 border-t border-white/10 pt-4 text-[11px] text-marble/60 flex items-center gap-2">
                  <ShieldCheck aria-hidden="true" size={14} className="text-ares-gold shrink-0" />
                  <span>{ZERO_PII_DISCLAIMER}</span>
                </div>

                {/* Lightbox Navigation Buttons */}
                {filteredPhotos.length > 1 && (
                  <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                    <span className="text-xs text-marble/60">
                      Use <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-[10px] text-white">←</kbd> / <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-[10px] text-white">→</kbd> keys or buttons to navigate
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => selectAdjacentPhoto(-1)}
                        aria-label="Previous photo"
                        className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
                      >
                        <ArrowLeft aria-hidden="true" size={16} />
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => selectAdjacentPhoto(1)}
                        aria-label="Next photo"
                        className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
                      >
                        Next
                        <ArrowRight aria-hidden="true" size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
