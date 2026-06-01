"use client";

import React, { useState } from "react";
import { Eye, MapPin, X, ArrowLeft, ArrowRight, Link as LinkIcon } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";

interface GalleryPhoto {
  id: number;
  title: string;
  category: "Robot Specs" | "Outreach" | "Competition" | "CAD Design";
  date: string;
  location: string;
  desc: string;
  colorClass: string; // fallback stylized color block
  imageUrl?: string;
}

const MOCK_PHOTOS: GalleryPhoto[] = [
  {
    id: 1,
    title: "Mecanum Drivetrain EKF Calibration",
    category: "Robot Specs",
    date: "2026-04-10",
    location: "MARS Laboratory",
    desc: "Drive teams executing high-frequency odometry tests to reduce EKF state slip values.",
    colorClass: "from-ares-red/30 to-black/80 border-ares-red/20"
  },
  {
    id: 2,
    title: "Carbon Fiber Intake Sprockets",
    category: "Robot Specs",
    date: "2026-03-15",
    location: "ARES Machine Shop",
    desc: "CNC milled custom carbon-fiber sprockets for high-torque intake pivot controls.",
    colorClass: "from-ares-bronze/30 to-black/80 border-ares-bronze/20"
  },
  {
    id: 3,
    title: "Spark! WV Bridge Exhibit Launch",
    category: "Outreach",
    date: "2026-03-20",
    location: "Spark! Museum",
    desc: "ARES students teaching structural engineering principles using custom West Virginia bridge trusses.",
    colorClass: "from-ares-gold/20 to-black/80 border-ares-gold/25"
  },
  {
    id: 4,
    title: "High Submersible Ascension Hook",
    category: "Competition",
    date: "2026-04-28",
    location: "Championship Arena",
    desc: "ARES robot executing a perfect high-tower bar hang in the final 10 seconds of Qualifiers.",
    colorClass: "from-ares-red/45 to-black/90 border-ares-red/30"
  },
  {
    id: 5,
    title: "Draco-Compressed Chassis Assembly CAD",
    category: "CAD Design",
    date: "2026-02-18",
    location: "Onshape Cloud Engine",
    desc: "Direct browser visualization of our 18x18 FTC chassis assembly synced from Onshape.",
    colorClass: "from-ares-bronze/45 to-black/90 border-ares-bronze/30"
  },
  {
    id: 6,
    title: "Vertex AI Match Analytics Briefing",
    category: "Competition",
    date: "2026-05-12",
    location: "Strategy Warroom",
    desc: "Programmers and scouts analyzing BigQuery match logs to optimize autonomous target routes.",
    colorClass: "from-ares-gold/30 to-black/90 border-ares-gold/20"
  }
];

