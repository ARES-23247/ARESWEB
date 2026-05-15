import SEO from "../components/SEO";
import { useGetAlbum, type AlbumDetail as AlbumDetailType } from "../api/albums";
import { ArrowLeft, Images, Maximize2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import ImageLightbox from "../components/ImageLightbox";
import { useState } from "react";

export default function AlbumDetail({ id }: { id: string }) {
  const { data: albumResponse, isLoading } = useGetAlbum(id);
  const album = albumResponse?.album ?? null;

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

  if (isLoading) {
    return (
      <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8">
        <div className="w-full max-w-7xl mx-auto px-6 py-24 flex justify-center">
          <div className="w-12 h-12 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
        </div>
      </main>
    );
  }

  if (!album) {
    return (
      <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8">
        <div className="w-full max-w-4xl mx-auto px-6 py-24">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Album Not Found</h1>
            <Link to="/albums" className="text-ares-cyan hover:text-white transition-colors">
              ← Back to Albums
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const media = album.media || [];
  const displayMode = album.displayMode || "masonry";

  return (
    <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8 overflow-hidden">
      <SEO
        title={album.title}
        description={album.description || `View the ${album.title} photo album from ARES 23247.`}
      />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-16">
        <Link
          to="/albums"
          className="inline-flex items-center gap-2 text-ares-cyan hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Albums
        </Link>

        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tighter mb-4">
            {album.title}
          </h1>
          {album.description && (
            <p className="text-white/60 text-lg max-w-3xl">{album.description}</p>
          )}
        </div>

        {media.length === 0 ? (
          <div className="bg-black/40 border border-white/10 ares-cut-sm p-12 text-center text-white/50">
            <Images className="mx-auto mb-4 opacity-50" size={48} />
            <p className="font-mono">This album has no photos yet.</p>
          </div>
        ) : (
          <>
            {displayMode === "masonry" ? (
              <MasonryLayout media={media} onOpenLightbox={openLightbox} />
            ) : (
              <MovingLayout media={media} onOpenLightbox={openLightbox} />
            )}
          </>
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

// Masonry Layout
function MasonryLayout({ 
  media, 
  onOpenLightbox 
}: { 
  media: NonNullable<AlbumDetailType["media"]>;
  onOpenLightbox: (url: string, alt: string) => void;
}) {
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-6">
      {media.map((item) => {
        const imageUrl = `/api/media/${encodeURIComponent(item.photo?.r2Key ?? item.id)}`;
        const altText = item.photo?.filename || "Album photo";
        
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => onOpenLightbox(imageUrl, altText)}
            className="w-full text-left break-inside-avoid relative group overflow-hidden ares-cut-sm border border-white/10 bg-black/40 mb-6 cursor-pointer"
          >
            <img
              src={imageUrl}
              alt={altText}
              className="w-full h-auto block transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            {/* Gradient Overlay for Text */}
            <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
              <p className="text-white font-medium text-sm drop-shadow-md truncate w-full">{altText}</p>
            </div>
            {/* Zoom Icon Overlay */}
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 transform scale-90 group-hover:scale-100 transition-transform duration-300">
                <Maximize2 className="w-5 h-5 text-white" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Moving Carousel Layout (GPU Accelerated)
function MovingLayout({ 
  media, 
  onOpenLightbox 
}: { 
  media: NonNullable<AlbumDetailType["media"]>;
  onOpenLightbox: (url: string, alt: string) => void;
}) {
  // Duplicate media array to create seamless loop
  const carouselItems = [...media, ...media, ...media];

  return (
    <div className="relative w-[100vw] left-[50%] right-[50%] -ml-[50vw] -mr-[50vw] bg-black py-16 border-y border-white/10 overflow-hidden">
      {/* 
        Tailwind doesn't have a built-in infinite scroll animation by default without extending theme, 
        so we inject a small style block here just for this layout to ensure smooth GPU translation.
      */}
      <style>{`
        @keyframes scroll-infinite {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-33.333333%, 0, 0); }
        }
        .animate-scroll-infinite {
          animation: scroll-infinite 60s linear infinite;
        }
        .animate-scroll-infinite:hover {
          animation-play-state: paused;
        }
      `}</style>
      
      <div className="flex w-max animate-scroll-infinite items-center">
        {carouselItems.map((item, index) => {
          const imageUrl = `/api/media/${encodeURIComponent(item.photo?.r2Key ?? item.id)}`;
          const altText = item.photo?.filename || "Album photo";
          
          return (
            <div 
              key={`${item.id}-${index}`} 
              className="px-4 w-[80vw] sm:w-[50vw] md:w-[35vw] lg:w-[25vw] flex-shrink-0 group"
            >
              <button
                type="button"
                onClick={() => onOpenLightbox(imageUrl, altText)}
                className="w-full text-left relative overflow-hidden ares-cut-sm border border-white/10 aspect-[4/3] cursor-pointer"
              >
                <img
                  src={imageUrl}
                  alt={altText}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                {/* Gradient Overlay for Text */}
                <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                  <p className="text-white font-medium text-sm drop-shadow-md truncate w-full">{altText}</p>
                </div>
                {/* Zoom Icon Overlay */}
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 transform scale-90 group-hover:scale-100 transition-transform duration-300">
                    <Maximize2 className="w-5 h-5 text-white" />
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
