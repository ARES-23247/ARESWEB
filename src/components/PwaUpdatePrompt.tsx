import { logger } from "@/utils/logger";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, WifiOff, X } from "lucide-react";
import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const REGISTRATION_RETRY_DELAY_MS = 1_500;
const MAX_REGISTRATION_ATTEMPTS = 3;
const UPDATE_ACTIVATION_TIMEOUT_MS = 8_000;
const DISMISSED_UPDATE_SESSION_KEY = "ares:pwa-update-dismissed";

interface PwaUpdatePromptProps {
  enabled?: boolean;
  reloadPage?: () => void;
}

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

function diagnosticMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function updateDismissedForSession(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED_UPDATE_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissedUpdate(): void {
  try {
    window.sessionStorage.setItem(DISMISSED_UPDATE_SESSION_KEY, "1");
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }
}

function clearDismissedUpdate(): void {
  try {
    window.sessionStorage.removeItem(DISMISSED_UPDATE_SESSION_KEY);
  } catch {
    // A successful activation can still reload when storage is unavailable.
  }
}

export default function PwaUpdatePrompt({
  enabled =
    import.meta.env.PROD &&
    !(
      import.meta.env.MODE === "e2e" &&
      typeof window !== "undefined" &&
      window.ARES_E2E_BYPASS === true
    ),
  reloadPage,
}: PwaUpdatePromptProps) {
  const performReload = useMemo(
    () => reloadPage ?? window.location.reload.bind(window.location),
    [reloadPage],
  );
  const updateServiceWorker = useRef<UpdateServiceWorker | null>(null);
  const activationTimeout = useRef<number | undefined>(undefined);
  const controllerChangeHandler = useRef<(() => void) | null>(null);
  const reloadStarted = useRef(false);
  const updateDismissed = useRef(updateDismissedForSession());
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const clearActivationWait = useCallback(() => {
    if (activationTimeout.current !== undefined) {
      window.clearTimeout(activationTimeout.current);
      activationTimeout.current = undefined;
    }
    if (
      controllerChangeHandler.current &&
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controllerChangeHandler.current,
      );
      controllerChangeHandler.current = null;
    }
  }, []);

  const reloadWithActivatedWorker = useCallback(() => {
    if (reloadStarted.current) return;
    reloadStarted.current = true;
    clearActivationWait();
    updateDismissed.current = false;
    clearDismissedUpdate();
    performReload();
  }, [clearActivationWait, performReload]);

  const reloadAfterActivationTimeout = useCallback(() => {
    if (reloadStarted.current) return;
    reloadStarted.current = true;
    clearActivationWait();
    updateDismissed.current = true;
    rememberDismissedUpdate();
    setUpdateAvailable(false);
    setError(null);
    setIsUpdating(false);
    performReload();
  }, [clearActivationWait, performReload]);

  const dismissUpdate = useCallback(() => {
    clearActivationWait();
    updateDismissed.current = true;
    rememberDismissedUpdate();
    reloadStarted.current = false;
    setUpdateAvailable(false);
    setError(null);
    setIsUpdating(false);
  }, [clearActivationWait]);

  useEffect(() => {
    if (
      !enabled ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    )
      return;

    let registration: ServiceWorkerRegistration | undefined;
    let registrationAttempts = 0;
    let retryTimer: number | undefined;
    let isDisposed = false;

    const checkForUpdate = () => {
      if (
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        !registration
      )
        return;
      void registration.update().catch((updateError: unknown) => {
        logger.error("PWA update check failed:", updateError);
        setError(`Update check failed: ${diagnosticMessage(updateError)}`);
      });
    };

    const handleRegistrationError = (registrationError: unknown) => {
      if (isDisposed) return;
      registrationAttempts += 1;
      if (
        registrationAttempts < MAX_REGISTRATION_ATTEMPTS &&
        navigator.onLine
      ) {
        logger.warn("PWA registration failed; retrying:", registrationError);
        retryTimer = window.setTimeout(
          registerServiceWorker,
          REGISTRATION_RETRY_DELAY_MS,
        );
        return;
      }

      logger.error("PWA registration failed:", registrationError);
      setError(
        `Offline access could not be enabled: ${diagnosticMessage(registrationError)}`,
      );
    };

    const registrationOptions = () => ({
      immediate: true,
      onNeedReload: () => {
        if (!isDisposed) reloadWithActivatedWorker();
      },
      onNeedRefresh: () => {
        if (isDisposed) return;
        if (updateDismissed.current || updateDismissedForSession()) return;
        setError(null);
        setIsUpdating(false);
        setUpdateAvailable(true);
      },
      onOfflineReady: () => {
        if (isDisposed) return;
        registrationAttempts = 0;
        setError(null);
      },
      onRegisteredSW: (
        _serviceWorkerUrl: string,
        currentRegistration?: ServiceWorkerRegistration,
      ) => {
        if (isDisposed) return;
        if (!currentRegistration) return;
        registration = currentRegistration;
        registrationAttempts = 0;
        setError(null);
      },
      onRegisterError: handleRegistrationError,
    });

    function registerServiceWorker() {
      if (isDisposed) return;
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      try {
        updateServiceWorker.current = registerSW(registrationOptions());
      } catch (registrationError) {
        handleRegistrationError(registrationError);
      }
    }

    const handleOnline = () => {
      if (registration) {
        checkForUpdate();
        return;
      }
      registrationAttempts = 0;
      setError(null);
      registerServiceWorker();
    };

    registerServiceWorker();

    const intervalId = window.setInterval(
      checkForUpdate,
      UPDATE_CHECK_INTERVAL_MS,
    );
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("online", handleOnline);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      clearActivationWait();
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("online", handleOnline);
    };
  }, [clearActivationWait, enabled, reloadWithActivatedWorker]);

  const installUpdate = async () => {
    if (!updateServiceWorker.current) return;
    clearActivationWait();
    updateDismissed.current = false;
    clearDismissedUpdate();
    reloadStarted.current = false;
    setIsUpdating(true);
    setError(null);

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      controllerChangeHandler.current = reloadWithActivatedWorker;
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        reloadWithActivatedWorker,
        { once: true },
      );
    }

    activationTimeout.current = window.setTimeout(() => {
      reloadAfterActivationTimeout();
    }, UPDATE_ACTIVATION_TIMEOUT_MS);

    try {
      await updateServiceWorker.current(true);
    } catch (updateError) {
      clearActivationWait();
      logger.error("PWA activation failed:", updateError);
      setError(`Update activation failed: ${diagnosticMessage(updateError)}`);
      setIsUpdating(false);
    }
  };

  if (!updateAvailable && !error) return null;

  return (
    <aside
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-modal mx-auto max-w-lg rounded-xl border border-white/15 bg-obsidian p-4 text-white shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-ares-red p-2 text-white">
          {error ? (
            <WifiOff aria-hidden="true" size={18} />
          ) : (
            <RefreshCw aria-hidden="true" size={18} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-sm font-black uppercase tracking-wide">
            {updateAvailable ? "Portal update ready" : "Offline support unavailable"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-marble/80">
            {updateAvailable
              ? "Reload when you are ready to use the latest version. Unsaved form entries may be lost."
              : "Online browsing still works. Try again after reconnecting or reloading the page."}
          </p>
          {error && (
            <p className="mt-2 break-words font-mono text-[11px] text-marble/70">
              {error}
            </p>
          )}
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
                onClick={() => {
                  dismissUpdate();
                }}
                disabled={isUpdating}
                className="rounded border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wide text-marble hover:bg-white/10 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Later
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          disabled={isUpdating}
          onClick={() => {
            dismissUpdate();
          }}
          className="rounded p-1 text-marble/70 hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </aside>
  );
}

export { diagnosticMessage };
