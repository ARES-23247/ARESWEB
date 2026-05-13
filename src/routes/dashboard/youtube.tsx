import { createFileRoute } from '@tanstack/react-router';
import { useState, useRef, useMemo } from 'react';
import { useGetYoutubeAuthStatus, useGetYoutubeAuthUrl, useGetYoutubeResumableUrlMutation } from '../../api/youtube';
import { useGetVideos, useSyncYoutubeVideosMutation } from '../../api';
import { Upload, Video, AlertCircle, Settings, Pencil, Play, Plus, ExternalLink, RefreshCw, Filter, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { toastApiError, ApiError, client } from '../../api/honoClient';
import { useQueryClient } from '@tanstack/react-query';
import VideoPickerModal from '../../components/VideoPickerModal';

export const Route = createFileRoute('/dashboard/youtube')({
  component: VideoHub,
});

function VideoHub() {
  const queryClient = useQueryClient();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [editVideoId, setEditVideoId] = useState<string | undefined>(undefined);

  const { data: authStatus, isLoading: isStatusLoading } = useGetYoutubeAuthStatus();
  const { data: videosResponse, isLoading: isVideosLoading } = useGetVideos();

  const [typeFilter, setTypeFilter] = useState<"all" | "video" | "short">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const syncYoutubeMutation = useSyncYoutubeVideosMutation();

  const handleSyncYoutube = async () => {
    try {
      const result = await syncYoutubeMutation.mutateAsync();
      if (result.added > 0) {
        toast.success(`Synced ${result.added} new videos from YouTube!`);
      } else {
        toast.info("No new videos found on YouTube.");
      }
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    } catch (error) {
      toastApiError(error, "Failed to sync videos from YouTube.");
    }
  };

  const videos = useMemo(() => {
    return (videosResponse as unknown as { videos: Array<{ id: string; title: string; description: string | null; platform: string; videoId: string; thumbnailUrl: string | null; embedUrl: string; type: string; createdAt: string }> })?.videos ?? [];
  }, [videosResponse]);

  const filteredAndSortedVideos = useMemo(() => {
    let result = [...videos];

    if (typeFilter !== "all") {
      result = result.filter(v => v.type === typeFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [videos, typeFilter, sortOrder]);

  return (
    <div className="flex-1 w-full flex flex-col min-h-0">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tighter">Video Hub</h2>
          <p className="text-marble/60 text-sm mt-1">Upload, sync, and manage all team videos in one place.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncYoutube}
            disabled={syncYoutubeMutation.isPending}
            className="px-4 py-2 bg-ares-cyan/20 hover:bg-ares-cyan/30 text-ares-cyan font-black uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2 border border-ares-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
          >
            <RefreshCw size={14} className={syncYoutubeMutation.isPending ? "animate-spin" : ""} />
            {syncYoutubeMutation.isPending ? "Syncing..." : "Sync YouTube"}
          </button>
          <button
            onClick={() => setIsPickerOpen(true)}
            className="px-4 py-2 bg-ares-red hover:bg-ares-red/80 text-white font-black uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2 text-xs"
          >
            <Plus size={14} />
            Add Video
          </button>
        </div>
      </div>

      {/* Main Layout: Uploader (left) + Video Library (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left Panel: YouTube Direct Upload */}
        <div className="lg:col-span-1">
          {isStatusLoading ? (
            <div className="bg-obsidian border border-white/10 ares-cut-sm p-5 h-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-white/10 border-t-ares-red rounded-full animate-spin" />
            </div>
          ) : !authStatus?.isAuthenticated ? (
            <YouTubeConnectPanel />
          ) : (
            <YouTubeUploader memberType={authStatus.memberType} />
          )}
        </div>

        {/* Right Panel: Video Library */}
        <div className="lg:col-span-2 overflow-y-auto pr-2 pb-6">
          {isVideosLoading ? (
            <div className="w-full h-64 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-white/10 border-t-ares-red rounded-full animate-spin" />
            </div>
          ) : videos.length === 0 ? (
            <div className="w-full h-64 flex flex-col items-center justify-center text-white/20 gap-4 border border-white/10 ares-cut-sm">
              <Play size={48} className="opacity-50" />
              <p className="font-mono text-sm">No videos yet.</p>
              <button
                onClick={() => setIsPickerOpen(true)}
                className="px-4 py-2 bg-ares-red/20 hover:bg-ares-red/30 text-ares-danger-soft ares-cut-sm text-sm font-bold transition-all border border-ares-red/30"
              >
                Add your first video
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-obsidian border border-white/10 ares-cut-sm p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter size={16} className="text-white/40" />
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as "all" | "video" | "short")}
                      className="bg-black border border-white/10 text-white text-xs px-2 py-1.5 uppercase font-bold tracking-wider outline-none focus:border-ares-red transition-colors cursor-pointer appearance-none"
                    >
                      <option value="all">All Media</option>
                      <option value="video">Videos</option>
                      <option value="short">Shorts</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowUpDown size={16} className="text-white/40" />
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                      className="bg-black border border-white/10 text-white text-xs px-2 py-1.5 uppercase font-bold tracking-wider outline-none focus:border-ares-red transition-colors cursor-pointer appearance-none"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                    </select>
                  </div>
                </div>
                <div className="text-xs text-marble/60 font-mono">
                  {filteredAndSortedVideos.length} Result{filteredAndSortedVideos.length !== 1 ? 's' : ''}
                </div>
              </div>

              {filteredAndSortedVideos.length === 0 ? (
                <div className="w-full h-40 flex flex-col items-center justify-center text-white/20 gap-2 border border-white/10 ares-cut-sm">
                  <Video size={32} className="opacity-50" />
                  <p className="font-mono text-sm">No matches found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAndSortedVideos.map((video) => (
                    <div
                      key={video.id}
                      className="bg-obsidian border border-white/10 ares-cut-sm overflow-hidden group hover:border-ares-red/30 transition-colors"
                    >
                      {video.platform === 'youtube' ? (
                        <div className="w-full h-40 bg-black/20 relative">
                          <iframe
                            src={`https://www.youtube.com/embed/${video.videoId}`}
                            title={video.title}
                            className="absolute inset-0 w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            loading="lazy"
                          ></iframe>
                        </div>
                      ) : video.thumbnailUrl ? (
                        <div className="w-full h-40 bg-black/20 flex items-center justify-center">
                          <img src={video.thumbnailUrl} alt={video.title} className="max-w-full max-h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-full h-40 bg-ares-red/10 flex items-center justify-center">
                          <span className={`text-4xl ${video.platform === "youtube" ? "text-ares-red" : "text-white/60"}`}>▶</span>
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] uppercase font-bold tracking-wider ${video.platform === "youtube" ? "text-ares-red" : "text-white/60"}`}>
                            {video.platform}
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-ares-cyan/80 bg-ares-cyan/10 px-1.5 py-0.5 rounded-sm">
                            {video.type}
                          </span>
                        </div>
                        <h3 className="text-white font-bold text-lg mb-1">{video.title}</h3>
                        {video.description && (
                          <p className="text-white/60 text-sm mb-3 line-clamp-2">{video.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/10">
                          <a
                            href={
                              video.platform === 'youtube'
                                ? `https://www.youtube.com/watch?v=${video.videoId}`
                                : video.embedUrl.startsWith('http') ? video.embedUrl : `https://${video.embedUrl}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-ares-cyan hover:text-white transition-colors flex items-center gap-1"
                          >
                            <ExternalLink size={12} />
                            Watch video
                          </a>
                          <div className="flex items-center gap-2 ml-auto">
                            {video.platform === 'youtube' && (
                              <a
                                href={`https://studio.youtube.com/video/${video.videoId}/edit`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-white/60 hover:text-[#FF0000] transition-colors"
                                title="Open in YouTube Studio"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
                              </a>
                            )}
                            <button
                              onClick={() => {
                                setEditVideoId(video.id);
                                setIsPickerOpen(true);
                              }}
                              className="p-2 text-white/60 hover:text-ares-red transition-colors"
                              title="Edit metadata in ARESWEB"
                            >
                              <Pencil size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <VideoPickerModal
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false);
          setEditVideoId(undefined);
        }}
        onVideoSelected={(_videoId, _title, _platform, _id) => {
          setIsPickerOpen(false);
          setEditVideoId(undefined);
          queryClient.invalidateQueries({ queryKey: ["videos"] });
        }}
        editVideoId={editVideoId}
      />
    </div>
  );
}

// ─── YouTube Connect Panel ─────────────────────────────────────────────────────

function YouTubeConnectPanel() {
  const { data: authUrl, isLoading: isUrlLoading, error: authError } = useGetYoutubeAuthUrl();

  return (
    <div className="bg-obsidian border border-white/10 ares-cut-sm p-5 h-full flex flex-col items-center justify-center text-center gap-4">
      <div className="w-14 h-14 bg-ares-red/20 rounded-full flex items-center justify-center">
        <Video className="text-ares-red" size={24} />
      </div>
      <div>
        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Connect YouTube</h3>
        <p className="text-marble/60 text-xs max-w-[240px]">
          Authorize the dashboard with your YouTube account to upload videos directly.
        </p>
      </div>

      {authError ? (
        <div className="p-3 bg-ares-red/10 border border-ares-red/30 flex items-start gap-2 text-left w-full">
          <AlertCircle className="text-ares-red shrink-0 mt-0.5" size={14} />
          <p className="text-ares-red text-xs">
            {authError instanceof ApiError ? authError.message : (authError instanceof Error ? authError.message : "Failed to fetch authorization URL.")}
          </p>
        </div>
      ) : null}

      <button
        onClick={() => {
          if (authUrl?.url) {
            window.location.href = authUrl.url;
          } else {
            toastApiError("Authorization URL not available.");
          }
        }}
        disabled={isUrlLoading}
        className="px-5 py-2.5 bg-ares-red text-white font-bold uppercase tracking-widest ares-cut-sm hover:bg-ares-bronze transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
      >
        {isUrlLoading ? (
          <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : (
          <Settings size={14} />
        )}
        {isUrlLoading ? "Loading..." : "Authorize via Google"}
      </button>
    </div>
  );
}

// ─── YouTube Direct Uploader ───────────────────────────────────────────────────

function YouTubeUploader({ memberType }: { memberType?: "student" | "mentor" | "coach" }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<"public" | "unlisted" | "private">('private');
  const [mediaType, setMediaType] = useState<"video" | "short">("video");

  const [createBlogPost, setCreateBlogPost] = useState(false);
  const [crossPostSocial, setCrossPostSocial] = useState(false);

  const canSetPublic = memberType === "coach" || memberType === "mentor";

  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const resumableMutation = useGetYoutubeResumableUrlMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }

      const videoElement = document.createElement('video');
      videoElement.preload = 'metadata';
      videoElement.onloadedmetadata = () => {
        window.URL.revokeObjectURL(videoElement.src);
        if (videoElement.duration <= 60) {
          setMediaType("short");
        } else {
          setMediaType("video");
        }
      };
      videoElement.src = URL.createObjectURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!title.trim()) {
      toastApiError('Title is required');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setUploadError('');

    let finalDescription = description.trim();
    if (mediaType === "short" && !finalDescription.toLowerCase().includes("#shorts")) {
      finalDescription = finalDescription ? `${finalDescription}\n\n#Shorts` : "#Shorts";
    }

    try {
      const { uploadUrl } = await resumableMutation.mutateAsync({
        title: title.trim(),
        description: finalDescription,
        privacyStatus,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      });

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
        credentials: 'omit',
        mode: 'cors',
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        let detail = uploadResponse.statusText;
        try {
          const res = JSON.parse(errorText);
          if (res.error?.message) detail = res.error.message;
        } catch {
          if (errorText) detail = errorText.substring(0, 100);
        }
        throw new Error(`Google API Error ${uploadResponse.status}: ${detail}`);
      }

      const uploadedVideo = await uploadResponse.json();
      const videoId = uploadedVideo.id;
      const thumbnailKey = uploadedVideo.snippet?.thumbnails?.high?.url || null;

      try {
        await client.api.videos.$post({
          json: {
            title: title.trim(),
            description: finalDescription,
            platform: "youtube",
            videoId,
            thumbnailKey,
            type: mediaType,
            createBlogPost,
            crossPostSocial
          }
        });
      } catch (err) {
        console.error("Failed to sync video to dashboard:", err);
        // We don't fail the whole operation if the sync fails, but we might want to let the user know.
        toastApiError(err, 'Video uploaded, but failed to sync to dashboard');
      }

      toast.success('Video uploaded successfully!');

      setFile(null);
      setTitle('');
      setDescription('');
      setPrivacyStatus('private');
      setMediaType("video");
      setCreateBlogPost(false);
      setCrossPostSocial(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err: unknown) {
      console.error(err);
      let message = 'Upload failed';
      let diagnostic = '';

      if (err instanceof ApiError) {
        message = err.message;
        diagnostic = `API_${err.code}`;
      } else if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        message = 'Network Error (Failed to fetch). This is commonly caused by an adblocker blocking the Google API, or a CORS misconfiguration. Please disable your adblocker and try again.';
        diagnostic = 'NETWORK_FETCH_FAILED';
      } else if (err instanceof Error) {
        message = err.message;
      }

      setUploadError(diagnostic ? `${diagnostic}: ${message}` : message);
      toastApiError(err, 'Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-obsidian border border-white/10 ares-cut-sm p-5 h-full flex flex-col">
      <h3 className="text-ares-red font-black uppercase tracking-widest text-sm mb-4">Direct Upload</h3>

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-1 pb-1">
        <div>
          <span className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">Video File</span>
          <label
            htmlFor="youtube-file-input"
            className="border-2 border-dashed border-white/20 p-4 flex flex-col items-center justify-center bg-black/30 hover:bg-black/50 transition-colors cursor-pointer text-center"
          >
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <Video className="text-ares-cyan" size={24} />
                <span className="text-sm font-bold text-white truncate max-w-[200px]">{file.name}</span>
                <span className="text-xs text-white/50">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="text-marble/40" size={24} />
                <span className="text-sm font-bold text-white/70">Click to select video</span>
                <span className="text-xs text-white/40">Any size (bypasses Cloudflare limits)</span>
              </div>
            )}
            <input
              id="youtube-file-input"
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="video/*"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
        </div>

        <div>
          <label htmlFor="youtube-title" className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">Title *</label>
          <input
            id="youtube-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isUploading}
            className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm"
          />
        </div>

        <div>
          <label htmlFor="youtube-description" className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">Description</label>
          <textarea
            id="youtube-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isUploading}
            rows={4}
            className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="youtube-media-type" className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">Type</label>
            <select
              id="youtube-media-type"
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as "video" | "short")}
              disabled={isUploading}
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm appearance-none"
            >
              <option value="video">Standard Video</option>
              <option value="short">YouTube Short</option>
            </select>
          </div>
          <div>
            <label htmlFor="youtube-privacy" className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">Privacy Status</label>
            <select
              id="youtube-privacy"
              value={privacyStatus}
              onChange={(e) => setPrivacyStatus(e.target.value as "public" | "unlisted" | "private")}
              disabled={isUploading}
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm appearance-none"
            >
              {canSetPublic && <option value="public">Public</option>}
              <option value="unlisted">Unlisted (Hidden)</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-2 border border-white/10 p-3 bg-black/20">
          <span className="block text-xs font-bold text-ares-red uppercase tracking-wider mb-1">Automation (Optional)</span>
          
          <label className="flex items-start gap-3 cursor-pointer group" aria-label="Generate Blog Post">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                checked={createBlogPost}
                onChange={(e) => setCreateBlogPost(e.target.checked)}
                disabled={isUploading}
                className="peer sr-only"
              />
              <div className="w-4 h-4 border border-white/20 bg-black peer-checked:bg-ares-red peer-checked:border-ares-red transition-colors"></div>
              <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 14 14" fill="none">
                <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"></path>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white group-hover:text-ares-red transition-colors">Generate Blog Post</span>
              <span className="text-xs text-marble/60">Automatically create and publish a blog post embedding this video.</span>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group" aria-label="Cross-Post to Social Media">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                checked={crossPostSocial}
                onChange={(e) => setCrossPostSocial(e.target.checked)}
                disabled={isUploading}
                className="peer sr-only"
              />
              <div className="w-4 h-4 border border-white/20 bg-black peer-checked:bg-ares-red peer-checked:border-ares-red transition-colors"></div>
              <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 14 14" fill="none">
                <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"></path>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white group-hover:text-ares-red transition-colors">Cross-Post to Social Media</span>
              <span className="text-xs text-marble/60">Automatically queue a post to Bluesky and Facebook for this video.</span>
            </div>
          </label>
        </div>

        {uploadError && (
          <div className="p-3 bg-ares-red/10 border border-ares-red/30 flex items-start gap-2 text-xs text-ares-red">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="font-bold uppercase tracking-tighter">Upload Failure</p>
              <p className="font-mono leading-relaxed opacity-90 break-words">{uploadError}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 shrink-0">
        {isUploading ? (
          <div className="w-full flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-white uppercase">
              <span>Uploading to YouTube...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-ares-cyan transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={handleUpload}
            disabled={!file || !title.trim()}
            className="w-full py-3 bg-ares-cyan hover:bg-ares-cyan/90 text-black font-black uppercase tracking-widest ares-cut-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Upload size={18} /> Upload Video
          </button>
        )}
      </div>
    </div>
  );
}
