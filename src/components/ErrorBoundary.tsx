import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorStr: string;
  correlationId: string;
  statusCode?: number;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorStr: "",
    correlationId: ""
  };

  public static getDerivedStateFromError(error: unknown): State {
    // Type narrow from unknown to extract error information safely
    const getErrorMessage = (err: unknown): string => {
      if (err instanceof Error) {
        return err.message || "";
      }
      if (typeof err === "string") {
        return err;
      }
      return String(err);
    };

    const errorMessage = getErrorMessage(error);

    // Detect stale chunk errors from PWA/service worker cache after deployment
    const isStaleChunk =
      errorMessage.includes("Failed to fetch dynamically imported module") ||
      errorMessage.includes("Importing a module script failed") ||
      errorMessage.includes("error loading dynamically imported module");

    if (isStaleChunk) {
      const reloadKey = "ares-stale-chunk-reload";
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      // Only auto-reload once per 60s to prevent infinite loop
      if (!lastReload || now - Number(lastReload) > 60_000) {
        sessionStorage.setItem(reloadKey, String(now));
        // Unregister stale service worker and force reload
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(r => r.unregister());
          });
        }
        window.location.reload();
      }
    }

    const isThirdPartyFault =
      errorMessage.includes("SecurityError") ||
      errorMessage.includes("cross-origin") ||
      errorMessage.includes("Blocked a frame");

    const correlationId = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Extract status code with proper type guards
    const getStatusCode = (err: unknown): number | undefined => {
      if (err instanceof Error && "status" in err && typeof err.status === "number") {
        return err.status;
      }
      if (err && typeof err === "object" && "statusCode" in err && typeof err.statusCode === "number") {
        return err.statusCode;
      }
      if (err && typeof err === "object" && "response" in err) {
        const response = (err as { response: unknown }).response;
        if (response && typeof response === "object" && "status" in response && typeof response.status === "number") {
          return response.status;
        }
      }
      return undefined;
    };

    // Extract error details with type narrowing
    const getErrorDetails = (err: unknown): { stack: string; toString: string } => {
      if (err instanceof Error) {
        return {
          stack: err.stack || "",
          toString: err.toString()
        };
      }
      return {
        stack: "",
        toString: String(err)
      };
    };

    const errorDetails = getErrorDetails(error);

    return {
      hasError: true,
      errorStr: isThirdPartyFault ? "Third-party resource or iframe blocked due to security constraints." : (errorDetails.stack || errorDetails.toString),
      correlationId,
      statusCode: getStatusCode(error)
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ARES React Error Boundary Intercepted Fault:", error, errorInfo);

    // Report to Sentry if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== "undefined" && (window as any).Sentry) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Sentry.captureException(error, {
        tags: { component: "ErrorBoundary", correlationId: this.state.correlationId },
        extra: { errorInfo, statusCode: this.state.statusCode },
      });
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-ares-gray-deep text-white ares-cut-sm border border-dashed border-ares-danger/50 p-8 shadow-2xl">
          <div className="text-ares-danger mb-6">
            <svg className="w-16 h-16 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold font-mono tracking-widest text-ares-danger uppercase mb-2">Telemetry Fault Detected</h2>
          <p className="text-white/60 text-center max-w-lg mb-6 leading-relaxed">
            The ARES React engine encountered an unhandled DOM rendering collision. The system has automatically isolated the fault.
          </p>

          <div className="flex gap-4 mb-4">
            <div className="bg-black/40 px-3 py-1.5 ares-cut-sm border border-white/10 flex flex-col items-center">
              <span className="text-[10px] uppercase text-white/70 font-bold tracking-widest">Correlation ID</span>
              <span className="text-sm font-mono text-ares-gold">{this.state.correlationId}</span>
            </div>
            {this.state.statusCode && (
              <div className="bg-black/40 px-3 py-1.5 ares-cut-sm border border-white/10 flex flex-col items-center">
                <span className="text-[10px] uppercase text-white/70 font-bold tracking-widest">HTTP Status</span>
                <span className="text-sm font-mono text-ares-red">{this.state.statusCode}</span>
              </div>
            )}
          </div>

          <div className="bg-ares-gray-dark border border-white/10 p-4 ares-cut-sm w-full max-w-xl text-left font-mono text-xs text-white overflow-x-auto mb-8 shadow-inner">
            {this.state.errorStr}
          </div>
          <button 
            className="bg-white text-ares-gray-deep font-bold px-8 py-3 ares-cut-sm hover:bg-ares-gold transition-colors tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-ares-gold ring-offset-2 ring-offset-ares-gray-deep shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_20px_rgba(251,191,36,0.4)]"
            onClick={() => window.location.reload()}
          >
            Reboot Interface
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
