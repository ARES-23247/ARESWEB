import { createFileRoute } from '@tanstack/react-router';
import { useState, useRef } from 'react';
import { useGetYoutubeAuthStatus, useGetYoutubeAuthUrl, useGetYoutubeVideos, useGetYoutubeResumableUrlMutation, useUpdateYoutubeVideoMutation } from '../../api/youtube';
import { Upload, Video, AlertCircle, Settings, X, Pencil, Play } from 'lucide-react';
import { toast } from 'sonner';
// import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from "@radix-ui/react-dialog";
import { formatDistanceToNow } from 'date-fns';
import { ApiError } from '../../api/honoClient';

export const Route = createFileRoute('/dashboard/youtube')({
  component: YoutubeDashboard,
});

function YoutubeDashboard() {
  const { data: authStatus, isLoading: isStatusLoading } = useGetYoutubeAuthStatus();
  const { data: authUrl, isLoading: isUrlLoading, error: authError } = useGetYoutubeAuthUrl();

  if (isStatusLoading) {
    return (
      <div className="flex-1 w-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-ares-red rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!authStatus?.isAuthenticated) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-ares-red/20 rounded-full flex items-center justify-center mb-6">
          <Video className="text-ares-red" size={32} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Connect YouTube Channel</h2>
        <p className="text-marble/80 max-w-md mb-8">
          To upload videos directly to YouTube from ARESWEB and bypass Cloudflare limits, you must authorize the dashboard with the team&apos;s YouTube account.
        </p>
        
        {authError ? (
          <div className="mb-6 p-4 bg-ares-red/10 border border-ares-red/30 rounded flex items-start gap-3 text-left max-w-md">
            <AlertCircle className="text-ares-red shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-ares-red font-bold text-sm">Authorization Error</p>
              <p className="text-marble/70 text-xs mt-1">
                {authError instanceof ApiError ? authError.message : (authError instanceof Error ? authError.message : "Failed to fetch authorization URL. Check if YouTube API keys are configured.")}
              </p>
            </div>
          </div>
        ) : null}

        <button
          onClick={() => {
            if (authUrl?.url) {
              window.location.href = authUrl.url;
            } else {
              toast.error("Authorization URL not available. Please check YouTube API configuration.");
            }
          }}
          disabled={isUrlLoading}
          className={`px-6 py-3 bg-ares-red text-white font-bold uppercase tracking-widest ares-cut hover:bg-ares-bronze transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isUrlLoading ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          ) : (
            <Settings size={18} />
          )}
          {isUrlLoading ? "Loading..." : "Authorize via Google"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col min-h-0">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tighter">YouTube Dashboard</h2>
          <p className="text-marble/60 text-sm mt-1">Upload and manage direct-to-YouTube videos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-1">
          <YouTubeUploader />
        </div>
        <div className="lg:col-span-2 overflow-y-auto pr-2 pb-6">
          <YouTubeVideoList />
        </div>
      </div>
    </div>
  );
}

function YouTubeUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<"public" | "unlisted" | "private">('unlisted');
  
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const resumableMutation = useGetYoutubeResumableUrlMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      if (!title) {
        // Strip extension for default title
        setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setUploadError('');

    try {
      // 1. Get the resumable upload URL from our backend
      const { uploadUrl } = await resumableMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        privacyStatus,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      });

      // 2. Perform the direct upload via XMLHttpRequest for progress events
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentage = Math.round((e.loaded * 100) / e.total);
            setProgress(percentage);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error during upload'));
        };

        xhr.send(file);
      });

      toast.success('Video uploaded successfully!');
      
      // Reset form
      setFile(null);
      setTitle('');
      setDescription('');
      setPrivacyStatus('unlisted');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (err: unknown) {
      console.error(err);
      setUploadError((err as Error).message || 'Upload failed');
      toast.error('Failed to upload video');
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

        <div>
          <label htmlFor="youtube-privacy" className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">Privacy Status</label>
          <select
            id="youtube-privacy"
            value={privacyStatus}
            onChange={(e) => setPrivacyStatus(e.target.value as "public" | "unlisted" | "private")}
            disabled={isUploading}
            className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm appearance-none"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted (Hidden)</option>
            <option value="private">Private</option>
          </select>
        </div>

        {uploadError && (
          <div className="p-3 bg-ares-red/10 border border-ares-red/30 flex items-start gap-2 text-sm text-ares-red">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="break-words break-all">{uploadError}</p>
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

function YouTubeVideoList() {
  const { data: response, isLoading } = useGetYoutubeVideos();
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-ares-red rounded-full animate-spin"></div>
      </div>
    );
  }

  const videos = response?.videos || [];

  if (videos.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-white/20 gap-4 border border-white/10 ares-cut-sm">
        <Video size={48} className="opacity-50" />
        <p className="font-mono text-sm">No videos found on the channel.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {videos.map((video) => (
          <div key={video.id} className="bg-obsidian border border-white/10 ares-cut-sm flex flex-col group hover:border-ares-red/30 transition-colors">
            <div className="relative pt-[56.25%] bg-black w-full overflow-hidden">
              {video.thumbnailUrl ? (
                <img src={video.thumbnailUrl} alt={video.title} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="text-white/20" size={32} />
                </div>
              )}
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-sm text-[10px] font-black uppercase tracking-widest text-white ares-cut-sm">
                {video.privacyStatus}
              </div>
            </div>
            
            <div className="p-4 flex-1 flex flex-col min-h-0">
              <h4 className="text-white font-bold text-sm line-clamp-2 mb-1" title={video.title}>{video.title}</h4>
              <p className="text-xs text-marble/50 mb-3">{formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}</p>
              
              <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
                <a 
                  href={`https://youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-ares-cyan hover:text-white flex items-center gap-1 font-bold uppercase tracking-wider"
                >
                  <Play size={12} /> Watch
                </a>
                
                <button
                  onClick={() => setEditingVideoId(video.id)}
                  className="p-1.5 text-white/50 hover:text-ares-red hover:bg-ares-red/10 transition-colors ares-cut-sm"
                  title="Edit metadata"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingVideoId && (
        <EditVideoModal 
          video={videos.find(v => v.id === editingVideoId)!} 
          onClose={() => setEditingVideoId(null)} 
        />
      )}
    </>
  );
}

function EditVideoModal({ video, onClose }: { video: { id: string; title: string; description?: string; privacyStatus: "public" | "unlisted" | "private" }, onClose: () => void }) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description || '');
  const [privacyStatus, setPrivacyStatus] = useState<"public" | "unlisted" | "private">(video.privacyStatus);
  
  const updateMutation = useUpdateYoutubeVideoMutation();

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: video.id,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        privacyStatus
      });
      toast.success('Metadata updated successfully');
      onClose();
    } catch (err: unknown) {
      toast.error('Failed to update metadata', { description: (err as Error).message });
    }
  };

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998]" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[9998] translate-x-[-50%] translate-y-[-50%] bg-obsidian border border-white/10 shadow-2xl ares-cut-lg w-[calc(100%-2rem)] max-w-md flex flex-col focus:outline-none">
          <div className="flex items-center justify-between p-5 border-b border-white/10 bg-black/40">
            <Dialog.Title className="text-lg font-black text-white tracking-widest uppercase m-0">
              Edit YouTube Video
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="edit-title" className="block text-xs font-bold text-ares-red uppercase tracking-wider mb-2">Title</label>
              <input
                id="edit-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="edit-description" className="block text-xs font-bold text-ares-red uppercase tracking-wider mb-2">Description</label>
              <textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm resize-none"
              />
            </div>

            <div>
              <label htmlFor="edit-privacy" className="block text-xs font-bold text-ares-red uppercase tracking-wider mb-2">Privacy Status</label>
              <select
                id="edit-privacy"
                value={privacyStatus}
                onChange={(e) => setPrivacyStatus(e.target.value as "public" | "unlisted" | "private")}
                className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm appearance-none"
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted (Hidden)</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          <div className="p-5 border-t border-white/10 flex items-center justify-end gap-3 bg-black/20">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/50 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-6 py-2 bg-ares-red hover:bg-ares-red/90 text-white font-black uppercase tracking-widest ares-cut-sm transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
