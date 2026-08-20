/**
 * LazyMonacoEditor.tsx
 *
 * Lazy-loaded Monaco Editor wrapper with ARES-branded loading UX and error handling.
 * Implements 3-second timeout with friendly messaging and retry logic.
 *
 * Monaco is bundled from the lockfile rather than fetched from a runtime CDN.
 */

import { useState, useEffect } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import "./monacoRuntime";
import MonacoEditor, {
  DiffEditor as MonacoDiffEditor,
  type DiffEditorProps,
  type Monaco,
} from "@monaco-editor/react";
import { logger } from "../../utils/logger";
import EditorSkeleton from "./EditorSkeleton";

import type { editor } from "monaco-editor";

interface LazyMonacoEditorProps {
  height?: string | number;
  language?: string;
  theme?: string;
  path?: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  onMount?: (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => void;
  options?: Record<string, unknown>;
}

// Error display with retry
function ErrorDisplay({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 gap-4 text-center">
      <AlertCircle className="w-12 h-12 text-ares-red" aria-hidden="true" />
      <div>
        <h3 className="text-lg font-bold text-white mb-2">
          Editor Load Failed
        </h3>
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

export default function LazyMonacoEditor({
  onMount: originalOnMount,
  ...restProps
}: LazyMonacoEditorProps) {
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
      <MonacoEditor
        {...restProps}
        loading={<EditorSkeleton />}
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
      {timedOut && (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="text-sm text-ares-gold bg-black/60 px-4 py-2 rounded inline-block">
            Loading the code editor and language tools…
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Keeps the diff editor behind the same bundled Monaco worker configuration as
 * the standard editor. This matters when AI changes are the first editor view
 * opened in a session: importing DiffEditor directly would bypass
 * monacoRuntime's local-worker setup.
 */
export function LazyMonacoDiffEditor(props: DiffEditorProps) {
  return (
    <div className="h-full w-full relative">
      <MonacoDiffEditor {...props} loading={<EditorSkeleton />} />
    </div>
  );
}

// Export types for consumers
export type {
  DiffEditorProps as LazyMonacoDiffEditorProps,
  LazyMonacoEditorProps,
};
