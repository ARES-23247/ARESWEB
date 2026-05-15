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

  return (
    <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8 overflow-hidden">
      <SEO
        title={album.title}
        description={album.description || `View the ${album.title} photo album from ARES 23247.`}
      />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-16">
        <Link
          to="/albums"
          className="inline-flex items-center justify-center gap-4 px-8 py-3 ares-cut-sm bg-black/40 border border-white/5 text-ares-cyan font-black uppercase tracking-[0.2em] text-[10px] hover:bg-ares-cyan hover:text-black transition-all duration-500 shadow-lg shadow-ares-cyan/10 mb-16 backdrop-blur-sm group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-2 transition-transform" />
          Back to Archives
        </Link>

        <div className="mb-20">
          <div className="bg-ares-cyan/10 text-ares-cyan px-4 py-1 ares-cut-sm font-black uppercase tracking-[0.3em] text-[10px] border border-ares-cyan/20 inline-block mb-8 shadow-[0_0_20px_rgba(0,192,192,0.1)]">
             Mission Log // Imagery
          </div>
          <h1 className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter leading-none mb-8">
            {album.title}
          </h1>
          {album.description && (
            <p className="text-marble/40 text-xl max-w-3xl font-medium leading-relaxed">{album.description}</p>
          )}
        </div>

        {media.length === 0 ? (
          <div className="bg-black/40 border border-white/5 ares-cut-lg p-20 text-center text-marble/20 backdrop-blur-sm">
            <Images className="mx-auto mb-8 opacity-10" size={80} />
            <p className="font-black uppercase tracking-[0.4em] text-xs">This vault is currently empty //</p>
          </div>
        ) : (
          <MasonryLayout media={media} onOpenLightbox={openLightbox} />
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
            className="w-full text-left break-inside-avoid relative group overflow-hidden ares-cut-lg border border-white/5 bg-black/40 mb-8 cursor-pointer transition-all duration-700 hover:border-ares-red/30 hover:shadow-[0_20px_40px_rgba(192,0,0,0.15)]"
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
            <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="w-14 h-14 rounded-full bg-ares-red/20 backdrop-blur-md flex items-center justify-center border border-ares-red/30 scale-90 group-hover:scale-100 transition-transform duration-500">
                <Maximize2 className="w-6 h-6 text-white" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
