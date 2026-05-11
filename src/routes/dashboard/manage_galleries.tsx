import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { useGetGalleries, useDeleteGallery } from '../../api'
import { useDashboardSession } from '../../hooks/useDashboardSession'
import { Pencil, Trash2, Images, Plus, ExternalLink } from 'lucide-react'
import { useModal } from '../../contexts/ModalContext'
import GalleryPickerModal from '../../components/GalleryPickerModal'

export const Route = createFileRoute('/dashboard/manage_galleries')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()
  const modal = useModal()
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const { data: galleriesResponse, isLoading } = useGetGalleries()
  const deleteMutation = useDeleteGallery({
    onSuccess: () => {
      toast.success("Gallery deleted successfully")
    },
    onError: () => {
      toast.error("Failed to delete gallery")
    }
  })

  const galleries = (galleriesResponse as unknown as { galleries: Array<{ id: string, title: string, description: string | null, googlePhotosUrl: string | null, heroImageUrl: string | null }> })?.galleries ?? []

  const handleDelete = async (id: string, title: string) => {
    const confirmed = await modal.confirm({
      title: "Delete Gallery",
      description: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      confirmText: "Delete",
      destructive: true,
    })
    if (!confirmed) return
    deleteMutation.mutate(id)
  }

  return (
    <div className="flex-1 w-full flex flex-col min-h-0">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tighter">Manage Photo Galleries</h2>
          <p className="text-marble/60 text-sm mt-1">Create and manage photo galleries linked to Google Photos.</p>
        </div>

        <button
          onClick={() => setIsPickerOpen(true)}
          className="px-4 py-2 bg-ares-gold hover:bg-ares-gold/80 text-black font-black uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          New Gallery
        </button>
      </div>

      {isLoading ? (
        <div className="w-full h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
        </div>
      ) : galleries.length === 0 ? (
        <div className="w-full h-64 flex flex-col items-center justify-center text-white/20 gap-4 border border-white/10 ares-cut-sm">
          <Images size={48} className="opacity-50" />
          <p className="font-mono text-sm">No galleries yet.</p>
          <button
            onClick={() => setIsPickerOpen(true)}
            className="px-4 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 text-ares-gold ares-cut-sm text-sm font-bold transition-all border border-ares-gold/30"
          >
            Create your first gallery
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
          {galleries.map((gallery) => (
            <div
              key={gallery.id}
              className="bg-obsidian border border-white/10 ares-cut-sm overflow-hidden group hover:border-ares-gold/30 transition-colors"
            >
              {gallery.heroImageUrl ? (
                <img src={gallery.heroImageUrl} alt={gallery.title} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-ares-gold/10 flex items-center justify-center">
                  <Images className="text-ares-gold/30 w-12 h-12" />
                </div>
              )}
              <div className="p-4">
                <h3 className="text-white font-bold text-lg mb-1">{gallery.title}</h3>
                {gallery.description && (
                  <p className="text-white/60 text-sm mb-3 line-clamp-2">{gallery.description}</p>
                )}
                <div className="flex items-center justify-between">
                  {gallery.googlePhotosUrl && (
                    <a
                      href={gallery.googlePhotosUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-ares-cyan hover:text-white transition-colors flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      View on Google Photos
                    </a>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() => {/* TODO: Edit functionality */}}
                      className="p-2 text-white/60 hover:text-ares-gold transition-colors"
                      title="Edit gallery"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(gallery.id, gallery.title)}
                      className="p-2 text-white/60 hover:text-ares-red transition-colors"
                      title="Delete gallery"
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

      <GalleryPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={() => {
          setIsPickerOpen(false)
          // Refetch is handled by the query client
        }}
      />
    </div>
  )
}
