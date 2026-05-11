import SEO from "../components/SEO";
import { useGetVideo, type Video } from "../api";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export default function VideoDetail({ id }: { id: string }) {
  const { data: videoResponse, isLoading } = useGetVideo(id);
  const video = (videoResponse as unknown as { video: Video } | null)?.video ?? null;

  if (isLoading) {
    return (
      <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8">
        <div className="w-full max-w-4xl mx-auto px-6 py-24 flex justify-center">
          <div className="w-12 h-12 border-4 border-white/10 border-t-ares-red rounded-full animate-spin"></div>
        </div>
      </main>
    );
  }

  if (!video) {
    return (
      <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8">
        <div className="w-full max-w-4xl mx-auto px-6 py-24">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Video Not Found</h1>
            <Link to="/videos" className="text-ares-danger-soft hover:text-white transition-colors">
              ← Back to Videos
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "youtube": return "text-ares-red";
      case "vimeo": return "text-ares-cyan";
      default: return "text-white/60";
    }
  };

  return (
    <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO
        title={video.title}
        description={video.description || `Watch ${video.title} from ARES 23247.`}
      />
      <div className="w-full max-w-4xl mx-auto px-6 py-12 md:py-24">
        <Link
          to="/videos"
          className="inline-flex items-center gap-2 text-ares-danger-soft hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Videos
        </Link>

        <div className="mb-6">
          <span className={`text-xs uppercase font-bold tracking-wider ${getPlatformColor(video.platform)}`}>
            {video.platform}
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tighter mb-4">
          {video.title}
        </h1>

        {video.description && (
          <p className="text-white/60 text-lg mb-6">{video.description}</p>
        )}

        {/* Video Embed */}
        <div className="aspect-video w-full bg-black rounded-lg overflow-hidden ares-cut-sm border border-white/10 mb-8">
          <iframe
            src={video.embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>

        {video.thumbnailUrl && (
          <div className="bg-white/5 border border-white/10 ares-cut-sm p-4 flex items-center gap-4">
            <img
              src={video.thumbnailUrl}
              alt={`${video.title} thumbnail`}
              className="w-32 h-20 object-cover rounded"
            />
            <div>
              <p className="text-white/60 text-sm">Custom thumbnail used for this video</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
