import { Archive, FolderOpen, Pencil, Plus, RotateCcw } from "lucide-react";
import { tabElementId, tabPanelId } from "@/components/AccessibleTabs";
import type { ManagedAlbum } from "@/lib/media";
import {
  PhotoManagementEmpty,
  PhotoManagementLoading,
  PhotoManagementLoadMore,
} from "./PhotoManagementPrimitives";

interface PhotoAlbumsPanelProps {
  canManage: boolean;
  showArchived: boolean;
  onShowArchivedChange: (enabled: boolean) => void;
  loading: boolean;
  albums: ManagedAlbum[];
  actionBusy: boolean;
  onCreateAlbum: () => void;
  onOpenAlbum: (album: ManagedAlbum) => void;
  onOpenPhotos: (albumId: string) => void;
  onRestoreAlbum: (albumId: string) => void;
  onRequestArchive: (album: ManagedAlbum) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export default function PhotoAlbumsPanel({
  canManage,
  showArchived,
  onShowArchivedChange,
  loading,
  albums,
  actionBusy,
  onCreateAlbum,
  onOpenAlbum,
  onOpenPhotos,
  onRestoreAlbum,
  onRequestArchive,
  hasMore,
  loadingMore,
  onLoadMore,
}: PhotoAlbumsPanelProps) {
  return (
    <section
      id={tabPanelId("photo-management", "albums")}
      role="tabpanel"
      aria-labelledby={tabElementId("photo-management", "albums")}
      tabIndex={0}
      className="space-y-7"
    >
      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCreateAlbum}
            disabled={actionBusy}
            className="inline-flex items-center gap-2 bg-ares-red px-4 py-3 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
          >
            <Plus size={15} aria-hidden="true" /> Create album
          </button>
        </div>
      )}
      <div className="flex justify-end">
        {canManage && (
          <label className="flex items-center gap-2 text-xs font-bold text-marble">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => onShowArchivedChange(event.target.checked)}
              className="accent-ares-red"
            />{" "}
            Show archived albums
          </label>
        )}
      </div>

      {loading && albums.length === 0 ? (
        <PhotoManagementLoading label="Loading albums" />
      ) : albums.length === 0 ? (
        <PhotoManagementEmpty
          icon={<FolderOpen aria-hidden="true" />}
          text="No albums are ready yet."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {albums.map((album) => (
            <article
              key={album.id}
              className="overflow-hidden border border-white/10 bg-black/25"
            >
              {album.coverImageUrl ? (
                <img
                  src={album.coverImageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-black/30 text-marble/30">
                  <FolderOpen size={40} aria-hidden="true" />
                </div>
              )}
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase">
                  <span className="bg-ares-red px-2 py-1 text-white">
                    {album.category}
                  </span>
                  <span className="border border-white/15 px-2 py-1 text-marble/70">
                    {album.mediaCount} photos
                  </span>
                  {album.isPublic && (
                    <span className="border border-ares-gold/40 px-2 py-1 text-ares-gold">
                      Public
                    </span>
                  )}
                  {album.isArchived && (
                    <span className="border border-white/20 px-2 py-1 text-marble">
                      Archived
                    </span>
                  )}
                </div>
                <h2 className="font-heading text-xl font-black uppercase text-white">
                  {album.title}
                </h2>
                <p className="text-sm leading-relaxed text-marble/65">
                  {album.description || "No description yet."}
                </p>
                <div className="flex justify-between border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => onOpenPhotos(album.id)}
                    className="text-xs font-bold text-ares-cyan focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    Open photos
                  </button>
                  {canManage && (
                    <div className="flex gap-2">
                      {!album.isArchived && (
                        <button
                          type="button"
                          onClick={() => onOpenAlbum(album)}
                          disabled={actionBusy}
                          aria-label={`Edit ${album.title}`}
                          className="border border-white/15 p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                      )}
                      {album.isArchived ? (
                        <button
                          type="button"
                          onClick={() => onRestoreAlbum(album.id)}
                          disabled={actionBusy}
                          aria-label={`Restore ${album.title}`}
                          className="border border-ares-gold/40 p-2 text-ares-gold focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                        >
                          <RotateCcw size={14} aria-hidden="true" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRequestArchive(album)}
                          disabled={actionBusy}
                          aria-label={`Archive ${album.title}`}
                          className="border border-ares-red/50 p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                        >
                          <Archive size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {hasMore && (
        <PhotoManagementLoadMore
          busy={loadingMore}
          onClick={onLoadMore}
          label="albums"
        />
      )}
    </section>
  );
}
