import { useRef, useEffect, useCallback, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface SimPreviewFrameProps {
  /** Transpiled JavaScript code to execute in the sandbox */
  compiledCode: string;
  /** Compilation error message, if any */
  compileError: string | null;
}

/**
 * Sandboxed iframe that renders a React component from transpiled JS code.
 * Uses srcdoc with React CDN + the user's component. Runtime errors
 * are captured via postMessage and displayed in the parent.
 */
export default function SimPreviewFrame({ compiledCode, compileError }: SimPreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // Listen for runtime errors from the iframe
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === "sim-error") {
      setRuntimeError(event.data.message);
    }
    if (event.data?.type === "sim-ready") {
      setRuntimeError(null);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Build the iframe srcdoc whenever compiledCode changes
  useEffect(() => {
    if (!iframeRef.current || compileError) return;
    setRuntimeError(null);

    const srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    #root {
      width: 100%;
      max-width: 800px;
    }
    .sim-error {
      background: #3d1f1f;
      border: 1px solid #f85149;
      color: #f85149;
      padding: 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
    }
    .sim-loading {
      color: rgba(255,255,255,0.3);
      font-size: 13px;
      text-align: center;
      padding: 32px;
    }
    /* Utility classes for sim authors */
    .sim-container { padding: 24px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: rgba(255,255,255,0.03); }
    .sim-title { font-size: 18px; font-weight: 700; color: #d4a030; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.1em; }
    .sim-label { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.05em; }
    .sim-value { font-size: 24px; font-weight: 700; color: #58a6ff; font-family: monospace; }
    .sim-slider { width: 100%; accent-color: #d4a030; }
    .sim-canvas { border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; }
    .sim-btn { padding: 8px 16px; background: #d4a030; color: #000; font-weight: 700; border: none; border-radius: 4px; cursor: pointer; text-transform: uppercase; font-size: 12px; letter-spacing: 0.1em; }
    .sim-btn:hover { background: #e8b84a; }
    .sim-grid { display: grid; gap: 16px; }
    .sim-flex { display: flex; gap: 12px; align-items: center; }
  </style>
</head>
<body>
  <div id="root"><div class="sim-loading">Loading React...</div></div>
  <script>
    window.onerror = function(msg, source, line, col, error) {
      parent.postMessage({ type: 'sim-error', message: String(msg) + (line ? ' (line ' + line + ')' : '') }, '*');
      document.getElementById('root').innerHTML = '<div class="sim-error">' + msg + '</div>';
      return true;
    };

    // Load a script with fallback
    function loadScript(primary, fallback) {
      return new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.crossOrigin = 'anonymous';
        s.src = primary;
        s.onload = resolve;
        s.onerror = function() {
          var s2 = document.createElement('script');
          s2.crossOrigin = 'anonymous';
          s2.src = fallback;
          s2.onload = resolve;
          s2.onerror = reject;
          document.head.appendChild(s2);
        };
        document.head.appendChild(s);
      });
    }

    // Load React then ReactDOM, then run user code
    loadScript(
      'https://unpkg.com/react@18/umd/react.production.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js'
    ).then(function() {
      return loadScript(
        'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js'
      );
    }).then(function() {
      try {
        ${compiledCode}
        if (typeof SimComponent !== 'undefined') {
          var root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(SimComponent));
          parent.postMessage({ type: 'sim-ready' }, '*');
        } else {
          throw new Error('SimComponent is not defined. Your code must define: function SimComponent() { ... }');
        }
      } catch(e) {
        parent.postMessage({ type: 'sim-error', message: e.message }, '*');
        document.getElementById('root').innerHTML = '<div class="sim-error">' + e.message + '</div>';
      }
    }).catch(function() {
      var msg = 'Failed to load React from CDN. Check your internet connection and try again.';
      parent.postMessage({ type: 'sim-error', message: msg }, '*');
      document.getElementById('root').innerHTML = '<div class="sim-error">' + msg + '</div>';
    });
  </script>
</body>
</html>`;

    iframeRef.current.srcdoc = srcdoc;
  }, [compiledCode, compileError]);

  const displayError = compileError || runtimeError;

  return (
    <div className="relative h-full flex flex-col">
      {displayError && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-red-950/90 border-b border-red-500/30 px-4 py-3 flex items-start gap-2 text-red-400 text-xs font-mono">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <pre className="whitespace-pre-wrap">{displayError}</pre>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Simulation Preview"
        sandbox="allow-scripts"
        className="flex-1 w-full h-full bg-[#0d1117] border-0 rounded-b-lg"
      />
    </div>
  );
}