export default function GalleryPage() {
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredPhotos = activeCategory === "all"
    ? MOCK_PHOTOS
    : MOCK_PHOTOS.filter(p => p.category === activeCategory);

  const handleNextPhoto = () => {
    if (!selectedPhoto) return;
    const currentIdx = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
    const nextIdx = (currentIdx + 1) % filteredPhotos.length;
    setSelectedPhoto(filteredPhotos[nextIdx]);
  };

  const handlePrevPhoto = () => {
    if (!selectedPhoto) return;
    const currentIdx = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
    const prevIdx = (currentIdx - 1 + filteredPhotos.length) % filteredPhotos.length;
    setSelectedPhoto(filteredPhotos[prevIdx]);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      {/* Hero Header */}
      <section className="py-28 bg-obsidian relative overflow-hidden flex items-center min-h-[50vh]">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute top-0 left-0" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <p className="text-ares-bronze uppercase tracking-[0.4em] text-[10px] font-black font-heading mb-4 animate-pulse">
            Visual Match & Build Archives
          </p>
          <h1 className="text-4xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading">
            Team <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-xl text-white">Gallery</span>
          </h1>
          <p className="text-marble/85 text-base md:text-lg max-w-2xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6">
            Explore behind the scenes of ARES #23247. A rich chronological log documenting our journey from raw Onshape CAD models and machining to our live championship performances.
          </p>
        </div>
      </section>

      {/* Gallery Media Grid */}
      <section className="py-12 bg-black/10 border-y border-white/5 min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Header Controls & Dynamic Filter Selector */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-white/5 pb-6">
            <div className="flex flex-wrap gap-2">
              {["all", "Robot Specs", "Outreach", "Competition", "CAD Design"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                    activeCategory === cat
                      ? "bg-ares-red text-white"
                      : "bg-white/5 text-marble/45 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {cat === "all" ? "All Media" : cat}
                </button>
              ))}
            </div>

            <a
              href="https://photos.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white/5 border border-white/10 text-white text-[9px] font-black uppercase tracking-widest ares-cut-sm flex items-center gap-2 hover:border-ares-gold transition-colors"
            >
              <LinkIcon size={10} className="text-ares-gold" />
              Community Google Photos Album
            </a>
          </div>

          {/* CSS Columns Masonry Grid (Zero CLS) */}
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
            {filteredPhotos.map((photo, idx) => {
              // Assign varying aspect ratios for masonry visualization
              const aspects = ["aspect-[4/3]", "aspect-[3/4]", "aspect-[4/5]", "aspect-square"];
              const assignedAspect = aspects[idx % aspects.length];

              return (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className={`w-full overflow-hidden ares-cut border relative group cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(192,0,0,0.15)] bg-gradient-to-br ${photo.colorClass} ${assignedAspect} flex flex-col justify-end p-6`}
                >
                  {/* Subtle backdrop overlay */}
                  <div className="absolute inset-0 bg-black/45 group-hover:bg-black/20 transition-colors duration-500 z-0"></div>

                  <div className="relative z-10 space-y-2 text-left">
                    <span className="px-2 py-0.5 bg-ares-red text-white text-[7px] font-black uppercase tracking-wider rounded-md">
                      {photo.category}
                    </span>
                    <h3 className="text-base font-black text-white font-heading leading-tight uppercase group-hover:text-ares-gold transition-colors">
                      {photo.title}
                    </h3>
                    <p className="text-[10px] text-marble/60 line-clamp-2">
                      {photo.desc}
                    </p>
                    <div className="flex items-center gap-1.5 text-[8px] text-marble/45 font-mono pt-1.5">
                      <MapPin size={8} className="text-ares-red" />
                      <span>{photo.location}</span>
                      <span>&middot;</span>
                      <span>{photo.date}</span>
                    </div>
                  </div>

                  {/* Absolute Zoom Indicator Overlay */}
                  <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Eye size={12} className="text-white" />
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* Fullscreen Photo Lightbox Dialog Overlay */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/95 backdrop-blur-md"
            onClick={() => setSelectedPhoto(null)}
          />
          
          <div className="relative w-full max-w-4xl bg-obsidian border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col items-center justify-between z-50 min-h-[50vh] max-h-[90vh]">
            {/* Header controls */}
            <div className="w-full flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div>
                <span className="px-2.5 py-0.5 bg-ares-red text-white text-[8px] font-black uppercase tracking-widest rounded-md">
                  {selectedPhoto.category}
                </span>
                <span className="text-[10px] text-marble/40 font-mono ml-3">
                  Captured at {selectedPhoto.location} &middot; {selectedPhoto.date}
                </span>
              </div>
              <button
                aria-label="Close lightbox"
                onClick={() => setSelectedPhoto(null)}
                className="text-marble/55 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Central Graphic Container */}
            <div className={`w-full max-w-lg aspect-video bg-gradient-to-br ${selectedPhoto.colorClass} border border-white/5 rounded-2xl flex flex-col justify-center items-center p-8 text-center relative overflow-hidden my-4 shadow-inner`}>
              <div className="absolute inset-0 bg-black/60 z-0"></div>
              <div className="relative z-10 space-y-4">
                <span className="text-ares-gold/20 block font-heading text-7xl font-bold uppercase tracking-tight select-none">
                  ARES
                </span>
                <h3 className="text-2xl font-black text-white uppercase font-heading tracking-tight max-w-sm mx-auto leading-tight">
                  {selectedPhoto.title}
                </h3>
              </div>
            </div>

            {/* Bottom Details and Navigation */}
            <div className="w-full border-t border-white/5 pt-4 mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-marble/80 text-left max-w-xl">
                <strong>Description:</strong> {selectedPhoto.desc}
              </p>

              {/* Navigation arrows */}
              <div className="flex items-center gap-2 bg-black/45 border border-white/5 p-1 rounded-xl">
                <button
                  onClick={handlePrevPhoto}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 hover:text-ares-gold cursor-pointer transition-colors"
                >
                  <ArrowLeft size={14} />
                </button>
                <span className="text-[10px] font-mono text-marble/45 px-2">
                  {filteredPhotos.findIndex(p => p.id === selectedPhoto.id) + 1} / {filteredPhotos.length}
                </span>
                <button
                  onClick={handleNextPhoto}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 hover:text-ares-gold cursor-pointer transition-colors"
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
