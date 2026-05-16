import SEO from "../components/SEO";
import { useGetVideos, type Video } from "../api";
import { Play } from "lucide-react";
import { Link } from "@tanstack/react-router";

export default function Videos() {
  const { data: videosResponse, isLoading } = useGetVideos();
  const videos = (videosResponse as unknown as { videos: Video[] })?.videos ?? [];

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "youtube": return "text-ares-red";
      case "vimeo": return "text-ares-cyan";
      default: return "text-white/60";
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "youtube": return "▶";
      case "vimeo": return "v";
      default: return "▶";
    }
  };

  return (
    <main id="main-content" className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO
        title="Videos"
        description="Watch ARES 23247's video collection including robot reveals, match footage, and team documentaries."
      />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-24">
        <div className="mb-12">
          <h3 className="text-ares-danger-soft font-bold uppercase tracking-widest text-sm mb-2">
            Moving Pictures
          </h3>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tighter shadow-sm uppercase font-heading">
            Team <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] text-white font-bold inline-block mt-2">Videos</span>
          </h1>
          <p className="text-white/60 mt-4 max-w-2xl text-balance">
            Watch robot reveals, match footage, and behind-the-scenes content from our journey through FIRST Tech Challenge.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-white/10 border-t-ares-red rounded-full animate-spin"></div>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-marble/50 italic text-center py-12 font-medium">
            No videos available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Link
                key={video.id}
                to="/videos/$id"
                params={{ id: video.id }}
                className="group bg-black/40 border border-white/10 ares-cut-sm overflow-hidden hover:border-ares-red/50 transition-all hover:shadow-[0_0_30px_rgba(220,38,38,0.1)]"
              >
                <div className="relative aspect-video overflow-hidden bg-black">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className={`text-6xl ${getPlatformColor(video.platform)}`}>
                        {getPlatformIcon(video.platform)}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-16 h-16 bg-ares-red/90 rounded-full flex items-center justify-center">
                      <Play className="text-white ml-1" size={24} />
                    </div>
                  </div>
                  <div className="absolute top-2 left-2">
                    <span className={`text-[10px] uppercase font-bold tracking-wider bg-black/60 px-2 py-1 rounded ${getPlatformColor(video.platform)}`}>
                      {video.platform}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h2 className="text-white font-bold text-lg mb-1 line-clamp-2">{video.title}</h2>
                  {video.description && (
                    <p className="text-white/60 text-sm line-clamp-2">{video.description}</p>
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
