import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Users, Clock, ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface AnalyticsSummary {
  topPages: { path: string; category: string; views: number }[];
  recentViews: { path: string; category: string; user_agent: string; referrer: string; timestamp: string }[];
  totals: { category: string; total: number }[];
}

export default function AnalyticsDashboard() {
  const { data, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["analytics-summary"],
    queryFn: async () => {
      const r = await fetch("/api/admin/analytics/summary");
      if (!r.ok) throw new Error("Failed to fetch analytics");
      return r.json();
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-32 bg-white/5 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-white/5 rounded-3xl" />
          <div className="h-64 bg-white/5 rounded-3xl" />
        </div>
      </div>
    );
  }

  const categoryIcons: Record<string, any> = {
    doc: <BarChart3 className="text-ares-cyan" size={20} />,
    blog: <TrendingUp className="text-ares-gold" size={20} />,
    event: <Users className="text-ares-red" size={20} />,
    system: <Clock className="text-zinc-400" size={20} />,
  };

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data?.totals.map((t) => (
          <motion.div 
            key={t.category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 border border-white/5 p-6 rounded-3xl"
          >
            <div className="flex items-center gap-2 mb-2 opacity-50">
              {categoryIcons[t.category] || <BarChart3 size={16} />}
              <span className="text-[10px] font-bold uppercase tracking-widest">{t.category} Views</span>
            </div>
            <div className="text-3xl font-black text-white">{t.total.toLocaleString()}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Pages */}
        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-ares-gold" />
            Most Popular Content
          </h3>
          <div className="space-y-3">
            {data?.topPages.map((page, idx) => (
              <div key={page.path} className="flex items-center justify-between group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="text-xs font-mono text-zinc-600 w-4">0{idx + 1}</span>
                  <div className="flex flex-col truncate">
                    <Link to={page.path} className="text-sm text-zinc-300 hover:text-ares-gold transition-colors truncate flex items-center gap-1">
                      {page.path}
                      <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    <span className="text-[10px] uppercase text-zinc-600 font-bold tracking-tighter">{page.category}</span>
                  </div>
                </div>
                <div className="text-sm font-black text-white bg-white/5 px-2 py-1 rounded-lg">{page.views}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Interaction Feed */}
        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Clock size={20} className="text-ares-cyan" />
            Real-time Feed
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {data?.recentViews.map((view, idx) => (
              <div key={idx} className="flex flex-col gap-1 border-l border-white/5 pl-4 py-1 relative">
                <div className="absolute left-[-4px] top-2 w-2 h-2 rounded-full bg-ares-red shadow-[0_0_8px_rgba(192,0,0,0.5)]" />
                <div className="flex justify-between items-start">
                  <span className="text-xs text-zinc-200 font-medium truncate max-w-[200px]">{view.path}</span>
                  <span className="text-[10px] text-zinc-600 font-mono">
                    {new Date(view.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-zinc-600 uppercase font-bold tracking-widest">
                  <span className={view.category === 'doc' ? 'text-ares-cyan' : view.category === 'blog' ? 'text-ares-gold' : 'text-zinc-500'}>
                    {view.category}
                  </span>
                  <span>&middot;</span>
                  <span className="truncate max-w-[120px]">Ref: {view.referrer.replace(/https?:\/\/[^\/]+/, '') || 'direct'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
