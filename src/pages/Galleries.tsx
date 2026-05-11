import SEO from "../components/SEO";
import { useGetGalleries, type Gallery } from "../api";
import { Images, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";

export default function Galleries() {
  const { data: galleriesResponse, isLoading } = useGetGalleries();
  const galleries = (galleriesResponse as unknown as { galleries: Gallery[] })?.galleries ?? [];

  return (
    <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO
        title="Photo Galleries"
        description="Browse ARES 23247's photo galleries documenting our journey through FIRST Tech Challenge."
      />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-24">
        <div className="mb-12">
          <h3 className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-2">
            Visual Archives
          </h3>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tighter shadow-sm">
            Photo <span className="bg-ares-gold text-black px-2 py-0.5 ares-cut-sm shadow-inner font-bold">Galleries</span>
          </h1>
          <p className="text-white/60 mt-4 max-w-2xl text-balance">
            Explore our curated photo galleries showcasing team events, build seasons, competitions, and community outreach.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
          </div>
        ) : galleries.length === 0 ? (
          <div className="text-marble/50 italic text-center py-12 font-medium">
            No galleries available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleries.map((gallery) => (
              <Link
                key={gallery.id}
                to="/galleries/$id"
                params={{ id: gallery.id }}
                className="group bg-black/40 border border-white/10 ares-cut-sm overflow-hidden hover:border-ares-gold/50 transition-all hover:shadow-[0_0_30px_rgba(250,191,28,0.1)]"
              >
                {gallery.heroImageUrl ? (
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={gallery.heroImageUrl}
                      alt={gallery.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h2 className="text-white font-bold text-xl">{gallery.title}</h2>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-ares-gold/10 flex items-center justify-center">
                    <Images className="text-ares-gold/30 w-16 h-16" />
                  </div>
                )}
                <div className="p-4">
                  {gallery.description && (
                    <p className="text-white/60 text-sm mb-3 line-clamp-2">{gallery.description}</p>
                  )}
                  {gallery.googlePhotosUrl && (
                    <div className="flex items-center gap-1 text-ares-cyan text-xs uppercase font-bold tracking-wider">
                      <ExternalLink size={12} />
                      Google Photos
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
