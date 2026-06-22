import React from "react";
import { Wifi, X, Info } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface LiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  ipAddress: string;
  setIpAddress: (ip: string) => void;
  handleConnectLive: () => void;
}

export default function LiveStreamModal({
  isOpen,
  onClose,
  ipAddress,
  setIpAddress,
  handleConnectLive
}: LiveStreamModalProps) {
  const liveModalRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/70 backdrop-blur-md transition-all duration-300">
      <div 
        ref={liveModalRef} 
        tabIndex={-1} 
        className="glass-card border border-white/10 bg-neutral-950 p-6 max-w-sm w-full rounded-2xl flex flex-col gap-5 shadow-2xl relative focus:outline-none"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-marble/40 hover:text-white cursor-pointer transition-colors"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ares-gold/10 border border-ares-gold/20 flex items-center justify-center text-ares-gold">
            <Wifi size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-md tracking-tight uppercase font-heading">
              Connect Live Stream
            </h3>
            <p className="text-marble/55 text-[10px] font-bold uppercase tracking-wider">
              NetworkTables v4 WebSocket
            </p>
          </div>
        </div>

        {typeof window !== "undefined" && window.location.protocol === "https:" && (
          <div className="bg-ares-gold/10 border border-ares-gold/20 rounded-xl p-3.5 flex flex-col gap-1.5 text-left">
            <div className="flex items-center gap-1.5 text-ares-gold font-bold text-[10px] uppercase tracking-wider">
              <Info size={12} className="stroke-[2.5]" /> Secure Context (HTTPS) Active
            </div>
            <p className="text-[9px] text-marble/70 leading-normal">
              Modern browsers block direct insecure connections (<code className="text-ares-gold bg-black/30 px-1 py-0.5 rounded">ws://</code>) from HTTPS websites. To connect:
            </p>
            <ol className="list-decimal list-inside text-[9px] text-marble/70 flex flex-col gap-1 mt-0.5">
              <li>Start the local proxy daemon on your laptop (<code className="text-ares-gold bg-black/30 px-1 py-0.5 rounded">node daemon.js</code>).</li>
              <li>Enter the robot's IP below and click Connect.</li>
            </ol>
            <p className="text-[9px] text-marble/50 mt-0.5 leading-normal">
              The dashboard will automatically bridge telemetry securely through <code className="text-ares-gold bg-black/30 px-1 py-0.5 rounded">localhost:5811</code>.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="robotIpInput" className="text-[10px] uppercase font-black tracking-widest text-ares-gold">
            Robot IP Address / Host
          </label>
          <input
            id="robotIpInput"
            type="text"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            placeholder="192.168.43.1"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-ares-gold transition-colors focus:ring-2 focus:ring-ares-cyan"
          />
          <p className="text-[10px] text-marble/40 mt-1 leading-normal">
            Default for FTC Wi-Fi Direct: <code className="text-ares-gold">192.168.43.1</code>. Control Hub / ADB: <code className="text-ares-gold">localhost</code> or <code className="text-ares-gold">192.168.43.1</code>.
          </p>
        </div>

        <div className="flex gap-3 mt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest rounded-xl transition-all duration-300 font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleConnectLive}
            className="flex-1 py-3 bg-ares-gold text-black hover:bg-ares-gold-soft text-[10px] uppercase font-black tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 font-bold"
          >
            <Wifi size={12} className="stroke-[3]" /> Connect
          </button>
        </div>
      </div>
    </div>
  );
}
