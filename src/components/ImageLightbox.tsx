import { X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageAlt: string;
}

/**
 * ImageLightbox - Full-screen modal for viewing images
 *
 * Used in Gallery page and other places where users need to view
 * images at full size. Click outside or press ESC to close.
 */
export default function ImageLightbox({ isOpen, onClose, imageUrl, imageAlt }: ImageLightboxProps) {
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
