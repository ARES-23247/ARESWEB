"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Eye, MapPin, RefreshCw, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { GreekMeander } from "@/components/GreekMeander";
import { PublicDataState } from "@/components/PublicDataState";
import SEO from "@/components/SEO";

const CATEGORIES = ["Robot Specs", "Outreach", "Competition", "CAD Design", "Practice", "Uncategorized"] as const;
type GalleryCategory = (typeof CATEGORIES)[number];

interface GalleryPhoto {
  key: string;
  title?: string;
  altText?: string;
  category: GalleryCategory;
  date?: string;
  dateKind?: "Captured";
  location?: string;
  description?: string;
  imageUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getCategory(value?: string): GalleryCategory {
  const match = CATEGORIES.find((category) => category.toLowerCase() === value?.toLowerCase());
  return match ?? "Uncategorized";
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
  const capturedDate = readText(value, "capturedAt");

  return {
    key: typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : `published-photo-${index}`,
    title: readText(value, "caption"),
    altText: readText(value, "altText"),
    category: getCategory(readText(value, "category")),
    date: capturedDate,
    dateKind: capturedDate ? "Captured" : undefined,
    location: readText(value, "location"),
    description: readText(value, "description"),
    imageUrl: safeImageUrl(readText(value, "publicUrl")),
  };
}

export default function GalleryPage() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [activeCategory, setActiveCategory] = useState<"all" | GalleryCategory>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadPhotos = useCallback(async (cursor?: string) => {
    const append = Boolean(cursor);
    if (append) setIsLoadingMore(true);
    else if (photos.length > 0) setIsRefreshing(true);
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
      setPhotos((current) => {
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
      console.error("Failed to load published photos from the public API:", error);
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [photos.length]);

  useEffect(() => {
    void loadPhotos();
    // Initial request only. Retry uses the visible button below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPhotos = useMemo(
    () => activeCategory === "all" ? photos : photos.filter((photo) => photo.category === activeCategory),
    [activeCategory, photos],
  );

  const selectAdjacentPhoto = useCallback((direction: -1 | 1) => {
    if (!selectedPhoto || filteredPhotos.length === 0) return;
    const currentIndex = filteredPhotos.findIndex((photo) => photo.key === selectedPhoto.key);
    const nextIndex = (Math.max(currentIndex, 0) + direction + filteredPhotos.length) % filteredPhotos.length;
    setSelectedPhoto(filteredPhotos[nextIndex]);
  }, [filteredPhotos, selectedPhoto]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-obsidian text-marble">
      <SEO title="Photo Gallery" description="Browse published ARES 23247 build, competition, and outreach photos with verified archive metadata." />

      <section className="relative flex min-h-[50vh] items-center overflow-hidden bg-obsidian py-28">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute left-0 top-0" />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <p className="mb-4 font-heading text-[10px] font-black uppercase tracking-[0.4em] text-ares-gold">Published team archive</p>
          <h1 className="mb-6 font-heading text-4xl font-black uppercase tracking-tight text-white md:text-7xl">
            Team <span className="ares-cut-sm inline-block bg-ares-red px-4 py-1 pb-3 text-white shadow-xl sm:px-6">Gallery</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl border-t border-white/10 pt-6 text-base leading-relaxed text-marble/85 md:text-lg">
            See published moments from our build, competition, and community work. Missing details are marked clearly instead of being guessed.
          </p>
        </div>
      </section>

      <section aria-labelledby="gallery-heading" className="min-h-[60vh] border-y border-white/5 bg-black/10 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <h2 id="gallery-heading" className="sr-only">Published photos</h2>
          <fieldset className="mb-10 border-b border-white/10 pb-6">
            <legend className="sr-only">Filter photos by category</legend>
            <div className="flex flex-wrap gap-2">
              {(["all", ...CATEGORIES] as const).map((category) => (
                <button
                  key={category}
                  type="button"
                  aria-pressed={activeCategory === category}
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-lg px-3.5 py-2 text-[9px] font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                    activeCategory === category ? "bg-ares-red text-white" : "bg-white/5 text-marble/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {category === "all" ? "All media" : category}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void loadPhotos()}
                disabled={isLoading || isRefreshing}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-[9px] font-black uppercase tracking-wider text-marble/80 hover:bg-white/10 hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <RefreshCw aria-hidden="true" size={12} />
                Refresh photos
              </button>
            </div>
          </fieldset>

          {isLoading ? (
            <p role="status" className="py-24 text-center text-sm font-bold text-ares-gold">Loading published photos…</p>
          ) : (
            <>
              {loadError && (
                <div className="mb-8">
                  <PublicDataState
                    title={photos.length > 0 ? "The gallery could not refresh" : "Unable to load the photo gallery"}
                    message={photos.length > 0 ? "The last published photos remain visible below." : "The published photo archive could not be reached."}
                    diagnostic={loadError}
                    onRetry={() => void loadPhotos()}
                  />
                </div>
              )}
              {isRefreshing && <p role="status" className="mb-6 text-center text-sm text-ares-gold">Refreshing published photos…</p>}

              {filteredPhotos.length === 0 && !loadError ? (
                <div className="hero-card border border-white/10 bg-black/20 p-12 text-center">
                  <h3 className="text-xl font-black text-white">No published photos in this view</h3>
                  <p className="mt-2 text-sm text-marble/75">Photos will appear here after the team publishes them.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPhotos.map((photo) => {
                    const title = photo.title ?? "Title not provided";
                    const imageAlt = photo.altText ?? photo.title ?? "Published team photo; description not provided";
                    return (
                      <button
                        key={photo.key}
                        type="button"
                        onClick={() => setSelectedPhoto(photo)}
                        aria-label={`Open photo: ${title}`}
                        className="hero-card group flex min-h-[22rem] w-full flex-col overflow-hidden border border-white/10 bg-black/20 text-left transition-colors hover:border-ares-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/45">
                          {photo.imageUrl ? (
                            <img
                              src={photo.imageUrl}
                              alt={imageAlt}
                              loading="lazy"
                              decoding="async"
                              fetchPriority="low"
                              width={4}
                              height={3}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-marble/70">Image URL not provided</div>
                          )}
                          <span className="absolute right-4 top-4 rounded-full bg-black/70 p-2 text-white"><Eye aria-hidden="true" size={16} /></span>
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <span className="w-fit rounded bg-ares-red px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white">{photo.category}</span>
                          <h3 className="mt-3 font-heading text-lg font-black uppercase text-white">{title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-marble/75">{photo.description ?? "Description not provided"}</p>
                          <div className="mt-auto space-y-2 pt-5 text-xs text-marble/70">
                            <p className="flex items-center gap-2"><MapPin aria-hidden="true" size={14} className="text-ares-gold" />{photo.location ?? "Location not provided"}</p>
                            <p className="flex items-center gap-2"><CalendarDays aria-hidden="true" size={14} className="text-ares-gold" />{photo.dateKind && photo.date ? `${photo.dateKind}: ${photo.date}` : "Date not provided"}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {hasMore && nextCursor && filteredPhotos.length > 0 && (
                <div className="mt-10 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadPhotos(nextCursor)}
                    disabled={isLoadingMore}
                    className="rounded-lg border border-ares-gold/40 bg-ares-gold/10 px-5 py-3 text-xs font-black uppercase tracking-wider text-ares-gold hover:bg-ares-gold/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    {isLoadingMore ? "Loading more photos…" : "Load more photos"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Dialog.Root open={selectedPhoto !== null} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/90" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-obsidian p-6 shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan md:p-8">
            {selectedPhoto && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded bg-ares-red px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white">{selectedPhoto.category}</span>
                    <Dialog.Title className="mt-3 font-heading text-2xl font-black uppercase text-white">{selectedPhoto.title ?? "Title not provided"}</Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm text-marble/75">{selectedPhoto.description ?? "Description not provided"}</Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button type="button" aria-label="Close photo" className="rounded p-2 text-marble/75 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><X aria-hidden="true" size={20} /></button>
                  </Dialog.Close>
                </div>

                <div className="mt-6 flex min-h-64 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/45">
                  {selectedPhoto.imageUrl ? (
                    <img src={selectedPhoto.imageUrl} alt={selectedPhoto.altText ?? selectedPhoto.title ?? "Published team photo; description not provided"} className="max-h-[60vh] w-full object-contain" />
                  ) : (
                    <p className="p-8 text-sm text-marble/70">Image URL not provided</p>
                  )}
                </div>

                <dl className="mt-5 grid gap-3 text-sm text-marble/80 sm:grid-cols-2">
                  <div><dt className="font-bold text-white">Location</dt><dd>{selectedPhoto.location ?? "Not provided"}</dd></div>
                  <div><dt className="font-bold text-white">Date</dt><dd>{selectedPhoto.dateKind && selectedPhoto.date ? `${selectedPhoto.dateKind}: ${selectedPhoto.date}` : "Not provided"}</dd></div>
                </dl>

                {filteredPhotos.length > 1 && (
                  <div className="mt-6 flex items-center justify-end gap-2">
                    <button type="button" onClick={() => selectAdjacentPhoto(-1)} aria-label="Previous photo" className="rounded bg-white/5 p-3 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><ArrowLeft aria-hidden="true" size={16} /></button>
                    <button type="button" onClick={() => selectAdjacentPhoto(1)} aria-label="Next photo" className="rounded bg-white/5 p-3 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><ArrowRight aria-hidden="true" size={16} /></button>
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
