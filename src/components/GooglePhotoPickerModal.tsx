import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Loader2,
  Check,
  Image as ImageIcon,
  ExternalLink,
  Download,
  FolderOpen,
  RefreshCw,
  LayoutGrid,
} from "lucide-react";
import {
  useCreatePickerSession,
  useGetPickerSession,
  useGetPickerItems,
  useDeletePickerSession,
  useImportPhotos,
  useGetAlbums,
  useSyncAlbum,
  PickedMediaItem,
  GoogleAlbum,
} from "../api/google-photos";
import { toast } from "sonner";

interface GooglePhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If provided, selecting an album will call this (e.g. for embedding in blog)
  onAlbumSelected?: (albumId: string, title: string) => void;
  // If provided, after importing photos, it returns the URLs (e.g. for inserting images)
  onPhotosImported?: (urls: string[]) => void;
}

export default function GooglePhotoPickerModal({
  isOpen,
  onClose,
  onAlbumSelected,
  onPhotosImported,
}: GooglePhotoPickerModalProps) {
  const [activeTab, setActiveTab] = useState<"picker" | "albums">("picker");

  // ==========================================
  // PICKER TAB STATE
  // ==========================================
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickedItems, setPickedItems] = useState<PickedMediaItem[]>([]);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());
  const popupRef = useRef<Window | null>(null);

  const createSession = useCreatePickerSession();
  const deleteSession = useDeletePickerSession();
  const importMutation = useImportPhotos();

  // Poll session status while picker is open
  const { data: sessionStatus } = useGetPickerSession(
    activeSessionId,
    isPickerOpen && !pickedItems.length
  );

  // Fetch items when user finishes selecting
  const { data: itemsData, isLoading: itemsLoading } = useGetPickerItems(
    sessionStatus?.mediaItemsSet ? activeSessionId : null
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (itemsData?.mediaItems && itemsData.mediaItems.length > 0) {
      // Filter out videos client-side since Picker API doesn't support mediaFilter
      const photosOnly = itemsData.mediaItems.filter(item => item.mimeType?.startsWith("image/"));
      setPickedItems(photosOnly);
      setSelectedForImport(new Set(photosOnly.map((i) => i.id)));
      setIsPickerOpen(false);
    }
  }, [itemsData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Monitor popup close
  useEffect(() => {
    if (!isPickerOpen || !popupRef.current) return;
    const checkPopup = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(checkPopup);
      }
    }, 1000);
    return () => clearInterval(checkPopup);
  }, [isPickerOpen]);

  const handleOpenPicker = useCallback(async () => {
    try {
      const session = await createSession.mutateAsync();
      setActiveSessionId(session.id);
      setIsPickerOpen(true);
      setPickedItems([]);

      const popup = window.open(
        `${session.pickerUri}/autoclose`,
        "google-photos-picker",
        "width=1200,height=800,scrollbars=yes,resizable=yes"
      );
      popupRef.current = popup;

      if (!popup) {
        toast.error("Popup blocked — please allow popups for this site");
        setIsPickerOpen(false);
      }
    } catch {
      toast.error("Failed to create picker session");
    }
  }, [createSession]);

  const handleToggleSelect = (id: string) => {
    setSelectedForImport((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedForImport.size === pickedItems.length) {
      setSelectedForImport(new Set());
    } else {
      setSelectedForImport(new Set(pickedItems.map((i) => i.id)));
    }
  };

  const handleImportPhotos = () => {
    const items = pickedItems
      .filter((item) => selectedForImport.has(item.id))
      .map((item) => ({
        id: item.id,
        baseUrl: item.mediaFile?.baseUrl || "",
        filename: item.mediaFile?.filename || `photo-${item.id}.jpg`,
        mimeType: item.mediaFile?.mimeType || "image/jpeg",
      }));

    if (items.length === 0) return;

    importMutation.mutate(
      { items },
      {
        onSuccess: (data) => {
          if (data.imported > 0) {
            toast.success(`Successfully imported ${data.imported} photos to R2!`);
            
            // Send back the URLs of successfully imported photos
            const successUrls = data.results
              .filter(r => r.status === "success" && r.r2Key)
              .map(r => `/cdn-cgi/image/width=800,quality=80/${r.r2Key}`);
              
            if (onPhotosImported && successUrls.length > 0) {
              onPhotosImported(successUrls);
            }
          }
          if (data.failed > 0) {
            toast.error(`Failed to import ${data.failed} photos.`);
          }
          if (data.imported > 0) {
            handleCleanupPicker();
            onClose();
          }
        },
      }
    );
  };

  const handleCleanupPicker = useCallback(() => {
    if (activeSessionId) deleteSession.mutate(activeSessionId);
    setActiveSessionId(null);
    setIsPickerOpen(false);
    setPickedItems([]);
    setSelectedForImport(new Set());
    popupRef.current = null;
  }, [activeSessionId, deleteSession]);

  useEffect(() => {
    if (!isOpen) {
      handleCleanupPicker();
    }
  }, [isOpen, handleCleanupPicker]);

  const isWaitingForSelection = isPickerOpen && !pickedItems.length;
  const hasPickedItems = pickedItems.length > 0;
  const selectedCount = pickedItems.filter((item) => selectedForImport.has(item.id)).length;

  // ==========================================
  // ALBUMS TAB STATE
  // ==========================================
  const { data: albumsData, isLoading: albumsLoading } = useGetAlbums();
  const syncAlbumMutation = useSyncAlbum();
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  const handleSyncAlbum = (album: GoogleAlbum) => {
    syncAlbumMutation.mutate(album.id, {
      onSuccess: (data) => {
        toast.success(`Album "${album.title}" synchronized with ${data.importResults.imported} new photos!`);
        if (onAlbumSelected) {
          onAlbumSelected(album.id, album.title);
          onClose();
        }
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-obsidian border border-ares-cyan/30 ares-cut-lg max-w-5xl w-full mx-4 h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center ares-cut-sm bg-ares-cyan/20 border border-ares-cyan/30 text-ares-cyan">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest">
                Google Photos
              </h2>
              <p className="text-xs text-marble/60 font-mono mt-1">
                Import from library or synchronize full albums
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-marble/60 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex border-b border-white/10 bg-black/20">
            <button
              onClick={() => setActiveTab("picker")}
              className={`flex-1 px-4 py-3 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === "picker" ? "bg-ares-cyan/10 text-ares-cyan border-b-2 border-ares-cyan" : "text-marble/60 hover:text-white hover:bg-white/5"}`}
            >
              <div className="flex items-center justify-center gap-2">
                <LayoutGrid size={16} />
                Select Photos
              </div>
            </button>
            <button
              onClick={() => setActiveTab("albums")}
              className={`flex-1 px-4 py-3 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === "albums" ? "bg-ares-cyan/10 text-ares-cyan border-b-2 border-ares-cyan" : "text-marble/60 hover:text-white hover:bg-white/5"}`}
            >
              <div className="flex items-center justify-center gap-2">
                <FolderOpen size={16} />
                Import Albums
              </div>
            </button>
          </div>

          {/* PICKER TAB CONTENT */}
          {activeTab === "picker" && (
            <div className="flex-1 overflow-y-auto p-6 focus:outline-none">
            {importMutation.isPending && (
              <div className="rounded-lg border border-ares-cyan/20 bg-marble/5 p-12">
                <div className="flex flex-col items-center justify-center gap-4">
                  <RefreshCw className="h-12 w-12 animate-spin text-ares-cyan" />
                  <div className="text-center">
                    <h2 className="text-xl font-semibold text-marble">Importing to R2...</h2>
                    <p className="mt-2 text-sm text-marble/70">
                      Copying selected photos into ARES storage.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isWaitingForSelection && !importMutation.isPending && (
              <div className="rounded-lg border border-ares-cyan/20 bg-marble/5 p-12">
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-ares-cyan" />
                  <div>
                    <h2 className="text-xl font-semibold text-marble">Waiting for selection...</h2>
                    <p className="mt-2 text-sm text-marble/70">
                      Select photos in the Google window that opened.
                    </p>
                  </div>
                  <button
                    onClick={handleCleanupPicker}
                    className="mt-2 ares-cut-sm border border-ares-cyan/30 px-4 py-2 text-sm text-marble hover:bg-marble/5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {itemsLoading && !importMutation.isPending && (
              <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-ares-cyan" />
              </div>
            )}

            {hasPickedItems && !importMutation.isPending && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/40 px-4 py-3">
                  <div className="flex items-center gap-4">
                    <button onClick={handleSelectAll} className="text-sm text-ares-cyan hover:underline font-bold">
                      {selectedCount === pickedItems.length ? "Deselect All" : "Select All"}
                    </button>
                    <span className="text-sm text-marble/70 font-mono">
                      {selectedCount} / {pickedItems.length} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleCleanupPicker} className="text-sm text-marble hover:text-white px-3 py-1.5 transition-colors">
                      Discard
                    </button>
                    <button
                      onClick={handleImportPhotos}
                      disabled={selectedCount === 0 || importMutation.isPending}
                      className="flex items-center gap-2 ares-cut-sm bg-ares-cyan text-black px-4 py-1.5 text-sm font-bold tracking-wider uppercase transition-colors hover:bg-ares-cyan/90 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      Import {selectedCount > 0 ? `(${selectedCount})` : ""}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {pickedItems.map((item) => {
                    const isSelected = selectedForImport.has(item.id);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => handleToggleSelect(item.id)}
                        className={`group relative cursor-pointer overflow-hidden ares-cut-sm border transition-all aspect-square block w-full text-left ${
                          isSelected ? "border-2 border-ares-cyan" : "border-white/10 hover:border-ares-cyan/50"
                        }`}
                      >
                        {item.baseUrl ? (
                          <img
                            src={`/api/google-photos/picker/media-proxy?url=${encodeURIComponent(`${item.baseUrl}=w400-h400-c`)}`}
                            alt="Picker thumb"
                            className="w-full h-full object-cover"
                          />
                        ) : item.mediaFile?.baseUrl ? (
                          <img
                            src={`/api/google-photos/picker/media-proxy?url=${encodeURIComponent(`${item.mediaFile.baseUrl}=w400-h400-c`)}`}
                            alt="Picker thumb"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-black/40 flex items-center justify-center">
                            <ImageIcon className="text-marble/30 w-8 h-8" />
                          </div>
                        )}
                        <div
                          className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                            isSelected ? "border-ares-cyan bg-ares-cyan text-black" : "border-white/80 bg-black/30 text-transparent"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!isWaitingForSelection && !hasPickedItems && !itemsLoading && !importMutation.isPending && (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-center text-marble/60">
                <div className="p-6 rounded-full bg-ares-cyan/10">
                  <ImageIcon className="h-12 w-12 text-ares-cyan" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-lg font-bold text-white mb-2">Import Individual Photos</h3>
                  <p className="text-sm">
                    Open the Google Photos selector to pick specific photos and copy them into ARES R2 storage.
                  </p>
                </div>
                <button
                  onClick={handleOpenPicker}
                  disabled={createSession.isPending}
                  className="flex items-center gap-2 ares-cut-sm bg-ares-cyan px-6 py-3 text-sm font-black text-black tracking-widest uppercase hover:bg-ares-cyan/90 transition-colors disabled:opacity-50 mt-4"
                >
                  <ExternalLink className="h-4 w-4" />
                  {createSession.isPending ? "Opening..." : "Open Google Photos Picker"}
                </button>
              </div>
            )}
            </div>
          )}

          {/* ALBUMS TAB CONTENT */}
          {activeTab === "albums" && (
            <div className="flex-1 overflow-y-auto p-6 focus:outline-none bg-black/20">
            {albumsLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-ares-cyan" />
              </div>
            ) : albumsData?.albums && albumsData.albums.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {albumsData.albums.map((album) => (
                  <div
                    key={album.id}
                    className="relative flex flex-col overflow-hidden ares-cut-sm border border-white/10 bg-obsidian group hover:border-ares-cyan/50 transition-all"
                  >
                    <div className="aspect-[4/3] bg-black/50 relative">
                      {album.coverPhotoBaseUrl ? (
                        <img
                          src={`${album.coverPhotoBaseUrl}=w500-h400-c`}
                          alt={album.title}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FolderOpen className="w-12 h-12 text-marble/20" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-md ares-cut-sm text-xs font-mono text-ares-cyan border border-ares-cyan/30">
                        {album.mediaItemsCount || 0} items
                      </div>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-bold text-sm text-white line-clamp-1 mb-1" title={album.title}>
                        {album.title}
                      </h3>
                      <div className="mt-auto pt-4 flex gap-2">
                        {onAlbumSelected && (
                          <button
                            onClick={() => onAlbumSelected(album.id, album.title)}
                            className="flex-1 px-3 py-1.5 ares-cut-sm bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider transition-colors text-center border border-white/10"
                          >
                            Embed
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedAlbumId(album.id);
                            handleSyncAlbum(album);
                          }}
                          disabled={syncAlbumMutation.isPending && selectedAlbumId === album.id}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 ares-cut-sm bg-ares-cyan/10 hover:bg-ares-cyan text-ares-cyan hover:text-black border border-ares-cyan/30 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                          {syncAlbumMutation.isPending && selectedAlbumId === album.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          Sync
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-marble/60">
                <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
                <p>No albums found in Google Photos.</p>
              </div>
            )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
