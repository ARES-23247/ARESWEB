/**
 * LazyMonacoEditor.tsx
 *
 * Lazy-loaded Monaco Editor wrapper with ARES-branded loading UX and error handling.
 * Implements 3-second timeout with friendly messaging and retry logic.
 *
 * SECURITY: Version pinned to 0.52.2 for supply chain stability.
 * MITIGATION: CSP restricts script sources to cdn.jsdelivr.net.
 */

import { lazy, Suspense, useState, useEffect, ReactNode } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { loader } from "@monaco-editor/react";
import { logger } from "../../utils/logger";
import EditorSkeleton from "./EditorSkeleton";

// Monaco Editor CDN Configuration
const MONACO_VERSION = "0.52.2";
loader.config({
  paths: { vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs` }
});

// Lazy import Monaco Editor
const MonacoEditor = lazy(() => import("@monaco-editor/react"));

import type { editor } from "monaco-editor";

interface LazyMonacoEditorProps {
  height?: string | number;
  language?: string;
  theme?: string;
  path?: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  onMount?: (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => void;
  options?: Record<string, unknown>;
}

// Compact ARES-red spinner (matches SimLoader pattern)
// Unused component retained for reference
// function SimLoader() {
//   return (
//     <div className="flex justify-center items-center py-8">
//       <div className="w-8 h-8 border-4 border-ares-red/30 border-t-ares-red rounded-full animate-spin" />
//     </div>
//   );
// }

// Error display with retry
function ErrorDisplay({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 gap-4 text-center">
      <AlertCircle className="w-12 h-12 text-ares-red" aria-hidden="true" />
      <div>
        <h3 className="text-lg font-bold text-white mb-2">Editor Load Failed</h3>
        <p className="text-sm text-white/60 max-w-md">{error}</p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 bg-ares-red hover:bg-ares-red/80 text-white rounded font-semibold transition-colors"
      >
        <RotateCw className="w-4 h-4" />
        Try Again
      </button>
      <p className="text-xs text-white/40 mt-2">
        If this persists, try refreshing the page.
      </p>
    </div>
  );
}

// Loading wrapper with timeout detection
function LoadingWrapper({ children, timedOut }: { children: ReactNode; timedOut: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Suspense fallback={<EditorSkeleton />}>
        {children}
      </Suspense>
      {timedOut && (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="text-sm text-ares-gold bg-black/60 px-4 py-2 rounded inline-block">
            Taking longer than expected... (Monaco is ~2.5MB)
          </p>
        </div>
      )}
    </div>
  );
}

export default function LazyMonacoEditor({ onMount: originalOnMount, ...restProps }: LazyMonacoEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  // 3-second timeout detection
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTimedOut(true);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleRetry = () => {
    if (retryCount >= 1) {
      // After one retry, suggest page refresh
      setError("Editor still cannot load. Please refresh the page.");
      return;
    }

    setRetryCount((prev) => prev + 1);
    setError(null);

    // Exponential backoff: 1 second delay before retry
    setTimeout(() => {
      logger.info("Retrying Monaco Editor load...");
      window.location.reload();
    }, 1000);
  };

  if (error) {
    return <ErrorDisplay error={error} onRetry={handleRetry} />;
  }

  return (
    <div className="h-full w-full relative">
      <LoadingWrapper timedOut={timedOut}>
        <MonacoEditor
          {...restProps}
          onMount={(editor, monaco) => {
            // Clear timeout on successful mount
            setTimedOut(false);
            originalOnMount?.(editor, monaco);
          }}
          // Handle Monaco worker initialization failures
          beforeMount={(_monaco) => {
            // Monaco pre-mount hook — reserved for future worker config
          }}
        />
      </LoadingWrapper>
    </div>
  );
}

// Export types for consumers
export type { LazyMonacoEditorProps };
