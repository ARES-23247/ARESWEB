import { useState, useEffect, useMemo } from "react";
import { X, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { adminApi } from "../api/adminApi";
import { useAdminSettings } from "../hooks/useAdminSettings";

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "blog" | "event";
  id: string; // slug for blog, id for event
  title: string;
}

export default function BroadcastModal({ isOpen, onClose, type, id, title }: BroadcastModalProps) {
  const { availableSocials } = useAdminSettings();
  // Track user overrides (toggled off platforms). Derived state avoids setState-in-effect.
  const [toggleOverrides, setToggleOverrides] = useState<Record<string, boolean>>({});
  const selectedsocials = useMemo(() => {
    const result: Record<string, boolean> = {};
    availableSocials.forEach(p => result[p] = toggleOverrides[p] !== undefined ? toggleOverrides[p] : true);
    return result;
  }, [availableSocials, toggleOverrides]);
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Reset status/error after modal close animation completes
  useEffect(() => {
    if (isOpen) return;
    const timer = setTimeout(() => {
      setStatus("idle");
      setErrorMsg("");
      setToggleOverrides({});
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleBroadcast = async () => {
    setIsPending(true);
    setErrorMsg("");
    
    try {
      const url = type === "blog" 
        ? `/api/admin/posts/${id}/repush` 
        : `/api/admin/events/${id}/repush`;
        
      const data = await adminApi.request<{ success: boolean, error?: string }>(url, {
        method: "POST",
        body: JSON.stringify({ socials: selectedsocials }),
      });
      
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
      <div className="bg-obsidian border border-white/10 w-full max-w-md ares-cut overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 ares-cut-sm ${type === 'blog' ? 'bg-ares-red text-white' : 'bg-ares-gold text-black'}`}>
              <Send size={16} />
            </div>
            <h3 className="font-bold text-white tracking-tight">Social Broadcast</h3>
          </div>
          <button onClick={onClose} className="p-1 text-marble/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <p className="text-xs font-bold text-marble/40 uppercase tracking-widest mb-1">Target Content</p>
            <p className="text-lg font-bold text-white leading-tight">{title}</p>
            <p className="text-xs text-marble/60 mt-1 italic capitalize">{type} Entry</p>
          </div>

          {status === "idle" && (
            <>
              <p className="text-xs font-bold text-marble/40 uppercase tracking-widest mb-3">Select Platforms</p>
              {availableSocials.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {availableSocials.map(platform => (
                    <label 
                      key={platform} 
                      className={`flex items-center gap-3 p-3 ares-cut-sm border cursor-pointer transition-all ${
                        selectedsocials[platform] 
                        ? 'bg-ares-cyan/10 border-ares-cyan/40 text-white' 
                        : 'bg-white/5 border-white/10 text-marble/40 hover:border-white/20'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedsocials[platform] || false}
                        onChange={(e) => setToggleOverrides(prev => ({ ...prev, [platform]: e.target.checked }))}
                        className="w-4 h-4 rounded border-white/20 bg-obsidian text-ares-cyan focus:ring-ares-cyan"
                      />
                      <span className="text-sm font-bold capitalize">{platform}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-4 ares-cut-sm bg-white/5 border border-dashed border-white/10 text-center mb-6">
                  <p className="text-xs text-marble/40">No social platforms configured in settings.</p>
                </div>
              )}

              <button
                onClick={handleBroadcast}
                disabled={isPending || availableSocials.length === 0 || !Object.values(selectedsocials).some(Boolean)}
                className="w-full py-3.5 ares-cut-sm bg-white text-obsidian font-bold tracking-wide hover:bg-ares-gold hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-obsidian flex items-center justify-center gap-2 shadow-xl active:scale-[0.98]"
              >
                {isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-marble/40 border-t-obsidian rounded-full animate-spin"></div>
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
              <div className="w-16 h-16 bg-ares-gold/20 text-ares-gold rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-xl font-bold text-white mb-1">Broadcast Sent!</h4>
              <p className="text-marble/60 text-sm">Synchronizing across {Object.values(selectedsocials).filter(Boolean).length} platforms...</p>
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
                className="text-xs font-bold text-marble/40 hover:text-white underline tracking-widest"
              >
                TRY AGAIN
              </button>
            </div>
          )}
        </div>

        <div className="p-4 bg-white/[0.02] border-t border-white/5">
          <p className="text-[10px] text-marble/40 italic text-center font-mono uppercase tracking-tighter">
            Omnichannel content delivery managed by ARES Content Pipeline
          </p>
        </div>
      </div>
    </div>
  );
}
