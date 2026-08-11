"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Archive, CheckCircle, FolderOpen, Image as ImageIcon, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Search, Shield, Upload, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { resizeAndCompressImage } from "@/lib/image";
import { AlbumCategory, apiFailure, GooglePhotosConnection, ManagedAlbum, ManagedPhoto } from "@/lib/media";

type Tab = "library" | "albums" | "sync";
type PendingArchive = { kind: "photo"; item: ManagedPhoto } | { kind: "album"; item: ManagedAlbum };
interface PhotoPage { photos: ManagedPhoto[]; hasMore: boolean; nextCursor: string | null }
interface AlbumPage { albums: ManagedAlbum[]; hasMore: boolean; nextCursor: string | null }
interface PickerItem { id: string; mediaFile: { baseUrl: string; filename?: string; mimeType?: string } }
interface UploadState { key: string; name: string; state: "waiting" | "uploading" | "done" | "error"; detail?: string }

const CATEGORIES: AlbumCategory[] = ["Robot Specs", "Outreach", "Competition", "CAD Design", "Practice"];

export default function DashboardPhotosPage() {
  const { user, authorizedUser } = useAuth();
  const canContribute = Boolean(user && authorizedUser && authorizedUser.role !== "unverified");
  const canManage = authorizedUser?.role === "admin" || authorizedUser?.role === "coach";
  const [tab, setTab] = useState<Tab>("library");
  const [photos, setPhotos] = useState<ManagedPhoto[]>([]);
  const [albums, setAlbums] = useState<ManagedAlbum[]>([]);
  const [photoCursor, setPhotoCursor] = useState<string | null>(null);
  const [albumCursor, setAlbumCursor] = useState<string | null>(null);
  const [morePhotos, setMorePhotos] = useState(false);
  const [moreAlbums, setMoreAlbums] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [albumFilter, setAlbumFilter] = useState("");
  const [showArchivedPhotos, setShowArchivedPhotos] = useState(false);
  const [showArchivedAlbums, setShowArchivedAlbums] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<PendingArchive | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [photoEditor, setPhotoEditor] = useState<ManagedPhoto | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoAlt, setPhotoAlt] = useState("");
  const [photoLabels, setPhotoLabels] = useState("");
  const [photoAlbum, setPhotoAlbum] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const [albumEditorOpen, setAlbumEditorOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<ManagedAlbum | null>(null);
  const [albumTitle, setAlbumTitle] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [albumCategory, setAlbumCategory] = useState<AlbumCategory>("Competition");
  const [albumCover, setAlbumCover] = useState("");
  const [albumPublic, setAlbumPublic] = useState(false);
  const [savingAlbum, setSavingAlbum] = useState(false);

  const [connection, setConnection] = useState<GooglePhotosConnection | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [pickerSession, setPickerSession] = useState("");
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [pickerStatus, setPickerStatus] = useState("");
  const [pickerBusy, setPickerBusy] = useState(false);
  const [syncAlbum, setSyncAlbum] = useState("");
  const pickerPopup = useRef<Window | null>(null);

  const [uploadAlbum, setUploadAlbum] = useState("");
  const [uploadGoogle, setUploadGoogle] = useState(false);
  const [uploadAi, setUploadAi] = useState(true);
  const [uploads, setUploads] = useState<UploadState[]>([]);

  const loadPhotos = useCallback(async (append = false) => {
    append ? setLoadingMore(true) : setLoadingPhotos(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "30", includeArchived: String(showArchivedPhotos) });
      if (albumFilter) params.set("albumId", albumFilter);
      if (append && photoCursor) params.set("cursor", photoCursor);
      const response = await authenticatedFetch(`/api/photos?${params.toString()}`);
      if (!response.ok) throw await apiFailure(response, "Photo library could not load.");
      const page = await response.json() as PhotoPage;
      setPhotos((current) => append
        ? [...new Map([...current, ...page.photos].map((photo) => [photo.id, photo])).values()]
        : page.photos);
      setPhotoCursor(page.nextCursor);
      setMorePhotos(page.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoadingPhotos(false);
      setLoadingMore(false);
    }
  }, [albumFilter, photoCursor, showArchivedPhotos]);

  const loadAlbums = useCallback(async (append = false) => {
    append ? setLoadingMore(true) : setLoadingAlbums(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "30", includeArchived: String(showArchivedAlbums) });
      if (append && albumCursor) params.set("cursor", albumCursor);
      const response = await authenticatedFetch(`/api/photos/albums?${params.toString()}`);
      if (!response.ok) throw await apiFailure(response, "Albums could not load.");
      const page = await response.json() as AlbumPage;
      setAlbums((current) => append
        ? [...new Map([...current, ...page.albums].map((album) => [album.id, album])).values()]
        : page.albums);
      setAlbumCursor(page.nextCursor);
      setMoreAlbums(page.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoadingAlbums(false);
      setLoadingMore(false);
    }
  }, [albumCursor, showArchivedAlbums]);

  const loadConnection = useCallback(async () => {
    if (!canManage) return;
    setConnectionLoading(true);
    try {
      const response = await authenticatedFetch("/api/photos/auth/status");
      if (!response.ok) throw await apiFailure(response, "Google Photos connection could not load.");
      const status = await response.json() as GooglePhotosConnection;
      setConnection(status);
      setUploadGoogle(status.configured);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setConnectionLoading(false);
    }
  }, [canManage]);

  useEffect(() => { void loadPhotos(false); }, [albumFilter, showArchivedPhotos]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadAlbums(false); }, [showArchivedAlbums]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadConnection(); }, [loadConnection]);

  useEffect(() => {
    if (!pickerSession) return;
    const poll = window.setInterval(async () => {
      try {
        const response = await authenticatedFetch(`/api/photos/picker/${pickerSession}`);
        if (!response.ok) throw await apiFailure(response, "Picker status could not load.");
        const status = await response.json() as { mediaItemsSet: boolean };
        if (!status.mediaItemsSet) return;
        window.clearInterval(poll);
        const itemsResponse = await authenticatedFetch(`/api/photos/picker/${pickerSession}/items`);
        if (!itemsResponse.ok) throw await apiFailure(itemsResponse, "Selected photos could not load.");
        const payload = await itemsResponse.json() as { mediaItems: PickerItem[]; count: number };
        setPickerItems(payload.mediaItems);
        setPickerStatus(`${payload.count} photo${payload.count === 1 ? "" : "s"} selected from the team account.`);
      } catch (cause) {
        window.clearInterval(poll);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    }, 3000);
    return () => window.clearInterval(poll);
  }, [pickerSession]);

  const filteredPhotos = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return photos;
    return photos.filter((photo) => `${photo.caption} ${photo.altText} ${photo.labels.join(" ")}`.toLowerCase().includes(query));
  }, [photos, search]);

  const openPhoto = (photo: ManagedPhoto) => {
    setPhotoEditor(photo);
    setPhotoCaption(photo.caption);
    setPhotoAlt(photo.altText);
    setPhotoLabels(photo.labels.join(", "));
    setPhotoAlbum(photo.albumId || "");
    setEditorError(null);
  };

  const savePhoto = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!photoEditor || savingPhoto) return;
    setSavingPhoto(true);
    setEditorError(null);
    try {
      const response = await authenticatedFetch(`/api/photos/${photoEditor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: photoCaption,
          altText: photoAlt,
          labels: photoLabels.split(",").map((label) => label.trim()).filter(Boolean),
          albumId: photoAlbum || null,
        }),
      });
      if (!response.ok) throw await apiFailure(response, "Photo details could not be saved.");
      const payload = await response.json() as { photo: ManagedPhoto };
      setPhotos((current) => current.map((photo) => photo.id === payload.photo.id ? payload.photo : photo));
      setPhotoEditor(null);
      setNotice("Photo details saved.");
      await loadAlbums(false);
    } catch (cause) {
      setEditorError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSavingPhoto(false);
    }
  };

  const openAlbum = (album?: ManagedAlbum) => {
    setEditingAlbum(album || null);
    setAlbumTitle(album?.title || "");
    setAlbumDescription(album?.description || "");
    setAlbumCategory(album?.category || "Competition");
    setAlbumCover(album?.coverImageUrl || "");
    setAlbumPublic(album?.isPublic || false);
    setEditorError(null);
    setAlbumEditorOpen(true);
  };

  const saveAlbum = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || savingAlbum) return;
    setSavingAlbum(true);
    setEditorError(null);
    try {
      const response = await authenticatedFetch(editingAlbum ? `/api/photos/albums/${editingAlbum.id}` : "/api/photos/albums", {
        method: editingAlbum ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: albumTitle, description: albumDescription, category: albumCategory, coverImageUrl: albumCover, isPublic: albumPublic }),
      });
      if (!response.ok) throw await apiFailure(response, "Album could not be saved.");
      const payload = await response.json() as { album: ManagedAlbum };
      setAlbums((current) => editingAlbum ? current.map((album) => album.id === editingAlbum.id ? payload.album : album) : [payload.album, ...current]);
      setAlbumEditorOpen(false);
      setNotice(editingAlbum ? "Album changes saved." : "Album created.");
    } catch (cause) {
      setEditorError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSavingAlbum(false);
    }
  };

  const archivePending = async () => {
    if (!pendingArchive || !canManage) return;
    setActionBusy(true);
    setError(null);
    try {
      const path = pendingArchive.kind === "photo"
        ? `/api/photos/${pendingArchive.item.id}`
        : `/api/photos/albums/${pendingArchive.item.id}`;
      const response = await authenticatedFetch(path, { method: "DELETE" });
      if (!response.ok) throw await apiFailure(response, "Item could not be archived.");
      if (pendingArchive.kind === "photo") setPhotos((current) => current.filter((photo) => photo.id !== pendingArchive.item.id));
      else setAlbums((current) => current.filter((album) => album.id !== pendingArchive.item.id));
      setPendingArchive(null);
      setPhotoEditor(null);
      setNotice("Item moved to the archive. You can restore it later.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setActionBusy(false);
    }
  };

  const restore = async (kind: "photo" | "album", id: string) => {
    setActionBusy(true);
    setError(null);
    try {
      const path = kind === "photo" ? `/api/photos/${id}/restore` : `/api/photos/albums/${id}/restore`;
      const response = await authenticatedFetch(path, { method: "POST" });
      if (!response.ok) throw await apiFailure(response, "Item could not be restored.");
      kind === "photo" ? setPhotos((current) => current.filter((photo) => photo.id !== id)) : setAlbums((current) => current.filter((album) => album.id !== id));
      setNotice("Item restored to the active library.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setActionBusy(false);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || !canContribute) return;
    const selected = Array.from(files).filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (!selected.length) {
      setError("Choose JPEG, PNG, or WebP image files.");
      return;
    }
    const initial = selected.map((file, index) => ({ key: `${file.name}-${file.size}-${index}`, name: file.name, state: "waiting" as const }));
    setUploads(initial);
    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      const key = initial[index].key;
      setUploads((current) => current.map((item) => item.key === key ? { ...item, state: "uploading" } : item));
      try {
        const compressed = await resizeAndCompressImage(file);
        const filename = compressed.mimeType === "image/jpeg" ? file.name.replace(/\.[^.]+$/, "") + ".jpg" : file.name;
        const response = await authenticatedFetch("/api/photos/upload-unified", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileBase64: compressed.base64, filename, mimeType: compressed.mimeType, albumId: uploadAlbum || null, uploadToGoogle: uploadGoogle && connection?.configured, runAiLabeling: uploadAi }),
        });
        if (!response.ok) throw await apiFailure(response, "Upload failed.");
        const payload = await response.json() as { photo: ManagedPhoto; googleSync?: { warning?: string | null } };
        setPhotos((current) => [payload.photo, ...current.filter((photo) => photo.id !== payload.photo.id)]);
        setUploads((current) => current.map((item) => item.key === key ? { ...item, state: "done", detail: payload.googleSync?.warning || undefined } : item));
      } catch (cause) {
        setUploads((current) => current.map((item) => item.key === key ? { ...item, state: "error", detail: cause instanceof Error ? cause.message : String(cause) } : item));
      }
    }
    await loadAlbums(false);
  };

  const startPicker = async () => {
    if (!canManage || pickerBusy) return;
    setPickerBusy(true);
    setPickerItems([]);
    setPickerStatus("");
    setError(null);
    pickerPopup.current = window.open("about:blank", "GooglePhotosPicker", "width=720,height=760,resizable=yes,scrollbars=yes");
    try {
      const response = await authenticatedFetch("/api/photos/picker", { method: "POST" });
      if (!response.ok) throw await apiFailure(response, "Google Photos picker could not start.");
      const payload = await response.json() as { sessionId: string; pickerUri: string; mediaItemsSet: boolean };
      setPickerSession(payload.sessionId);
      setPickerStatus("Choose photos in the Google window. This page will update when you finish.");
      if (pickerPopup.current) pickerPopup.current.location.href = payload.pickerUri;
    } catch (cause) {
      pickerPopup.current?.close();
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPickerBusy(false);
    }
  };

  const importPickerItems = async () => {
    if (!pickerItems.length || pickerBusy) return;
    setPickerBusy(true);
    setError(null);
    try {
      const album = albums.find((item) => item.id === syncAlbum);
      const response = await authenticatedFetch("/api/photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: pickerItems, albumId: album?.id, albumName: album?.title }),
      });
      if (!response.ok) throw await apiFailure(response, "Selected photos could not import.");
      const payload = await response.json() as { imported: number; failed: number };
      setPickerStatus(`Imported ${payload.imported} photo${payload.imported === 1 ? "" : "s"}. ${payload.failed ? `${payload.failed} need attention.` : ""}`);
      if (pickerSession) await authenticatedFetch(`/api/photos/picker/${pickerSession}`, { method: "DELETE" });
      setPickerSession("");
      setPickerItems([]);
      await Promise.all([loadPhotos(false), loadAlbums(false)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPickerBusy(false);
    }
  };

  return <div className="space-y-8 pb-20">
    <header className="flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between"><div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-gold"><ImageIcon size={14} aria-hidden="true" /> Team media</p><h1 className="font-heading text-4xl font-black uppercase tracking-tight text-white md:text-5xl">Manage Photos</h1><p className="mt-2 max-w-2xl text-sm text-marble/70">Upload team photos, add useful alt text, build albums, and import from the team Google account.</p></div><div role="tablist" aria-label="Photo management views" className="flex flex-wrap border border-white/10 bg-black/30 p-1">{([['library', 'Library'], ['albums', 'Albums'], ['sync', 'Google sync']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-ares-cyan ${tab === value ? "bg-ares-red text-white" : "text-marble/65"}`}>{label}</button>)}</div></header>

    {!canContribute && <p className="flex items-center gap-2 border border-ares-gold/30 bg-ares-gold/10 p-4 text-sm text-marble"><Shield size={16} aria-hidden="true" /> Your account has read-only access to team photos.</p>}
    {notice && <p role="status" className="border border-ares-gold/30 bg-ares-gold/10 p-4 text-sm text-marble">{notice}</p>}
    {error && <div role="alert" className="border border-ares-red bg-ares-red/15 p-4 text-white"><p className="font-bold">The photo library was not changed.</p><p className="mt-1 break-words font-mono text-xs text-white/80">{error}</p></div>}

    {tab === "library" && <section role="tabpanel" className="space-y-7">
      {canContribute && <div className="grid gap-5 border border-white/10 bg-black/25 p-5 lg:grid-cols-[1fr_18rem]"><div><label htmlFor="photo-files" className="flex min-h-36 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-white/15 p-6 text-center text-marble/70 focus-within:ring-2 focus-within:ring-ares-cyan"><Upload className="mb-2 text-ares-gold" aria-hidden="true" /><span className="text-xs font-black uppercase tracking-wider">Choose photos to upload</span><span className="mt-1 text-[10px]">JPEG, PNG, or WebP. Files stay in the queue if one fails.</span><input id="photo-files" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => void uploadFiles(event.target.files)} /></label>{uploads.length > 0 && <ul aria-live="polite" className="mt-3 space-y-2">{uploads.map((upload) => <li key={upload.key} className="border border-white/10 p-2 text-xs text-marble"><span className="font-bold">{upload.name}</span> — {upload.state}{upload.detail && <p className={`mt-1 font-mono text-[10px] ${upload.state === "error" ? "text-white" : "text-marble/60"}`}>{upload.detail}</p>}</li>)}</ul>}</div><fieldset className="space-y-4"><legend className="text-xs font-black uppercase tracking-wider text-ares-gold">Upload options</legend><div><label htmlFor="upload-album" className="mb-1 block text-xs text-marble">Album</label><select id="upload-album" value={uploadAlbum} onChange={(event) => setUploadAlbum(event.target.value)} className="w-full border border-white/15 bg-obsidian px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><option value="">No album</option>{albums.filter((album) => !album.isArchived).map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}</select></div><label className="flex items-start gap-2 text-xs text-marble"><input type="checkbox" checked={uploadAi} onChange={(event) => setUploadAi(event.target.checked)} className="mt-0.5 accent-ares-red" /> Suggest a caption and tags</label><label className="flex items-start gap-2 text-xs text-marble"><input type="checkbox" checked={uploadGoogle} disabled={!connection?.configured} onChange={(event) => setUploadGoogle(event.target.checked)} className="mt-0.5 accent-ares-red" /> Also copy to the team Google Photos library</label></fieldset></div>}
      <div className="flex flex-col gap-4 border border-white/10 bg-black/25 p-4 md:flex-row md:items-end md:justify-between"><div className="flex flex-wrap gap-3"><div><label htmlFor="photo-search" className="mb-1 block text-[10px] font-bold uppercase text-marble/60">Search captions and tags</label><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/50" aria-hidden="true" /><input id="photo-search" value={search} onChange={(event) => setSearch(event.target.value)} className="border border-white/15 bg-obsidian py-2 pl-9 pr-3 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></div></div><div><label htmlFor="photo-album-filter" className="mb-1 block text-[10px] font-bold uppercase text-marble/60">Album</label><select id="photo-album-filter" value={albumFilter} onChange={(event) => setAlbumFilter(event.target.value)} className="border border-white/15 bg-obsidian px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><option value="">All albums</option>{albums.filter((album) => !album.isArchived).map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}</select></div></div>{canManage && <label className="flex items-center gap-2 text-xs font-bold text-marble"><input type="checkbox" checked={showArchivedPhotos} onChange={(event) => setShowArchivedPhotos(event.target.checked)} className="accent-ares-red" /> Show archived photos</label>}</div>
      {loadingPhotos && photos.length === 0 ? <Loading label="Loading photos" /> : filteredPhotos.length === 0 ? <Empty icon={<ImageIcon aria-hidden="true" />} text="No photos match this view." /> : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredPhotos.map((photo) => <article key={photo.id} className="overflow-hidden border border-white/10 bg-black/25"><button type="button" onClick={() => openPhoto(photo)} className="block aspect-video w-full bg-black focus-visible:ring-2 focus-visible:ring-ares-cyan" aria-label={`Open ${photo.caption || "team photo"} details`}><img src={photo.publicUrl} alt={photo.altText || "Team photo; alt text needed"} loading="lazy" decoding="async" className="h-full w-full object-cover" /></button><div className="space-y-3 p-4"><div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase">{photo.isSynced && <span className="border border-ares-gold/40 px-2 py-1 text-ares-gold">Google synced</span>}{photo.isArchived && <span className="bg-ares-red px-2 py-1 text-white">Archived</span>}</div><h2 className="font-heading font-black uppercase text-white">{photo.caption || "Team photo"}</h2><p className="line-clamp-2 text-xs text-marble/65">{photo.altText || "Add alt text so everyone can understand this image."}</p><div className="flex justify-end gap-2 border-t border-white/10 pt-3">{!photo.isArchived && <button type="button" onClick={() => openPhoto(photo)} aria-label="Edit photo details" className="border border-white/15 p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><Pencil size={14} aria-hidden="true" /></button>}{canManage && (photo.isArchived ? <button type="button" onClick={() => void restore("photo", photo.id)} disabled={actionBusy} aria-label="Restore photo" className="border border-ares-gold/40 p-2 text-ares-gold focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw size={14} aria-hidden="true" /></button> : <button type="button" onClick={() => setPendingArchive({ kind: "photo", item: photo })} aria-label="Archive photo" className="border border-ares-red/50 p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><Archive size={14} aria-hidden="true" /></button>)}</div></div></article>)}</div>}
      {morePhotos && <LoadMore busy={loadingMore} onClick={() => void loadPhotos(true)} label="photos" />}
    </section>}

    {tab === "albums" && <section role="tabpanel" className="space-y-7">{canManage && <div className="flex justify-end"><button type="button" onClick={() => openAlbum()} className="inline-flex items-center gap-2 bg-ares-red px-4 py-3 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><Plus size={15} aria-hidden="true" /> Create album</button></div>}<div className="flex justify-end">{canManage && <label className="flex items-center gap-2 text-xs font-bold text-marble"><input type="checkbox" checked={showArchivedAlbums} onChange={(event) => setShowArchivedAlbums(event.target.checked)} className="accent-ares-red" /> Show archived albums</label>}</div>{loadingAlbums && albums.length === 0 ? <Loading label="Loading albums" /> : albums.length === 0 ? <Empty icon={<FolderOpen aria-hidden="true" />} text="No albums are ready yet." /> : <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">{albums.map((album) => <article key={album.id} className="overflow-hidden border border-white/10 bg-black/25">{album.coverImageUrl ? <img src={album.coverImageUrl} alt="" loading="lazy" decoding="async" className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center bg-black/30 text-marble/30"><FolderOpen size={40} aria-hidden="true" /></div>}<div className="space-y-3 p-5"><div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase"><span className="bg-ares-red px-2 py-1 text-white">{album.category}</span><span className="border border-white/15 px-2 py-1 text-marble/70">{album.mediaCount} photos</span>{album.isPublic && <span className="border border-ares-gold/40 px-2 py-1 text-ares-gold">Public</span>}{album.isArchived && <span className="border border-white/20 px-2 py-1 text-marble">Archived</span>}</div><h2 className="font-heading text-xl font-black uppercase text-white">{album.title}</h2><p className="text-sm leading-relaxed text-marble/65">{album.description || "No description yet."}</p><div className="flex justify-between border-t border-white/10 pt-4"><button type="button" onClick={() => { setAlbumFilter(album.id); setTab("library"); }} className="text-xs font-bold text-ares-cyan focus-visible:ring-2 focus-visible:ring-ares-cyan">Open photos</button>{canManage && <div className="flex gap-2">{!album.isArchived && <button type="button" onClick={() => openAlbum(album)} aria-label={`Edit ${album.title}`} className="border border-white/15 p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><Pencil size={14} aria-hidden="true" /></button>}{album.isArchived ? <button type="button" onClick={() => void restore("album", album.id)} aria-label={`Restore ${album.title}`} className="border border-ares-gold/40 p-2 text-ares-gold focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw size={14} aria-hidden="true" /></button> : <button type="button" onClick={() => setPendingArchive({ kind: "album", item: album })} aria-label={`Archive ${album.title}`} className="border border-ares-red/50 p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><Archive size={14} aria-hidden="true" /></button>}</div>}</div></div></article>)}</div>}{moreAlbums && <LoadMore busy={loadingMore} onClick={() => void loadAlbums(true)} label="albums" />}</section>}

    {tab === "sync" && <section role="tabpanel" className="space-y-6"><div className="border border-white/10 bg-black/25 p-6"><h2 className="font-heading text-2xl font-black uppercase text-white">Team Google Photos</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-marble/70">This connection uses the team-owned Google account. Credentials stay in Google Secret Manager and never appear in this page.</p>{!canManage ? <p className="mt-5 border border-ares-gold/30 bg-ares-gold/10 p-4 text-sm text-marble">An admin or coach can import from the team account.</p> : connectionLoading ? <Loading label="Checking connection" /> : <div className="mt-5 flex flex-col gap-4 border border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3">{connection?.configured ? <CheckCircle className="text-ares-gold" aria-hidden="true" /> : <Shield className="text-marble/50" aria-hidden="true" />}<div><p className="font-bold text-white">{connection?.configured ? "Team connection ready" : "Team connection needs setup"}</p><p className="text-xs text-marble/60">Stored in Secret Manager. No account IDs or tokens are shown.</p></div></div><button type="button" onClick={() => void loadConnection()} className="inline-flex items-center gap-2 border border-white/20 px-4 py-2 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><RefreshCw size={14} aria-hidden="true" /> Check again</button></div>}</div>{canManage && connection?.configured && <div className="border border-white/10 bg-black/25 p-6"><h3 className="font-heading text-xl font-black uppercase text-white">Import selected photos</h3><p className="mt-2 text-sm text-marble/70">Open the Google picker, choose team photos, then import them into an active album or leave them unassigned.</p><div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end"><div className="flex-1"><label htmlFor="sync-album" className="mb-1 block text-xs font-bold text-marble">Import into album</label><select id="sync-album" value={syncAlbum} onChange={(event) => setSyncAlbum(event.target.value)} className="w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><option value="">No album</option>{albums.filter((album) => !album.isArchived).map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}</select></div><button type="button" onClick={() => void startPicker()} disabled={pickerBusy} className="bg-ares-red px-5 py-3 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">{pickerBusy ? "Working" : "Choose from Google Photos"}</button></div>{pickerStatus && <p role="status" className="mt-4 border border-ares-gold/30 bg-ares-gold/10 p-3 text-sm text-marble">{pickerStatus}</p>}{pickerItems.length > 0 && <button type="button" onClick={() => void importPickerItems()} disabled={pickerBusy} className="mt-4 bg-ares-red px-5 py-3 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">Import {pickerItems.length} selected photo{pickerItems.length === 1 ? "" : "s"}</button>}</div>}</section>}

    <Dialog.Root open={Boolean(photoEditor)} onOpenChange={(open) => !savingPhoto && !open && setPhotoEditor(null)}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80" /><Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-white/15 bg-obsidian p-6 focus:outline-none"><div className="flex items-start justify-between"><div><Dialog.Title className="font-heading text-2xl font-black uppercase text-white">Photo details</Dialog.Title><Dialog.Description className="mt-1 text-sm text-marble/60">Write a clear caption and alt text. Do not name students in public captions.</Dialog.Description></div><Dialog.Close asChild><button type="button" aria-label="Close photo details" className="p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><X aria-hidden="true" /></button></Dialog.Close></div>{photoEditor && <form onSubmit={(event) => void savePhoto(event)} className="mt-6 space-y-4"><img src={photoEditor.publicUrl} alt="" className="max-h-64 w-full object-contain bg-black" /><div><label htmlFor="photo-caption" className="mb-1 block text-xs font-bold text-marble">Caption</label><input id="photo-caption" maxLength={500} value={photoCaption} onChange={(event) => setPhotoCaption(event.target.value)} className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></div><div><label htmlFor="photo-alt" className="mb-1 block text-xs font-bold text-marble">Alt text</label><textarea id="photo-alt" required maxLength={300} rows={3} value={photoAlt} onChange={(event) => setPhotoAlt(event.target.value)} className="w-full resize-y border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></div><div><label htmlFor="photo-labels" className="mb-1 block text-xs font-bold text-marble">Tags, separated by commas</label><input id="photo-labels" value={photoLabels} onChange={(event) => setPhotoLabels(event.target.value)} className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></div><div><label htmlFor="photo-album" className="mb-1 block text-xs font-bold text-marble">Album</label><select id="photo-album" value={photoAlbum} onChange={(event) => setPhotoAlbum(event.target.value)} className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><option value="">No album</option>{albums.filter((album) => !album.isArchived).map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}</select></div>{editorError && <div role="alert" className="border border-ares-red bg-ares-red/15 p-3 text-white"><p className="font-bold">Your changes are still here.</p><p className="mt-1 font-mono text-xs text-white/80">{editorError}</p></div>}<div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pt-4">{canManage && <button type="button" onClick={() => setPendingArchive({ kind: "photo", item: photoEditor })} className="border border-ares-red/50 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">Archive</button>}<div className="ml-auto flex gap-3"><Dialog.Close asChild><button type="button" className="border border-white/15 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button></Dialog.Close><button type="submit" disabled={savingPhoto} className="bg-ares-red px-5 py-2 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">{savingPhoto ? "Saving" : "Save details"}</button></div></div></form>}</Dialog.Content></Dialog.Portal></Dialog.Root>

    <Dialog.Root open={albumEditorOpen} onOpenChange={(open) => !savingAlbum && setAlbumEditorOpen(open)}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80" /><Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[92vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-white/15 bg-obsidian p-6 focus:outline-none"><div className="flex justify-between"><div><Dialog.Title className="font-heading text-2xl font-black uppercase text-white">{editingAlbum ? "Edit album" : "Create album"}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-marble/60">Public albums appear in the team gallery.</Dialog.Description></div><Dialog.Close asChild><button type="button" aria-label="Close album editor" className="p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><X aria-hidden="true" /></button></Dialog.Close></div><form onSubmit={(event) => void saveAlbum(event)} className="mt-6 space-y-4"><div><label htmlFor="album-title" className="mb-1 block text-xs font-bold text-marble">Title</label><input id="album-title" required maxLength={120} value={albumTitle} onChange={(event) => setAlbumTitle(event.target.value)} className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></div><div><label htmlFor="album-description" className="mb-1 block text-xs font-bold text-marble">Description</label><textarea id="album-description" maxLength={1000} rows={3} value={albumDescription} onChange={(event) => setAlbumDescription(event.target.value)} className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></div><div><label htmlFor="album-category" className="mb-1 block text-xs font-bold text-marble">Category</label><select id="album-category" value={albumCategory} onChange={(event) => setAlbumCategory(event.target.value as AlbumCategory)} className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div><div><label htmlFor="album-cover" className="mb-1 block text-xs font-bold text-marble">Cover image URL</label><input id="album-cover" type="url" value={albumCover} onChange={(event) => setAlbumCover(event.target.value)} className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></div><label className="flex items-start gap-2 text-sm text-marble"><input type="checkbox" checked={albumPublic} onChange={(event) => setAlbumPublic(event.target.checked)} className="mt-1 accent-ares-red" /> Show this album in the public gallery</label>{editorError && <div role="alert" className="border border-ares-red bg-ares-red/15 p-3 text-white"><p className="font-bold">Your album changes are still here.</p><p className="mt-1 font-mono text-xs text-white/80">{editorError}</p></div>}<div className="flex justify-end gap-3 border-t border-white/10 pt-4"><Dialog.Close asChild><button type="button" className="border border-white/15 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button></Dialog.Close><button type="submit" disabled={savingAlbum} className="bg-ares-red px-5 py-2 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">{savingAlbum ? "Saving" : "Save album"}</button></div></form></Dialog.Content></Dialog.Portal></Dialog.Root>

    <Dialog.Root open={Boolean(pendingArchive)} onOpenChange={(open) => !open && !actionBusy && setPendingArchive(null)}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[110] bg-black/80" /><Dialog.Content className="fixed left-1/2 top-1/2 z-[111] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-white/15 bg-obsidian p-6 focus:outline-none"><Dialog.Title className="font-heading text-xl font-black uppercase text-white">Archive this {pendingArchive?.kind}?</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-relaxed text-marble/70">It leaves active and public views. The file and its details stay safe so an admin can restore it.</Dialog.Description><div className="mt-6 flex justify-end gap-3"><Dialog.Close asChild><button type="button" disabled={actionBusy} className="border border-white/15 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button></Dialog.Close><button type="button" onClick={() => void archivePending()} disabled={actionBusy} className="bg-ares-red px-4 py-2 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">{actionBusy ? "Archiving" : "Archive"}</button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}

function Loading({ label }: { label: string }) {
  return <div role="status" className="flex justify-center gap-2 py-16 text-ares-gold"><Loader2 className="motion-safe:animate-spin" aria-hidden="true" /><span className="text-sm">{label}</span></div>;
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="border border-white/10 bg-black/20 p-14 text-center text-marble/50"><span className="mx-auto mb-3 block w-fit">{icon}</span><p className="text-sm">{text}</p></div>;
}

function LoadMore({ busy, onClick, label }: { busy: boolean; onClick: () => void; label: string }) {
  return <div className="text-center"><button type="button" onClick={onClick} disabled={busy} className="border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">{busy ? "Loading" : `Load more ${label}`}</button></div>;
}
