import {
  Archive,
  Image as ImageIcon,
  Pencil,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";
import { tabElementId, tabPanelId } from "@/components/AccessibleTabs";
import type {
  GooglePhotosConnection,
  ManagedAlbum,
  ManagedPhoto,
} from "@/lib/media";
import {
  PhotoManagementEmpty,
  PhotoManagementFailure,
  PhotoManagementLoading,
  PhotoManagementLoadMore,
} from "./PhotoManagementPrimitives";

export interface UploadState {
  key: string;
  name: string;
  state: "waiting" | "uploading" | "done" | "error";
  detail?: string;
}

interface PhotoLibraryPanelProps {
  canContribute: boolean;
  canManage: boolean;
  albums: ManagedAlbum[];
  connection: GooglePhotosConnection | null;
  uploads: UploadState[];
  uploadAlbum: string;
  uploadAi: boolean;
  uploadGoogle: boolean;
  onUploadFiles: (files: FileList | null) => void;
  onUploadAlbumChange: (albumId: string) => void;
  onUploadAiChange: (enabled: boolean) => void;
  onUploadGoogleChange: (enabled: boolean) => void;
  search: string;
  albumFilter: string;
  showArchived: boolean;
  onSearchChange: (value: string) => void;
  onAlbumFilterChange: (albumId: string) => void;
  onShowArchivedChange: (enabled: boolean) => void;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  photos: ManagedPhoto[];
  actionBusy: boolean;
  onOpenPhoto: (photo: ManagedPhoto) => void;
  onRestorePhoto: (photoId: string) => void;
  onRequestArchive: (photo: ManagedPhoto) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export default function PhotoLibraryPanel({
  canContribute,
  canManage,
  albums,
  connection,
  uploads,
  uploadAlbum,
  uploadAi,
  uploadGoogle,
  onUploadFiles,
  onUploadAlbumChange,
  onUploadAiChange,
  onUploadGoogleChange,
  search,
  albumFilter,
  showArchived,
  onSearchChange,
  onAlbumFilterChange,
  onShowArchivedChange,
  loading,
  loadError,
  onRetry,
  photos,
  actionBusy,
  onOpenPhoto,
  onRestorePhoto,
  onRequestArchive,
  hasMore,
  loadingMore,
  onLoadMore,
}: PhotoLibraryPanelProps) {
  const activeAlbums = albums.filter((album) => !album.isArchived);

  return (
    <section
      id={tabPanelId("photo-management", "library")}
      role="tabpanel"
      aria-labelledby={tabElementId("photo-management", "library")}
      tabIndex={0}
      className="space-y-7"
    >
      {canContribute && (
        <div className="grid gap-5 border border-white/10 bg-black/25 p-5 lg:grid-cols-[1fr_18rem]">
          <div>
            <label
              htmlFor="photo-files"
              className="flex min-h-36 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-white/15 p-6 text-center text-marble/70 focus-within:ring-2 focus-within:ring-ares-cyan"
            >
              <Upload className="mb-2 text-ares-gold" aria-hidden="true" />
              <span className="text-xs font-black uppercase tracking-wider">
                Choose photos to upload
              </span>
              <span className="mt-1 text-[10px]">
                JPEG, PNG, or WebP. Files stay in the queue if one fails.
              </span>
              <input
                id="photo-files"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => onUploadFiles(event.target.files)}
              />
            </label>
            {uploads.length > 0 && (
              <ul aria-live="polite" className="mt-3 space-y-2">
                {uploads.map((upload) => (
                  <li
                    key={upload.key}
                    className="border border-white/10 p-2 text-xs text-marble"
                  >
                    <span className="font-bold">{upload.name}</span> —{" "}
                    {upload.state}
                    {upload.detail && (
                      <p
                        className={`mt-1 font-mono text-[10px] ${upload.state === "error" ? "text-white" : "text-marble/60"}`}
                      >
                        {upload.detail}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <fieldset className="space-y-4">
            <legend className="text-xs font-black uppercase tracking-wider text-ares-gold">
              Upload options
            </legend>
            <div>
              <label
                htmlFor="upload-album"
                className="mb-1 block text-xs text-marble"
              >
                Album
              </label>
              <select
                id="upload-album"
                value={uploadAlbum}
                onChange={(event) => onUploadAlbumChange(event.target.value)}
                className="w-full border border-white/15 bg-obsidian px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <option value="">No album</option>
                {activeAlbums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.title}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-start gap-2 text-xs text-marble">
              <input
                type="checkbox"
                checked={uploadAi}
                onChange={(event) => onUploadAiChange(event.target.checked)}
                className="mt-0.5 accent-ares-red"
              />{" "}
              Suggest a caption and tags
            </label>
            <label className="flex items-start gap-2 text-xs text-marble">
              <input
                type="checkbox"
                checked={uploadGoogle}
                disabled={!connection?.configured}
                onChange={(event) => onUploadGoogleChange(event.target.checked)}
                className="mt-0.5 accent-ares-red"
              />{" "}
              Also copy to the team Google Photos library
            </label>
          </fieldset>
        </div>
      )}

      <div className="flex flex-col gap-4 border border-white/10 bg-black/25 p-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap gap-3">
          <div>
            <label
              htmlFor="photo-search"
              className="mb-1 block text-[10px] font-bold uppercase text-marble/60"
            >
              Search captions and tags
            </label>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/50"
                aria-hidden="true"
              />
              <input
                id="photo-search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                className="border border-white/15 bg-obsidian py-2 pl-9 pr-3 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="photo-album-filter"
              className="mb-1 block text-[10px] font-bold uppercase text-marble/60"
            >
              Album
            </label>
            <select
              id="photo-album-filter"
              value={albumFilter}
              onChange={(event) => onAlbumFilterChange(event.target.value)}
              className="border border-white/15 bg-obsidian px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <option value="">All albums</option>
              {activeAlbums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        {canManage && (
          <label className="flex items-center gap-2 text-xs font-bold text-marble">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => onShowArchivedChange(event.target.checked)}
              className="accent-ares-red"
            />{" "}
            Show archived photos
          </label>
        )}
      </div>

      {loadError && (
        <PhotoManagementFailure
          title="Photos could not load."
          detail={loadError}
          retryLabel="Retry photos"
          onRetry={onRetry}
        />
      )}

      {loading && photos.length === 0 ? (
        <PhotoManagementLoading label="Loading photos" />
      ) : photos.length === 0 && !loadError ? (
        <PhotoManagementEmpty
          icon={<ImageIcon aria-hidden="true" />}
          text="No photos match this view."
        />
      ) : photos.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {photos.map((photo) => (
            <article
              key={photo.id}
              className="overflow-hidden border border-white/10 bg-black/25"
            >
              <button
                type="button"
                onClick={() => onOpenPhoto(photo)}
                className="block aspect-video w-full bg-black focus-visible:ring-2 focus-visible:ring-ares-cyan"
                aria-label={`Open ${photo.caption || "team photo"} details`}
              >
                <img
                  src={photo.thumbnailUrl || photo.publicUrl}
                  alt={photo.altText || "Team photo; alt text needed"}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </button>
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase">
                  {photo.isSynced && (
                    <span className="border border-ares-gold/40 px-2 py-1 text-ares-gold">
                      Google synced
                    </span>
                  )}
                  {photo.isArchived && (
                    <span className="bg-ares-red px-2 py-1 text-white">
                      Archived
                    </span>
                  )}
                </div>
                <h2 className="font-heading font-black uppercase text-white">
                  {photo.caption || "Team photo"}
                </h2>
                <p className="line-clamp-2 text-xs text-marble/65">
                  {photo.altText ||
                    "Add alt text so everyone can understand this image."}
                </p>
                <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
                  {!photo.isArchived && (
                    <button
                      type="button"
                      onClick={() => onOpenPhoto(photo)}
                      disabled={actionBusy}
                      aria-label="Edit photo details"
                      className="border border-white/15 p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                  )}
                  {canManage &&
                    (photo.isArchived ? (
                      <button
                        type="button"
                        onClick={() => onRestorePhoto(photo.id)}
                        disabled={actionBusy}
                        aria-label="Restore photo"
                        className="border border-ares-gold/40 p-2 text-ares-gold focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                      >
                        <RotateCcw size={14} aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRequestArchive(photo)}
                        disabled={actionBusy}
                        aria-label="Archive photo"
                        className="border border-ares-red/50 p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                      >
                        <Archive size={14} aria-hidden="true" />
                      </button>
                    ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {hasMore && (
        <PhotoManagementLoadMore
          busy={loadingMore}
          onClick={onLoadMore}
          label="photos"
        />
      )}
    </section>
  );
}
