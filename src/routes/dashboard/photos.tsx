import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Image, RefreshCw, CheckSquare, Square } from "lucide-react";
import { useGetMediaItems, useGetAlbums } from "@/api/google-photos";
import { PhotoUploadModal } from "@/components/dashboard/PhotoUploadModal";
import { PhotoGrid } from "@/components/dashboard/PhotoGrid";
import { PhotoImportButton } from "@/components/dashboard/PhotoImportButton";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/photos")({
  component: PhotosDashboard,
});

function PhotosDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Selection state for photo import (IMG-02)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch media items and albums
  const {
    data: mediaData,
    isLoading: mediaLoading,
    error: mediaError,
    refetch: refetchMedia,
  } = useGetMediaItems({
    albumId: selectedAlbumId ?? undefined,
    pageSize: 25,
  });

  const {
    data: albumsData,
    isLoading: albumsLoading,
    error: albumsError,
  } = useGetAlbums({
    pageSize: 50,
  });

  const mediaItems = mediaData?.mediaItems ?? [];
  const albums = albumsData?.albums ?? [];

  // Selection handlers
  const handleSelectPhoto = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(mediaItems.map((item) => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  const handleImportSuccess = () => {
    // Clear selection and exit select mode after import
    handleClearSelection();
  };

  const handleImportComplete = (data: { imported: number; failed: number }) => {
    // Show success toast (per IMG-07)
    if (data.imported > 0) {
      toast.success(`Imported ${data.imported} photo${data.imported === 1 ? "" : "s"}`);
    }

    // Show warning for failed imports (per D-20)
    if (data.failed > 0) {
      toast.warning(`${data.failed} photo${data.failed === 1 ? "" : "s"} failed to import`);
    }

    // Clear selection and exit select mode
    handleImportSuccess();
  };

  const handleImportError = () => {
    // Error display is handled by PhotoImportButton component
    toast.error("Photo import failed");
  };

  return (
    <div className="min-h-screen bg-obsidian">
      {/* Header */}
      <header className="border-b border-ares-bronze/30 bg-obsidian/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ares-red">Google Photos</h1>
              <p className="mt-1 text-sm text-marble/70">
                Browse and upload team photos
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ares-bronze" />
                <input
                  type="text"
                  placeholder="Search photos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-64 rounded-lg border border-ares-bronze/30 bg-marble/10 pl-10 pr-4 text-sm text-marble placeholder:text-ares-bronze/50 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  aria-label="Search photos"
                />
              </div>

              {/* Select Photos Toggle (IMG-02) */}
              <button
                type="button"
                onClick={() => {
                  if (isSelectMode) {
                    handleClearSelection();
                  } else {
                    setIsSelectMode(true);
                  }
                }}
                className={`
                  rounded-lg border px-4 py-2 text-sm font-medium transition-colors
                  focus-visible:ring-2 focus-visible:ring-ares-cyan
                  ${
                    isSelectMode
                      ? "border-ares-red bg-ares-red/10 text-ares-red"
                      : "border-ares-bronze/30 text-marble hover:border-ares-bronze hover:bg-marble/5"
                  }
                `}
                aria-label={isSelectMode ? "Cancel selection" : "Select photos"}
                aria-pressed={isSelectMode}
              >
                {isSelectMode ? (
                  <>
                    <Square className="mr-2 inline h-4 w-4" />
                    Cancel Selection
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-2 inline h-4 w-4" />
                    Select Photos
                  </>
                )}
              </button>

              {/* Import Button (shown when in select mode with selections) */}
              {isSelectMode && selectedIds.size > 0 && (
                <PhotoImportButton
                  selectedIds={Array.from(selectedIds)}
                  albumId={selectedAlbumId ?? undefined}
                  onSuccess={handleImportComplete}
                  onError={handleImportError}
                />
              )}

              {/* Upload Button */}
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="rounded-lg bg-ares-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ares-red/90 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                aria-label="Upload photos"
              >
                <Image className="mr-2 inline h-4 w-4" />
                Upload
              </button>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => refetchMedia()}
                className="rounded-lg border border-ares-bronze/30 px-3 py-2 text-marble transition-colors hover:border-ares-bronze hover:bg-marble/5 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                aria-label="Refresh photos"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          {/* Albums Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <div className="sticky top-6 rounded-lg border border-ares-bronze/20 bg-marble/5 p-4">
              <h2 className="mb-4 text-lg font-semibold text-marble">Albums</h2>

              {albumsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-12 animate-pulse rounded bg-ares-bronze/10"
                    />
                  ))}
                </div>
              ) : albumsError ? (
                <p className="text-sm text-ares-red">
                  Failed to load albums
                </p>
              ) : albums.length === 0 ? (
                <p className="text-sm text-ares-bronze">No albums found</p>
              ) : (
                <nav className="space-y-1" aria-label="Albums">
                  {/* All Photos option */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAlbumId(null);
                      // Clear selection when switching albums
                      handleClearSelection();
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedAlbumId === null
                        ? "bg-ares-red text-white"
                        : "text-marble hover:bg-marble/10"
                    }`}
                    aria-current={selectedAlbumId === null ? "true" : undefined}
                  >
                    All Photos
                  </button>

                  {/* Album list */}
                  {albums.map((album) => (
                    <button
                      key={album.id}
                      type="button"
                      onClick={() => {
                        setSelectedAlbumId(album.id);
                        // Clear selection when switching albums
                        handleClearSelection();
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        selectedAlbumId === album.id
                          ? "bg-ares-red text-white"
                          : "text-marble hover:bg-marble/10"
                      }`}
                      aria-current={selectedAlbumId === album.id ? "true" : undefined}
                    >
                      {album.coverPhotoBaseUrl ? (
                        <img
                          src={`${album.coverPhotoBaseUrl}=w100-h100`}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                          aria-hidden="true"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-ares-bronze/20">
                          <Image className="h-5 w-5 text-ares-bronze" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{album.title}</p>
                        {album.mediaItemsCount && (
                          <p className="text-xs opacity-70">
                            {album.mediaItemsCount} items
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </nav>
              )}
            </div>
          </aside>

          {/* Photo Grid */}
          <section className="flex-1">
            <div className="rounded-lg border border-ares-bronze/20 bg-marble/5 p-4">
              {mediaLoading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square animate-pulse rounded bg-ares-bronze/10"
                    />
                  ))}
                </div>
              ) : mediaError ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-ares-red">Failed to load photos</p>
                </div>
              ) : mediaItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Image className="mb-4 h-12 w-12 text-ares-bronze" />
                  <p className="text-marble">No photos found</p>
                </div>
              ) : (
                <PhotoGrid
                  mediaItems={mediaItems}
                  selectable={isSelectMode}
                  selectedIds={selectedIds}
                  onSelectChange={handleSelectPhoto}
                />
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Upload Modal */}
      <PhotoUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        albums={albums.map((a) => ({ id: a.id, title: a.title }))}
      />
    </div>
  );
}
