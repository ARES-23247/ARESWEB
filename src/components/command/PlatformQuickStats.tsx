import { Zap } from "lucide-react";
import { Card, Metric, Text, Grid, Color } from "@tremor/react";

interface PlatformQuickStatsProps {
  stats: Record<string, number>;
}

export default function PlatformQuickStats({ stats }: PlatformQuickStatsProps) {
  const data: { label: string; value: number; color: Color }[] = [
    { label: "Blog Posts", value: stats.posts || 0, color: "red" },
    { label: "Events", value: stats.events || 0, color: "amber" },
    { label: "Docs", value: stats.docs || 0, color: "cyan" },
    { label: "Sec Blocks", value: stats.securityBlocks || 0, color: "emerald" },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2 mb-2 ml-1">
        <Zap size={16} className="text-ares-gold" />
        Platform Stats
      </h3>
      <Grid numItems={2} numItemsSm={2} numItemsLg={4} className="gap-4">
        {data.map(stat => (
          <Card key={stat.label} className="bg-ares-gray-dark/30 border-white/5 ares-cut-sm p-4 text-center group hover:bg-ares-gray-dark/50 hover:border-white/20 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden" decoration="top" decorationColor={stat.color}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Text className="text-marble/60 uppercase tracking-widest font-bold text-[10px] mb-1 group-hover:text-marble transition-colors duration-300 relative z-10">{stat.label}</Text>
            <Metric className="text-white font-black text-2xl relative z-10 group-hover:scale-105 transition-transform duration-300 origin-center">{stat.value}</Metric>
          </Card>
        ))}
      </Grid>
    </div>
  );
}
