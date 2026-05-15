import SEO from "../components/SEO";
import { useGetAlbum, type AlbumDetail as AlbumDetailType } from "../api/albums";
import { ArrowLeft, Images } from "lucide-react";
import { Link } from "@tanstack/react-router";

export default function AlbumDetail({ id }: { id: string }) {
  const { data: albumResponse, isLoading } = useGetAlbum(id);
  const album = albumResponse?.album ?? null;

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
              <MasonryLayout media={media} />
            ) : (
              <MovingLayout media={media} />
            )}
          </>
        )}
      </div>
    </main>
  );
}

// Masonry Layout
function MasonryLayout({ media }: { media: NonNullable<AlbumDetailType["media"]> }) {
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
      {media.map((item) => (
        <div key={item.id} className="break-inside-avoid relative group overflow-hidden ares-cut-sm border border-white/10">
          <img
            src={`/api/media/${encodeURIComponent(item.photo?.r2Key ?? item.id)}`}
            alt={item.photo?.filename || "Album photo"}
            className="w-full h-auto block transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
             <a href={`/api/media/${encodeURIComponent(item.photo?.r2Key ?? item.id)}`} target="_blank" rel="noopener noreferrer" className="bg-ares-gold text-black font-bold uppercase tracking-widest text-xs px-4 py-2 ares-cut-sm opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
               View Full
             </a>
          </div>
        </div>
      ))}
    </div>
  );
}

// Moving Carousel Layout (GPU Accelerated)
function MovingLayout({ media }: { media: NonNullable<AlbumDetailType["media"]> }) {
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
        {carouselItems.map((item, index) => (
          <div 
            key={`${item.id}-${index}`} 
            className="px-4 w-[80vw] sm:w-[50vw] md:w-[35vw] lg:w-[25vw] flex-shrink-0 group"
          >
            <div className="relative overflow-hidden ares-cut-sm border border-white/10 aspect-[4/3]">
              <img
                src={`/api/media/${encodeURIComponent(item.photo?.r2Key ?? item.id)}`}
                alt={item.photo?.filename || "Album photo"}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <a href={`/api/media/${encodeURIComponent(item.photo?.r2Key ?? item.id)}`} target="_blank" rel="noopener noreferrer" className="bg-ares-gold text-black font-bold uppercase tracking-widest text-xs px-4 py-2 ares-cut-sm opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                  View Full
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
