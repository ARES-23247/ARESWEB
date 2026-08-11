import React from "react";
import { Upload, AlertCircle, Image as ImageIcon, Maximize2, RefreshCw } from "lucide-react";
import { EventPhoto } from "./types";

interface EventGalleryProps {
  isVerified: boolean;
  uploadingImage: boolean;
  uploadError: string | null;
  loadingPhotos: boolean;
  photoLoadError: string | null;
  photos: EventPhoto[];
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRetryPhotos: () => void;
  setSelectedPhoto: (photo: EventPhoto) => void;
}

export default function EventGallery({
  isVerified,
  uploadingImage,
  uploadError,
  loadingPhotos,
  photoLoadError,
  photos,
  handleImageUpload,
  onRetryPhotos,
  setSelectedPhoto
}: EventGalleryProps) {
  return (
    <div className="space-y-6 pt-6 border-t border-white/5">
      <header className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight font-heading">Event Gallery</h3>
          <p className="text-[10px] text-marble/50 uppercase font-bold mt-0.5">Media captured from this operation</p>
        </div>

        <div className="flex items-center gap-2">
          {isVerified && (
            <div className="relative">
            <input
              type="file"
              accept="image/*"
              id="photo-upload-input"
              className="hidden"
              onChange={handleImageUpload}
              disabled={uploadingImage}
            />
            <label
              htmlFor="photo-upload-input"
              className="px-3 py-1.5 border border-white/10 hover:border-ares-gold bg-white/5 hover:bg-white/10 text-marble hover:text-ares-gold text-[9px] font-black uppercase tracking-widest ares-cut-sm inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {uploadingImage ? (
                <span className="w-3 h-3 border-2 border-ares-gold border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Upload size={12} />
              )}
              Upload Photo
            </label>
            </div>
          )}
          <button
            type="button"
            onClick={onRetryPhotos}
            disabled={loadingPhotos}
            aria-label="Refresh event photos"
            className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-marble transition-colors hover:border-ares-gold hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-60"
          >
            <RefreshCw aria-hidden="true" size={12} className={loadingPhotos ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {uploadError && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-ares-red/40 bg-ares-red/15 p-3.5 text-xs text-white">
          <AlertCircle aria-hidden="true" size={14} /> {uploadError}
        </div>
      )}

      {photoLoadError && (
        <div role="alert" className="rounded-lg border border-ares-red/40 bg-ares-red/15 p-4 text-white">
          <div className="flex items-start gap-2">
            <AlertCircle aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">Event photos are temporarily unavailable.</p>
              <p className="mt-1 break-words font-mono text-[10px] text-marble/80">{photoLoadError}</p>
            </div>
            <button
              type="button"
              onClick={onRetryPhotos}
              disabled={loadingPhotos}
              className="rounded bg-ares-red px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white hover:bg-ares-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-60"
            >
              {loadingPhotos ? "Retrying…" : "Retry"}
            </button>
          </div>
        </div>
      )}

      {loadingPhotos && photos.length === 0 ? (
        <div role="status" className="p-12 text-center font-mono text-xs text-marble/60">
          Loading event photos…
        </div>
      ) : photos.length === 0 && !photoLoadError ? (
        <div className="p-12 text-center border border-dashed border-white/10 rounded-2xl bg-black/10 text-marble/30 text-xs font-mono">
          <ImageIcon aria-hidden="true" size={32} className="mx-auto mb-3 opacity-25" />
          No photos have been uploaded for this event.
        </div>
      ) : photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setSelectedPhoto(item)}
              aria-label={`Open event photo: ${item.filename}`}
              className="aspect-square relative overflow-hidden group cursor-pointer ares-cut border border-white/10 bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <img
                src={item.url}
                alt={item.filename}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103 opacity-80 group-hover:opacity-100"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 text-left">
                <span className="text-[7px] text-white/55 font-bold uppercase truncate">{item.filename}</span>
                {item.uploadedBy && !item.uploadedBy.includes("@") && (
                  <span className="text-[8px] text-ares-gold font-black uppercase tracking-wide truncate">
                    By {item.uploadedBy}
                  </span>
                )}
              </div>
              <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center border border-white/15 opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 size={10} className="text-white" />
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
