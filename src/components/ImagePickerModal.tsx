import { useState } from "react";
import { X, ImagePlus, Plus, ZoomIn } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useGetMedia, type R2MediaItem } from "../api";

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageKey: string, imageUrl: string) => void;
}

export default function ImagePickerModal({
  isOpen,
  onClose,
  onSelect,
}: ImagePickerModalProps) {
  const { data: mediaRes, isLoading } = useGetMedia({
    enabled: isOpen,
  });

  // Filter only images
  const images = mediaRes?.media
    ?.filter((m: R2MediaItem) => m.httpMetadata?.contentType?.startsWith("image/"))
    ?.reverse() || [];

  const generateCleanName = (key: string): string => {
    return key.split("-").slice(1).join("-").replace(/\.[^/.]+$/, "") || "ARES Photo";
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-asset-picker data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-asset-picker translate-x-[-50%] translate-y-[-50%] bg-obsidian border border-white/10 shadow-2xl ares-cut-lg w-[calc(100%-2rem)] max-w-5xl max-h-[85vh] flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ares-gold/20 flex items-center justify-center ares-cut-sm border border-ares-gold/30">
                <ImagePlus className="text-ares-gold" size={20} aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-black text-white tracking-widest uppercase m-0">
                  Select Image
                </Dialog.Title>
                <Dialog.Description className="text-xs text-white/60 font-mono m-0">
                  Choose a photo from the ARES gallery
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close modal"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-obsidian">
            {isLoading ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
                <p className="text-xs font-bold uppercase tracking-widest text-ares-gold animate-pulse">Loading images...</p>
              </div>
            ) : images.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-4">
                <ImagePlus size={48} className="opacity-50" aria-hidden="true" />
                <p className="font-mono text-sm">No images available in the gallery.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image: R2MediaItem) => (
                  <button
                    key={image.key}
                    onClick={() => onSelect(image.key, `/api/media/${image.key}`)}
                    className="relative aspect-square bg-black/50 border border-white/10 ares-cut-sm overflow-hidden group cursor-pointer hover:border-ares-gold/50 transition-all hover:scale-[1.02] hover:shadow-[0_8px_16px_rgba(255,215,0,0.1)]"
                  >
                    <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity">
                      <Plus className="text-ares-gold w-8 h-8" />
                    </div>
                    <img
                      src={`/api/media/${image.key}`}
                      alt={generateCleanName(image.key)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-sm font-medium truncate drop-shadow-md">
                        {generateCleanName(image.key)}
                      </p>
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

// Lightbox modal for viewing images in full size
interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageAlt: string;
}

export function ImageLightbox({ isOpen, onClose, imageUrl, imageAlt }: ImageLightboxProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[60] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={onClose}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-[60] translate-x-[-50%] translate-y-[-50%] flex items-center justify-center max-w-[95vw] max-h-[95vh] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 focus:outline-none"
          onPointerDownOutside={onClose}
          onEscapeKeyDown={onClose}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={imageUrl}
              alt={imageAlt}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={onClose}
              aria-label="Close lightbox"
              className="absolute -top-12 right-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
            >
              <X size={24} aria-hidden="true" />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
