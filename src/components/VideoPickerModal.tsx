import { useState } from "react";
import { X, Play, Plus, ImagePlus } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useGetVideos, useParseVideoUrlMutation, useUpdateVideo } from "../api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrapResponse } from "../api/honoClient";
import AssetPickerModal from "./AssetPickerModal";
import { toast } from "sonner";
import { toastApiError } from "../api/honoClient";


interface Video {
  id: string;
  title: string;
  description: string | null;
  platform: "youtube" | "other";
  videoId: string;
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  embedUrl: string;
  createdAt: string;
  updatedAt: string;
}

export default function VideoPickerModal({
  isOpen,
  onClose,
  onVideoSelected,
  editVideoId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onVideoSelected: (actualVideoId: string, title: string, platform: "youtube" | "other", mediaId: string) => void;
  editVideoId?: string;
}) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [platform, setPlatform] = useState<"youtube" | "other">("youtube");
  const [parsedVideoId, setParsedVideoId] = useState("");
  const [thumbnailKey, setThumbnailKey] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [newPrivacyStatus, setNewPrivacyStatus] = useState<"public" | "unlisted" | "private" | "">("");
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [urlError, setUrlError] = useState("");

  const [prevEditVideoId, setPrevEditVideoId] = useState<string | undefined>(undefined);
  const [prevVideoToEditId, setPrevVideoToEditId] = useState<string | undefined>(undefined);

  const { data: videosResponse, isLoading, refetch } = useGetVideos({
    enabled: isOpen,
  });

  const parseUrlMutation = useParseVideoUrlMutation();

  const videos = (videosResponse as unknown as { videos: Video[] })?.videos ?? [];

  // Find the video to edit
  const videoToEdit = videos.find((v) => v.id === editVideoId);

  function resetForm() {
    setNewTitle("");
    setNewDescription("");
    setVideoUrl("");
    setPlatform("youtube");
    setParsedVideoId("");
    setThumbnailKey(null);
    setThumbnailUrl(null);
    setNewPrivacyStatus("");
    setUrlError("");
  }

  // Pre-fill form when editing
  if (editVideoId !== prevEditVideoId || videoToEdit?.id !== prevVideoToEditId) {
    setPrevEditVideoId(editVideoId);
    setPrevVideoToEditId(videoToEdit?.id);
    if (editVideoId && videoToEdit) {
      setIsCreating(true);
      setNewTitle(videoToEdit.title);
      setNewDescription(videoToEdit.description || "");
      setPlatform(videoToEdit.platform);
      setParsedVideoId(videoToEdit.videoId);
      setThumbnailKey(videoToEdit.thumbnailKey);
      setThumbnailUrl(videoToEdit.thumbnailUrl);
      setVideoUrl("");
      setUrlError("");
    } else if (!editVideoId) {
      // Reset form when switching to create mode
      resetForm();
      setIsCreating(false);
    }
  }

  const handleParseUrl = async () => {
    if (!videoUrl.trim()) {
      setUrlError("Please enter a video URL");
      return;
    }
    const parseResult = await parseUrlMutation.mutateAsync({ url: videoUrl.trim() });
    if (parseResult) {
      setPlatform(parseResult.platform);
      setParsedVideoId(parseResult.videoId);
    }
  };



  const createMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      description?: string;
      platform: "youtube" | "other";
      videoId: string;
      thumbnailKey?: string;
    }) => {
      const res = await client.videos.admin.$post({
        json: payload,
      });
      return unwrapResponse<{ video: Video }>(res);
    },
    onSuccess: (data) => {
      refetch();
      setIsCreating(false);
      resetForm();
      onVideoSelected(data.video.videoId, data.video.title, data.video.platform, data.video.id);
      toast.success("Video added successfully");
    },
    onError: (error) => {
      toastApiError(error, "Failed to create video");
    }
  });

  const updateMutation = useUpdateVideo({
    onSuccess: () => {
      refetch();
      setIsCreating(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success("Video updated successfully");
      onClose();
    },
    onError: (error) => {
      toastApiError(error, "Failed to update video");
    }
  });

  const handleCreate = async () => {
    let finalVideoId = parsedVideoId;
    let finalPlatform = platform;

    if (!parsedVideoId.trim() && videoUrl.trim()) {
      try {
        const parseResult = await parseUrlMutation.mutateAsync({ url: videoUrl.trim() });
        if (parseResult) {
          setPlatform(parseResult.platform);
          setParsedVideoId(parseResult.videoId);
          finalVideoId = parseResult.videoId;
          finalPlatform = parseResult.platform;
        } else {
          setUrlError("Invalid video URL");
          return;
        }
      } catch (_err) {
        setUrlError("Invalid video URL");
        return;
      }
    }

    if (!newTitle.trim() || !finalVideoId.trim()) return;

    const payload = {
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      platform: finalPlatform,
      videoId: finalVideoId,
      thumbnailKey: thumbnailKey || undefined,
    };

    if (editVideoId) {
      updateMutation.mutate({ id: editVideoId, ...payload });
      
      // If editing a YouTube video and a new privacy status was selected, update it on YouTube
      if (finalPlatform === "youtube" && newPrivacyStatus) {
        client.youtube[":id"].$put({
          param: { id: finalVideoId },
          json: { privacyStatus: newPrivacyStatus as "public" | "unlisted" | "private" }
        }).catch(err => {
          console.error("Failed to update YouTube privacy status:", err);
          toastApiError(err, "Failed to update visibility on YouTube");
        });
      }
    } else {
      createMutation.mutate(payload);
    }
  };

  const getPlatformIcon = (p: "youtube" | "vimeo" | "other") => {
    switch (p) {
      case "youtube":
        return "▶";
      default:
        return "▶";
    }
  };

  const getPlatformColor = (p: "youtube" | "vimeo" | "other") => {
    switch (p) {
      case "youtube":
        return "text-ares-red";
      default:
      return "text-white/60";
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset form when closing
      setIsCreating(false);
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-[9998] translate-x-[-50%] translate-y-[-50%] bg-obsidian border border-white/10 shadow-2xl ares-cut-lg w-[calc(100%-2rem)] max-w-3xl max-h-[80vh] flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ares-red/20 flex items-center justify-center ares-cut-sm border border-ares-red/30">
                <Play className="text-ares-danger-soft" size={20} aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-black text-white tracking-widest uppercase m-0">
                  {isCreating ? (editVideoId ? "Edit Video" : "Add Video") : "Select Video"}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-white/60 font-mono m-0">
                  {isCreating
                    ? editVideoId
                      ? "Update video details"
                      : "Link a video from YouTube, Vimeo, or other platform"
                    : "Choose a video to embed"}
                </Dialog.Description>
              </div>
            </div>
            {isCreating && (
              <button
                onClick={() => {
                  setIsCreating(false);
                  resetForm();
                }}
                className="text-xs text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}
            <Dialog.Close asChild>
              <button
                aria-label="Close modal"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-obsidian">
            {isCreating ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="videoUrl" className="block text-xs font-bold text-ares-red uppercase tracking-wider mb-2">
                    Video URL *
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="videoUrl"
                      type="url"
                      value={videoUrl}
                      onChange={(e) => {
                        setVideoUrl(e.target.value);
                        setUrlError("");
                      }}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className={`flex-1 bg-black border ${urlError ? 'border-ares-red' : 'border-white/10'} ares-cut-sm px-4 py-3 text-white placeholder-white/30 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all`}
                    />
                    <button
                      onClick={handleParseUrl}
                      className="px-4 py-3 bg-ares-red/20 hover:bg-ares-red/30 text-ares-danger-soft ares-cut-sm text-sm font-bold transition-all border border-ares-red/30 whitespace-nowrap"
                    >
                      Parse
                    </button>
                  </div>
                  {urlError && <p className="text-ares-red text-xs mt-1">{urlError}</p>}
                  {parsedVideoId && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-ares-cyan">
                      <span className="bg-ares-cyan/20 px-2 py-1 rounded">{platform}</span>
                      <span className="font-mono">{parsedVideoId}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="newTitle" className="block text-xs font-bold text-ares-red uppercase tracking-wider mb-2">
                    Video Title *
                  </label>
                  <input
                    id="newTitle"
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Robot Reveal 2025"
                    className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/30 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="newDescription" className="block text-xs font-bold text-ares-red uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    id="newDescription"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description of this video..."
                    rows={2}
                    className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/30 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all resize-none"
                  />
                </div>
                {editVideoId && platform === "youtube" && (
                  <div>
                    <label htmlFor="newPrivacyStatus" className="block text-xs font-bold text-ares-red uppercase tracking-wider mb-2">
                      Update YouTube Visibility (Optional)
                    </label>
                    <select
                      id="newPrivacyStatus"
                      value={newPrivacyStatus}
                      onChange={(e) => setNewPrivacyStatus(e.target.value as any)}
                      className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all appearance-none text-sm"
                    >
                      <option value="">-- Keep Current Visibility --</option>
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                    <p className="text-[10px] text-white/40 mt-1">Updates the actual video visibility on YouTube. Leave blank to keep current.</p>
                  </div>
                )}
                <div>
                  <div className="block text-xs font-bold text-ares-red uppercase tracking-wider mb-2">
                    Custom Thumbnail
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setIsAssetPickerOpen(true)}
                      className="flex-1 px-4 py-3 bg-black border border-dashed border-white/20 ares-cut-sm text-center cursor-pointer hover:border-ares-red/50 transition-colors group"
                    >
                      {thumbnailUrl ? (
                        <div className="flex items-center justify-center gap-2">
                          <img src={thumbnailUrl} alt="Thumbnail preview" className="h-8 w-auto object-cover rounded shadow-sm" />
                          <span className="text-ares-danger-soft text-sm truncate">{thumbnailKey}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-white/40 group-hover:text-ares-danger-soft transition-colors">
                          <ImagePlus size={16} />
                          <span className="text-sm">Select from R2 Vault...</span>
                        </div>
                      )}
                    </button>
                    {thumbnailUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setThumbnailKey(null);
                          setThumbnailUrl(null);
                        }}
                        className="p-3 bg-black border border-white/10 ares-cut-sm text-white/40 hover:text-ares-red hover:border-ares-red/50 transition-colors"
                        title="Remove thumbnail"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || (!parsedVideoId && !videoUrl.trim()) || createMutation.isPending || updateMutation.isPending || parseUrlMutation.isPending}
                  className="px-6 py-3 bg-ares-red hover:bg-ares-red/90 text-black font-black ares-cut-sm uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full mt-4"
                >
                  {(createMutation.isPending || updateMutation.isPending)
                    ? editVideoId
                      ? "Updating Video..."
                      : "Adding Video..."
                    : editVideoId
                      ? "Update Video"
                      : "Add Video"}
                </button>
              </div>
            ) : isLoading ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-white/10 border-t-ares-red rounded-full animate-spin"></div>
                <p className="text-xs font-bold uppercase tracking-widest text-ares-danger-soft animate-pulse">Loading videos...</p>
              </div>
            ) : videos.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-4">
                <Play size={48} className="opacity-50" aria-hidden="true" />
                <p className="font-mono text-sm">No videos available.</p>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-4 py-2 bg-ares-red/20 hover:bg-ares-red/30 text-ares-danger-soft ares-cut-sm text-sm font-bold transition-all border border-ares-red/30"
                >
                  Add your first video
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {videos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => onVideoSelected(video.videoId, video.title, video.platform, video.id)}
                    className="relative bg-black/50 border border-white/10 ares-cut-sm overflow-hidden group cursor-pointer hover:border-ares-red/50 transition-colors text-left"
                  >
                    <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity">
                      <Plus className="text-ares-danger-soft w-8 h-8" />
                    </div>
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt={video.title} className="w-full h-32 object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-32 bg-ares-red/10 flex items-center justify-center">
                        <span className={`text-4xl ${getPlatformColor(video.platform)}`}>{getPlatformIcon(video.platform)}</span>
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${getPlatformColor(video.platform)}`}>
                          {video.platform}
                        </span>
                      </div>
                      <p className="text-white font-bold text-sm truncate">{video.title}</p>
                      {video.description && (
                        <p className="text-white/60 text-xs mt-1 line-clamp-2">{video.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!isCreating && (
            <div className="p-4 border-t border-white/10 bg-black/40 flex justify-center">
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-ares-red/20 hover:bg-ares-red/30 text-ares-danger-soft ares-cut-sm text-sm font-bold transition-all border border-ares-red/30 flex items-center gap-2"
              >
                <Plus size={16} />
                Add New Video
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>

      {/* R2 Asset Picker for Thumbnails */}
      {isAssetPickerOpen && (
        <AssetPickerModal
          isOpen={isAssetPickerOpen}
          onClose={() => setIsAssetPickerOpen(false)}
          onSelect={(url, altText, key) => {
            setThumbnailUrl(url);
            // If the key is not explicitly provided, attempt to extract it from the URL
            const finalKey = key || (url.includes("/api/media/") ? url.split("/api/media/")[1] : url);
            setThumbnailKey(finalKey);
            setIsAssetPickerOpen(false);
          }}
        />
      )}
    </Dialog.Root>
  );
}
