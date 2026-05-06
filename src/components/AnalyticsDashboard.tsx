import { BarChart3, TrendingUp, Clock, ExternalLink, Activity, Users, Database, Server } from "lucide-react";
import { Link } from "react-router-dom";
import { useGetPlatformAnalytics } from "../api";
import { BarList, Card, Title, Text, DonutChart, Flex, LineChart } from "@tremor/react";

import DashboardPageHeader from "./dashboard/DashboardPageHeader";

export default function AnalyticsDashboard() {
  const { data: analyticsData, isLoading, isError } = useGetPlatformAnalytics();

  const data = analyticsData || null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-32 bg-white/5 ares-cut-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-white/5 ares-cut-lg" />
          <div className="h-32 bg-white/5 ares-cut-lg" />
          <div className="h-32 bg-white/5 ares-cut-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-white/5 ares-cut-lg" />
          <div className="h-64 bg-white/5 ares-cut-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader 
        title="Platform Analytics" 
        subtitle="Real-time visibility into platform traffic, engagement, and performance."
        icon={<BarChart3 className="text-ares-cyan" />}
      />

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          TELEMETRY FAULT: Failed to synchronize platform metrics.
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-black/40 border-white/5 ares-cut-lg">
          <Flex alignItems="start">
            <div className="truncate">
              <Text className="text-marble/60 uppercase tracking-widest font-black text-[10px]">Total Views</Text>
              <Title className="text-white text-3xl font-black">{data?.totalPageViews?.toLocaleString() || 0}</Title>
            </div>
            <Activity className="text-ares-cyan" size={24} />
          </Flex>
        </Card>
        <Card className="bg-black/40 border-white/5 ares-cut-lg">
          <Flex alignItems="start">
            <div className="truncate">
              <Text className="text-marble/60 uppercase tracking-widest font-black text-[10px]">Unique Visitors</Text>
              <Title className="text-white text-3xl font-black">{data?.uniqueVisitors?.toLocaleString() || 0}</Title>
            </div>
            <Users className="text-ares-gold" size={24} />
          </Flex>
        </Card>
        <Card className="bg-black/40 border-white/5 ares-cut-lg">
          <Flex alignItems="start">
            <div className="truncate">
              <Text className="text-marble/60 uppercase tracking-widest font-black text-[10px]">Total Assets</Text>
              <Title className="text-white text-3xl font-black">{data?.resourceUsage?.totalAssets?.toLocaleString() || 0}</Title>
            </div>
            <Database className="text-marble/80" size={24} />
          </Flex>
        </Card>
        <Card className="bg-black/40 border-white/5 ares-cut-lg">
          <Flex alignItems="start">
            <div className="truncate">
              <Text className="text-marble/60 uppercase tracking-widest font-black text-[10px]">API Calls</Text>
              <Title className="text-white text-3xl font-black">{data?.resourceUsage?.apiCalls?.toLocaleString() || 0}</Title>
            </div>
            <Server className="text-marble/80" size={24} />
          </Flex>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-black/40 border-white/5 ares-cut-lg">
          <Title className="text-white font-bold mb-4 flex items-center gap-2">
            <Activity size={20} className="text-ares-cyan" />
            30-Day Activity
          </Title>
          <LineChart
            className="h-72 mt-4"
            data={data?.userActivity || []}
            index="date"
            categories={["pageViews"]}
            colors={["cyan"]}
            yAxisWidth={40}
            showAnimation={true}
          />
        </Card>

        <Card className="bg-black/40 border-white/5 ares-cut-lg">
          <Title className="text-white font-bold mb-4 flex items-center gap-2">
            <Server size={20} className="text-marble/50" />
            API Latency (ms)
          </Title>
          <LineChart
            className="h-72 mt-4"
            data={data?.latency || []}
            index="date"
            categories={["avg_latency"]}
            colors={["amber"]}
            yAxisWidth={40}
            showAnimation={true}
            valueFormatter={(number) => `${number.toFixed(1)}ms`}
          />
        </Card>
      </div>

      {/* Distribution Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="bg-black/40 border-white/5 ares-cut-lg">
            <Flex alignItems="start">
              <div className="truncate">
                <Text className="text-marble/60 uppercase tracking-widest font-black text-[10px]">Traffic Distribution</Text>
                <Title className="text-white text-3xl font-black">{(data?.totals || []).reduce((acc: number, t: { total: number }) => acc + t.total, 0).toLocaleString()}</Title>
              </div>
            </Flex>
            <DonutChart
              className="mt-6 h-40"
              data={data?.totals || []}
              category="total"
              index="category"
              colors={["cyan", "amber", "red", "slate"]}
              showAnimation={true}
            />
         </Card>
         
         <Card className="md:col-span-2 bg-black/40 border-white/5 ares-cut-lg">
            <Text className="text-marble/60 uppercase tracking-widest font-black text-[10px] mb-4">Top Referrers</Text>
            <BarList
              data={(data?.topReferrers || []).map((p: { referrer: string, visits: number }) => ({ name: p.referrer.replace(/https?:\/\//, '').split('/')[0], value: p.visits }))}
              className="mt-2"
              color="amber"
            />
         </Card>
      </div>

      {/* Details Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <Card className="bg-black/40 border-white/5 ares-cut-lg p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Clock size={20} className="text-ares-cyan" />
            Real-time Feed
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {(data?.recentViews || []).map((view: { path: string, timestamp: string, category: string, referrer: string }, idx: number) => (
              <div key={idx} className="flex flex-col gap-1 border-l border-white/5 pl-4 py-1 relative">
                <div className="absolute left-[-4px] top-2 w-2 h-2 rounded-full bg-ares-red shadow-[0_0_8px_rgba(192,0,0,0.5)]" />
                <div className="flex justify-between items-start">
                  <span className="text-xs text-marble font-medium truncate max-w-[200px]">{view.path}</span>
                  <span className="text-xs text-marble/60 font-mono">
                    {new Date(view.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-marble/60 uppercase font-bold tracking-widest">
                  <span className={view.category === 'doc' ? 'text-ares-cyan' : view.category === 'blog' ? 'text-ares-gold' : 'text-marble/50'}>
                    {view.category}
                  </span>
                  <span>&middot;</span>
                  <span className="truncate max-w-[120px]">Ref: {view.referrer.replace(/https?:\/\/[^/]+/, '') || 'direct'}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Detailed List */}
        <Card className="bg-black/40 border-white/5 ares-cut-lg p-6">
           <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-ares-gold" />
            Impact Breakdown
          </h3>
          <div className="space-y-3">
            {(data?.topPages || []).map((page: { path: string, category: string, views: number }, idx: number) => (
              <div key={page.path} className="flex items-center justify-between group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="text-xs font-mono text-marble/60 w-4">0{idx + 1}</span>
                  <div className="flex flex-col truncate">
                    <Link to={page.path} className="text-sm text-marble hover:text-ares-gold transition-colors truncate flex items-center gap-1">
                      {page.path}
                      <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    <span className="text-xs uppercase text-marble/60 font-bold tracking-tighter">{page.category}</span>
                  </div>
                </div>
                <div className="text-sm font-black text-white bg-white/5 px-2 py-1 ares-cut-sm">{page.views}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
