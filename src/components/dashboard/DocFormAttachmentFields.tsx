import React from "react";
import { Image as ImageIcon } from "lucide-react";

interface DocFormAttachmentFieldsProps {
  variant: "docs" | "documents" | "blog";
  formFileUrl: string;
  setFormFileUrl: (val: string) => void;
  formThumbnail: string;
  setFormThumbnail: (val: string) => void;
  setIsPhotoPickerOpen: (val: boolean) => void;
}

export default function DocFormAttachmentFields({
  variant,
  formFileUrl,
  setFormFileUrl,
  formThumbnail,
  setFormThumbnail,
  setIsPhotoPickerOpen
}: DocFormAttachmentFieldsProps) {
  return (
    <div className="space-y-6">
      {/* Documents Variant Attachment */}
      {variant === "documents" && (
        <div>
          <label
            htmlFor="formFileUrl"
            className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
          >
            File / External URL Link
          </label>
          <input
            id="formFileUrl"
            type="url"
            placeholder="https://drive.google.com/... or github.com"
            value={formFileUrl}
            onChange={(e) => setFormFileUrl(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
            required
          />
        </div>
      )}

      {/* Blog Variant Attachment */}
      {variant === "blog" && (
        <div>
          <label
            htmlFor="formThumbnail"
            className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
          >
            Thumbnail Graphic URL
          </label>
          <div className="flex gap-2">
            <input
              id="formThumbnail"
              type="text"
              placeholder="https://images.unsplash.com/..."
              value={formThumbnail}
              onChange={(e) => setFormThumbnail(e.target.value)}
              className="flex-grow bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
            />
            <button
              type="button"
              onClick={() => setIsPhotoPickerOpen(true)}
              className="px-3 bg-white/5 hover:bg-ares-gold/20 border border-white/10 hover:border-ares-gold text-white rounded flex items-center justify-center transition-all cursor-pointer"
              title="Choose from Gallery"
            >
              <ImageIcon size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
