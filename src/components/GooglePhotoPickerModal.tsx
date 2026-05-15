import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Loader2,
  Check,
  Image as ImageIcon,
  ExternalLink,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  useCreatePickerSession,
  useGetPickerSession,
  useGetPickerItems,
  useDeletePickerSession,
  useImportPhotos,
  PickedMediaItem,
} from "../api/google-photos";
import { toast } from "sonner";

interface GooglePhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If provided, after importing photos, it returns the items (url and r2Key)
  onPhotosImported?: (items: { url: string; r2Key: string }[]) => void;
}

export default function GooglePhotoPickerModal({
  isOpen,
  onClose,
  onPhotosImported,
}: GooglePhotoPickerModalProps) {

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
      const photosOnly = itemsData.mediaItems.filter(item => item.mediaFile?.mimeType?.startsWith("image/"));
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
    const popup = window.open(
      "about:blank",
      "google-photos-picker",
      "width=1200,height=800,scrollbars=yes,resizable=yes"
    );
    popupRef.current = popup;

    if (!popup) {
      toast.error("Popup blocked — please allow popups for this site");
      setIsPickerOpen(false);
      return;
    }

    try {
      const session = await createSession.mutateAsync();
      setActiveSessionId(session.id);
      setIsPickerOpen(true);
      setPickedItems([]);

      let finalUri = session.pickerUri;
      if (finalUri.includes("?")) {
        const [base, query] = finalUri.split("?");
        finalUri = `${base}/autoclose?${query}`;
      } else {
        finalUri = `${finalUri}/autoclose`;
      }

      popup.location.href = finalUri;
    } catch {
      toast.error("Failed to create picker session");
      if (popupRef.current) popupRef.current.close();
      popupRef.current = null;
      setIsPickerOpen(false);
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
            
            // Send back the items of successfully imported photos
            const successItems = data.results
              .filter((r): r is typeof r & { r2Key: string } => r.status === "success" && !!r.r2Key)
              .map(r => ({ url: `/api/media/${r.r2Key}`, r2Key: r.r2Key }));
              
            if (onPhotosImported && successItems.length > 0) {
              onPhotosImported(successItems);
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
          {/* PICKER CONTENT */}
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
                        {item.mediaFile?.baseUrl ? (
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
        </div>
      </div>
    </div>
  );
}
