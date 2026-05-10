import { useState } from "react";
import { format, subMonths } from "date-fns";
import {
  TrendingUp,
  Send,
  Clock,
  AlertCircle,
  CheckCircle2,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Filter,
} from "lucide-react";
import { useGetSocialAnalytics } from "../../api/socialQueue";

interface SocialAnalyticsProps {
  dateRange?: { start: string; end: string };
}

// Platform colors
const PLATFORM_COLORS: Record<string, string> = {
  twitter: "bg-black",
  bluesky: "bg-social-bluesky",
  facebook: "bg-social-facebook",
  instagram: "bg-gradient-to-br from-purple-500 to-pink-500",
  discord: "bg-social-discord",
  slack: "bg-social-slack",
  teams: "bg-social-teams",
  gchat: "bg-social-googlechat",
  linkedin: "bg-social-linkedin",
  tiktok: "bg-social-tiktok",
  band: "bg-social-band",
};

export default function SocialAnalytics({ dateRange }: SocialAnalyticsProps) {
  const [selectedRange, setSelectedRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

  // Calculate date range
  const getRangeDates = () => {
    const now = new Date();
    switch (selectedRange) {
      case "7d":
        return { start: format(subMonths(now, 0), "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
      case "30d":
        return { start: format(subMonths(now, 1), "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
      case "90d":
        return { start: format(subMonths(now, 3), "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
      case "all":
        return { start: undefined, end: undefined };
      default:
        return { start: undefined, end: undefined };
    }
  };

  const rangeDates = dateRange || getRangeDates();

  const { data: analytics, isLoading } = useGetSocialAnalytics(rangeDates);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2 bg-white/5 ares-cut-sm p-1">
          {(["7d", "30d", "90d", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider ares-cut-sm transition-all ${
                selectedRange === range
                  ? "bg-ares-cyan text-black"
                  : "text-marble/60 hover:text-white"
              }`}
            >
              {range === "all" ? "All Time" : range}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-marble/60">Loading analytics...</div>
      ) : analytics ? (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-obsidian border border-white/10 ares-cut-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-ares-cyan/20 text-ares-cyan ares-cut-sm">
                  <Send size={20} />
                </div>
                <div>
                  <p className="text-xs text-marble/60 uppercase tracking-wider font-bold">Total Posts</p>
                  <p className="text-2xl font-black text-white">{analytics.totalPosts}</p>
                </div>
              </div>
            </div>
            <div className="bg-obsidian border border-white/10 ares-cut-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 text-green-500 ares-cut-sm">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="text-xs text-marble/60 uppercase tracking-wider font-bold">Sent</p>
                  <p className="text-2xl font-black text-white">{analytics.totalSent}</p>
                </div>
              </div>
            </div>
            <div className="bg-obsidian border border-white/10 ares-cut-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-ares-gold/20 text-ares-gold ares-cut-sm">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-xs text-marble/60 uppercase tracking-wider font-bold">Pending</p>
                  <p className="text-2xl font-black text-white">{analytics.totalPending}</p>
                </div>
              </div>
            </div>
            <div className="bg-obsidian border border-white/10 ares-cut-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-ares-red/20 text-ares-red ares-cut-sm">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <p className="text-xs text-marble/60 uppercase tracking-wider font-bold">Failed</p>
                  <p className="text-2xl font-black text-white">{analytics.totalFailed}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Engagement Metrics */}
          <div className="bg-obsidian border border-white/10 ares-cut-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="text-ares-gold" size={20} />
              Engagement Metrics
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/5 ares-cut-sm p-4 text-center">
                <Eye className="mx-auto text-ares-cyan mb-2" size={24} />
                <p className="text-2xl font-black text-white">{analytics.engagement.totalImpressions.toLocaleString()}</p>
                <p className="text-xs text-marble/60 uppercase tracking-wider">Impressions</p>
              </div>
              <div className="bg-white/5 ares-cut-sm p-4 text-center">
                <Heart className="mx-auto text-ares-red mb-2" size={24} />
                <p className="text-2xl font-black text-white">{analytics.engagement.totalLikes.toLocaleString()}</p>
                <p className="text-xs text-marble/60 uppercase tracking-wider">Likes</p>
              </div>
              <div className="bg-white/5 ares-cut-sm p-4 text-center">
                <Share2 className="mx-auto text-ares-gold mb-2" size={24} />
                <p className="text-2xl font-black text-white">{analytics.engagement.totalShares.toLocaleString()}</p>
                <p className="text-xs text-marble/60 uppercase tracking-wider">Shares</p>
              </div>
              <div className="bg-white/5 ares-cut-sm p-4 text-center">
                <MessageCircle className="mx-auto text-ares-cyan mb-2" size={24} />
                <p className="text-2xl font-black text-white">{analytics.engagement.totalComments.toLocaleString()}</p>
                <p className="text-xs text-marble/60 uppercase tracking-wider">Comments</p>
              </div>
            </div>
          </div>

          {/* Posts by Platform */}
          <div className="bg-obsidian border border-white/10 ares-cut-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Filter className="text-ares-bronze" size={20} />
              Posts by Platform
            </h3>
            <div className="space-y-3">
              {Object.entries(analytics.byPlatform)
                .filter(([_, count]) => (count as number) > 0)
                .sort(([_, a], [__, b]) => (b as number) - (a as number))
                .map(([platform, count]) => (
                  <div key={platform} className="flex items-center gap-3">
                    <div className={`w-8 h-8 ares-cut-sm ${PLATFORM_COLORS[platform]} flex items-center justify-center text-white text-xs font-bold uppercase`}>
                      {platform.slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-white capitalize">{platform}</span>
                        <span className="text-sm font-mono text-marble/60">{count as number}</span>
                      </div>
                      <div className="h-2 bg-white/10 ares-cut overflow-hidden">
                        <div
                          className={`h-full ${PLATFORM_COLORS[platform]}`}
                          style={{ width: `${((count as number) / analytics.totalPosts) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      ) : (
        <div className="p-8 text-center text-marble/60">
          No analytics data available for the selected period
        </div>
      )}
    </div>
  );
}
