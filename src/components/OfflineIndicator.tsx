import { useEffect, useRef, useState } from "react";
import { WifiOff, CheckCircle2 } from "lucide-react";

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(() => {
    return typeof navigator !== "undefined" ? !navigator.onLine : false;
  });
  const [showReconnected, setShowReconnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearReconnectTimer = () => {
      if (reconnectTimer.current !== null) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };
    const handleOnline = () => {
      clearReconnectTimer();
      setIsOffline(false);
      setShowReconnected(true);
      reconnectTimer.current = setTimeout(() => {
        setShowReconnected(false);
        reconnectTimer.current = null;
      }, 3500);
    };

    const handleOffline = () => {
      clearReconnectTimer();
      setIsOffline(true);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearReconnectTimer();
    };
  }, []);

  if (showReconnected) {
    return (
      <aside
        role="status"
        aria-live="polite"
        style={{ top: "var(--site-announcement-height, 0px)" }}
        className="fixed inset-x-0 z-[80] bg-ares-success/95 backdrop-blur-md text-obsidian text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-lg transition-colors print:hidden"
      >
        <CheckCircle2 size={14} aria-hidden="true" />
        <span>Network connection restored. Live data may take a moment to refresh.</span>
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
      style={{ top: "var(--site-announcement-height, 0px)" }}
      className="fixed inset-x-0 z-[80] bg-gradient-to-r from-obsidian via-zinc-900 to-obsidian border-b border-ares-gold/40 text-marble text-xs py-2 px-4 flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-md print:hidden"
    >
      <div className="w-2 h-2 rounded-full bg-ares-gold" aria-hidden="true" />
      <WifiOff size={14} className="text-ares-gold flex-shrink-0" aria-hidden="true" />
      <span>
        <strong className="text-ares-gold uppercase tracking-wider font-extrabold mr-1">Pit Mode:</strong>
        You are offline. Previously loaded pages may remain available, but live data and changes will not sync.
      </span>
    </aside>
  );
}
