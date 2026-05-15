import SEO from "../components/SEO";
import ResponsiveImage from "../components/ResponsiveImage";
import ImageLightbox from "../components/ImageLightbox";
import { useGetMedia, useGetPublicSettings, type R2MediaItem } from "../api";
import { useState } from "react";

// Generate descriptive alt text for images with location context
function generateImageAlt(key: string, index: number): string {
  const cleanName = key.split("-").slice(1).join("-").replace(/\.[^/.]+$/, "") || `Robotics photo ${index + 1}`;

  // Add location context for SEO
  const locationContext = [
    "ARES 23247 robotics team",
    "Morgantown West Virginia",
    "FIRST Tech Challenge"
  ].join(", ");

  return `${cleanName} - ${locationContext}`;
}

export default function Gallery() {
  const { data: mediaRes, isLoading, isError } = useGetMedia();

  const { data: settingsRes } = useGetPublicSettings();

  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxImageAlt, setLightboxImageAlt] = useState<string>("");

  const openLightbox = (imageUrl: string, altText: string) => {
    setLightboxImageUrl(imageUrl);
    setLightboxImageAlt(altText);
  };

  const closeLightbox = () => {
    setLightboxImageUrl(null);
    setLightboxImageAlt("");
  };

  const data = mediaRes || null;
  const photoDriveUrl = settingsRes?.settings?.["COMMUNITY_PHOTO_DRIVE_URL"] || null;

  // Filter only images and reverse to show newest first
  const photos = data?.media
    ?.filter((m: R2MediaItem) => m.httpMetadata?.contentType?.startsWith("image/"))
    ?.reverse() || [];

  return (
    <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO title="Team Gallery" description="Explore behind the scenes of ARES 23247. From raw CAD prototypes and machining directly to the qualification arenas." />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-24">
      <div className="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div>
          <div className="bg-ares-gold/10 text-ares-gold px-6 py-2 ares-cut-sm font-black uppercase tracking-[0.4em] text-[10px] mb-8 border border-ares-gold/20 inline-block">
             Visual Archive // Build Season
          </div>
          <h1 className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter leading-none mb-8">
            Team <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-marble/20">Gallery</span>
          </h1>
          <p className="text-marble/40 text-xl max-w-2xl font-medium leading-relaxed">
            Explore behind the scenes of ARES 23247. From raw CAD prototypes and machining all the way to performing under the bright lights of our qualification arenas.
          </p>
        </div>
        {photoDriveUrl && (
          <div className="flex-shrink-0">
            <a
              href={String(photoDriveUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black/40 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] px-8 py-4 ares-cut-sm inline-flex items-center gap-3 transition-all duration-500 border border-white/5 hover:border-ares-gold group backdrop-blur-sm"
            >
              <svg className="w-4 h-4 text-ares-gold group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Community Photo Drive
            </a>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-white/10 border-t-ares-red rounded-full animate-spin"></div>
        </div>
      ) : isError ? (
        <div className="text-white bg-ares-red/40 border border-ares-red/50 ares-cut-sm p-4 font-bold text-center">
          Failed to load gallery images. Please try again later.
        </div>
      ) : photos.length === 0 ? (
        <div className="text-marble/50 italic text-center py-12 font-medium">No photos found in the ARES gallery.</div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          {photos.map((photo: R2MediaItem, index: number) => {
            // Assign varying aspect ratios for masonry visualization
            const aspects = ["aspect-video", "aspect-[3/4]", "aspect-[4/5]", "aspect-square"];
            const assignedAspect = aspects[index % aspects.length];
            const imageUrl = `/api/media/${photo.key}`;
            const altText = generateImageAlt(photo.key, index);

            return (
              <button
                key={photo.key}
                onClick={() => openLightbox(imageUrl, altText)}
                aria-label={`View ${altText} in full screen`}
                className={`relative w-full overflow-hidden ares-cut-lg bg-black/40 border border-white/5 group cursor-pointer transition-all duration-700 hover:-translate-y-2 hover:border-ares-red/30 hover:shadow-[0_20px_40px_rgba(192,0,0,0.15)] ${assignedAspect} p-0 backdrop-blur-sm`}
              >
                <ResponsiveImage
                   src={imageUrl}
                   alt={altText}
                   className="absolute inset-0 w-full h-full"
                   imgClassName="transition-transform duration-1000 group-hover:scale-110"
                />
                <div className="absolute inset-0 z-20 bg-gradient-to-t from-black via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-8">
                  <p className="text-white font-black text-[10px] uppercase tracking-[0.2em] truncate w-full drop-shadow-2xl">
                    {photo.key.split("-").slice(1).join("-").replace(/\.[^/.]+$/, "")}
                  </p>
                </div>
                <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="w-14 h-14 rounded-full bg-ares-red/20 backdrop-blur-md flex items-center justify-center border border-ares-red/30 scale-90 group-hover:scale-100 transition-transform duration-500">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v2m0-2h3m-3 0H7" />
                    </svg>
                  </div>
                </div>
              </button>
              );
            })}
        </div>
      )}
      </div>

      {/* Lightbox for viewing images */}
      {lightboxImageUrl && (
        <ImageLightbox
          isOpen={!!lightboxImageUrl}
          onClose={closeLightbox}
          imageUrl={lightboxImageUrl}
          imageAlt={lightboxImageAlt}
        />
      )}
    </main>
  );
}
