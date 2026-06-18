"use client";

import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Play, X, Calendar, Clock, Film, ExternalLink, RefreshCw } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { cleanThumbnailUrl } from "@/lib/utils";
import { GreekMeander } from "@/components/GreekMeander";

interface TeamVideo {
  id: string;
  title: string;
  description?: string;
  platform: string;
  videoId: string;
  thumbnailUrl?: string;
  embedUrl: string;
  type: "video" | "short";
  createdAt: string;
}

const MOCK_VIDEOS: TeamVideo[] = [
  {
    id: "video_1",
    title: "ARES #23247 World Championship Finals Run",
    description: "Full match footage capturing our mechanical sliders, multi-sample autonomous routines, and hang kinematics.",
    platform: "youtube",
    videoId: "dQw4w9WgXcQ",
    thumbnailUrl: "https://images.unsplash.com/photo-1516116211223-5c359a36298a?w=500&auto=format&fit=crop&q=60",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    type: "video",
    createdAt: "2026-05-22"
  },
  {
    id: "video_2",
    title: "Pinpoint IMU Drift Calibrations in 60s",
    description: "Fast-paced YouTube Short tutorial illustrating drift reduction routines for regional teams.",
    platform: "youtube",
    videoId: "dQw4w9WgXcQ",
    thumbnailUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=500&auto=format&fit=crop&q=60",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    type: "short",
    createdAt: "2026-05-27"
  }
];

