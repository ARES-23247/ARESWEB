import { UseMutationResult } from "@tanstack/react-query";

interface AssetSyndicateModalProps {
  syndicateKey: string | null;
  setSyndicateKey: (key: string | null) => void;
  syndicateCaption: string;
  setSyndicateCaption: (caption: string) => void;
  syndicateMutation: UseMutationResult<unknown, Error, { key: string; caption: string }, unknown>;
}

export default function AssetSyndicateModal({
  syndicateKey,
  setSyndicateKey,
  syndicateCaption,
  setSyndicateCaption,
  syndicateMutation
}: AssetSyndicateModalProps) {
  if (!syndicateKey) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-obsidian border border-white/20 ares-cut w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/10 blur-3xl rounded-full pointer-events-none" />
        
        <h3 className="text-xl font-bold text-white mb-2">Broadcast Media</h3>
        <p className="text-sm text-marble mb-6">
          Dispatch this asset to Instagram, X, Facebook, and Discord securely. Make sure your Integration Keys are populated.
        </p>
        
        <div className="mb-6 bg-black/50 border border-white/10 ares-cut-sm p-2 flex justify-center">
          <img 
            src={`/api/media/${syndicateKey}`} 
            alt="Broadcast target" 
            className="h-32 object-contain rounded" 
          />
        </div>
        
        <div className="mb-6">
          <label htmlFor="captionInput" className="block text-xs font-bold text-marble/50 uppercase tracking-wider mb-2">Social Caption</label>
          <textarea
            id="captionInput"
            value={syndicateCaption}
            onChange={(e) => setSyndicateCaption(e.target.value)}
            rows={4}
            placeholder="Draft an engaging caption for your followers..."
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-colors resize-none"
          />
        </div>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => { setSyndicateKey(null); setSyndicateCaption(""); }}
            className="px-4 py-2 font-medium text-marble/40 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => syndicateMutation.mutate({ key: syndicateKey, caption: syndicateCaption })}
            disabled={syndicateMutation.isPending || syndicateCaption.trim() === ""}
            className={`px-6 py-2 ares-cut-sm font-bold transition-all shadow-lg ${
              syndicateMutation.isPending || syndicateCaption.trim() === ""
               ? "bg-white/5 text-marble/20 cursor-not-allowed"
               : "bg-ares-red text-white hover:bg-ares-gold hover:text-black hover:scale-105"
            }`}
          >
            {syndicateMutation.isPending ? "Dispatching..." : "Launch Payload"}
          </button>
        </div>
      </div>
    </div>
  );
}
