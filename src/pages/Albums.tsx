import SEO from "../components/SEO";
import { useGetAlbums } from "../api/albums";
import { Images } from "lucide-react";
import { Link } from "@tanstack/react-router";

export default function Albums() {
  const { data: albumsResponse, isLoading } = useGetAlbums();
  const albums = albumsResponse?.albums ?? [];

  return (
    <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO
        title="Photo Albums"
        description="Browse ARES 23247's photo albums documenting our journey through FIRST Tech Challenge."
      />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-24">
        <div className="mb-20">
          <div className="bg-ares-gold/10 text-ares-gold px-6 py-2 ares-cut-sm font-black uppercase tracking-[0.4em] text-[10px] mb-8 border border-ares-gold/20 inline-block">
             Visual Archives // Chronicles
          </div>
          <h1 className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter leading-none mb-8">
            Photo <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-marble/20">Albums</span>
          </h1>
          <p className="text-marble/40 text-xl max-w-2xl font-medium leading-relaxed">
            Explore our native photo albums showcasing team events, build seasons, competitions, and community outreach.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
          </div>
        ) : albums.length === 0 ? (
          <div className="text-marble/50 italic text-center py-12 font-medium">
            No albums available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {albums.map((album) => (
              <Link
                key={album.id}
                to="/albums/$id"
                params={{ id: album.id }}
                className="group bg-black/40 border border-white/5 ares-cut-lg overflow-hidden hover:border-ares-gold/30 transition-all duration-700 hover:shadow-[0_20px_40px_rgba(212,175,55,0.1)] flex flex-col backdrop-blur-sm"
              >
                {album.coverImageId ? (
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={`/api/media/${album.coverImageId}`}
                      alt={album.title}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                      <h2 className="text-white font-black text-2xl uppercase tracking-tighter drop-shadow-2xl">{album.title}</h2>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-black/60 flex flex-col items-center justify-center relative">
                    <Images className="text-ares-gold/20 w-16 h-16 group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                      <h2 className="text-white font-black text-2xl uppercase tracking-tighter drop-shadow-2xl">{album.title}</h2>
                    </div>
                  </div>
                )}
                <div className="p-8 flex-1 flex flex-col">
                  {album.description ? (
                    <p className="text-marble/40 text-sm mb-8 line-clamp-2 font-medium leading-relaxed">{album.description}</p>
                  ) : (
                    <p className="text-marble/20 italic text-sm mb-8 font-medium">No description provided for this mission log.</p>
                  )}
                  <div className="mt-auto pt-6 border-t border-white/5 text-[10px] uppercase font-black tracking-[0.2em] text-white/20 group-hover:text-ares-gold transition-colors flex items-center gap-2">
                    Access Album <span className="text-lg">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
