import { ImageOff } from "lucide-react";

export default function ScreenshotGallery() {

  return (
    <div
      role="note" className="my-6 flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
          <ImageOff aria-hidden="true" size={28}
            className="mb-3 text-marble/40"
          />
        <p className="font-bold text-white">
        No verified documentation screenshots are published here.</p>
          <p className="mt-2 max-w-xl text-sm text-marble/65">
        Screenshots appear only when a documentation-specific media record
        supplies an image and an accurate description.</p>
        </div>
      )}