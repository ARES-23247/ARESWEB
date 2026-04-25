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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static getDerivedStateFromError(error: any): State {
    const correlationId = Math.random().toString(36).substring(2, 10).toUpperCase();
    return { 
      hasError: true, 
      errorStr: error.stack || error.toString(),
      correlationId,
      statusCode: error.status || error.statusCode || error.response?.status
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ARES React Error Boundary Intercepted Fault:", error, errorInfo);
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
              <span className="text-[10px] uppercase text-white/40 font-bold tracking-widest">Correlation ID</span>
              <span className="text-sm font-mono text-ares-gold">{this.state.correlationId}</span>
            </div>
            {this.state.statusCode && (
              <div className="bg-black/40 px-3 py-1.5 ares-cut-sm border border-white/10 flex flex-col items-center">
                <span className="text-[10px] uppercase text-white/40 font-bold tracking-widest">HTTP Status</span>
                <span className="text-sm font-mono text-ares-red">{this.state.statusCode}</span>
              </div>
            )}
          </div>

          <div className="bg-ares-gray-dark border border-white/10 p-4 ares-cut-sm w-full max-w-xl text-left font-mono text-xs text-white overflow-x-auto mb-8 shadow-inner">
            {this.state.errorStr}
          </div>
          <button 
            className="bg-white text-ares-gray-deep font-bold px-8 py-3 rounded-full hover:bg-ares-gold transition-colors tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-ares-gold ring-offset-2 ring-offset-ares-gray-deep shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_20px_rgba(251,191,36,0.4)]"
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
