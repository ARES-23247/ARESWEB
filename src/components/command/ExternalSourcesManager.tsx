import { useState } from "react";
import { Brain, Trash2, Plus, GitBranch, Globe, RefreshCw, Terminal } from "lucide-react";
import { toast } from "sonner";
import {
  useGetExternalSources,
  useGetAIStatus,
  useAddExternalSource,
  useDeleteExternalSource,
  reindexExternalRequest,
} from "../../api/ai";

export default function ExternalSourcesManager() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState<"github" | "website">("github");
  const [syncErrors, setSyncErrors] = useState<string[] | null>(null);

  const { data: sources = [], isLoading } = useGetExternalSources();
  const { data: statusData } = useGetAIStatus({
    refetchInterval: 10000 // Refetch every 10s
  });

  const addMutation = useAddExternalSource({
    onSuccess: () => {
      toast.success("Source added successfully");
      setNewUrl("");
    },
    onError: (err: Error) => toast.error(`Failed to add source: ${err.message}`)
  });

  const deleteMutation = useDeleteExternalSource({
    onSuccess: () => {
      toast.success("Source deleted");
    },
    onError: (err: Error) => toast.error(`Failed to delete source: ${err.message}`)
  });

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncErrors(null);
    let totalIndexed = 0;
    const allErrors: string[] = [];

    for (const src of sources) {
      try {
        const data = await reindexExternalRequest(src.id);
        if (data.success) {
          if (data.indexed) totalIndexed += data.indexed;
          if (data.errors && data.errors.length > 0) {
            allErrors.push(...data.errors);
          }
        } else {
          allErrors.push(`Sync failed for ${src.url}: ${data.error || "Unknown error"}`);
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        allErrors.push(`${src.url}: ${err}`);
      }
    }

    if (allErrors.length > 0) {
      toast.warning(`${allErrors.length} indexing errors encountered.`);
      setSyncErrors(allErrors);
    } else {
      toast.success(`External sync complete: ${totalIndexed} documents updated.`);
      setSyncErrors(null);
    }

    setIsSyncing(false);
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
              ? "bg-white/5 text-marble/60 border-white/5 cursor-not-allowed"
              : "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:border-purple-500/40"
          }`}
        >
          <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
          {isSyncing ? "Syncing..." : "Sync All"}
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {isLoading ? (
          <div className="text-marble/60 text-sm">Loading sources...</div>
        ) : sources.length === 0 ? (
          <div className="text-marble/60 text-sm">No external sources configured.</div>
        ) : (
          sources.map((src) => (
            <div key={src.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 ares-cut-sm">
              <div className="flex items-center gap-3">
                {src.type === "github" ? <GitBranch size={16} className="text-marble" /> : <Globe size={16} className="text-marble" />}
                <div>
                  <div className="text-sm font-bold text-white">{src.url}</div>
                  <div className="text-xs text-marble/60 flex items-center gap-2">
                    {src.type === "github" && <span>{src.branch}</span>}
                    {src.last_indexed_at ? (
                      <span className="text-ares-cyan/80">Synced {new Date(src.last_indexed_at).toLocaleDateString()}</span>
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
        onSubmit={(e) => { e.preventDefault(); if(newUrl) addMutation.mutate({ type: newType, url: newUrl }); }}
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
        <div className="mt-6 border border-ares-danger/30 bg-black/50 p-3 relative group">
          <div className="absolute top-0 left-3 -translate-y-1/2 bg-obsidian px-2 flex items-center gap-1.5 text-ares-danger-soft text-[10px] font-bold uppercase tracking-widest border border-ares-danger/30">
            <Terminal size={10} />
            Previous Sync Errors
          </div>
          <div className="text-[10px] text-marble/60 mb-2 font-mono">
            Last run: {new Date(statusData.indexErrors.timestamp).toLocaleString()}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto font-mono text-[11px] text-ares-danger/80">
            {statusData.indexErrors.errors.map((err, i) => (
              <div key={i} className="pl-2 border-l border-ares-danger/30">
                &gt; {err}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Immediate Sync Errors */}
      {syncErrors && (
        <div className="mt-6 border border-ares-danger/50 bg-ares-red-dark/20 p-4 relative group rounded">
          <div className="absolute top-0 left-3 -translate-y-1/2 bg-obsidian px-2 flex items-center gap-1.5 text-ares-danger-soft text-xs font-bold uppercase tracking-widest border border-ares-danger/50">
            <Terminal size={12} />
            Indexing Errors ({syncErrors.length})
          </div>
          <div className="text-xs text-marble/60 mb-3 font-mono">
            These errors occurred during your most recent sync attempt.
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-xs text-ares-danger/80">
            {syncErrors.map((err, i) => (
              <div key={i} className="pl-3 border-l-2 border-ares-danger/50 bg-black/40 py-2 pr-2 rounded-r break-words whitespace-pre-wrap">
                {err}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
