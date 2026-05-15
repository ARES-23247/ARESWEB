import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useGetAlbum, useAddAlbumMedia, useRemoveAlbumMedia, useReorderAlbumMedia } from '../../api/albums'
import { ArrowLeft, Images, Upload, Maximize2, Trash2, Link as LinkIcon, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { uploadFile } from '../../utils/apiClient'
import { useQueryClient } from '@tanstack/react-query'
import GooglePhotoPickerModal from '../../components/GooglePhotoPickerModal'
import { toastApiError } from '../../api/honoClient'
import { useModal } from '../../contexts/ModalContext'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export const Route = createFileRoute('/dashboard/manage_albums/$id')({
  component: RouteComponent,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SortableMediaItem({ asset, onRemove }: { asset: any, onRemove: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative aspect-square bg-black border border-white/10 ares-cut-sm overflow-hidden ${isDragging ? 'opacity-50 ring-2 ring-ares-gold' : ''}`}
    >
      <img
        src={`/api/proxy-image?key=${encodeURIComponent(asset.photo?.r2Key ?? asset.id)}`}
        alt={asset.photo?.filename || "Album media"}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-ares-gold hover:text-black text-white transition-colors cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical size={18} />
        </button>
        <a
          href={`/api/proxy-image?key=${encodeURIComponent(asset.photo?.r2Key ?? asset.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-ares-cyan hover:text-black text-white transition-colors"
          title="View full size"
        >
          <Maximize2 size={18} />
        </a>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(asset.id)
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-ares-red hover:text-white text-white transition-colors"
          title="Remove from album"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  )
}

function RouteComponent() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const modal = useModal()
  
  const { data: albumResponse, isLoading: isLoadingAlbum } = useGetAlbum(id)
  
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  
  const [isGooglePickerOpen, setIsGooglePickerOpen] = useState(false)

  // Local state for optimistic drag and drop
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mediaItems, setMediaItems] = useState<any[]>([])

  const addMediaMutation = useAddAlbumMedia()
  const removeMediaMutation = useRemoveAlbumMedia()
  const reorderMediaMutation = useReorderAlbumMedia()
  
  const album = albumResponse?.album

  // Sync local state when server data changes, unless we are currently dragging
  useEffect(() => {
    if (album?.media) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMediaItems(album.media)
    }
  }, [album?.media])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before dragging starts (allows clicking buttons)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setMediaItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        
        const newItems = arrayMove(items, oldIndex, newIndex)
        
        // Dispatch mutation to save order
        const mediaIds = newItems.map(item => item.id)
        reorderMediaMutation.mutate({ id, mediaIds }, {
          onError: (err) => {
            toastApiError(err, "Failed to save new order")
            // Revert on error by refetching
            queryClient.invalidateQueries({ queryKey: ["albums", id] })
          }
        })
        
        return newItems
      })
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadProgress({ current: 0, total: files.length })

    let errorCount = 0
    const newMediaIds: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("folder", "album")

        const res = await uploadFile<{ key: string }>("/api/media/admin/upload", formData)
        if (res.key) {
          newMediaIds.push(res.key)
        }
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err)
        errorCount++
      }
      setUploadProgress({ current: i + 1, total: files.length })
    }

    if (newMediaIds.length > 0) {
      addMediaMutation.mutate({ id, mediaIds: newMediaIds }, {
        onSuccess: (data) => {
          toast.success(`Successfully uploaded and linked ${data.added} photos.`)
        },
        onError: (err) => {
          toastApiError(err, "Failed to link uploaded photos to album")
        }
      })
    } else if (errorCount > 0) {
      toast.error(`Failed to upload ${errorCount} photos.`)
    }

    setIsUploading(false)
    setUploadProgress(null)
  }

  const handleRemoveMedia = async (mediaId: string) => {
    const confirmed = await modal.confirm({
      title: "Remove Photo",
      description: "Are you sure you want to remove this photo from the album? The photo will not be deleted from the system, only unlinked from this album.",
      confirmText: "Remove",
      destructive: true,
    })
    
    if (!confirmed) return
    
    removeMediaMutation.mutate({ id, mediaId }, {
      onSuccess: () => {
        toast.success("Photo removed from album")
      },
      onError: (err) => {
        toastApiError(err, "Failed to remove photo")
      }
    })
  }

  if (isLoadingAlbum) {
    return (
      <div className="flex-1 w-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!album) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center text-white/50">
        <p>Album not found.</p>
        <Link to="/dashboard/manage_albums" className="text-ares-gold hover:underline mt-4">
          Return to Albums
        </Link>
      </div>
    )
  }

  return (
    <div className="flex-1 w-full flex flex-col min-h-0">
      <div className="mb-6 flex flex-col gap-4">
        <Link
          to="/dashboard/manage_albums"
          className="text-white/60 hover:text-white transition-colors flex items-center gap-2 w-fit text-sm"
        >
          <ArrowLeft size={16} />
          Back to Albums
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tighter">{album.title}</h2>
            <p className="text-marble/60 text-sm mt-1">{album.description || "No description provided."}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsGooglePickerOpen(true)}
              className="px-4 py-2 bg-ares-cyan/20 hover:bg-ares-cyan/30 text-ares-cyan border border-ares-cyan/30 font-black uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2"
            >
              <LinkIcon size={16} />
              Import Google Photos
            </button>
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

      {mediaItems.length === 0 ? (
        <div className="w-full flex-1 flex flex-col items-center justify-center text-white/20 gap-4 border border-white/10 ares-cut-sm bg-obsidian">
          <Images size={48} className="opacity-50" />
          <p className="font-mono text-sm">This album has no photos.</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsGooglePickerOpen(true)}
              className="px-4 py-2 bg-ares-cyan/20 hover:bg-ares-cyan/30 text-ares-cyan ares-cut-sm text-sm font-bold transition-all border border-ares-cyan/30"
            >
              Import from Google Photos
            </button>
            <label className="px-4 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 text-ares-gold ares-cut-sm text-sm font-bold transition-all border border-ares-gold/30 cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              Upload new photos
            </label>
          </div>
        </div>
      ) : (
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={mediaItems.map(m => m.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pb-4 pr-2">
              {mediaItems.map((asset) => (
                <SortableMediaItem 
                  key={asset.id} 
                  asset={asset} 
                  onRemove={handleRemoveMedia}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <GooglePhotoPickerModal
        isOpen={isGooglePickerOpen}
        onClose={() => setIsGooglePickerOpen(false)}
        onPhotosImported={(items) => {
          setIsGooglePickerOpen(false)
          const r2Keys = items.map(i => i.r2Key)
          addMediaMutation.mutate({ id, mediaIds: r2Keys }, {
            onSuccess: (data) => {
              toast.success(`Linked ${data.added} imported photos to album.`)
            },
            onError: (err) => {
              toastApiError(err, "Failed to link imported photos to album")
            }
          })
        }}
      />
    </div>
  )
}
