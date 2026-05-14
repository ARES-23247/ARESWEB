import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { Image, Upload, ExternalLink, Loader2, Check, AlertCircle, X } from "lucide-react";
import {
  useCreatePickerSession,
  useGetPickerSession,
  useGetPickerItems,
  useDeletePickerSession,
  useImportPhotos,
  type PickedMediaItem,
} from "@/api/google-photos";
import { PhotoUploadModal } from "@/components/dashboard/PhotoUploadModal";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/photos")({
  component: PhotosDashboard,
});

function PhotosDashboard() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Picker session state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickedItems, setPickedItems] = useState<PickedMediaItem[]>([]);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());

  const popupRef = useRef<Window | null>(null);

  // Picker session hooks
  const createSession = useCreatePickerSession();
  const deleteSession = useDeletePickerSession();
  const importMutation = useImportPhotos({
    onSuccess: (data) => {
      if (data.imported > 0) {
        toast.success(`Imported ${data.imported} photo${data.imported === 1 ? "" : "s"} to library`);
      }
      if (data.failed > 0) {
        toast.warning(`${data.failed} photo${data.failed === 1 ? "" : "s"} failed to import`);
      }
      // Clear state after import
      handleCleanup();
    },
  });

  // Poll session status while picker is open
  const {
    data: sessionStatus,
  } = useGetPickerSession(activeSessionId, isPickerOpen && !pickedItems.length);

  // Fetch items when user finishes selecting
  const {
    data: itemsData,
    isLoading: itemsLoading,
  } = useGetPickerItems(
    sessionStatus?.mediaItemsSet ? activeSessionId : null
  );

  // When items arrive, populate the review grid
  useEffect(() => {
    if (itemsData?.mediaItems && itemsData.mediaItems.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Expected behavior to initialize selection grid from API data
      setPickedItems(itemsData.mediaItems);
      setSelectedForImport(new Set(itemsData.mediaItems.map((i) => i.id)));
      setIsPickerOpen(false);
    }
  }, [itemsData]);

  // Monitor popup close
  useEffect(() => {
    if (!isPickerOpen || !popupRef.current) return;

    const checkPopup = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(checkPopup);
        // Don't clear session — keep polling for mediaItemsSet
      }
    }, 1000);

    return () => clearInterval(checkPopup);
  }, [isPickerOpen]);

  // Open the Google Photos Picker
  const handleOpenPicker = useCallback(async () => {
    try {
      const session = await createSession.mutateAsync();
      setActiveSessionId(session.id);
      setIsPickerOpen(true);
      setPickedItems([]);

      // Open picker in popup with /autoclose for web
      const pickerUrl = `${session.pickerUri}/autoclose`;
      const popup = window.open(
        pickerUrl,
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

  // Toggle selection for import
  const handleToggleSelect = (id: string) => {
    setSelectedForImport((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select/deselect all
  const handleSelectAll = () => {
    if (selectedForImport.size === pickedItems.length) {
      setSelectedForImport(new Set());
    } else {
      setSelectedForImport(new Set(pickedItems.map((i) => i.id)));
    }
  };

  // Import selected items to R2
  const handleImport = () => {
    const items = pickedItems
      .filter((item) => selectedForImport.has(item.id))
      .map((item) => ({
        id: item.id,
        baseUrl: item.baseUrl,
        filename: item.mediaFile?.filename,
        mimeType: item.mimeType,
      }));

    if (items.length === 0) {
      toast.warning("No photos selected for import");
      return;
    }

    importMutation.mutate({ items });
  };

  // Cleanup session and reset state
  const handleCleanup = useCallback(() => {
    if (activeSessionId) {
      deleteSession.mutate(activeSessionId);
    }
    setActiveSessionId(null);
    setIsPickerOpen(false);
    setPickedItems([]);
    setSelectedForImport(new Set());
    popupRef.current = null;
  }, [activeSessionId, deleteSession]);

  const isWaitingForSelection = isPickerOpen && !pickedItems.length;
  const hasPickedItems = pickedItems.length > 0;

  return (
    <div className="min-h-screen bg-obsidian">
      {/* Header */}
      <header className="border-b border-ares-bronze/30 bg-obsidian/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ares-red">Google Photos</h1>
              <p className="mt-1 text-sm text-marble/70">
                Import photos from Google Photos or upload from your device
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Pick Photos Button */}
              <button
                type="button"
                onClick={handleOpenPicker}
                disabled={createSession.isPending || isWaitingForSelection}
                className="flex items-center gap-2 rounded-lg bg-ares-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ares-red/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                aria-label="Pick photos from Google Photos"
              >
                {createSession.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    Pick from Google Photos
                  </>
                )}
              </button>

              {/* Upload Button */}
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="rounded-lg border border-ares-bronze/30 px-4 py-2 text-sm font-medium text-marble transition-colors hover:border-ares-bronze hover:bg-marble/5 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                aria-label="Upload photos from device"
              >
                <Upload className="mr-2 inline h-4 w-4" />
                Upload
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Waiting for selection state */}
        {isWaitingForSelection && (
          <div className="rounded-lg border border-ares-bronze/20 bg-marble/5 p-12">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-ares-cyan" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-marble">
                  Waiting for photo selection...
                </h2>
                <p className="mt-2 text-sm text-marble/70">
                  Select your photos in the Google Photos window that opened.
                  <br />
                  This page will update automatically when you&apos;re done.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCleanup}
                className="mt-2 rounded-lg border border-ares-bronze/30 px-4 py-2 text-sm text-marble transition-colors hover:bg-marble/5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading items after selection */}
        {itemsLoading && (
          <div className="rounded-lg border border-ares-bronze/20 bg-marble/5 p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-ares-cyan" />
              <p className="text-marble">Loading selected photos...</p>
            </div>
          </div>
        )}

        {/* Review grid — show picked items for import */}
        {hasPickedItems && !importMutation.isPending && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between rounded-lg border border-ares-bronze/20 bg-marble/5 px-4 py-3">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm text-ares-cyan hover:underline"
                >
                  {selectedForImport.size === pickedItems.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
                <span className="text-sm text-marble/70">
                  {selectedForImport.size} of {pickedItems.length} selected
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCleanup}
                  className="rounded-lg border border-ares-bronze/30 px-3 py-1.5 text-sm text-marble transition-colors hover:bg-marble/5"
                >
                  <X className="mr-1 inline h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={selectedForImport.size === 0}
                  className="flex items-center gap-2 rounded-lg bg-ares-red px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-ares-red/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Import Selected ({selectedForImport.size})
                </button>
              </div>
            </div>

            {/* Photo grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {pickedItems.map((item) => {
                const isSelected = selectedForImport.has(item.id);
                const filename = item.mediaFile?.filename ?? "Photo";

                return (
                  <div
                    key={item.id}
                    className={`
                      group relative aspect-square cursor-pointer overflow-hidden rounded-lg
                      border transition-all
                      ${
                        isSelected
                          ? "border-2 border-ares-red shadow-lg shadow-ares-red/20"
                          : "border-ares-bronze/20 hover:border-ares-red hover:shadow-lg hover:shadow-ares-red/20"
                      }
                    `}
                    onClick={() => handleToggleSelect(item.id)}
                    role="checkbox"
                    tabIndex={0}
                    aria-label={`${isSelected ? "Deselect" : "Select"} ${filename}`}
                    aria-checked={isSelected}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggleSelect(item.id);
                      }
                    }}
                  >
                    {/* Photo thumbnail */}
                    <img
                      src={`${item.baseUrl}=w300-h300-c`}
                      alt={filename}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Selection checkbox overlay */}
                    <div className={`
                      absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full
                      border-2 transition-all
                      ${
                        isSelected
                          ? "border-ares-red bg-ares-red text-white"
                          : "border-white/80 bg-black/30 text-transparent"
                      }
                    `}>
                      <Check className="h-3.5 w-3.5" />
                    </div>

                    {/* Filename overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="truncate text-xs font-medium text-white">{filename}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Import in progress */}
        {importMutation.isPending && (
          <div className="rounded-lg border border-ares-bronze/20 bg-marble/5 p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-ares-cyan" />
              <div className="text-center">
                <h2 className="text-xl font-semibold text-marble">Importing photos...</h2>
                <p className="mt-1 text-sm text-marble/70">
                  Downloading and storing {selectedForImport.size} photo{selectedForImport.size === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state — no active session */}
        {!isWaitingForSelection && !hasPickedItems && !itemsLoading && !importMutation.isPending && (
          <div className="rounded-lg border border-ares-bronze/20 bg-marble/5 p-12">
            <div className="flex flex-col items-center justify-center gap-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ares-red/10">
                <Image className="h-10 w-10 text-ares-red" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-marble">Team Photo Library</h2>
                <p className="mt-2 max-w-md text-sm text-marble/70">
                  Import photos from your team&apos;s Google Photos account to use across
                  the ARES platform, or upload new photos directly.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenPicker}
                  disabled={createSession.isPending}
                  className="flex items-center gap-2 rounded-lg bg-ares-red px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ares-red/90 disabled:opacity-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Pick from Google Photos
                </button>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-2 rounded-lg border border-ares-bronze/30 px-6 py-3 text-sm font-medium text-marble transition-colors hover:bg-marble/5"
                >
                  <Upload className="h-4 w-4" />
                  Upload from Device
                </button>
              </div>
            </div>

            {/* Error from session creation */}
            {createSession.isError && (
              <div className="mt-6 rounded-lg border border-ares-red/30 bg-ares-red/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-ares-red" />
                  <div>
                    <p className="text-sm font-medium text-ares-red">
                      Failed to open photo picker
                    </p>
                    <p className="mt-1 text-xs text-ares-red/70">
                      {createSession.error instanceof Error
                        ? createSession.error.message
                        : "Unknown error. Please try again."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Upload Modal — still uses appendonly scope */}
      <PhotoUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        albums={[]}
      />
    </div>
  );
}
