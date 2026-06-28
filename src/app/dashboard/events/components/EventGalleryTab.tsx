import React from "react";
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
}

export default function EventGalleryTab({
  photos,
  canEdit,
  uploadingImage,
  uploadError,
  handleImageUpload,
  handleDeletePhoto,
  setSelectedPhoto
}: EventGalleryTabProps) {
  return (
    <div className="flex-grow flex flex-col justify-between overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-white/5 text-left">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
            Operation Event Photo Gallery ({photos.length})
          </h4>

          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              <label className="px-3 py-1.5 bg-ares-gold hover:bg-ares-gold-soft text-black font-black uppercase text-[9px] tracking-wider rounded cursor-pointer transition-all inline-flex items-center gap-1">
                <Upload size={10} />
                {uploadingImage ? "Uploading..." : "Upload Photo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {uploadError && (
          <p className="text-[9px] font-mono text-ares-red bg-ares-red/10 p-2 rounded border border-ares-red/20 max-w-md">
            {uploadError}
          </p>
        )}

        {photos.length === 0 ? (
          <div className="py-20 text-center text-marble/35 font-mono text-[10px] uppercase tracking-wider border border-dashed border-white/5 rounded-xl">
            No photos uploaded yet for this operation event.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((p) => (
              <div
                key={p.id}
                className="relative group border border-white/10 rounded-lg overflow-hidden bg-black aspect-video hover:border-white/20 transition-all cursor-zoom-in"
                onClick={() => setSelectedPhoto(p)}
              >
                <img src={p.url} alt="Gallery item" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between text-[8px] font-mono text-white/80 pointer-events-none">
                  <span className="truncate">{p.filename}</span>
                  <div className="flex justify-between items-center pointer-events-auto">
                    <span className="text-[7.5px] text-marble/50">By {p.uploadedBy}</span>
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(p.id);
                        }}
                        className="p-1 bg-black/80 hover:bg-ares-red/25 rounded border border-white/10 hover:border-ares-red/20 text-white cursor-pointer"
                        title="Delete photo"
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
      </div>
    </div>
  );
}