export default function VideosPage() {
  const [videos, setVideos] = useState<TeamVideo[]>(MOCK_VIDEOS);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "video" | "short">("all");
  
  // Lightbox State
  const [selectedVideo, setSelectedVideo] = useState<TeamVideo | null>(null);
  const isLightboxOpen = !!selectedVideo;
  const lightboxRef = useFocusTrap(isLightboxOpen, () => setSelectedVideo(null));

  // Listen to Firestore
  useEffect(() => {
    setIsLoading(true);
    try {
      const videosRef = collection(db, "videos");
      const unsubscribe = onSnapshot(
        videosRef,
        (snapshot) => {
          if (snapshot.empty) {
            setVideos(MOCK_VIDEOS);
            setIsLive(false);
            setIsLoading(false);
            return;
          }
          const list = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || "Untitled Video",
              description: data.description || "",
              platform: data.platform || "youtube",
              videoId: data.videoId || "",
              thumbnailUrl: data.thumbnailUrl || "",
              embedUrl: data.embedUrl || "",
              type: data.type || "video",
              createdAt: data.createdAt || new Date().toISOString().split("T")[0]
            } as TeamVideo;
          });
          
          setVideos(list);
          setIsLive(true);
          setIsLoading(false);
        },
        (err) => {
          console.warn("Firestore collection not initialized or error, using mock library:", err);
          setVideos(MOCK_VIDEOS);
          setIsLive(false);
          setIsLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Local offline sandbox mode, using mock video hub:", e);
      setVideos(MOCK_VIDEOS);
      setIsLive(false);
      setIsLoading(false);
    }
  }, []);

  // Filter logic
  const filteredVideos = activeTab === "all"
    ? videos
    : videos.filter((v) => v.type === activeTab);

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      {/* Hero Header */}
      <section className="py-28 bg-obsidian relative overflow-hidden flex items-center min-h-[50vh]">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute top-0 left-0" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <p className="text-ares-bronze uppercase tracking-[0.4em] text-[10px] font-black font-heading mb-4 animate-pulse">
            Visual Media & Robot Highlights
          </p>
          <h1 className="text-4xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading">
            Video <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-xl text-white">Hub</span>
          </h1>
          <p className="text-marble/85 text-base md:text-lg max-w-2xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6">
            Tune in to watch ARES #23247 in action. Explore our match recordings, design reveals, regional highlights, and educational CAD/programming guides.
          </p>
        </div>
      </section>

      {/* Videos Section */}
      <section className="py-12 bg-black/10 border-y border-white/5 min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Header Controls & Filter Selector */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12 border-b border-white/5 pb-6">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "all", label: "All Media" },
                { id: "video", label: "Robot Highlights" },
                { id: "short", label: "Shorts & Tutorials" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-ares-red text-white"
                      : "bg-white/5 text-marble/45 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <a
              href="https://youtube.com/@ARESFTC"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white/5 border border-white/10 text-white text-[9px] font-black uppercase tracking-widest ares-cut-sm flex items-center gap-2 hover:border-ares-gold transition-colors"
            >
              <ExternalLink size={10} className="text-ares-gold" />
              Subscribe on YouTube
            </a>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <RefreshCw className="animate-spin text-ares-gold" size={32} />
              <span className="text-xs uppercase font-bold text-ares-gold/75 tracking-widest font-heading">Loading library...</span>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-24 bg-black/10 border border-white/5 rounded-2xl">
              <Film className="mx-auto text-marble/25 mb-4" size={48} />
              <p className="text-marble/55 text-xs font-black uppercase tracking-wider">No videos found</p>
              <p className="text-marble/35 text-[10px] mt-1.5">Check back later for newly synced video highlights.</p>
            </div>
          ) : (
            /* Videos Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredVideos.map((video) => {
                const isShort = video.type === "short";
                return (
                  <div
                    key={video.id}
                    onClick={() => setSelectedVideo(video)}
                    className="w-full flex flex-col justify-between overflow-hidden bg-gradient-to-br from-white/5 to-black/40 border border-white/10 rounded-2xl group cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(192,0,0,0.15)] hover:border-ares-red/35"
                  >
                    {/* Thumbnail Section */}
                    <div className="relative aspect-video w-full overflow-hidden bg-black/60 border-b border-white/5 flex items-center justify-center">
                      {video.thumbnailUrl ? (
                        <img
                          src={cleanThumbnailUrl(video.thumbnailUrl)}
                          alt={video.title}
                          className="w-full h-full object-cover opacity-75 group-hover:opacity-95 group-hover:scale-103 transition-all duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-black/40 flex flex-col items-center justify-center text-marble/20">
                          <Film size={32} />
                          <span className="text-[8px] font-black uppercase tracking-widest text-marble/40 mt-2">Highlights</span>
                        </div>
                      )}
                      
                      {/* Play Button Accent overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors duration-300">
                        <div className="w-12 h-12 rounded-full bg-ares-red/90 group-hover:bg-ares-red text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-all duration-300">
                          <Play size={18} fill="currentColor" className="ml-0.5" />
                        </div>
                      </div>

                      {/* Video Category/Type badge */}
                      <span className="absolute top-3 left-3 text-[8px] font-black uppercase px-2 py-0.5 rounded bg-black/75 border border-white/10 text-ares-gold tracking-wider">
                        {isShort ? "Short" : "Video"}
                      </span>
                    </div>

                    {/* Metadata details */}
                    <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                      <div className="space-y-2 text-left">
                        <h3 className="text-base font-black text-white font-heading leading-snug uppercase group-hover:text-ares-gold transition-colors line-clamp-2">
                          {video.title}
                        </h3>
                        <p className="text-marble/65 text-xs line-clamp-3 leading-relaxed">
                          {video.description || "No description provided."}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 pt-3 border-t border-white/5 text-[9px] font-mono text-marble/40 uppercase tracking-widest">
                        <span className="flex items-center gap-1">
                          <Calendar size={10} className="text-ares-red" />
                          {video.createdAt}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox Video Player Modal */}
      {isLightboxOpen && selectedVideo && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md" onClick={() => setSelectedVideo(null)} />
          
          <div
            ref={lightboxRef}
            className="w-full max-w-4xl bg-obsidian border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative z-10 flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-black/20">
              <div className="min-w-0 pr-4">
                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-ares-red/20 border border-ares-red/35 text-ares-red tracking-wider">
                  {selectedVideo.type === "short" ? "YouTube Short" : "Featured Video"}
                </span>
                <h2 id="modal-title" className="text-sm sm:text-base font-black text-white uppercase truncate font-heading tracking-tight mt-1.5">
                  {selectedVideo.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="text-marble/55 hover:text-white hover:bg-white/5 p-1.5 rounded-lg cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Video Iframe Player Container */}
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={`${selectedVideo.embedUrl}?autoplay=1&rel=0`}
                title={selectedVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              ></iframe>
            </div>

            {/* Modal Footer Description */}
            {selectedVideo.description && (
              <div className="p-6 border-t border-white/5 bg-black/10 text-left">
                <p className="text-xs text-marble/70 leading-relaxed max-h-24 overflow-y-auto pr-2">
                  {selectedVideo.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
