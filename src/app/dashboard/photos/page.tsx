"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { resizeAndCompressImage } from "@/lib/image";
import {
  apiFailure,
  GooglePhotosConnection,
  ManagedAlbum,
  ManagedPhoto,
} from "@/lib/media";
import AccessibleTabs from "@/components/AccessibleTabs";
import GooglePhotosSyncPanel from "./GooglePhotosSyncPanel";
import PhotoAlbumsPanel from "./PhotoAlbumsPanel";
import PhotoLibraryPanel, { type UploadState } from "./PhotoLibraryPanel";
import PhotoManagementDialogs, {
  type AlbumEditorDraft,
  type PendingArchive,
  type PhotoEditorDraft,
} from "./PhotoManagementDialogs";
import { usePhotoCollectionData } from "./usePhotoCollectionData";

type Tab = "library" | "albums" | "sync";
interface PickerItem {
  id: string;
  mediaFile: { baseUrl: string; filename?: string; mimeType?: string };
}
export default function DashboardPhotosPage() {
  const { user, authorizedUser } = useAuth();
  const canContribute = Boolean(
    user && authorizedUser && authorizedUser.role !== "unverified",
  );
  const canManage =
    authorizedUser?.role === "admin" || authorizedUser?.role === "coach";
  const [tab, setTab] = useState<Tab>("library");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [albumFilter, setAlbumFilter] = useState("");
  const [showArchivedPhotos, setShowArchivedPhotos] = useState(false);
  const [showArchivedAlbums, setShowArchivedAlbums] = useState(false);
  const {
    photos,
    setPhotos,
    albums,
    setAlbums,
    photoCursor,
    albumCursor,
    morePhotos,
    moreAlbums,
    loadingPhotos,
    loadingAlbums,
    loadingMorePhotos,
    loadingMoreAlbums,
    photoError,
    albumError,
    loadPhotos,
    loadAlbums,
  } = usePhotoCollectionData({
    albumFilter,
    showArchivedPhotos,
    showArchivedAlbums,
  });
  const [pendingArchive, setPendingArchive] = useState<PendingArchive | null>(
    null,
  );
  const [actionBusy, setActionBusy] = useState(false);

  const [photoEditor, setPhotoEditor] = useState<ManagedPhoto | null>(null);
  const [photoDraft, setPhotoDraft] = useState<PhotoEditorDraft>({
    caption: "",
    altText: "",
    labels: "",
    albumId: "",
  });
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const [albumEditorOpen, setAlbumEditorOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<ManagedAlbum | null>(null);
  const [albumDraft, setAlbumDraft] = useState<AlbumEditorDraft>({
    title: "",
    description: "",
    category: "Competition",
    coverImageUrl: "",
    isPublic: false,
  });
  const [savingAlbum, setSavingAlbum] = useState(false);

  const [connection, setConnection] = useState<GooglePhotosConnection | null>(
    null,
  );
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [pickerSession, setPickerSession] = useState("");
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [pickerStatus, setPickerStatus] = useState("");
  const [pickerBusy, setPickerBusy] = useState(false);
  const [syncAlbum, setSyncAlbum] = useState("");
  const pickerPopup = useRef<Window | null>(null);

  const [uploadAlbum, setUploadAlbum] = useState("");
  const [uploadAi, setUploadAi] = useState(true);
  const [uploads, setUploads] = useState<UploadState[]>([]);

  const loadConnection = useCallback(async () => {
    if (!canManage) return;
    setConnectionLoading(true);
    try {
      const response = await authenticatedFetch("/api/photos/auth/status");
      if (!response.ok)
        throw await apiFailure(
          response,
          "Google Photos connection could not load.",
        );
      const status = (await response.json()) as GooglePhotosConnection;
      setConnection(status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setConnectionLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  useEffect(() => {
    if (!pickerSession) return;
    const poll = window.setInterval(async () => {
      try {
        const response = await authenticatedFetch(
          `/api/photos/picker/${pickerSession}`,
        );
        if (!response.ok)
          throw await apiFailure(response, "Picker status could not load.");
        const status = (await response.json()) as { mediaItemsSet: boolean };
        if (!status.mediaItemsSet) return;
        window.clearInterval(poll);
        const itemsResponse = await authenticatedFetch(
          `/api/photos/picker/${pickerSession}/items`,
        );
        if (!itemsResponse.ok)
          throw await apiFailure(
            itemsResponse,
            "Selected photos could not load.",
          );
        const payload = (await itemsResponse.json()) as {
          mediaItems: PickerItem[];
          count: number;
        };
        setPickerItems(payload.mediaItems);
        setPickerStatus(
          `${payload.count} photo${payload.count === 1 ? "" : "s"} selected from the team account.`,
        );
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
    return photos.filter((photo) =>
      `${photo.caption} ${photo.altText} ${photo.labels.join(" ")}`
        .toLowerCase()
        .includes(query),
    );
  }, [photos, search]);

  const openPhoto = (photo: ManagedPhoto) => {
    setPhotoEditor(photo);
    setPhotoDraft({
      caption: photo.caption,
      altText: photo.altText,
      labels: photo.labels.join(", "),
      albumId: photo.albumId || "",
    });
    setEditorError(null);
  };

  const savePhoto = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!photoEditor || savingPhoto) return;
    setSavingPhoto(true);
    setEditorError(null);
    try {
      const response = await authenticatedFetch(
        `/api/photos/${photoEditor.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caption: photoDraft.caption,
            altText: photoDraft.altText,
            labels: photoDraft.labels
              .split(",")
              .map((label) => label.trim())
              .filter(Boolean),
            albumId: photoDraft.albumId || null,
          }),
        },
      );
      if (!response.ok)
        throw await apiFailure(response, "Photo details could not be saved.");
      const payload = (await response.json()) as { photo: ManagedPhoto };
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === payload.photo.id ? payload.photo : photo,
        ),
      );
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
    setAlbumDraft({
      title: album?.title || "",
      description: album?.description || "",
      category: album?.category || "Competition",
      coverImageUrl: album?.coverImageUrl || "",
      isPublic: album?.isPublic || false,
    });
    setEditorError(null);
    setAlbumEditorOpen(true);
  };

  const saveAlbum = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || savingAlbum) return;
    setSavingAlbum(true);
    setEditorError(null);
    try {
      const response = await authenticatedFetch(
        editingAlbum
          ? `/api/photos/albums/${editingAlbum.id}`
          : "/api/photos/albums",
        {
          method: editingAlbum ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: albumDraft.title,
            description: albumDraft.description,
            category: albumDraft.category,
            coverImageUrl: albumDraft.coverImageUrl,
            isPublic: albumDraft.isPublic,
          }),
        },
      );
      if (!response.ok)
        throw await apiFailure(response, "Album could not be saved.");
      const payload = (await response.json()) as { album: ManagedAlbum };
      setAlbums((current) =>
        editingAlbum
          ? current.map((album) =>
              album.id === editingAlbum.id ? payload.album : album,
            )
          : [payload.album, ...current],
      );
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
      const path =
        pendingArchive.kind === "photo"
          ? `/api/photos/${pendingArchive.item.id}`
          : `/api/photos/albums/${pendingArchive.item.id}`;
      const response = await authenticatedFetch(path, { method: "DELETE" });
      if (!response.ok)
        throw await apiFailure(response, "Item could not be archived.");
      if (pendingArchive.kind === "photo") {
        const archivedPhoto = pendingArchive.item;
        setPhotos((current) =>
          showArchivedPhotos
            ? current.map((photo) =>
                photo.id === archivedPhoto.id
                  ? { ...photo, isArchived: true }
                  : photo,
              )
            : current.filter((photo) => photo.id !== archivedPhoto.id),
        );
        if (archivedPhoto.albumId) {
          setAlbums((current) =>
            current.map((album) =>
              album.id === archivedPhoto.albumId
                ? { ...album, mediaCount: Math.max(0, album.mediaCount - 1) }
                : album,
            ),
          );
        }
      } else {
        const archivedAlbum = pendingArchive.item;
        setAlbums((current) =>
          showArchivedAlbums
            ? current.map((album) =>
                album.id === archivedAlbum.id
                  ? { ...album, isArchived: true, isPublic: false }
                  : album,
              )
            : current.filter((album) => album.id !== archivedAlbum.id),
        );
      }
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
      const path =
        kind === "photo"
          ? `/api/photos/${id}/restore`
          : `/api/photos/albums/${id}/restore`;
      const response = await authenticatedFetch(path, { method: "POST" });
      if (!response.ok)
        throw await apiFailure(response, "Item could not be restored.");
      if (kind === "photo") {
        const payload = (await response.json()) as { photo: ManagedPhoto };
        setPhotos((current) =>
          current.map((photo) =>
            photo.id === payload.photo.id ? payload.photo : photo,
          ),
        );
        if (payload.photo.albumId) {
          setAlbums((current) =>
            current.map((album) =>
              album.id === payload.photo.albumId
                ? { ...album, mediaCount: album.mediaCount + 1 }
                : album,
            ),
          );
        }
      } else {
        const payload = (await response.json()) as { album: ManagedAlbum };
        setAlbums((current) =>
          current.map((album) =>
            album.id === payload.album.id ? payload.album : album,
          ),
        );
      }
      setNotice("Item restored to the active library.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setActionBusy(false);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || !canContribute) return;
    const selected = Array.from(files).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    );
    if (!selected.length) {
      setError("Choose JPEG, PNG, or WebP image files.");
      return;
    }
    const initial = selected.map((file, index) => ({
      key: `${file.name}-${file.size}-${index}`,
      name: file.name,
      state: "waiting" as const,
    }));
    setUploads(initial);
    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      const key = initial[index].key;
      setUploads((current) =>
        current.map((item) =>
          item.key === key ? { ...item, state: "uploading" } : item,
        ),
      );
      try {
        const compressed = await resizeAndCompressImage(file);
        const filename =
          compressed.mimeType === "image/jpeg"
            ? file.name.replace(/\.[^.]+$/, "") + ".jpg"
            : file.name;
        const response = await authenticatedFetch(
          "/api/photos/upload-unified",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileBase64: compressed.base64,
              filename,
              mimeType: compressed.mimeType,
              albumId: uploadAlbum || null,
              runAiLabeling: uploadAi,
            }),
          },
        );
        if (!response.ok) throw await apiFailure(response, "Upload failed.");
        const payload = (await response.json()) as {
          photo: ManagedPhoto;
        };
        setPhotos((current) => [
          payload.photo,
          ...current.filter((photo) => photo.id !== payload.photo.id),
        ]);
        setUploads((current) =>
          current.map((item) =>
            item.key === key
              ? {
                  ...item,
                  state: "done",
                }
              : item,
          ),
        );
      } catch (cause) {
        setUploads((current) =>
          current.map((item) =>
            item.key === key
              ? {
                  ...item,
                  state: "error",
                  detail:
                    cause instanceof Error ? cause.message : String(cause),
                }
              : item,
          ),
        );
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
    pickerPopup.current = window.open(
      "about:blank",
      "GooglePhotosPicker",
      "width=720,height=760,resizable=yes,scrollbars=yes",
    );
    try {
      const response = await authenticatedFetch("/api/photos/picker", {
        method: "POST",
      });
      if (!response.ok)
        throw await apiFailure(
          response,
          "Google Photos picker could not start.",
        );
      const payload = (await response.json()) as {
        sessionId: string;
        pickerUri: string;
        mediaItemsSet: boolean;
      };
      setPickerSession(payload.sessionId);
      setPickerStatus(
        "Choose photos in the Google window. This page will update when you finish.",
      );
      if (pickerPopup.current)
        pickerPopup.current.location.href = payload.pickerUri;
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
        body: JSON.stringify({
          items: pickerItems,
          albumId: album?.id,
          albumName: album?.title,
        }),
      });
      if (!response.ok)
        throw await apiFailure(response, "Selected photos could not import.");
      const payload = (await response.json()) as {
        imported: number;
        failed: number;
      };
      setPickerStatus(
        `Imported ${payload.imported} photo${payload.imported === 1 ? "" : "s"}. ${payload.failed ? `${payload.failed} need attention.` : ""}`,
      );
      if (pickerSession)
        await authenticatedFetch(`/api/photos/picker/${pickerSession}`, {
          method: "DELETE",
        });
      setPickerSession("");
      setPickerItems([]);
      await Promise.all([loadPhotos(false), loadAlbums(false)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPickerBusy(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-gold">
            <ImageIcon size={14} aria-hidden="true" /> Team media
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight text-white md:text-5xl">
            Manage Photos
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-marble/70">
            Upload team photos, add useful alt text, build albums, and import
            from the team Google account.
          </p>
        </div>
        <AccessibleTabs
          id="photo-management"
          label="Photo management views"
          tabs={[
            { value: "library", label: "Library" },
            { value: "albums", label: "Albums" },
            { value: "sync", label: "Google sync" },
          ]}
          activeTab={tab}
          onChange={setTab}
          className="flex flex-wrap border border-white/10 bg-black/30 p-1"
          tabClassName={(_value, active) =>
            `px-4 py-2 text-[10px] font-black uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-ares-cyan ${active ? "bg-ares-red text-white" : "text-marble/65"}`
          }
        />
      </header>

      {!canContribute && (
        <p className="flex items-center gap-2 border border-ares-gold/30 bg-ares-gold/10 p-4 text-sm text-marble">
          <Shield size={16} aria-hidden="true" /> Your account has read-only
          access to team photos.
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="border border-ares-gold/30 bg-ares-gold/10 p-4 text-sm text-marble"
        >
          {notice}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="border border-ares-red bg-ares-red/15 p-4 text-white"
        >
          <p className="font-bold">The photo library was not changed.</p>
          <p className="mt-1 break-words font-mono text-xs text-white/80">
            {error}
          </p>
        </div>
      )}

      {tab === "library" && (
        <PhotoLibraryPanel
          canContribute={canContribute}
          canManage={canManage}
          albums={albums}
          uploads={uploads}
          uploadAlbum={uploadAlbum}
          uploadAi={uploadAi}
          onUploadFiles={(files) => void uploadFiles(files)}
          onUploadAlbumChange={setUploadAlbum}
          onUploadAiChange={setUploadAi}
          search={search}
          albumFilter={albumFilter}
          showArchived={showArchivedPhotos}
          onSearchChange={setSearch}
          onAlbumFilterChange={setAlbumFilter}
          onShowArchivedChange={setShowArchivedPhotos}
          loading={loadingPhotos}
          loadError={photoError}
          onRetry={() => void loadPhotos(false)}
          photos={filteredPhotos}
          actionBusy={actionBusy}
          onOpenPhoto={openPhoto}
          onRestorePhoto={(photoId) => void restore("photo", photoId)}
          onRequestArchive={(photo) =>
            setPendingArchive({ kind: "photo", item: photo })
          }
          hasMore={morePhotos}
          loadingMore={loadingMorePhotos}
          onLoadMore={() => void loadPhotos(true, photoCursor)}
        />
      )}

      {tab === "albums" && (
        <PhotoAlbumsPanel
          canManage={canManage}
          showArchived={showArchivedAlbums}
          onShowArchivedChange={setShowArchivedAlbums}
          loading={loadingAlbums}
          loadError={albumError}
          onRetry={() => void loadAlbums(false)}
          albums={albums}
          actionBusy={actionBusy}
          onCreateAlbum={() => openAlbum()}
          onOpenAlbum={openAlbum}
          onOpenPhotos={(albumId) => {
            setAlbumFilter(albumId);
            setTab("library");
          }}
          onRestoreAlbum={(albumId) => void restore("album", albumId)}
          onRequestArchive={(album) =>
            setPendingArchive({ kind: "album", item: album })
          }
          hasMore={moreAlbums}
          loadingMore={loadingMoreAlbums}
          onLoadMore={() => void loadAlbums(true, albumCursor)}
        />
      )}

      {tab === "sync" && (
        <GooglePhotosSyncPanel
          canManage={canManage}
          connection={connection}
          connectionLoading={connectionLoading}
          onCheckConnection={() => void loadConnection()}
          albums={albums}
          syncAlbum={syncAlbum}
          onSyncAlbumChange={setSyncAlbum}
          pickerBusy={pickerBusy}
          pickerStatus={pickerStatus}
          pickerItemCount={pickerItems.length}
          onStartPicker={() => void startPicker()}
          onImportPickerItems={() => void importPickerItems()}
        />
      )}

      <PhotoManagementDialogs
        albums={albums}
        canManage={canManage}
        photo={photoEditor}
        photoDraft={photoDraft}
        setPhotoDraft={setPhotoDraft}
        savingPhoto={savingPhoto}
        onClosePhoto={() => setPhotoEditor(null)}
        onSavePhoto={(event) => void savePhoto(event)}
        onRequestPhotoArchive={(photo) =>
          setPendingArchive({ kind: "photo", item: photo })
        }
        albumOpen={albumEditorOpen}
        editingAlbum={editingAlbum}
        albumDraft={albumDraft}
        setAlbumDraft={setAlbumDraft}
        savingAlbum={savingAlbum}
        onAlbumOpenChange={setAlbumEditorOpen}
        onSaveAlbum={(event) => void saveAlbum(event)}
        editorError={editorError}
        pendingArchive={pendingArchive}
        actionBusy={actionBusy}
        onArchiveOpenChange={(open) => !open && setPendingArchive(null)}
        onConfirmArchive={() => void archivePending()}
      />
    </div>
  );
}
