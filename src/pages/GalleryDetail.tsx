import SEO from "../components/SEO";
import { useGetGallery, type Gallery } from "../api";
import { Images, ExternalLink, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export default function GalleryDetail({ id }: { id: string }) {
  const { data: galleryResponse, isLoading } = useGetGallery(id);
  const gallery = (galleryResponse as unknown as { gallery: Gallery } | null)?.gallery ?? null;

  if (isLoading) {
    return (
      <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8">
        <div className="w-full max-w-4xl mx-auto px-6 py-24 flex justify-center">
          <div className="w-12 h-12 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
        </div>
      </main>
    );
  }

  if (!gallery) {
    return (
      <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8">
        <div className="w-full max-w-4xl mx-auto px-6 py-24">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Gallery Not Found</h1>
            <Link to="/galleries" className="text-ares-cyan hover:text-white transition-colors">
              ← Back to Galleries
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO
        title={gallery.title}
        description={gallery.description || `View the ${gallery.title} photo gallery from ARES 23247.`}
      />
      <div className="w-full max-w-4xl mx-auto px-6 py-12 md:py-24">
        <Link
          to="/galleries"
          className="inline-flex items-center gap-2 text-ares-cyan hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Galleries
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tighter mb-4">
            {gallery.title}
          </h1>
          {gallery.description && (
            <p className="text-white/60 text-lg">{gallery.description}</p>
          )}
        </div>

        {gallery.heroImageUrl && (
          <div className="mb-8 rounded-lg overflow-hidden ares-cut-sm border border-white/10">
            <img
              src={gallery.heroImageUrl}
              alt={gallery.title}
              className="w-full"
            />
          </div>
        )}

        {gallery.googlePhotosUrl && (
          <div className="bg-ares-cyan/10 border border-ares-cyan/30 ares-cut-sm p-8 text-center">
            <Images className="text-ares-cyan mx-auto mb-4" size={48} />
            <h2 className="text-xl font-bold text-white mb-2">View Full Gallery</h2>
            <p className="text-white/60 mb-6">
              This gallery is hosted on Google Photos. Click the button below to view all photos.
            </p>
            <a
              href={gallery.googlePhotosUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-ares-cyan hover:bg-ares-cyan/80 text-black font-bold py-3 px-6 ares-cut-sm transition-all"
            >
              <ExternalLink size={18} />
              Open in Google Photos
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
