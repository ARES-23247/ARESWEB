import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Zap, TrendingUp, AlertCircle, Cpu } from "lucide-react";

interface PerformanceSummary {
  lcp?: number;
  inp?: number;
  cls?: number;
  fcp?: number;
}

const VitalCard: React.FC<{
  name: string;
  value?: number;
  threshold: { good: number; poor: number };
  unit: string;
  icon: React.ReactNode;
}> = ({ name, value, threshold, unit, icon }) => {
  if (value === undefined) {
    return (
      <div className="bg-obsidian border border-white/10 ares-cut-lg p-4">
        <div className="flex items-center justify-between pb-2">
          <h3 className="text-sm font-bold text-white">{name}</h3>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-black text-marble/60">-</div>
          <p className="text-xs text-marble/60 uppercase tracking-wider mt-1">No data available</p>
        </div>
      </div>
    );
  }

  const isGood = value <= threshold.good;
  const isPoor = value > threshold.poor;
  const color = isGood ? "text-green-500" : isPoor ? "text-ares-red" : "text-ares-gold";
  const status = isGood ? "Good" : isPoor ? "Poor" : "Needs Improvement";

  return (
    <div className="bg-obsidian border border-white/10 ares-cut-lg p-4">
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-sm font-bold text-white">{name}</h3>
        {icon}
      </div>
      <div>
        <div className={`text-2xl font-black ${color}`}>
          {name === 'CLS' ? value.toFixed(3) : value.toFixed(0)} {unit}
        </div>
        <p className="text-xs text-marble/60 uppercase tracking-wider mt-1">{status}</p>
      </div>
    </div>
  );
};

export default function PerformanceDashboard() {
  const { data: metrics, error } = useQuery<PerformanceSummary>({
    queryKey: ['performance-metrics'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/performance/summary');
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    refetchInterval: 60000,
  });

  if (error) {
    return (
      <div className="bg-ares-red/10 border border-ares-red/30 ares-cut-sm p-4 flex gap-3 text-ares-red">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm font-bold uppercase tracking-wider">Failed to load performance metrics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-ares-red/20 to-red-900/20 ares-cut-sm border border-ares-red/20">
              <Cpu className="text-ares-red" size={28} />
            </div>
            Platform Performance
          </h2>
          <p className="text-marble/60 text-sm mt-2">
            Core Web Vitals and real-user monitoring data collected across all routes.
          </p>
        </div>
      </div>

      <section>
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="text-ares-cyan" size={20} />
          Core Web Vitals
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <VitalCard 
            name="Largest Contentful Paint (LCP)" 
            value={metrics?.lcp} 
            threshold={{ good: 2500, poor: 4000 }} 
            unit="ms"
            icon={<Zap className="h-4 w-4 text-marble/60" />}
          />
          <VitalCard 
            name="Interaction to Next Paint (INP)" 
            value={metrics?.inp} 
            threshold={{ good: 200, poor: 500 }} 
            unit="ms"
            icon={<Activity className="h-4 w-4 text-marble/60" />}
          />
          <VitalCard 
            name="Cumulative Layout Shift (CLS)" 
            value={metrics?.cls} 
            threshold={{ good: 0.1, poor: 0.25 }} 
            unit=""
            icon={<TrendingUp className="h-4 w-4 text-marble/60" />}
          />
          <VitalCard 
            name="First Contentful Paint (FCP)" 
            value={metrics?.fcp} 
            threshold={{ good: 1800, poor: 3000 }} 
            unit="ms"
            icon={<Zap className="h-4 w-4 text-marble/60" />}
          />
        </div>
      </section>

      <section className="mt-8">
        <h3 className="text-xl font-bold text-white mb-4">Bundle Size Monitoring</h3>
        <div className="bg-obsidian border border-white/10 ares-cut-lg p-4 flex gap-3 text-marble/90">
          <Activity className="h-5 w-5 shrink-0 text-ares-gold" />
          <p className="text-sm">
            Continuous bundle size monitoring is actively running in CI/CD. The baseline threshold is set to 10% maximum deviation.
            See GitHub Actions for detailed reports on each pull request.
          </p>
        </div>
      </section>
    </div>
  );
}
