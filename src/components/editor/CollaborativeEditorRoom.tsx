import React, { useEffect, useState, createContext, useContext, useRef, useMemo, useCallback } from "react";
import YPartyKitProvider, { WebsocketProvider } from "y-partykit/provider";
import * as Y from "yjs";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

interface CollaborativeEditorContextType {
  ydoc: Y.Doc | undefined;
  provider: WebsocketProvider | undefined;
  isCollaborative: boolean;
  providerId: number;
}

const CollaborativeEditorContext = createContext<CollaborativeEditorContextType>({
  ydoc: undefined,
  provider: undefined,
  isCollaborative: false,
  providerId: 0,
});

export function useCollaborativeEditor() {
  return useContext(CollaborativeEditorContext);
}

/** Connection timeout in milliseconds before falling back to standalone mode */
const CONNECT_TIMEOUT_MS = 5000;
/** Exponential backoff delays for reconnection attempts (ms) */
const RECONNECT_DELAYS = [5000, 10000, 20000, 40000, 60000] as const;
/** Maximum number of reconnection attempts before showing manual reconnect button */
const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS.length;

/**
 * Inner component that handles the PartyKit connection lifecycle.
 * Separated so the no-host path never mounts provider logic at all.
 */
function ConnectedEditorRoom({
  roomId,
  host,
  ydoc,
  children,
  onDocLoaded,
}: {
  roomId: string;
  host: string;
  ydoc: Y.Doc;
  children: React.ReactNode;
  onDocLoaded?: (ydoc: Y.Doc) => void;
}) {
  const [provider, setProvider] = useState<WebsocketProvider | undefined>(undefined);
  const [providerId, setProviderId] = useState(0);
  const [isSynced, setIsSynced] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  // Track all providers for cleanup on unmount (WR-06)
  const providersRef = useRef<Set<WebsocketProvider>>(new Set());

  // Reconnection state
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptReconnectRef = useRef<(() => void) | undefined>(undefined);

  /** Attempt to reconnect with exponential backoff */
  const attemptReconnect = useCallback(() => {
    if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      setIsReconnecting(false);
      return;
    }

    setIsReconnecting(true);
    const delay = RECONNECT_DELAYS[reconnectAttempt];

    console.warn(`[CollaborativeEditor] Reconnection attempt ${reconnectAttempt + 1}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

    reconnectTimeoutRef.current = setTimeout(() => {
      // Destroy any existing provider before creating a new one (CR-01)
      if (providerRef.current) {
        providerRef.current.destroy();
      }

      // Create a new provider instance to reconnect
      const newProvider = new YPartyKitProvider(host, roomId, ydoc);
      providerRef.current = newProvider;
      // Track this provider for cleanup (WR-06)
      providersRef.current.add(newProvider);

      newProvider.on("synced", (synced: boolean) => {
        if (synced) {
          setIsSynced(true);
          setTimedOut(false);
          setIsReconnecting(false);
          setReconnectAttempt(0); // Reset on success
          setProvider(newProvider);
          setProviderId(prev => prev + 1);
          onDocLoaded?.(ydoc);
        }
      });

      // If this attempt fails, schedule the next attempt directly (CR-02, CR-06)
      newProvider.on("connection-error", () => {
        setReconnectAttempt(prev => {
          const next = prev + 1;
          if (next >= MAX_RECONNECT_ATTEMPTS) {
            setIsReconnecting(false);
            return next;
          }
          // Schedule next attempt directly to avoid infinite loop
          const nextDelay = RECONNECT_DELAYS[next];
          reconnectTimeoutRef.current = setTimeout(() => {
            attemptReconnectRef.current?.();
          }, nextDelay);
          return next;
        });
      });
    }, delay);
  }, [roomId, host, ydoc, onDocLoaded, reconnectAttempt]);

  useEffect(() => {
    attemptReconnectRef.current = attemptReconnect;
  }, [attemptReconnect]);

  useEffect(() => {
    // Capture providers ref for cleanup to avoid stale closure warning
    const allProviders = providersRef.current;

    // Destroy any existing provider before creating a new one (CR-01)
    if (providerRef.current) {
      providerRef.current.destroy();
    }

    const newProvider = new YPartyKitProvider(host, roomId, ydoc);
    providerRef.current = newProvider;
    // Track this provider for cleanup (WR-06)
    allProviders.add(newProvider);

    newProvider.on("synced", (synced: boolean) => {
      if (synced) {
        // Capture timeout reference to avoid race condition (CR-07)
        const timeout = timeoutRef.current;
        if (timeout) {
          clearTimeout(timeout);
          timeoutRef.current = null;
        }
      }
      setIsSynced(synced);
      setProvider(newProvider);
      if (synced) {
        setProviderId(prev => prev + 1);
        onDocLoaded?.(ydoc);
      }
    });

    // Track disconnection for auto-reconnect
    newProvider.on("connection-close", () => {
      if (typeof window !== 'undefined' && window.__PLAYWRIGHT_TEST__) {
        console.warn(`[CollaborativeEditor] Playwright test mode: Ignoring connection-close for room "${roomId}".`);
        return;
      }
      console.warn(`[CollaborativeEditor] Connection closed for room "${roomId}". Attempting reconnect...`);
      setIsSynced(false);
      setTimedOut(true);
      attemptReconnect();
    });

    // Track connection errors
    newProvider.on("connection-error", (err: Error | unknown) => {
      console.error(`[CollaborativeEditor] Connection error for room "${roomId}":`, err);
    });

    // Bypass sync wait in Playwright tests
    if (typeof window !== 'undefined' && window.__PLAYWRIGHT_TEST__) {
      queueMicrotask(() => {
        setIsSynced(true);
        setTimedOut(false);
        setProvider(newProvider);
        onDocLoaded?.(ydoc);
      });
    } else {
      timeoutRef.current = setTimeout(() => {
        console.warn(`[CollaborativeEditor] PartyKit connection timed out after ${CONNECT_TIMEOUT_MS}ms for room "${roomId}". Falling back to standalone mode.`);
        setTimedOut(true);
        onDocLoaded?.(ydoc);
      }, CONNECT_TIMEOUT_MS);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      newProvider.destroy();
      // Destroy all providers that may have been created during reconnection (WR-06)
      allProviders.forEach(p => p.destroy());
      allProviders.clear();
    };
  }, [roomId, host, ydoc, onDocLoaded, attemptReconnect]);

  /** Manual reconnect handler for user-triggered reconnection */
  const handleManualReconnect = useCallback(() => {
    setReconnectAttempt(0);
    setIsReconnecting(true);
    // Trigger reconnection with reset attempt count
    const delay = RECONNECT_DELAYS[0];
    reconnectTimeoutRef.current = setTimeout(() => {
      // Destroy any existing provider before creating a new one (CR-01)
      if (providerRef.current) {
        providerRef.current.destroy();
      }

      const newProvider = new YPartyKitProvider(host, roomId, ydoc);
      providerRef.current = newProvider;
      // Track this provider for cleanup (WR-06)
      providersRef.current.add(newProvider);

      newProvider.on("synced", (synced: boolean) => {
        if (synced) {
          setIsSynced(true);
          setTimedOut(false);
          setIsReconnecting(false);
          setReconnectAttempt(0);
          setProvider(newProvider);
          setProviderId(prev => prev + 1);
          onDocLoaded?.(ydoc);
        }
      });

      newProvider.on("connection-error", () => {
        setReconnectAttempt(prev => {
          const next = prev + 1;
          if (next >= MAX_RECONNECT_ATTEMPTS) {
            setIsReconnecting(false);
            return next;
          }
          // Schedule next attempt directly
          const nextDelay = RECONNECT_DELAYS[next];
          reconnectTimeoutRef.current = setTimeout(() => {
            attemptReconnect();
          }, nextDelay);
          return next;
        });
      });
    }, delay);
  }, [roomId, host, ydoc, onDocLoaded, attemptReconnect]);

  const isCollaborative = isSynced && !timedOut;

  if (!isSynced && !timedOut) {
    return (
      <div className="flex items-center justify-center py-20 bg-ares-black border-x border-b border-white/10 rounded-b-xl min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-ares-cyan" size={24} />
          <span className="text-xs text-ares-gray">Connecting to collaborative server...</span>
        </div>
      </div>
    );
  }

  return (
    <CollaborativeEditorContext.Provider value={{ ydoc, provider, isCollaborative, providerId }}>
      <div className="relative">
        <StatusBadge
          isCollaborative={isCollaborative}
          isReconnecting={isReconnecting}
          reconnectAttempt={reconnectAttempt}
          maxAttempts={MAX_RECONNECT_ATTEMPTS}
          onManualReconnect={handleManualReconnect}
          host={host}
        />
        {children}
      </div>
    </CollaborativeEditorContext.Provider>
  );
}

function StatusBadge({
  isCollaborative,
  isReconnecting,
  reconnectAttempt,
  maxAttempts,
  onManualReconnect,
  host,
}: {
  isCollaborative: boolean;
  isReconnecting?: boolean;
  reconnectAttempt?: number;
  maxAttempts?: number;
  onManualReconnect?: () => void;
  host?: string;
}) {
  const hasExceededAttempts = reconnectAttempt !== undefined && maxAttempts !== undefined && reconnectAttempt >= maxAttempts;

  if (isCollaborative) {
    return (
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-ares-cyan/10 text-ares-cyan border border-ares-cyan/20">
        <Wifi size={10} /> Live
      </div>
    );
  }

  // Offline state
  return (
    <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-ares-gold/10 text-ares-gold border border-ares-gold/20">
        <WifiOff size={10} /> Offline
        {!isCollaborative && <span className="text-ares-bronze-light/80 text-[9px] ml-1">(Local only)</span>}
      </div>
      {isReconnecting && (
        <span className="text-[9px] text-ares-gold/80 animate-pulse">
          Reconnecting... ({(reconnectAttempt ?? 0) + 1}/{maxAttempts})
        </span>
      )}
      {hasExceededAttempts && onManualReconnect && (
        <button
          onClick={onManualReconnect}
          className="text-[9px] text-ares-cyan hover:text-ares-cyan/80 underline underline-offset-1 cursor-pointer"
          type="button"
        >
          Reconnect
        </button>
      )}
      {/* Show host for debugging */}
      {host && (
        <span className="text-[8px] text-marble/60 max-w-[150px] truncate" title={host}>
          {host}
        </span>
      )}
    </div>
  );
}

export function CollaborativeEditorRoom({
  roomId,
  children,
  onDocLoaded,
}: {
  roomId: string;
  children: React.ReactNode;
  onDocLoaded?: (ydoc: Y.Doc) => void;
}) {
  const [ydoc] = useState<Y.Doc>(() => new Y.Doc());
  const host = useMemo(() => {
    // In Playwright tests, force standalone mode by returning empty string
    if (typeof window !== 'undefined' && window.__PLAYWRIGHT_TEST__) {
      return "";
    }
    return import.meta.env.VITE_PARTYKIT_HOST || "";
  }, []);

  const stableOnDocLoaded = useCallback((doc: Y.Doc) => {
    onDocLoaded?.(doc);
  }, [onDocLoaded]);

  // No PartyKit host configured — render standalone immediately
  if (!host) {
    console.warn("[CollaborativeEditor] VITE_PARTYKIT_HOST is not set! Collaborative editing will be disabled.");
    return (
      <CollaborativeEditorContext.Provider value={{ ydoc, provider: undefined, isCollaborative: false, providerId: 0 }}>
        <div className="relative">
          <StatusBadge isCollaborative={false} />
          {children}
        </div>
      </CollaborativeEditorContext.Provider>
    );
  }

  return (
    <ConnectedEditorRoom roomId={roomId} host={host} ydoc={ydoc} onDocLoaded={stableOnDocLoaded}>
      {children}
    </ConnectedEditorRoom>
  );
}
