/* eslint-disable @typescript-eslint/no-explicit-any */
import SEO from "../components/SEO";
import LazyImage from "../components/LazyImage";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface R2MediaResponse {
  media: {
    key: string;
    size: number;
    uploaded: string;
    httpMetadata: {
      contentType: string;
    };
  }[];
}

export default function Gallery() {
  const { data: mediaRes, isLoading, isError } = api.media.getMedia.useQuery({}, {
    queryKey: ["media"],
  });

  const data = mediaRes?.status === 200 ? mediaRes.body : null;

  // Filter only images and reverse to show newest first
  const photos = data?.media
    ?.filter((m: any) => m.httpMetadata?.contentType?.startsWith("image/"))
    ?.reverse() || [];

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO title="Team Gallery" description="Explore behind the scenes of ARES 23247. From raw CAD prototypes and machining directly to the qualification arenas." />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-24">
      <div className="mb-12">
        <h3 className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-2">Build Season &amp; Comps</h3>
        <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tighter shadow-sm">
          Team <span className="text-red-500">Gallery</span>
        </h1>
        <p className="text-white/60 mt-4 max-w-2xl text-balance">
          Explore behind the scenes of ARES 23247. From raw CAD prototypes and machining all the way to performing under the bright lights of our qualification arenas.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-white/10 border-t-ares-red rounded-full animate-spin"></div>
        </div>
      ) : isError ? (
        <div className="text-white bg-red-900/40 border border-red-500/50 ares-cut-sm p-4 font-bold text-center">
          Failed to load gallery images. Please try again later.
        </div>
      ) : photos.length === 0 ? (
        <div className="text-marble/50 italic text-center py-12 font-medium">No photos found in the ARES gallery.</div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          {photos.map((photo: any, index: any) => {
            // Assign varying aspect ratios for masonry visualization
            const aspects = ["aspect-video", "aspect-[3/4]", "aspect-[4/5]", "aspect-square"];
            const assignedAspect = aspects[index % aspects.length];

            return (
              <div
                key={photo.key}
                className={`relative w-full overflow-hidden ares-cut glass-card group cursor-pointer transition-transform duration-500 hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(220,38,38,0.1)] ${assignedAspect}`}
              >
                <LazyImage 
                   src={`/api/media/${photo.key}`} 
                   alt={photo.key} 
                   className="absolute inset-0 w-full h-full"
                   imgClassName="transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                  <p className="text-white font-medium text-sm drop-shadow-md truncate w-full">{photo.key.split("-").slice(1).join("-")}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
