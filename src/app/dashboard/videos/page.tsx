"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Activity, Archive, ExternalLink, Loader2, Pencil, Play, Plus, RefreshCw, RotateCcw, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { apiFailure, ManagedVideo, parseYouTubeVideoId } from "@/lib/media";

interface VideoPage { videos: ManagedVideo[]; hasMore: boolean; nextCursor: string | null }
interface VideoDraft {
  title: string;
  videoId: string;
  description: string;
  type: "video" | "short";
  status: "draft" | "published";
  thumbnailUrl: string;
}

const EMPTY_DRAFT: VideoDraft = {
  title: "",
  videoId: "",
  description: "",
  type: "video",
  status: "draft",
  thumbnailUrl: "",
};

export default function VideosManagementPage() {
  const { authorizedUser } = useAuth();
  const canManage = authorizedUser?.role === "admin" || authorizedUser?.role === "coach";
  const [videos, setVideos] = useState<ManagedVideo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "video" | "short">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedVideo | null>(null);
  const [draft, setDraft] = useState<VideoDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<ManagedVideo | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadVideos = useCallback(async (append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "30", includeArchived: String(showArchived) });
      if (append && cursor) params.set("cursor", cursor);
      const response = await authenticatedFetch(`/api/videos?${params.toString()}`);
      if (!response.ok) throw await apiFailure(response, "Video library could not load.");
      const page = await response.json() as VideoPage;
      setVideos((current) => append
        ? [...new Map([...current, ...page.videos].map((video) => [video.id, video])).values()]
        : page.videos);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [cursor, showArchived]);

  useEffect(() => { void loadVideos(false); }, [showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleVideos = useMemo(() => {
    const filtered = typeFilter === "all" ? [...videos] : videos.filter((video) => video.type === typeFilter);
    return filtered.sort((a, b) => {
      const first = Date.parse(a.createdAt) || 0;
      const second = Date.parse(b.createdAt) || 0;
      return sortOrder === "newest" ? second - first : first - second;
    });
  }, [sortOrder, typeFilter, videos]);

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT, status: "published" });
    setSaveError(null);
    setEditorOpen(true);
  };

  const openEdit = (video: ManagedVideo) => {
    setEditing(video);
    setDraft({
      title: video.title,
      videoId: video.videoId,
      description: video.description,
      type: video.type,
      status: video.status,
      thumbnailUrl: video.thumbnailUrl,
    });
    setSaveError(null);
    setEditorOpen(true);
  };

  const saveVideo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || saving) return;
    if (!parseYouTubeVideoId(draft.videoId)) {
      setSaveError("Enter a valid YouTube URL or 11-character video ID.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const response = await authenticatedFetch(editing ? `/api/videos/${editing.id}` : "/api/videos", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) throw await apiFailure(response, "Video could not be saved.");
      const payload = await response.json() as { video: ManagedVideo };
      setVideos((current) => editing
        ? current.map((video) => video.id === editing.id ? payload.video : video)
        : [payload.video, ...current]);
      setEditorOpen(false);
      setNotice(editing ? "Video changes saved." : "Video added to the library.");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const archiveVideo = async () => {
    if (!pendingArchive || !canManage) return;
    const target = pendingArchive;
    setActionId(target.id);
    setError(null);
    try {
      const response = await authenticatedFetch(`/api/videos/${target.id}`, { method: "DELETE" });
      if (!response.ok) throw await apiFailure(response, "Video could not be archived.");
      setVideos((current) => current.filter((video) => video.id !== target.id));
      setPendingArchive(null);
      setNotice("Video moved to the archive. You can restore it later.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setActionId(null);
    }
  };

  const restoreVideo = async (video: ManagedVideo) => {
    setActionId(video.id);
    setError(null);
    try {
      const response = await authenticatedFetch(`/api/videos/${video.id}/restore`, { method: "POST" });
      if (!response.ok) throw await apiFailure(response, "Video could not be restored.");
      setVideos((current) => current.filter((item) => item.id !== video.id));
      setNotice("Video restored. It is back in the active library.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setActionId(null);
    }
  };

  const syncYoutube = async () => {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await authenticatedFetch("/api/videos/sync", { method: "POST" });
      if (!response.ok) throw await apiFailure(response, "YouTube sync failed.");
      const payload = await response.json() as { message?: string };
      setNotice(payload.message || "YouTube sync finished.");
      await loadVideos(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-gold"><Activity size={14} aria-hidden="true" /> Team media</p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight text-white md:text-5xl">Manage Videos</h1>
          <p className="mt-2 max-w-2xl text-sm text-marble/70">Add team YouTube links, review drafts, and sync the official team channel.</p>
        </div>
        {canManage && <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void syncYoutube()} disabled={syncing} className="inline-flex items-center gap-2 border border-ares-gold/40 px-4 py-3 text-xs font-black uppercase tracking-wider text-ares-gold focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">
            <RefreshCw size={15} className={syncing ? "motion-safe:animate-spin" : ""} aria-hidden="true" /> {syncing ? "Syncing" : "Sync YouTube"}
          </button>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 bg-ares-red px-4 py-3 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><Plus size={15} aria-hidden="true" /> Add video</button>
        </div>}
      </header>

      {!canManage && <p className="border border-ares-gold/30 bg-ares-gold/10 p-4 text-sm text-marble">You can view the team library. An admin or coach manages video links.</p>}
      {notice && <p role="status" className="border border-ares-gold/30 bg-ares-gold/10 p-4 text-sm text-marble">{notice}</p>}
      {error && <div role="alert" className="border border-ares-red bg-ares-red/15 p-4 text-white"><p className="text-sm font-bold">The video library was not changed.</p><p className="mt-1 break-words font-mono text-xs text-white/80">{error}</p><button type="button" onClick={() => void loadVideos(false)} className="mt-3 text-xs font-bold uppercase text-white underline focus-visible:ring-2 focus-visible:ring-ares-cyan">Try again</button></div>}

      <section aria-label="Video filters" className="flex flex-col gap-4 border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-4">
          <div><label htmlFor="video-type" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-marble/60">Media type</label><select id="video-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="border border-white/15 bg-obsidian px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><option value="all">All media</option><option value="video">Videos</option><option value="short">Shorts</option></select></div>
          <div><label htmlFor="video-sort" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-marble/60">Sort order</label><select id="video-sort" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)} className="border border-white/15 bg-obsidian px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
        </div>
        {canManage && <label className="flex items-center gap-2 text-xs font-bold text-marble"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="h-4 w-4 accent-ares-red focus-visible:ring-2 focus-visible:ring-ares-cyan" /> Show archived videos</label>}
      </section>

      {loading && videos.length === 0 ? <div role="status" className="flex justify-center py-20 text-ares-gold"><Loader2 className="motion-safe:animate-spin" aria-hidden="true" /><span className="sr-only">Loading videos</span></div> : visibleVideos.length === 0 ? <p className="border border-white/10 bg-black/20 p-10 text-center text-sm text-marble/60">No videos match this view.</p> : <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {visibleVideos.map((video) => <article key={video.id} className="overflow-hidden border border-white/10 bg-black/25">
          <a href={video.watchUrl} target="_blank" rel="noopener noreferrer" className="group relative block aspect-video overflow-hidden bg-black focus-visible:ring-2 focus-visible:ring-ares-cyan" aria-label={`Watch ${video.title} on YouTube`}>
            {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.02]" />}
            <span className="absolute inset-0 flex items-center justify-center bg-black/30"><span className="rounded-full bg-ares-red p-4 text-white"><Play size={22} fill="currentColor" aria-hidden="true" /></span></span>
          </a>
          <div className="space-y-4 p-5">
            <div><div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider"><span className="bg-ares-red px-2 py-1 text-white">{video.type}</span><span className="border border-white/15 px-2 py-1 text-marble/70">{video.status}</span>{video.isArchived && <span className="border border-ares-gold/40 px-2 py-1 text-ares-gold">Archived</span>}</div><h2 className="mt-3 font-heading text-xl font-black uppercase text-white">{video.title}</h2>{video.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-marble/70">{video.description}</p>}</div>
            <div className="flex items-center justify-between border-t border-white/10 pt-4"><a href={video.watchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-ares-cyan focus-visible:ring-2 focus-visible:ring-ares-cyan">Watch <ExternalLink size={12} aria-hidden="true" /></a>{canManage && <div className="flex gap-2">{!video.isArchived && <button type="button" onClick={() => openEdit(video)} aria-label={`Edit ${video.title}`} className="border border-white/15 p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><Pencil size={14} aria-hidden="true" /></button>}{video.isArchived ? <button type="button" disabled={actionId === video.id} onClick={() => void restoreVideo(video)} aria-label={`Restore ${video.title}`} className="border border-ares-gold/40 p-2 text-ares-gold focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"><RotateCcw size={14} aria-hidden="true" /></button> : <button type="button" onClick={() => setPendingArchive(video)} aria-label={`Archive ${video.title}`} className="border border-ares-red/50 p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><Archive size={14} aria-hidden="true" /></button>}</div>}</div>
          </div>
        </article>)}
      </div>}

      {hasMore && <div className="text-center"><button type="button" onClick={() => void loadVideos(true)} disabled={loadingMore} className="border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">{loadingMore ? "Loading" : "Load more videos"}</button></div>}

      <Dialog.Root open={editorOpen} onOpenChange={(open) => !saving && setEditorOpen(open)}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80" /><Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-white/15 bg-obsidian p-6 shadow-2xl focus:outline-none"><div className="flex items-start justify-between gap-4"><div><Dialog.Title className="font-heading text-2xl font-black uppercase text-white">{editing ? "Edit video" : "Add video"}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-marble/60">Use a link from the official team YouTube channel.</Dialog.Description></div><Dialog.Close asChild><button type="button" disabled={saving} aria-label="Close video editor" className="p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><X aria-hidden="true" /></button></Dialog.Close></div>
        <form onSubmit={(event) => void saveVideo(event)} className="mt-6 space-y-4"><div><label htmlFor="video-title-input" className="mb-1 block text-xs font-bold text-marble">Title</label><input id="video-title-input" required maxLength={180} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></div><div><label htmlFor="video-link-input" className="mb-1 block text-xs font-bold text-marble">YouTube URL or video ID</label><input id="video-link-input" required value={draft.videoId} onChange={(event) => setDraft({ ...draft, videoId: event.target.value })} className="w-full border border-white/15 bg-black/40 px-3 py-2 font-mono text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></div><div><label htmlFor="video-description-input" className="mb-1 block text-xs font-bold text-marble">Summary</label><textarea id="video-description-input" maxLength={2000} rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="w-full resize-y border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></div><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="video-kind-input" className="mb-1 block text-xs font-bold text-marble">Media type</label><select id="video-kind-input" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as VideoDraft["type"] })} className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><option value="video">Video</option><option value="short">Short</option></select></div><div><label htmlFor="video-status-input" className="mb-1 block text-xs font-bold text-marble">Status</label><select id="video-status-input" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as VideoDraft["status"] })} className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><option value="draft">Draft</option><option value="published">Published</option></select></div></div><div><label htmlFor="video-thumbnail-input" className="mb-1 block text-xs font-bold text-marble">Thumbnail URL (optional)</label><input id="video-thumbnail-input" type="url" value={draft.thumbnailUrl} onChange={(event) => setDraft({ ...draft, thumbnailUrl: event.target.value })} className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></div>{saveError && <div role="alert" className="border border-ares-red bg-ares-red/15 p-3 text-white"><p className="text-xs font-bold">Your draft is still here. The video was not saved.</p><p className="mt-1 font-mono text-[10px] text-white/80">{saveError}</p></div>}<div className="flex justify-end gap-3 border-t border-white/10 pt-4"><Dialog.Close asChild><button type="button" disabled={saving} className="border border-white/15 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button></Dialog.Close><button type="submit" disabled={saving} className="inline-flex items-center gap-2 bg-ares-red px-5 py-2 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">{saving && <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" />}{saving ? "Saving" : "Save video"}</button></div></form>
      </Dialog.Content></Dialog.Portal></Dialog.Root>

      <Dialog.Root open={Boolean(pendingArchive)} onOpenChange={(open) => !open && !actionId && setPendingArchive(null)}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[110] bg-black/80" /><Dialog.Content className="fixed left-1/2 top-1/2 z-[111] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-white/15 bg-obsidian p-6 focus:outline-none"><Dialog.Title className="font-heading text-xl font-black uppercase text-white">Archive this video?</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-relaxed text-marble/70">The video leaves active and public views. You can restore it later.</Dialog.Description><div className="mt-6 flex justify-end gap-3"><Dialog.Close asChild><button type="button" disabled={Boolean(actionId)} className="border border-white/15 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button></Dialog.Close><button type="button" onClick={() => void archiveVideo()} disabled={Boolean(actionId)} className="bg-ares-red px-4 py-2 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">{actionId ? "Archiving" : "Archive video"}</button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
    </div>
  );
}
