"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, ExternalLink, Film, Loader2, Play, X } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import SEO from "@/components/SEO";
import { apiFailure, ManagedVideo, parsePublicVideoPage } from "@/lib/media";

export default function VideosPage() {
  const [videos, setVideos] = useState<ManagedVideo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "video" | "short">("all");
  const [selected, setSelected] = useState<ManagedVideo | null>(null);

  const loadVideos = useCallback(async (append = false, targetCursor: string | null = null) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "24" });
      if (append && targetCursor) params.set("cursor", targetCursor);
      const response = await fetch(`/api/videos/public?${params.toString()}`);
      if (!response.ok) throw await apiFailure(response, "Published videos could not load.");
      const payload = await response.json().catch(() => {
        throw new Error(`HTTP ${response.status} ${response.statusText || "OK"}: The video API returned invalid JSON.`);
      });
      const page = parsePublicVideoPage(payload);
      setVideos((current) =>
        append
          ? [...new Map([...current, ...page.videos].map((video) => [video.id, video])).values()]
          : page.videos
      );
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadVideos(false);
  }, [loadVideos]);

  const visibleVideos = useMemo(
    () => (filter === "all" ? videos : videos.filter((video) => video.type === filter)),
    [filter, videos]
  );

  const selectAdjacentVideo = useCallback(
    (direction: -1 | 1) => {
      if (!selected || visibleVideos.length === 0) return;
      const currentIndex = visibleVideos.findIndex((video) => video.id === selected.id);
      const nextIndex = (Math.max(currentIndex, 0) + direction + visibleVideos.length) % visibleVideos.length;
      setSelected(visibleVideos[nextIndex]);
    },
    [selected, visibleVideos]
  );

  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        selectAdjacentVideo(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        selectAdjacentVideo(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, selectAdjacentVideo]);

  return (
    <div className="min-h-screen bg-obsidian text-marble">
      <SEO title="Video Hub" description="Watch ARES 23247 match recordings, robot reveals, team highlights, and learning guides." />
      <section className="relative flex min-h-[45vh] items-center overflow-hidden py-24">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute left-0 top-0" />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.35em] text-ares-bronze">Team highlights and learning</p>
          <h1 className="font-heading text-5xl font-black uppercase tracking-tight text-white md:text-7xl">
            Video <span className="bg-ares-red px-4 py-1 text-white">Hub</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl border-t border-white/10 pt-6 text-base leading-relaxed text-marble/85">
            Watch the robot compete, see how we build, and learn with Team ARES.
          </p>
        </div>
      </section>

      <main className="border-y border-white/10 bg-black/10 py-12" id="main-content">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div role="group" aria-label="Filter videos" className="flex flex-wrap gap-2">
              {([["all", "All media"], ["video", "Videos"], ["short", "Shorts"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                    filter === value ? "bg-ares-red text-white" : "border border-white/10 bg-white/5 text-marble/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <a
              href="https://www.youtube.com/@ARESFTC"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Team YouTube <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>

          {error && (
            <div role="alert" className="mb-8 border border-ares-red bg-ares-red/15 p-4 text-white">
              <p className="font-bold">We could not load the video library.</p>
              <p className="mt-1 font-mono text-xs text-white/80">{error}</p>
              <button
                type="button"
                onClick={() => void loadVideos(false)}
                className="mt-3 text-xs font-bold uppercase underline focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Try again
              </button>
            </div>
          )}

          {loading && videos.length === 0 ? (
            <div role="status" className="flex justify-center py-24 text-ares-gold">
              <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading videos</span>
            </div>
          ) : error && videos.length === 0 ? null : visibleVideos.length === 0 ? (
            <div className="border border-white/10 p-16 text-center">
              <Film className="mx-auto mb-3 text-marble/30" aria-hidden="true" />
              <p className="text-sm text-marble/60">No videos match this filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {visibleVideos.map((video) => (
                <article key={video.id} className="overflow-hidden border border-white/10 bg-black/30">
                  <button
                    type="button"
                    onClick={() => setSelected(video)}
                    className="group relative block aspect-video w-full overflow-hidden bg-black focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    aria-label={`Play ${video.title}`}
                  >
                    {video.thumbnailUrl && (
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover opacity-80 motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.02]"
                      />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <span className="rounded-full bg-ares-red p-4 text-white">
                        <Play size={20} fill="currentColor" aria-hidden="true" />
                      </span>
                    </span>
                    <span className="absolute left-3 top-3 bg-ares-red px-2 py-1 text-[9px] font-black uppercase text-white">
                      {video.type}
                    </span>
                  </button>
                  <div className="space-y-3 p-5">
                    <h2 className="font-heading text-lg font-black uppercase text-white">{video.title}</h2>
                    {video.description && (
                      <p className="line-clamp-3 text-sm leading-relaxed text-marble/70">{video.description}</p>
                    )}
                    <a
                      href={video.watchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-ares-cyan hover:underline focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    >
                      Watch on YouTube <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}

          {hasMore && (
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => void loadVideos(true, cursor)}
                disabled={loadingMore}
                className="border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
              >
                {loadingMore ? "Loading" : "Load more videos"}
              </button>
            </div>
          )}
        </div>
      </main>

      <Dialog.Root open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-modal bg-black/90" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-modal max-h-[95vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-white/15 bg-obsidian focus:outline-none">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="bg-ares-red px-2 py-0.5 text-[8px] font-black uppercase text-white">
                    {selected?.type}
                  </span>
                  {visibleVideos.length > 1 && selected && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
                      {visibleVideos.findIndex((v) => v.id === selected.id) + 1} of {visibleVideos.length}
                    </span>
                  )}
                </div>
                <Dialog.Title className="mt-2 font-heading text-lg font-black uppercase text-white">
                  {selected?.title}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-marble/60">Team YouTube video player</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" aria-label="Close video" className="p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">
                  <X aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>

            {selected && (
              <>
                <div className="aspect-video bg-black">
                  <iframe
                    src={`${selected.embedUrl}?autoplay=1&rel=0`}
                    title={selected.title}
                    loading="lazy"
                    sandbox="allow-scripts allow-presentation allow-popups"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
                {selected.description && (
                  <p className="p-5 text-sm leading-relaxed text-marble/70">{selected.description}</p>
                )}

                {visibleVideos.length > 1 && (
                  <div className="flex items-center justify-end gap-2 border-t border-white/10 p-4">
                    <button
                      type="button"
                      onClick={() => selectAdjacentVideo(-1)}
                      aria-label="Previous video"
                      className="rounded bg-white/5 p-2.5 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    >
                      <ArrowLeft aria-hidden="true" size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => selectAdjacentVideo(1)}
                      aria-label="Next video"
                      className="rounded bg-white/5 p-2.5 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    >
                      <ArrowRight aria-hidden="true" size={16} />
                    </button>
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
