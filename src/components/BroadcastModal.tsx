import { useState, useEffect } from "react";
import { X, Send, CheckCircle2, AlertCircle } from "lucide-react";

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "blog" | "event";
  id: string; // slug for blog, id for event
  title: string;
}

export default function BroadcastModal({ isOpen, onClose, type, id, title }: BroadcastModalProps) {
  const [availableSocials, setAvailableSocials] = useState<string[]>([]);
  const [selectedsocials, setSelectedSocials] = useState<Record<string, boolean>>({});
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setStatus("idle");
        setErrorMsg("");
      }, 300);
      return () => clearTimeout(timer);
    }

    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/admin/settings", { credentials: "include" });
        const data = await res.json() as { success: boolean, settings: Record<string, string> };
        if (data.success && data.settings) {
          const config = data.settings;
          const available = [];
          if (config.ZULIP_BOT_EMAIL && config.ZULIP_API_KEY) available.push("zulip");
          if (config.DISCORD_WEBHOOK_URL) available.push("discord");
          if (config.BLUESKY_HANDLE && config.BLUESKY_APP_PASSWORD) available.push("bluesky");
          if (config.SLACK_WEBHOOK_URL) available.push("slack");
          if (config.TEAMS_WEBHOOK_URL) available.push("teams");
          if (config.GCHAT_WEBHOOK_URL) available.push("gchat");
          if (config.FACEBOOK_ACCESS_TOKEN) available.push("facebook");
          if (config.TWITTER_ACCESS_TOKEN) available.push("twitter");
          if (config.INSTAGRAM_ACCESS_TOKEN) available.push("instagram");
          
          setAvailableSocials(available);
          
          // Default all available to true
          const initial: Record<string, boolean> = {};
          available.forEach(p => initial[p] = true);
          setSelectedSocials(initial);
        }
      } catch (err) {
        console.error("Failed to fetch available socials for broadcast:", err);
      }
    };
    fetchSettings();
  }, [isOpen]);

  const handleBroadcast = async () => {
    setIsPending(true);
    setErrorMsg("");
    
    try {
      const url = type === "blog" 
        ? `/api/admin/posts/${id}/repush` 
        : `/api/admin/events/${id}/repush`;
        
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ socials: selectedsocials }),
      });
      
      const data = await res.json() as { success: boolean, error?: string };
      if (data.success) {
        setStatus("success");
        setTimeout(onClose, 2000);
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Broadcast failed");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error — broadcast failed");
    } finally {
      setIsPending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md ares-cut overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 ares-cut-sm ${type === 'blog' ? 'bg-ares-red/20 text-ares-red' : 'bg-ares-gold/20 text-ares-gold'}`}>
              <Send size={16} />
            </div>
            <h3 className="font-bold text-white tracking-tight">Social Broadcast</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Target Content</p>
            <p className="text-lg font-bold text-white leading-tight">{title}</p>
            <p className="text-xs text-zinc-400 mt-1 italic capitalize">{type} Entry</p>
          </div>

          {status === "idle" && (
            <>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Select Platforms</p>
              {availableSocials.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {availableSocials.map(platform => (
                    <label 
                      key={platform} 
                      className={`flex items-center gap-3 p-3 ares-cut-sm border cursor-pointer transition-all ${
                        selectedsocials[platform] 
                        ? 'bg-ares-cyan/10 border-ares-cyan/40 text-white' 
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedsocials[platform] || false}
                        onChange={(e) => setSelectedSocials(prev => ({ ...prev, [platform]: e.target.checked }))}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-ares-cyan focus:ring-ares-cyan"
                      />
                      <span className="text-sm font-bold capitalize">{platform}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-4 ares-cut-sm bg-zinc-950 border border-dashed border-zinc-800 text-center mb-6">
                  <p className="text-xs text-zinc-500">No social platforms configured in settings.</p>
                </div>
              )}

              <button
                onClick={handleBroadcast}
                disabled={isPending || availableSocials.length === 0 || !Object.values(selectedsocials).some(Boolean)}
                className="w-full py-3.5 ares-cut-sm bg-white text-zinc-950 font-bold tracking-wide hover:bg-ares-cyan hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-zinc-950 flex items-center justify-center gap-2 shadow-xl active:scale-[0.98]"
              >
                {isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-950 rounded-full animate-spin"></div>
                    BROADCASTING...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    RE-TRIGGER SYNDICATION
                  </>
                )}
              </button>
            </>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in-90 scale-95 duration-300">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-xl font-bold text-white mb-1">Broadcast Sent!</h4>
              <p className="text-zinc-400 text-sm">Synchronizing across {Object.values(selectedsocials).filter(Boolean).length} platforms...</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 bg-ares-red/20 text-ares-red rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={32} />
              </div>
              <h4 className="text-xl font-bold text-white mb-1">Broadcast Failed</h4>
              <p className="text-ares-red text-sm mb-4">{errorMsg}</p>
              <button 
                onClick={() => setStatus("idle")}
                className="text-xs font-bold text-zinc-400 hover:text-white underline tracking-widest"
              >
                TRY AGAIN
              </button>
            </div>
          )}
        </div>

        <div className="p-4 bg-zinc-950/30 border-t border-zinc-800/50">
          <p className="text-[10px] text-zinc-500 italic text-center font-mono uppercase tracking-tighter">
            Omnichannel content delivery managed by ARES Content Pipeline
          </p>
        </div>
      </div>
    </div>
  );
}
