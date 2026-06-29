import React from "react";
import { X } from "lucide-react";
import { EventPhoto } from "./types";

interface PhotoLightboxProps {
  selectedPhoto: EventPhoto | null;
  onClose: () => void;
}

export default function PhotoLightbox({ selectedPhoto, onClose }: PhotoLightboxProps) {
  if (!selectedPhoto) return null;

  const uploadedByText = selectedPhoto.uploadedBy?.includes("@")
    ? "ARES Member"
    : selectedPhoto.uploadedBy || "ARES Member";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-4xl bg-obsidian border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col justify-between max-h-[90vh]">
        <header className="w-full flex items-center justify-between border-b border-white/5 pb-3.5">
          <div>
            <span className="text-[10px] text-marble/40 font-mono">
              Uploaded by {uploadedByText} &middot; {new Date(selectedPhoto.uploadedAt).toLocaleDateString()}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-marble/55 hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan"
            aria-label="Close lightbox"
          >
            <X size={18} />
          </button>
        </header>

        <div className="w-full flex-grow flex items-center justify-center my-6 overflow-hidden">
          <img
            src={selectedPhoto.url}
            alt={selectedPhoto.filename}
            className="w-full h-auto max-h-[60vh] object-contain rounded-lg border border-white/5"
          />
        </div>

        <footer className="w-full border-t border-white/5 pt-3.5 flex justify-between items-center text-xs">
          <p className="text-marble/60 font-semibold truncate max-w-lg">{selectedPhoto.filename}</p>
          <a
            href={selectedPhoto.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 border border-white/10 hover:border-ares-gold text-marble hover:text-ares-gold text-[9px] font-black uppercase tracking-widest transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan"
          >
            Open Original ↗
          </a>
        </footer>
      </div>
    </div>
  );
}
