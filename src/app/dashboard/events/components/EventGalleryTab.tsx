import React, { useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { EventPhoto } from "./EventEditorDrawer";

interface EventGalleryTabProps {
  photos: EventPhoto[];
  canEdit: boolean;
  uploadingImage: boolean;
  uploadError: string | null;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeletePhoto: (photoId: string) => void;
  setSelectedPhoto: (photo: EventPhoto | null) => void;
  occurrenceDate?: string | null;
}

export default function EventGalleryTab({
  photos,
  canEdit,
  uploadingImage,
  uploadError,
  handleImageUpload,
  handleDeletePhoto,
  setSelectedPhoto,
  occurrenceDate,
}: EventGalleryTabProps) {
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);
  const pendingPhoto = photos.find((photo) => photo.id === pendingPhotoId);
  return (
    <div className="flex-grow flex flex-col justify-between overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-white/5 text-left">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
            {occurrenceDate ? "Session & Series Photo Gallery" : "Event Photo Gallery"} ({photos.length})
          </h4>

          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              <label className="px-3 py-1.5 bg-ares-gold hover:bg-ares-bronze text-black font-black uppercase text-[9px] tracking-wider rounded cursor-pointer transition-all inline-flex items-center gap-1 focus-within:ring-2 focus-within:ring-ares-cyan">
                <Upload size={10} />
                {uploadingImage ? "Uploading..." : "Upload Photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="sr-only"
                />
              </label>
            </div>
          )}
        </div>

        {uploadError && (
          <p
            role="alert"
            className="text-[9px] font-mono text-white bg-ares-red/15 p-2 rounded border border-ares-red/40 max-w-md"
          >
            {uploadError}
          </p>
        )}

        {photos.length === 0 ? (
          <div className="py-20 text-center text-marble/35 font-mono text-[10px] uppercase tracking-wider border border-dashed border-white/5 rounded-xl">
            {occurrenceDate
              ? "No photos uploaded yet for this session or series."
              : "No photos uploaded yet for this event."}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((p) => (
              <div
                key={p.id}
                className="relative group border border-white/10 rounded-lg overflow-hidden bg-black aspect-video hover:border-white/20 transition-all"
              >
                <img
                  src={p.thumbnailUrl ?? p.url}
                  alt={p.filename || "Event gallery photo"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <button
                  type="button"
                  onClick={() => setSelectedPhoto(p)}
                  aria-label={`Open ${p.filename || "event photo"}`}
                  className="absolute inset-0 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ares-cyan"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity motion-reduce:transition-none p-2 flex flex-col justify-between text-[8px] font-mono text-white/80 pointer-events-none">
                  <span className="truncate">{p.filename}</span>
                  {occurrenceDate && (
                    <span className="w-fit rounded bg-black/80 px-1.5 py-0.5 text-[7px] font-black uppercase text-ares-gold">
                      {p.occurrenceDate === occurrenceDate ? "This session" : "Series"}
                    </span>
                  )}
                  <div className="flex justify-between items-center pointer-events-auto">
                    <span className="text-[7.5px] text-marble/50">By {p.uploadedBy}</span>
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingPhotoId(p.id);
                        }}
                        className="p-1 bg-black/80 hover:bg-ares-red/25 rounded border border-white/10 hover:border-ares-red/20 text-white cursor-pointer"
                        aria-label={`Archive ${p.filename || "event photo"}`}
                        title="Archive photo"
                      >
                        <Trash2 size={9} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingPhoto && (
          <div
            role="alertdialog"
            aria-label="Confirm event photo archive"
            className="rounded border border-ares-red/35 bg-ares-red/10 p-4 text-sm text-white"
          >
            <p>
              Archive <strong>{pendingPhoto.filename || "this photo"}</strong> from the event gallery?
            </p>
            <p className="mt-1 text-xs text-marble/70">This keeps the record available for recovery.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setPendingPhotoId(null)}
                className="rounded border border-white/15 px-3 py-2 text-xs font-bold focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  handleDeletePhoto(pendingPhoto.id);
                  setPendingPhotoId(null);
                }}
                className="rounded bg-ares-red px-3 py-2 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Archive photo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
