import { useState } from "react";
import { Brain, Trash2, Plus, GitBranch, Globe, RefreshCw, Terminal } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function ExternalSourcesManager() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState<"github" | "website">("github");
  const [syncErrors, setSyncErrors] = useState<string[] | null>(null);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["external-sources"],
    queryFn: async () => {
      const res = await fetch("/api/ai/external-sources");
      if (!res.ok) throw new Error("Failed to fetch sources");
      return res.json() as Promise<{ id: string; type: string; url: string; branch: string; last_indexed_at: string | null }[]>;
    }
  });

  const { data: statusData } = useQuery({
    queryKey: ["ai-status"],
    queryFn: async () => {
      const res = await fetch("/api/ai/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json() as Promise<{ indexErrors?: { timestamp: string, errors: string[] } | null }>;
    },
    refetchInterval: 10000 // Refetch every 10s
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/external-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType, url: newUrl })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Source added successfully");
      setNewUrl("");
      queryClient.invalidateQueries({ queryKey: ["external-sources"] });
    },
    onError: (err: Error) => toast.error(`Failed to add source: ${err.message}`)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/external-sources/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Source deleted");
      queryClient.invalidateQueries({ queryKey: ["external-sources"] });
    },
    onError: (err: Error) => toast.error(`Failed to delete source: ${err.message}`)
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/ai/reindex-external", { method: "POST" });
      const data = await res.json() as { success?: boolean; indexed?: number; errors?: string[]; error?: string };
      if (res.ok && data.success) {
        toast.success(`External sync complete: ${data.indexed} documents updated.`);
        if (data.errors && data.errors.length > 0) {
          toast.warning(`${data.errors.length} indexing errors encountered.`);
          setSyncErrors(data.errors);
        } else {
          setSyncErrors(null);
        }
        queryClient.invalidateQueries({ queryKey: ["external-sources"] });
        queryClient.invalidateQueries({ queryKey: ["ai-status"] });
      } else {
        toast.error(data.error || `Sync failed (HTTP ${res.status})`);
      }
    } catch (e) {
      toast.error(`Sync request failed: ${e}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-obsidian/50 border border-white/5 ares-cut p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
          <Brain size={16} className="text-purple-400" />
          External Knowledge
        </h3>
        <button
          onClick={handleSync}
          disabled={isSyncing || sources.length === 0}
          className={`px-3 py-1.5 ares-cut-sm border text-xs font-bold transition-all flex items-center gap-2 ${
            isSyncing || sources.length === 0
              ? "bg-white/5 text-marble/40 border-white/5 cursor-not-allowed"
              : "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:border-purple-500/40"
          }`}
        >
          <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
          {isSyncing ? "Syncing..." : "Sync All"}
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {isLoading ? (
          <div className="text-marble/40 text-sm">Loading sources...</div>
        ) : sources.length === 0 ? (
          <div className="text-marble/40 text-sm">No external sources configured.</div>
        ) : (
          sources.map((src) => (
            <div key={src.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 ares-cut-sm">
              <div className="flex items-center gap-3">
                {src.type === "github" ? <GitBranch size={16} className="text-marble" /> : <Globe size={16} className="text-marble" />}
                <div>
                  <div className="text-sm font-bold text-white">{src.url}</div>
                  <div className="text-xs text-marble/40 flex items-center gap-2">
                    {src.type === "github" && <span>{src.branch}</span>}
                    {src.last_indexed_at ? (
                      <span className="text-green-400/80">Synced {new Date(src.last_indexed_at).toLocaleDateString()}</span>
                    ) : (
                      <span className="text-ares-gold/80">Never synced</span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => deleteMutation.mutate(src.id)}
                className="text-ares-red/60 hover:text-ares-red transition-colors p-1"
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <form 
        onSubmit={(e) => { e.preventDefault(); if(newUrl) addMutation.mutate(); }}
        className="flex gap-2"
      >
        <select 
          value={newType} 
          onChange={(e) => setNewType(e.target.value as "github" | "website")}
          className="bg-black/40 border border-white/10 text-white text-sm px-3 focus:outline-none focus:border-ares-cyan"
        >
          <option value="github">GitHub</option>
          <option value="website" disabled>Website</option>
        </select>
        <input 
          type="text" 
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder={newType === "github" ? "owner/repo" : "https://..."}
          className="flex-1 bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-ares-cyan"
        />
        <button 
          type="submit"
          disabled={!newUrl || addMutation.isPending}
          className="bg-white/10 hover:bg-white/20 border border-white/10 px-3 flex items-center justify-center transition-colors disabled:opacity-50"
        >
          <Plus size={16} className="text-white" />
        </button>
      </form>

      {/* Admin Debug Console from KV */}
      {statusData?.indexErrors && !syncErrors && (
        <div className="mt-6 border border-red-500/30 bg-black/50 p-3 relative group">
          <div className="absolute top-0 left-3 -translate-y-1/2 bg-obsidian px-2 flex items-center gap-1.5 text-red-400 text-[10px] font-bold uppercase tracking-widest border border-red-500/30">
            <Terminal size={10} />
            Previous Sync Errors
          </div>
          <div className="text-[10px] text-marble/60 mb-2 font-mono">
            Last run: {new Date(statusData.indexErrors.timestamp).toLocaleString()}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto font-mono text-[11px] text-red-300/80">
            {statusData.indexErrors.errors.map((err, i) => (
              <div key={i} className="pl-2 border-l border-red-500/30">
                &gt; {err}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Immediate Sync Errors */}
      {syncErrors && (
        <div className="mt-6 border border-red-500/50 bg-red-950/20 p-4 relative group rounded">
          <div className="absolute top-0 left-3 -translate-y-1/2 bg-obsidian px-2 flex items-center gap-1.5 text-red-400 text-xs font-bold uppercase tracking-widest border border-red-500/50">
            <Terminal size={12} />
            Indexing Errors ({syncErrors.length})
          </div>
          <div className="text-xs text-marble/60 mb-3 font-mono">
            These errors occurred during your most recent sync attempt.
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-xs text-red-200">
            {syncErrors.map((err, i) => (
              <div key={i} className="pl-3 border-l-2 border-red-500/50 bg-black/40 py-2 pr-2 rounded-r break-words whitespace-pre-wrap">
                {err}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
