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
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-24">
        <div className="mb-20">
          <div className="bg-ares-gold/10 text-ares-gold px-6 py-2 ares-cut-sm font-black uppercase tracking-[0.4em] text-[10px] mb-8 border border-ares-gold/20 inline-block">
             Cine-Log // Operations
          </div>
          <h1 className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter leading-none mb-8">
            Team <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-marble/20">Videos</span>
          </h1>
          <p className="text-marble/40 text-xl max-w-2xl font-medium leading-relaxed">
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
                className="group bg-black/40 border border-white/5 ares-cut-lg overflow-hidden transition-all duration-700 hover:border-ares-red/30 hover:shadow-[0_20px_40px_rgba(192,0,0,0.15)] backdrop-blur-sm"
              >
                <div className="relative aspect-video overflow-hidden bg-black/60">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className={`text-6xl ${getPlatformColor(video.platform)}`}>
                        {getPlatformIcon(video.platform)}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                    <div className="w-16 h-16 bg-ares-red/90 ares-cut flex items-center justify-center scale-90 group-hover:scale-100 transition-transform duration-500">
                      <Play className="text-white ml-1 fill-white" size={24} />
                    </div>
                  </div>
                  <div className="absolute top-4 left-4">
                    <span className={`text-[8px] uppercase font-black tracking-[0.2em] bg-black/80 px-3 py-1 ares-cut-sm border border-white/10 ${getPlatformColor(video.platform)}`}>
                      {video.platform}
                    </span>
                  </div>
                </div>
                <div className="p-8">
                  <h2 className="text-white font-black text-lg mb-3 line-clamp-2 uppercase tracking-tighter leading-tight group-hover:text-ares-red transition-colors">{video.title}</h2>
                  {video.description && (
                    <p className="text-marble/40 text-xs font-medium line-clamp-2 leading-relaxed">{video.description}</p>
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
