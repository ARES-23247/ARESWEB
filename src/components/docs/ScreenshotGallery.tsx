import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

export default function ScreenshotGallery() {
  const [images, setImages] = useState<string[]>([
    "https://api.dicebear.com/7.x/bottts/svg?seed=robotics1",
    "https://api.dicebear.com/7.x/bottts/svg?seed=robotics2",
    "https://api.dicebear.com/7.x/bottts/svg?seed=robotics3"
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    async function loadPhotos() {
      try {
        const res = await authenticatedFetch("/api/photos");
        if (res.ok) {
          const data = await res.json();
          if (data.photos && data.photos.length > 0) {
            const urls = data.photos
              .map((p: any) => p.publicUrl)
              .filter(Boolean);
            if (urls.length > 0) {
              setImages(urls);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load screenshots from API:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPhotos();
  }, []);

  const next = () => setIndex((i) => (i + 1) % images.length);
  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);

  return (
    <div className="my-6 relative border border-white/10 ares-cut-sm overflow-hidden bg-black aspect-video group shadow-xl">
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.img
            key={index}
            src={images[index]}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full object-cover opacity-80"
            alt="Telemetry Dashboard"
          />
        </AnimatePresence>
      )}

      {!isLoading && images.length > 1 && (
        <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <button title="Previous image" onClick={prev} aria-label="Previous image" className="p-2 bg-black/50 hover:bg-ares-red/80 text-white ares-cut-sm backdrop-blur transition-colors font-bold"><ChevronLeft size={24} /></button>
          <button title="Next image" onClick={next} aria-label="Next image" className="p-2 bg-black/50 hover:bg-ares-red/80 text-white ares-cut-sm backdrop-blur transition-colors font-bold"><ChevronRight size={24} /></button>
        </div>
      )}

      {!isLoading && images.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {images.map((_: string, i: number) => (
            <div key={i} className={`w-2 h-2 ares-cut-sm transition-all ${i === index ? "bg-ares-gold scale-125" : "bg-white/60"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
