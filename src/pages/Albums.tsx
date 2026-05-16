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
        <div className="mb-12">
          <h3 className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-2">
            Visual Archives
          </h3>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tighter shadow-sm uppercase font-heading">
            Photo <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] text-white font-bold inline-block mt-2">Albums</span>
          </h1>
          <p className="text-white/60 mt-4 max-w-2xl text-balance">
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
                className="group bg-black/40 border border-white/10 ares-cut-sm overflow-hidden hover:border-ares-gold/50 transition-all hover:shadow-[0_0_30px_rgba(250,191,28,0.1)] flex flex-col"
              >
                {album.coverImageId ? (
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={`/api/media/${album.coverImageId}`}
                      alt={album.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                      <h2 className="text-white font-bold text-xl drop-shadow-md">{album.title}</h2>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-ares-gold/10 flex flex-col items-center justify-center relative">
                    <Images className="text-ares-gold/30 w-16 h-16" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                      <h2 className="text-white font-bold text-xl drop-shadow-md">{album.title}</h2>
                    </div>
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col">
                  {album.description ? (
                    <p className="text-white/60 text-sm mb-3 line-clamp-2">{album.description}</p>
                  ) : (
                    <p className="text-white/40 italic text-sm mb-3">No description provided.</p>
                  )}
                  <div className="mt-auto pt-2 text-ares-cyan text-xs uppercase font-bold tracking-wider flex items-center gap-1 group-hover:text-white transition-colors">
                    View Album →
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
