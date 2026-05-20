import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, AlertCircle, Calendar, RefreshCw, GitBranch, ShieldAlert } from "lucide-react";
import SEO from "../../components/SEO";
import CadChangelog from "../../components/tools/CadChangelog";

export const Route = createFileRoute("/onshape/bom-history")({
  component: BOMHistoryPage,
});

interface BOMHistoryEntry {
  id: number;
  documentId: string;
  elementId: string;
  partCount: number;
  syncedBy: string;
  syncedAt: string;
}

function BOMHistoryPage() {
  const [activeTab, setActiveTab] = useState<"timeline" | "syncs">("timeline");

  // Fetch BOM sync history from D1 database
  const { data, isLoading, error, refetch } = useQuery<{ history: BOMHistoryEntry[] }>({
    queryKey: ["onshape", "bom-history"],
    queryFn: async () => {
      const response = await fetch("/api/onshape/bom/history/all");
      if (!response.ok) {
        throw new Error(`Failed to fetch BOM history: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });

  const history = data?.history || [];

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-marble py-12 px-6 relative overflow-hidden">
      <SEO title="CAD Mechanical Changelog" description="Onshape BOM history and mechanical design iteration changelog" />
      
      {/* Ambience glow */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-ares-gold/5 blur-[150px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4" />
      <div className="absolute inset-0 bg-[url('https://api.aresfirst.org/assets/grid.svg')] opacity-[0.02] mix-blend-overlay pointer-events-none z-0" aria-hidden="true" />

      <div className="max-w-6xl mx-auto relative z-10 space-y-8">
        
        {/* Header Block */}
        <header className="border-b border-white/5 pb-6">
          <div className="inline-flex items-center gap-1 bg-ares-gold/10 border border-ares-gold/30 px-3 py-1 ares-cut-sm text-[10px] font-black uppercase text-ares-gold tracking-widest mb-3">
            <GitBranch size={12} className="text-ares-gold" />
            Iterative Design Log
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white">
            CAD Changelog & History
          </h1>
          <p className="text-marble/60 text-xs font-bold tracking-wider mt-1 uppercase">
            MECH DESIGN ITERATIONS & BOM SYNC RECORDS
          </p>
        </header>

        {/* Tab Controller */}
        <div className="flex bg-black/40 p-1 ares-cut-sm border border-white/5 w-fit">
          <button
            onClick={() => setActiveTab("timeline")}
            className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ares-cut-sm flex items-center gap-2 ${
              activeTab === "timeline"
                ? "bg-ares-red text-white"
                : "text-marble/40 hover:text-white"
            }`}
          >
            <Calendar size={14} />
            Design Iteration Timeline
          </button>
          <button
            onClick={() => setActiveTab("syncs")}
            className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ares-cut-sm flex items-center gap-2 ${
              activeTab === "syncs"
                ? "bg-ares-red text-white"
                : "text-marble/40 hover:text-white"
            }`}
          >
            <RefreshCw size={14} />
            BOM Sync Operations
          </button>
        </div>

        {/* Tabs Content */}
        <div className="w-full">
          {activeTab === "timeline" ? (
            <CadChangelog />
          ) : (
            <div className="bg-white/[0.02] border border-white/5 p-6 ares-cut-lg backdrop-blur-md">
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                <Clock size={16} className="text-ares-red" />
                BOM Synchronization Log
              </h3>

              {isLoading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <RefreshCw className="h-8 w-8 animate-spin text-ares-red mb-4" />
                  <p className="text-xs font-bold tracking-widest uppercase text-marble/40">Loading sync history...</p>
                </div>
              )}

              {error && (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                  <ShieldAlert className="h-12 w-12 text-ares-red" />
                  <div>
                    <h4 className="text-sm font-black uppercase text-white">Sync History Error</h4>
                    <p className="text-xs text-marble/60 mt-1">{error instanceof Error ? error.message : "Failed to load database entries."}</p>
                  </div>
                  <button
                    onClick={() => refetch()}
                    className="px-4 py-2 bg-ares-red hover:bg-red-700 text-white font-bold uppercase tracking-widest ares-cut-sm text-[10px] transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              )}

              {!isLoading && !error && history.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                  <Clock className="h-12 w-12 text-marble/20" />
                  <h4 className="text-xs font-black uppercase text-marble/40 tracking-wider">No Sync Logs Found</h4>
                  <p className="text-xs text-marble/20 max-w-sm mt-1">BOM sync logs will be automatically registered when elements are synchronized in the command center.</p>
                </div>
              )}

              {!isLoading && !error && history.length > 0 && (
                <div className="overflow-x-auto border border-white/5 ares-cut">
                  <table className="w-full text-left border-collapse" aria-label="BOM Sync Records">
                    <thead>
                      <tr className="bg-black/60 border-b border-white/10 uppercase tracking-widest text-[9px] text-marble/50">
                        <th className="px-6 py-4 font-black">Document Identifier</th>
                        <th className="px-6 py-4 font-black">Element Identifier</th>
                        <th className="px-6 py-4 font-black text-right">Parts Count</th>
                        <th className="px-6 py-4 font-black">Operator</th>
                        <th className="px-6 py-4 font-black">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-medium divide-y divide-white/5 bg-black/10">
                      {history.map((entry) => (
                        <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 text-marble/60 font-mono text-[10px]">
                            {entry.documentId}
                          </td>
                          <td className="px-6 py-4 text-marble/60 font-mono text-[10px]">
                            {entry.elementId}
                          </td>
                          <td className="px-6 py-4 text-right text-white font-bold font-mono">
                            {entry.partCount}
                          </td>
                          <td className="px-6 py-4 text-marble/70">
                            {entry.syncedBy}
                          </td>
                          <td className="px-6 py-4 text-marble/50">
                            {formatDate(entry.syncedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
