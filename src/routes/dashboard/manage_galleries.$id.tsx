import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useGetGallery, useGetGalleryMedia } from '../../api'
import { ArrowLeft, Images, Upload, Maximize2 } from 'lucide-react'
import { toast } from 'sonner'
import { uploadFile } from '../../utils/apiClient'
import { useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/dashboard/manage_galleries/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  
  const { data: galleryResponse, isLoading: isLoadingGallery } = useGetGallery(id)
  const { data: mediaResponse, isLoading: isLoadingMedia } = useGetGalleryMedia(id)
  
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  
  const gallery = galleryResponse?.gallery
  const media = mediaResponse?.media || []

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadProgress({ current: 0, total: files.length })

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("folder", id) // Use the gallery ID as the folder

        await uploadFile("/api/media/admin/upload", formData)
        successCount++
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err)
        errorCount++
      }
      setUploadProgress({ current: i + 1, total: files.length })
    }

    setIsUploading(false)
    setUploadProgress(null)
    
    // Refresh the media list
    queryClient.invalidateQueries({ queryKey: ["galleries", id, "media"] })
    
    if (errorCount > 0) {
      toast.error(`Uploaded ${successCount} photos, failed to upload ${errorCount}.`)
    } else {
      toast.success(`Successfully uploaded ${successCount} photos.`)
    }
  }

  if (isLoadingGallery) {
    return (
      <div className="flex-1 w-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!gallery) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center text-white/50">
        <p>Gallery not found.</p>
        <Link to="/dashboard/manage_galleries" className="text-ares-gold hover:underline mt-4">
          Return to Galleries
        </Link>
      </div>
    )
  }

  return (
    <div className="flex-1 w-full flex flex-col min-h-0">
      <div className="mb-6 flex flex-col gap-4">
        <Link
          to="/dashboard/manage_galleries"
          className="text-white/60 hover:text-white transition-colors flex items-center gap-2 w-fit text-sm"
        >
          <ArrowLeft size={16} />
          Back to Albums
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tighter">{gallery.title}</h2>
            <p className="text-marble/60 text-sm mt-1">{gallery.description || "No description provided."}</p>
          </div>

          <label className="px-4 py-2 bg-ares-gold hover:bg-ares-gold/80 text-black font-black uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <Upload size={16} />
            {isUploading ? `Uploading...` : 'Upload Photos'}
          </label>
        </div>
      </div>

      {isUploading && uploadProgress && (
        <div className="w-full bg-black border border-white/10 ares-cut-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm font-bold">Uploading Photos...</span>
            <span className="text-ares-gold text-sm font-mono">{uploadProgress.current} / {uploadProgress.total}</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-ares-gold transition-all duration-300"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {isLoadingMedia ? (
        <div className="w-full h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
        </div>
      ) : media.length === 0 ? (
        <div className="w-full flex-1 flex flex-col items-center justify-center text-white/20 gap-4 border border-white/10 ares-cut-sm bg-obsidian">
          <Images size={48} className="opacity-50" />
          <p className="font-mono text-sm">This album is empty.</p>
          <label className="px-4 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 text-ares-gold ares-cut-sm text-sm font-bold transition-all border border-ares-gold/30 cursor-pointer">
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            Upload some photos
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pb-4 pr-2">
          {media.map((asset) => (
            <div
              key={asset.key}
              className="group relative aspect-square bg-black border border-white/10 ares-cut-sm overflow-hidden"
            >
              <img
                src={asset.url}
                alt="Gallery content"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-ares-cyan hover:text-black text-white transition-colors"
                  title="View full size"
                >
                  <Maximize2 size={18} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
