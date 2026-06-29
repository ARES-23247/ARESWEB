"use client";

import React, { useState, useEffect, useCallback } from "react";
import { authenticatedFetch } from "@/lib/api";
import { Eye, MapPin, X, ArrowLeft, ArrowRight, Link as LinkIcon } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import SEO from "@/components/SEO";
import * as Dialog from "@radix-ui/react-dialog";

interface GalleryPhoto {
  id: number;
  title: string;
  category: "Robot Specs" | "Outreach" | "Competition" | "CAD Design" | "Practice";
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
  const [photos, setPhotos] = useState<GalleryPhoto[]>(MOCK_PHOTOS);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPhotos() {
      try {
        const res = await fetch("/api/photos/public");
        if (res.ok) {
          const data = await res.json();
          if (data.photos && data.photos.length > 0) {
            const mapped: GalleryPhoto[] = data.photos.map((p: any, idx: number) => {
              const gradients = [
                "from-ares-red/30 to-black/80 border-ares-red/20",
                "from-ares-bronze/30 to-black/80 border-ares-bronze/20",
                "from-ares-gold/20 to-black/80 border-ares-gold/25",
                "from-ares-red/45 to-black/90 border-ares-red/30"
              ];
              const colorClass = gradients[idx % gradients.length];

              // Clean up Google file uuid prefix for cleaner titles
              let titleClean = p.originalFilename || "ARES Archive";
              if (titleClean.includes("-")) {
                const parts = titleClean.split("-");
                if (parts[0].length > 20) {
                  titleClean = parts.slice(1).join("-");
                }
              }
              titleClean = titleClean.replace(/\.[^/.]+$/, "");

              // Standard category mapping
              let category: GalleryPhoto["category"] = "Robot Specs";
              if (p.albumId === "robot-specs" || p.albumId === "Robot Specs") category = "Robot Specs";
              else if (p.albumId === "outreach" || p.albumId === "Outreach") category = "Outreach";
              else if (p.albumId === "competition" || p.albumId === "Competition") category = "Competition";
              else if (p.albumId === "cad-design" || p.albumId === "CAD Design") category = "CAD Design";
              else if (p.albumId === "practice" || p.albumId === "Practice") category = "Practice";

              return {
                id: p.id,
                title: titleClean,
                category,
                date: p.importedAt ? p.importedAt.split("T")[0] : new Date().toISOString().split("T")[0],
                location: "MARS Laboratory",
                desc: p.description || "Google Photos synced engineering archive log.",
                colorClass,
                imageUrl: p.publicUrl,
              };
            });
            setPhotos(mapped);
          } else {
            setPhotos(MOCK_PHOTOS);
          }
        } else {
          setPhotos(MOCK_PHOTOS);
        }
      } catch (err) {
        console.warn("Failed to load synced photos from API:", err);
        setPhotos(MOCK_PHOTOS);
      } finally {
        setIsLoading(false);
      }
    }
    loadPhotos();
  }, []);

  const filteredPhotos = activeCategory === "all"
    ? photos
    : photos.filter(p => p.category === activeCategory);

  const handleNextPhoto = useCallback(() => {
    if (!selectedPhoto) return;
    const currentIdx = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
    const nextIdx = (currentIdx + 1) % filteredPhotos.length;
    setSelectedPhoto(filteredPhotos[nextIdx]);
  }, [selectedPhoto, filteredPhotos]);

  const handlePrevPhoto = useCallback(() => {
    if (!selectedPhoto) return;
    const currentIdx = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
    const prevIdx = (currentIdx - 1 + filteredPhotos.length) % filteredPhotos.length;
    setSelectedPhoto(filteredPhotos[prevIdx]);
  }, [selectedPhoto, filteredPhotos]);

  useEffect(() => {
    if (!selectedPhoto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrevPhoto();
      if (e.key === "ArrowRight") handleNextPhoto();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPhoto, handlePrevPhoto, handleNextPhoto]);

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      <SEO title="Photo Gallery" description="Behind the scenes of ARES 23247. A visual build log documenting our journey from raw Onshape CAD models and machining to our live championship performances." />
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
              {["all", "Robot Specs", "Outreach", "Competition", "CAD Design", "Practice"].map(cat => (
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

            {/* Removed obsolete Community Google Photos Album link */}
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
                  tabIndex={0}
                  role="button"
                  aria-label={`Open lightbox for ${photo.title}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedPhoto(photo);
                    }
                  }}
                  className={`w-full overflow-hidden ares-cut border relative group cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(192,0,0,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan bg-gradient-to-br ${photo.colorClass} ${assignedAspect} flex flex-col justify-end p-6`}
                >
                  {/* Real Image Render with subtle zoom */}
                  {photo.imageUrl ? (
                    <img
                      src={photo.imageUrl}
                      alt={photo.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-85 group-hover:scale-105 transition-all duration-500 z-0"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-black/45 group-hover:bg-black/20 transition-colors duration-500 z-0"></div>
                  )}

                  <div className="relative z-10 space-y-2 text-left bg-black/60 p-3 rounded-lg border border-white/5 backdrop-blur-[2px] w-full">
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
                  <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                    <Eye size={12} className="text-white" />
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* Fullscreen Photo Lightbox Dialog Overlay */}
      <Dialog.Root open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 animate-fade-in" />
          <Dialog.Content 
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                handlePrevPhoto();
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                handleNextPhoto();
              }
            }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-obsidian border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col items-center justify-between z-50 min-h-[50vh] max-h-[90vh] focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan animate-scale-in"
          >
            {selectedPhoto && (
              <>
                <Dialog.Title className="sr-only">
                  {selectedPhoto.title}
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  {selectedPhoto.desc}
                </Dialog.Description>
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
                  <Dialog.Close asChild>
                    <button
                      aria-label="Close lightbox"
                      className="text-marble/55 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan rounded"
                    >
                      <X size={20} />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Central Graphic Container */}
                <div className="w-full max-w-xl aspect-video bg-black border border-white/5 rounded-2xl relative overflow-hidden my-4 shadow-inner flex items-center justify-center">
                  {selectedPhoto.imageUrl ? (
                    <img
                      src={selectedPhoto.imageUrl}
                      alt={selectedPhoto.title}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${selectedPhoto.colorClass} flex flex-col justify-center items-center p-8 text-center`}>
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
                  )}
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
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 hover:text-ares-gold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan"
                      aria-label="Previous photo"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <span className="text-[10px] font-mono text-marble/45 px-2">
                      {filteredPhotos.findIndex(p => p.id === selectedPhoto.id) + 1} / {filteredPhotos.length}
                    </span>
                    <button
                      onClick={handleNextPhoto}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 hover:text-ares-gold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan"
                      aria-label="Next photo"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
}
