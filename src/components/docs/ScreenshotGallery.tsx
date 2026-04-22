import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { publicApi } from "../../api/publicApi";

interface R2MediaResponse {
  media: {
    key: string;
    httpMetadata: {
      contentType: string;
    };
  }[];
}

export default function ScreenshotGallery() {
  const { data, isLoading } = useQuery<R2MediaResponse>({
    queryKey: ["media"],
    queryFn: async () => {
      try {
        const data = await publicApi.get<R2MediaResponse>("/api/media");
        return data;
      } catch {
        throw new Error("Failed to fetch media");
      }
    }
  });

  const [index, setIndex] = useState(0);

  // Filter only images and reverse to show newest first
  const images = data?.media
    ?.filter(m => m.httpMetadata?.contentType?.startsWith("image/"))
    ?.reverse()
    .map(m => `/api/media/${m.key}`) || ["/hero_bg.png", "/gallery_4.png", "/news_1.png"]; // fallbacks

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
          <button onClick={prev} className="p-2 bg-black/50 hover:bg-ares-red/80 text-white rounded-full backdrop-blur transition-colors"><ChevronLeft size={24} /></button>
          <button onClick={next} className="p-2 bg-black/50 hover:bg-ares-cyan/80 text-white rounded-full backdrop-blur transition-colors"><ChevronRight size={24} /></button>
        </div>
      )}

      {!isLoading && images.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {images.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === index ? "bg-ares-gold scale-125" : "bg-white/60"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
