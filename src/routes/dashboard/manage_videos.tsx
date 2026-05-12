import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { useGetVideos, useDeleteVideo, useSyncYoutubeVideosMutation } from '../../api'
import { Pencil, Trash2, Play, Plus, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useModal } from '../../contexts/ModalContext'
import VideoPickerModal from '../../components/VideoPickerModal'
import { ApiError } from '../../api/honoClient'

export const Route = createFileRoute('/dashboard/manage_videos')({
  component: RouteComponent,
})

function RouteComponent() {
  const modal = useModal()
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [editVideoId, setEditVideoId] = useState<string | undefined>(undefined)
  const { data: videosResponse, isLoading } = useGetVideos()
  const deleteMutation = useDeleteVideo({
    onSuccess: () => {
      toast.success("Video deleted successfully")
    },
    onError: () => {
      toast.error("Failed to delete video")
    }
  })

  const syncYoutubeMutation = useSyncYoutubeVideosMutation()
  const queryClient = useQueryClient()

  const handleSyncYoutube = async () => {
    try {
      const result = await syncYoutubeMutation.mutateAsync()
      if (result.added > 0) {
        toast.success(`Synced ${result.added} new videos from YouTube!`)
      } else {
        toast.info("No new videos found on YouTube.")
      }
      queryClient.invalidateQueries({ queryKey: ["videos"] })
    } catch (error) {
      // Extract detailed error message from ApiError
      let errorMessage = "Failed to sync videos from YouTube."
      let errorDescription: string | undefined

      if (error instanceof ApiError) {
        errorMessage = error.message
        // Add helpful context based on error code
        switch (error.code) {
          case "YOUTUBE_QUOTA_EXCEEDED":
            errorDescription = "The daily YouTube API limit has been reached."
            break
          case "YOUTUBE_API_KEY_MISSING":
          case "YOUTUBE_API_KEY_INVALID":
            errorDescription = "Check the YouTube API key configuration."
            break
          case "YOUTUBE_ACCESS_FORBIDDEN":
          case "YOUTUBE_ACCESS_DENIED":
            errorDescription = "The API key may not have access to this playlist."
            break
          case "YOUTUBE_PLAYLIST_NOT_FOUND":
          case "YOUTUBE_NOT_FOUND":
            errorDescription = "The playlist may have been moved or deleted."
            break
        }
      }

      // Display error with optional description
      toast.error(errorMessage, {
        description: errorDescription,
        icon: <AlertCircle className="text-ares-red" />
      })
      console.error("YouTube sync error:", error)
    }
  }

  const videos = (videosResponse as unknown as { videos: Array<{ id: string, title: string, description: string | null, platform: string, videoId: string, thumbnailUrl: string | null, embedUrl: string }> })?.videos ?? []

  const handleDelete = async (id: string, title: string) => {
    const confirmed = await modal.confirm({
      title: "Delete Video",
      description: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      confirmText: "Delete",
      destructive: true,
    })
    if (!confirmed) return
    deleteMutation.mutate(id)
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "youtube": return "text-ares-red"
      case "vimeo": return "text-ares-cyan"
      default: return "text-white/60"
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "youtube": return "▶"
      case "vimeo": return "v"
      default: return "▶"
    }
  }

  return (
    <div className="flex-1 w-full flex flex-col min-h-0">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tighter">Manage Videos</h2>
          <p className="text-marble/60 text-sm mt-1">Link and manage videos from YouTube, Vimeo, and other platforms.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncYoutube}
            disabled={syncYoutubeMutation.isPending}
            className="px-4 py-2 bg-ares-cyan/20 hover:bg-ares-cyan/30 text-ares-cyan font-black uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2 border border-ares-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={syncYoutubeMutation.isPending ? "animate-spin" : ""} />
            {syncYoutubeMutation.isPending ? "Syncing..." : "Sync YouTube"}
          </button>
          
          <button
            onClick={() => setIsPickerOpen(true)}
            className="px-4 py-2 bg-ares-red hover:bg-ares-red/80 text-white font-black uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2"
          >
            <Plus size={16} />
            Add Video
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="w-full h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white/10 border-t-ares-red rounded-full animate-spin"></div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="bg-obsidian border border-white/10 ares-cut-sm overflow-hidden group hover:border-ares-red/30 transition-colors"
            >
              {video.thumbnailUrl ? (
                <div className="w-full h-40 bg-black/20 flex items-center justify-center">
                  <img src={video.thumbnailUrl} alt={video.title} className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <div className="w-full h-40 bg-ares-red/10 flex items-center justify-center">
                  <span className={`text-4xl ${getPlatformColor(video.platform)}`}>{getPlatformIcon(video.platform)}</span>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${getPlatformColor(video.platform)}`}>
                    {video.platform}
                  </span>
                </div>
                <h3 className="text-white font-bold text-lg mb-1">{video.title}</h3>
                {video.description && (
                  <p className="text-white/60 text-sm mb-3 line-clamp-2">{video.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <a
                    href={
                      video.platform === 'youtube' 
                        ? `https://www.youtube.com/watch?v=${video.videoId}` 
                        : video.platform === 'vimeo'
                        ? `https://vimeo.com/${video.videoId}`
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
                    <button
                      onClick={() => {
                        setEditVideoId(video.id)
                        setIsPickerOpen(true)
                      }}
                      className="p-2 text-white/60 hover:text-ares-red transition-colors"
                      title="Edit video"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(video.id, video.title)}
                      className="p-2 text-white/60 hover:text-ares-red transition-colors"
                      title="Delete video"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <VideoPickerModal
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false)
          setEditVideoId(undefined)
        }}
        onVideoSelected={(_videoId, _title, _platform, _id) => {
          setIsPickerOpen(false)
          setEditVideoId(undefined)
          queryClient.invalidateQueries({ queryKey: ["videos"] })
        }}
        editVideoId={editVideoId}
      />
    </div>
  )
}
