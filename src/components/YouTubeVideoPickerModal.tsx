import { useState, useEffect, useCallback, useRef } from "react";
import { X, Loader2, Check, Video, ExternalLink, Upload, RefreshCw, AlertCircle } from "lucide-react";
import {
  useCreateVideoPickerSession,
  useGetPickerSession,
  useGetPickerItems,
  useDeletePickerSession,
  useUploadGooglePhotosToYoutube,
} from "@/api/google-photos";
import { toast } from "sonner";

interface PickedVideo {
  id: string;
  baseUrl: string;
  mimeType: string;
  mediaFile?: {
    filename?: string;
    fileSize?: string;
    videoMetadata?: {
      width?: string;
      height?: string;
      duration?: string;
    };
  };
}

interface YouTubeVideoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberType?: "student" | "mentor" | "coach";
}

export default function YouTubeVideoPickerModal({
  isOpen,
  onClose,
  memberType,
}: YouTubeVideoPickerModalProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickedItems, setPickedItems] = useState<PickedVideo[]>([]);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());

  // Upload form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacyStatus, setPrivacyStatus] = useState<"public" | "unlisted" | "private">("private");
  const [mediaType, setMediaType] = useState<"video" | "short">("video");

  const popupRef = useRef<Window | null>(null);

  const createSession = useCreateVideoPickerSession();
  const deleteSession = useDeletePickerSession();
  const uploadMutation = useUploadGooglePhotosToYoutube();

  const canSetPublic = memberType === "coach" || memberType === "mentor";

  // Poll session status while picker is open
  const { data: sessionStatus } = useGetPickerSession(
    activeSessionId,
    isPickerOpen && !pickedItems.length
  );

  // Fetch items when user finishes selecting
  const { data: itemsData, isLoading: itemsLoading } = useGetPickerItems(
    sessionStatus?.mediaItemsSet ? activeSessionId : null
  );

  // When items arrive, populate the review grid
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (itemsData?.mediaItems && itemsData.mediaItems.length > 0) {
      setPickedItems(itemsData.mediaItems as PickedVideo[]);
      setSelectedForImport(new Set(itemsData.mediaItems.map((i) => i.id)));
      setIsPickerOpen(false);

      // Auto-generate title from first video if not set
      if (!title && itemsData.mediaItems[0]?.mediaFile?.filename) {
        const filename = itemsData.mediaItems[0].mediaFile?.filename || "";
        setTitle(filename.replace(/\.[^/.]+$/, ""));
      }
    }
  }, [itemsData, title]);
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

  // Open the Google Photos Video Picker
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
        "google-photos-video-picker",
        "width=1200,height=800,scrollbars=yes,resizable=yes"
      );
      popupRef.current = popup;

      if (!popup) {
        toast.error("Popup blocked — please allow popups for this site");
        setIsPickerOpen(false);
      }
    } catch {
      toast.error("Failed to create video picker session");
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

  // Upload selected videos to YouTube
  const handleUpload = () => {
    const items = pickedItems
      .filter((item) => selectedForImport.has(item.id))
      .map((item) => ({
        id: item.id,
        baseUrl: item.baseUrl,
        filename: item.mediaFile?.filename || `video-${item.id}.mp4`,
        mimeType: item.mimeType,
      }));

    if (items.length === 0) {
      toast.warning("No videos selected for upload");
      return;
    }

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    uploadMutation.mutate(
      {
        videos: items,
        title: title.trim(),
        description: description.trim(),
        privacyStatus,
        mediaType,
      },
      {
        onSuccess: (data) => {
          const { summary, results } = data;

          if (summary.successful > 0) {
            toast.success(
              `Uploaded ${summary.successful} video${summary.successful > 1 ? 's' : ''} to YouTube!`
            );
          }

          if (summary.failed > 0) {
            const failedVideos = results.filter((r) => r.status === "failed");
            toast.error(
              `Failed to upload ${summary.failed} video${summary.failed > 1 ? 's' : ''}:\n${failedVideos.map((v) => v.filename).join(", ")}`
            );
          }

          if (summary.successful > 0) {
            onClose();
          }
        },
      }
    );
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
    setTitle("");
    setDescription("");
    setPrivacyStatus("private");
    setMediaType("video");
    popupRef.current = null;
  }, [activeSessionId, deleteSession]);

  // Reset everything when modal closes
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleCleanup();
    }
  }, [isOpen, handleCleanup]);

  const isWaitingForSelection = isPickerOpen && !pickedItems.length;
  const hasPickedItems = pickedItems.length > 0;

  if (!isOpen) return null;

  const selectedCount = pickedItems.filter((item) => selectedForImport.has(item.id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-obsidian border border-ares-red/30 ares-cut-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-white">Import Videos from Google Photos</h2>
            <p className="text-sm text-marble/60 mt-1">
              Select videos from your Google Photos to upload to YouTube
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-marble/60 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Upload in progress */}
          {uploadMutation.isPending && (
            <div className="rounded-lg border border-ares-bronze/20 bg-marble/5 p-12">
              <div className="flex flex-col items-center justify-center gap-4">
                <RefreshCw className="h-12 w-12 animate-spin text-ares-cyan" />
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-marble">Uploading to YouTube...</h2>
                  <p className="mt-2 text-sm text-marble/70">
                    This may take a few minutes depending on video sizes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Waiting for selection state */}
          {isWaitingForSelection && !uploadMutation.isPending && (
            <div className="rounded-lg border border-ares-bronze/20 bg-marble/5 p-12">
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-ares-cyan" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-marble">
                    Waiting for video selection...
                  </h2>
                  <p className="mt-2 text-sm text-marble/70">
                    Select your videos in the Google Photos window that opened.
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
          {itemsLoading && !uploadMutation.isPending && (
            <div className="rounded-lg border border-ares-bronze/20 bg-marble/5 p-12">
              <div className="flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-ares-cyan" />
                <p className="text-marble">Loading selected videos...</p>
              </div>
            </div>
          )}

          {/* Upload form + Video grid */}
          {hasPickedItems && !uploadMutation.isPending && (
            <div className="space-y-6">
              {/* YouTube metadata form */}
              <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-4">
                <h3 className="text-sm font-bold text-ares-gold uppercase tracking-wider">YouTube Upload Settings</h3>

                <div>
                  <label htmlFor="gp-title" className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">
                    Title {pickedItems.length > 1 && "(will be numbered)"}
                  </label>
                  <input
                    id="gp-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm"
                    placeholder="e.g., Match Highlight #1"
                  />
                </div>

                <div>
                  <label htmlFor="gp-description" className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    id="gp-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm resize-none"
                    placeholder="Describe your video..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="gp-media-type" className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">Type</label>
                    <select
                      id="gp-media-type"
                      value={mediaType}
                      onChange={(e) => setMediaType(e.target.value as "video" | "short")}
                      className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm appearance-none"
                    >
                      <option value="video">Standard Video</option>
                      <option value="short">YouTube Short</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="gp-privacy" className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">Privacy Status</label>
                    <select
                      id="gp-privacy"
                      value={privacyStatus}
                      onChange={(e) => setPrivacyStatus(e.target.value as "public" | "unlisted" | "private")}
                      className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm appearance-none"
                    >
                      {canSetPublic && <option value="public">Public</option>}
                      <option value="unlisted">Unlisted (Hidden)</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between rounded-lg border border-ares-bronze/20 bg-marble/5 px-4 py-3">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-sm text-ares-cyan hover:underline"
                  >
                    {selectedCount === pickedItems.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                  <span className="text-sm text-marble/70">
                    {selectedCount} of {pickedItems.length} selected
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
                    onClick={handleUpload}
                    disabled={selectedCount === 0 || !title.trim() || uploadMutation.isPending}
                    className="flex items-center gap-2 rounded-lg bg-ares-red px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-ares-red/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    Upload to YouTube ({selectedCount})
                  </button>
                </div>
              </div>

              {/* Video grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pickedItems.map((item) => {
                  const isSelected = selectedForImport.has(item.id);
                  const filename = item.mediaFile?.filename || "Video";
                  const fileSize = item.mediaFile?.fileSize
                    ? `${(Number(item.mediaFile.fileSize) / (1024 * 1024)).toFixed(1)} MB`
                    : "Unknown size";

                  return (
                    <div
                      key={item.id}
                      className={`
                        group relative cursor-pointer overflow-hidden rounded-lg
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
                      {/* Video thumbnail placeholder */}
                      <div className="aspect-video bg-black/40 flex items-center justify-center">
                        <Video className="h-12 w-12 text-marble/40" />
                      </div>

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
                      <div className="p-3 bg-black/60">
                        <p className="truncate text-sm font-medium text-white">{filename}</p>
                        <p className="text-xs text-marble/60 mt-1">{fileSize}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state — no active session */}
          {!isWaitingForSelection && !hasPickedItems && !itemsLoading && !uploadMutation.isPending && (
            <div className="rounded-lg border border-ares-bronze/20 bg-marble/5 p-12">
              <div className="flex flex-col items-center justify-center gap-6 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ares-red/10">
                  <Video className="h-10 w-10 text-ares-red" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-marble">Select Videos from Google Photos</h2>
                  <p className="mt-2 max-w-md text-sm text-marble/70">
                    Choose videos from your Google Photos library to import into ARES and upload to YouTube.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenPicker}
                  disabled={createSession.isPending}
                  className="flex items-center gap-2 rounded-lg bg-ares-red px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ares-red/90 disabled:opacity-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  {createSession.isPending ? "Opening..." : "Open Google Photos Picker"}
                </button>

                {/* Error from session creation */}
                {createSession.isError && (
                  <div className="mt-6 rounded-lg border border-ares-red/30 bg-ares-red/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 text-ares-red" />
                      <div>
                        <p className="text-sm font-medium text-ares-red">
                          Failed to open video picker
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
