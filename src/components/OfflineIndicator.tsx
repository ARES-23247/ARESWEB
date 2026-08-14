import React, { useEffect, useState } from "react";
import { WifiOff, CheckCircle2 } from "lucide-react";

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(() => {
    return typeof navigator !== "undefined" ? !navigator.onLine : false;
  });
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (showReconnected) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed top-0 inset-x-0 z-50 bg-ares-success/90 backdrop-blur-md text-white text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-lg transition-all"
      >
        <CheckCircle2 size={14} className="animate-bounce" aria-hidden="true" />
        <span>Connected — Team portal sync restored.</span>
      </aside>
    );
  }

  if (!isOffline) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 bg-gradient-to-r from-obsidian via-zinc-900 to-obsidian border-b border-ares-gold/40 text-marble text-xs py-2 px-4 flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-md"
    >
      <div className="w-2 h-2 rounded-full bg-ares-gold animate-pulse" aria-hidden="true" />
      <WifiOff size={14} className="text-ares-gold flex-shrink-0" aria-hidden="true" />
      <span>
        <strong className="text-ares-gold uppercase tracking-wider font-extrabold mr-1">Pit Mode:</strong>
        You are offline. Interactive simulations, engineering references, and cached tools are fully operational.
      </span>
    </aside>
  );
}
