import { X, Images, Plus } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useGetAlbums } from "../api";

export default function AlbumPickerModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (albumId: string, title: string) => void;
}) {
  const { data: albumsResponse, isLoading } = useGetAlbums({
    enabled: isOpen,
  });
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const albums = (albumsResponse as unknown as { albums: any[] })?.albums ?? [];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content 
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-[9999] translate-x-[-50%] translate-y-[-50%] bg-obsidian border border-white/10 shadow-2xl ares-cut-lg w-[calc(100%-2rem)] max-w-5xl h-[80vh] flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ares-gold/20 flex items-center justify-center ares-cut-sm border border-ares-gold/30">
                <Images className="text-ares-gold" size={20} aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-black text-white tracking-widest uppercase m-0">Select Album</Dialog.Title>
                <Dialog.Description className="text-xs text-white/60 font-mono m-0">Embed a photo album into the document</Dialog.Description>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Dialog.Close asChild>
                <button
                  aria-label="Close modal"
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-obsidian">
            {isLoading ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
                <p className="text-xs font-bold uppercase tracking-widest text-ares-gold animate-pulse">Loading Albums...</p>
              </div>
            ) : albums.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-2">
                <Images size={48} className="opacity-50" aria-hidden="true" />
                <p className="font-mono text-sm">No albums available in the ARES vault.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {albums.map((album) => (
                  <button
                    key={album.id}
                    onClick={() => onSelect(album.id, album.title)}
                    className="relative aspect-video bg-black/50 border border-white/10 ares-cut-sm overflow-hidden group cursor-pointer hover:border-ares-gold transition-colors text-left"
                  >
                    <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity">
                      <Plus className="text-ares-gold w-8 h-8" />
                    </div>
                    {album.coverImageId ? (
                      <img 
                        src={`/api/media/${album.coverImageId}`} 
                        alt={album.title} 
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" 
                        loading="lazy" 
                      />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center">
                        <Images size={32} className="text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex flex-col justify-end">
                      <h3 className="text-white font-bold text-sm line-clamp-1">{album.title}</h3>
                      {album.description && (
                        <p className="text-white/60 text-[10px] line-clamp-1 mt-1">{album.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
