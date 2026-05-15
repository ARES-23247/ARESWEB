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
          <Card key={stat.label} className="bg-ares-gray-dark/30 border-white/5 ares-cut-sm p-4 text-center" decoration="top" decorationColor={stat.color}>
            <Text className="text-marble/60 uppercase tracking-widest font-bold text-[10px] mb-1">{stat.label}</Text>
            <Metric className="text-white font-black text-2xl">{stat.value}</Metric>
          </Card>
        ))}
      </Grid>
    </div>
  );
}
