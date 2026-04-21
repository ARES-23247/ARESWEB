import { Zap } from "lucide-react";

interface PlatformQuickStatsProps {
  stats: Record<string, number>;
}

export default function PlatformQuickStats({ stats }: PlatformQuickStatsProps) {
  return (
    <div className="bg-zinc-900/50 border border-white/5 ares-cut p-6">
      <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
        <Zap size={16} className="text-ares-gold" />
        Platform Stats
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Blog Posts", value: stats.posts || 0, color: "text-ares-red" },
          { label: "Events", value: stats.events || 0, color: "text-ares-gold" },
          { label: "Docs", value: stats.docs || 0, color: "text-ares-cyan" },
        ].map(stat => (
          <div key={stat.label} className="text-center p-4 bg-zinc-800/30 ares-cut-sm border border-white/5">
            <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
