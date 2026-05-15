import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { useGetAlbums, useDeleteAlbum, type Album } from '../../api/albums'
import { Pencil, Trash2, Images, Plus } from 'lucide-react'
import { useModal } from '../../contexts/ModalContext'
import AlbumEditorModal from '../../components/AlbumEditorModal'
import { toastApiError } from '../../api/honoClient'

export const Route = createFileRoute('/dashboard/manage_albums')({
  component: RouteComponent,
})

function RouteComponent() {
  const modal = useModal()
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [albumToEdit, setAlbumToEdit] = useState<Album | null>(null)
  
  const { data: albumsResponse, isLoading } = useGetAlbums()
  
  const deleteMutation = useDeleteAlbum({
    onSuccess: () => {
      toast.success("Album deleted successfully")
    },
    onError: (err) => {
      toastApiError(err, "Failed to delete album")
    }
  })

  const albums = albumsResponse?.albums ?? []

  const handleDelete = async (id: string, title: string) => {
    const confirmed = await modal.confirm({
      title: "Delete Album",
      description: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      confirmText: "Delete",
      destructive: true,
    })
    if (!confirmed) return
    deleteMutation.mutate(id)
  }

  const handleEdit = (album: Album) => {
    setAlbumToEdit(album)
    setIsEditorOpen(true)
  }

  const handleCreateNew = () => {
    setAlbumToEdit(null)
    setIsEditorOpen(true)
  }

  return (
    <div className="flex-1 w-full flex flex-col min-h-0">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tighter">Manage Photo Albums</h2>
          <p className="text-marble/60 text-sm mt-1">Create and manage internal photo albums hosted on ARESWEB.</p>
        </div>

        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-ares-gold hover:bg-ares-gold/80 text-black font-black uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          New Album
        </button>
      </div>

      {isLoading ? (
        <div className="w-full h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
        </div>
      ) : albums.length === 0 ? (
        <div className="w-full h-64 flex flex-col items-center justify-center text-white/20 gap-4 border border-white/10 ares-cut-sm">
          <Images size={48} className="opacity-50" />
          <p className="font-mono text-sm">No albums yet.</p>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 text-ares-gold ares-cut-sm text-sm font-bold transition-all border border-ares-gold/30"
          >
            Create your first album
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
          {albums.map((album) => (
            <div
              key={album.id}
              className="bg-obsidian border border-white/10 ares-cut-sm overflow-hidden group hover:border-ares-gold/30 transition-colors"
            >
              {album.coverImageId ? (
                <img src={`/api/media/${album.coverImageId}`} alt={album.title} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-ares-gold/10 flex items-center justify-center">
                  <Images className="text-ares-gold/30 w-12 h-12" />
                </div>
              )}
              <div className="p-4">
                <h3 className="text-white font-bold text-lg mb-1">{album.title}</h3>
                {album.description && (
                  <p className="text-white/60 text-sm mb-3 line-clamp-2">{album.description}</p>
                )}
                <div className="flex items-center justify-between mt-auto pt-2">
                  <Link
                    to="/dashboard/manage_albums/$id"
                    params={{ id: album.id }}
                    className="text-xs text-ares-gold hover:text-white transition-colors flex items-center gap-1 font-black uppercase tracking-widest"
                  >
                    Manage Album Media
                  </Link>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() => handleEdit(album)}
                      className="p-2 text-white/60 hover:text-ares-gold transition-colors"
                      title="Edit album"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(album.id, album.title)}
                      className="p-2 text-white/60 hover:text-ares-red transition-colors"
                      title="Delete album"
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

      <AlbumEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false)
          setAlbumToEdit(null)
        }}
        albumToEdit={albumToEdit}
      />
    </div>
  )
}
