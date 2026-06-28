import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Search, Play } from "lucide-react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cleanThumbnailUrl } from "@/lib/utils";

interface Video {
  id: string;
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  createdAt: string;
}

interface VideoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (videoId: string) => void;
}

export default function VideoPickerModal({ isOpen, onClose, onSelect }: VideoPickerModalProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchVideos = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const list = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            videoId: data.videoId || "",
            title: data.title || "Untitled Video",
            description: data.description || "",
            thumbnailUrl: data.thumbnailUrl || "",
            createdAt: data.createdAt || "",
          } as Video;
        });
        setVideos(list);
      } catch (err) {
        console.warn("Failed to load videos from Firestore:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredVideos = videos.filter(
    (v) =>
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-[10000] translate-x-[-50%] translate-y-[-50%] w-[calc(100%-2rem)] max-w-2xl bg-obsidian border border-white/10 p-6 shadow-2xl ares-cut-lg flex flex-col max-h-[85vh] text-marble z-10 text-left focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <header className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-ares-red rounded-full animate-ping shrink-0" />
              <Dialog.Title className="text-sm font-black text-white uppercase tracking-wider m-0">
                Select YouTube Video
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close modal"
                className="text-marble/55 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </header>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" />
            <input
              type="text"
              placeholder="Search videos by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-ares-red transition-colors placeholder:text-marble/25 focus-visible:ring-2 focus-visible:ring-ares-cyan"
            />
          </div>

          {/* Video List */}
          <div className="flex-grow overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <span className="w-6 h-6 border-2 border-ares-gold border-t-transparent rounded-full animate-spin"></span>
                <span className="text-[10px] text-marble/55">Querying video database...</span>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="py-20 text-center text-xs font-mono text-marble/35 border border-dashed border-white/10 rounded">
                No matching YouTube videos found
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredVideos.map((video) => (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => onSelect(video.videoId)}
                    className="group text-left bg-black/25 hover:bg-white/5 border border-white/10 rounded-lg p-3 cursor-pointer flex gap-3 transition-all active:scale-99 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    <div className="relative w-28 h-18 bg-black/55 rounded border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                      {video.thumbnailUrl ? (
                        <img
                          src={cleanThumbnailUrl(video.thumbnailUrl)}
                          alt=""
                          className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                          loading="lazy"
                        />
                      ) : (
                        <Play size={16} className="text-marble/30" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                        <div className="w-7 h-7 bg-ares-red/80 group-hover:bg-ares-red text-white flex items-center justify-center rounded-full shadow-lg transition-transform group-hover:scale-105">
                          <Play size={10} fill="currentColor" className="ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between overflow-hidden">
                      <div>
                        <h4 className="text-xs font-extrabold text-white group-hover:text-ares-gold transition-colors leading-tight line-clamp-2 uppercase tracking-tight">
                          {video.title}
                        </h4>
                        <p className="text-[10px] text-marble/55 line-clamp-2 mt-1 leading-normal">
                          {video.description}
                        </p>
                      </div>
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
