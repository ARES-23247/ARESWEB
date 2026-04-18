import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorStr: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorStr: ""
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorStr: error.toString() };
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
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-zinc-950 text-white rounded-xl border border-dashed border-red-500/50 p-8 shadow-2xl">
          <div className="text-red-500 mb-6">
            <svg className="w-16 h-16 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold font-mono tracking-widest text-red-500 uppercase mb-2">Telemetry Fault Detected</h2>
          <p className="text-zinc-400 text-center max-w-lg mb-6 leading-relaxed">
            The ARES React engine encountered an unhandled DOM rendering collision. The system has automatically isolated the fault.
          </p>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-md w-full max-w-xl text-left font-mono text-xs text-red-400 overflow-x-auto mb-8 shadow-inner">
            {this.state.errorStr}
          </div>
          <button 
            className="bg-white text-zinc-950 font-bold px-8 py-3 rounded-full hover:bg-ares-gold transition-colors tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-ares-gold ring-offset-2 ring-offset-zinc-950 shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_20px_rgba(251,191,36,0.4)]"
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
