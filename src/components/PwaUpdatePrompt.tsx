import { useEffect, useRef, useState } from "react";
import { RefreshCw, WifiOff, X } from "lucide-react";
import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

interface PwaUpdatePromptProps {
  enabled?: boolean;
}

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

function diagnosticMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function PwaUpdatePrompt({ enabled = import.meta.env.PROD }: PwaUpdatePromptProps) {
  const updateServiceWorker = useRef<UpdateServiceWorker | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    const checkForUpdate = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine || !registration) return;
      void registration.update().catch((updateError: unknown) => {
        console.error("PWA update check failed:", updateError);
        setError(`Update check failed: ${diagnosticMessage(updateError)}`);
      });
    };

    updateServiceWorker.current = registerSW({
      immediate: true,
      onNeedRefresh: () => setUpdateAvailable(true),
      onOfflineReady: () => setOfflineReady(true),
      onRegisteredSW: (_serviceWorkerUrl, currentRegistration) => {
        registration = currentRegistration;
      },
      onRegisterError: (registrationError: unknown) => {
        console.error("PWA registration failed:", registrationError);
        setError(`Offline access could not be enabled: ${diagnosticMessage(registrationError)}`);
      },
    });

    const intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("online", checkForUpdate);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
    };
  }, [enabled]);

  const installUpdate = async () => {
    if (!updateServiceWorker.current) return;
    setIsUpdating(true);
    setError(null);
    try {
      await updateServiceWorker.current(true);
    } catch (updateError) {
      console.error("PWA activation failed:", updateError);
      setError(`Update activation failed: ${diagnosticMessage(updateError)}`);
      setIsUpdating(false);
    }
  };

  if (!updateAvailable && !offlineReady && !error) return null;

  return (
    <aside
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-modal mx-auto max-w-lg rounded-xl border border-white/15 bg-obsidian p-4 text-white shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-ares-red p-2 text-white">
          {error ? <WifiOff aria-hidden="true" size={18} /> : <RefreshCw aria-hidden="true" size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-sm font-black uppercase tracking-wide">
            {updateAvailable ? "Portal update ready" : error ? "Offline support unavailable" : "Ready for offline use"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-marble/80">
            {updateAvailable
              ? "Reload when you are ready to use the latest version. Unsaved form entries may be lost."
              : error
                ? "Online browsing still works. Try again after reconnecting or reloading the page."
                : "The current portal shell is available if your connection drops."}
          </p>
          {error && <p className="mt-2 break-words font-mono text-[11px] text-marble/70">{error}</p>}
          {updateAvailable && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void installUpdate()}
                disabled={isUpdating}
                className="rounded bg-ares-red px-4 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-ares-bronze disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                {isUpdating ? "Updating…" : "Reload and update"}
              </button>
              <button
                type="button"
                onClick={() => setUpdateAvailable(false)}
                className="rounded border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wide text-marble hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Later
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => {
            setOfflineReady(false);
            setError(null);
          }}
          className="rounded p-1 text-marble/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </aside>
  );
}

export { diagnosticMessage };
