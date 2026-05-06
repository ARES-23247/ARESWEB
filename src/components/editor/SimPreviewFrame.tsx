import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { AlertTriangle } from "lucide-react";

interface SimPreviewFrameProps {
  /** Transpiled JavaScript code modules to execute in the sandbox */
  compiledFiles: Record<string, string>;
  /** Compilation error message, if any */
  compileError: string | null;
  /** Callback to trigger AI error fixing from the preview overlay */
  onFixWithAI?: () => void;
  /** Callback for test runner results */
  onTestResult?: (result: { name: string; passed: boolean; error?: string }) => void;
}

/**
 * Sandboxed iframe that renders a React component from transpiled JS code.
 * Uses srcdoc with React CDN + the user's component. Runtime errors
 * are captured via postMessage and displayed in the parent.
 */
export default function SimPreviewFrame({ compiledFiles, compileError, onFixWithAI, onTestResult }: SimPreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // Build allowed origins allowlist for strict PostMessage validation
  const allowedOrigins = useMemo(() => new Set([
    window.location.origin,
    // Production domain - add when deployed
    // 'https://ares-23247.org',
  ].filter(Boolean)), []);

  // Strict message type validation - only these types are accepted
  const ALLOWED_MESSAGE_TYPES = useMemo(() => new Set([
    'sim-error',
    'sim-ready',
    'ARES_TELEMETRY',
    'ARES_SCREENSHOT',
    'sim-console',
    'sim-fps',
    'sim-test-result'
  ]), []);

  /**
   * Validate and sanitize incoming postMessage data.
   * Returns null if data is invalid, otherwise returns sanitized data.
   */
  const sanitizeMessageData = (data: unknown, allowedTypes: Set<string>): { type: string; [key: string]: unknown } | null => {
    if (!data || typeof data !== 'object') return null;

    const messageData = data as Record<string, unknown>;

    // Validate type field exists and is a string
    if (typeof messageData.type !== 'string' || !allowedTypes.has(messageData.type)) {
      return null;
    }

    // Type-specific validation
    switch (messageData.type) {
      case 'ARES_TELEMETRY':
        // Validate telemetry key is a string and value is a number
        if (typeof messageData.key !== 'string' || typeof messageData.value !== 'number') {
          return null;
        }
        // Limit key length to prevent DoS
        if (messageData.key.length > 100) return null;
        break;

      case 'sim-error':
        // Validate message is a string and limit length
        if (typeof messageData.message !== 'string') return null;
        if (messageData.message.length > 10000) {
          messageData.message = messageData.message.slice(0, 10000) + '... (truncated)';
        }
        break;

      case 'sim-console':
        // Validate args is an array
        if (!Array.isArray(messageData.args)) return null;
        // Limit number of console args to prevent DoS
        if (messageData.args.length > 20) return null;
        break;

      case 'ARES_SCREENSHOT':
        // Validate dataUrl is a string and looks like a data URL
        if (typeof messageData.dataUrl !== 'string') return null;
        if (!messageData.dataUrl.startsWith('data:image/')) return null;
        // Limit data URL size to prevent DoS (5MB max)
        if (messageData.dataUrl.length > 5 * 1024 * 1024) return null;
        break;

      case 'sim-test-result':
        if (!messageData.result || typeof messageData.result !== 'object') return null;
        break;
    }

    return messageData as { type: string; [key: string]: unknown };
  };

  // Listen for runtime errors from the iframe
  const handleMessage = useCallback((event: MessageEvent) => {
    // Validate origin using allowlist approach
    if (!allowedOrigins.has(event.origin)) {
      console.warn('SimPreviewFrame: rejected message from unexpected origin:', event.origin);
      return;
    }

    // Sanitize and validate message structure
    const sanitizedData = sanitizeMessageData(event.data, ALLOWED_MESSAGE_TYPES);
    if (!sanitizedData) {
      console.warn('SimPreviewFrame: rejected message with invalid structure');
      return;
    }

    switch (sanitizedData.type) {
      case 'sim-error':
        setRuntimeError(String(sanitizedData.message));
        break;
      case 'sim-ready':
        setRuntimeError(null);
        break;
      case 'sim-test-result':
        if (onTestResult) {
          onTestResult(sanitizedData.result as { name: string; passed: boolean; error?: string });
        }
        break;
      // ARES_TELEMETRY and sim-console are logged but not processed further
      // ARES_SCREENSHOT is handled by screenshot request handler
    }
  }, [allowedOrigins, ALLOWED_MESSAGE_TYPES, onTestResult]);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Build the iframe srcdoc whenever compiledFiles changes
  useEffect(() => {
    if (!iframeRef.current || compileError) return;
    setRuntimeError(null);

    // Build CSS injection blocks from .css files
    const cssBlocks = Object.entries(compiledFiles)
      .filter(([filename]) => filename.endsWith('.css'))
      .map(([filename, content]) => `<style data-file="${filename}">${content}</style>`)
      .join('\n');

    // Build the script blocks for each compiled file (skip CSS)
    const moduleDefs = Object.entries(compiledFiles)
      .filter(([filename]) => !filename.endsWith('.css'))
      .map(([filename, code]) => {
        // We use env preset, so it outputs CommonJS. We wrap it in a function.
        return `
      __modules['${filename}'] = function(require, module, exports) {
        ${code}
      };
      `;
      })
      .join('\n');

    const srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- html2canvas with Subresource Integrity - generate SRI with: openssl dgst -sha384 -binary FILE | openssl base64 -A -->
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
          integrity="sha384-u/KoVFLnMiHwA4ANW0l7jN5JqdV7XFsEZx5G1Semv5f5fZ+kJPbYg/jAvQPsKWwj"
          crossorigin="anonymous"></script>
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
  ${cssBlocks}
  <script>
    // Virtual Module System & require MUST be defined before ares-physics.min.js loads
    // so that its internal require('react') calls succeed.
    window.__modules = {};
    window.__cache = {};
    window.__virtualModules = {};

    // Test runner harness
    window.test = function(name, fn) {
      try {
        fn();
        window.parent.postMessage({ type: 'sim-test-result', result: { name, passed: true } }, '*');
      } catch (e) {
        window.parent.postMessage({ type: 'sim-test-result', result: { name, passed: false, error: e.message } }, '*');
      }
    };
    
    window.expect = function(actual) {
      return {
        toBe: function(expected) {
          if (actual !== expected) throw new Error('Expected ' + expected + ' but got ' + actual);
        },
        toEqual: function(expected) {
          if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
        },
        toBeCloseTo: function(expected, precision = 2) {
          const pass = Math.abs(expected - actual) < Math.pow(10, -precision) / 2;
          if (!pass) throw new Error('Expected ' + expected + ' to be close to ' + actual);
        }
      };
    };
    
    function require(name) {
      if (name === 'react') return window.React;
      if (name === 'react-dom') return window.ReactDOM;
      if (window.__virtualModules[name]) return window.__virtualModules[name].exports;
      
      let resolveName = name;
      // Strip leading ./ or ../
      if (resolveName.startsWith('./')) resolveName = resolveName.slice(2);
      while (resolveName.startsWith('../')) resolveName = resolveName.slice(3);
      
      // Try exact match first
      if (window.__modules[resolveName]) {
        // Found exact match
      } else {
        // Try common extensions: .tsx, .jsx, .ts, .js
        const exts = ['.tsx', '.jsx', '.ts', '.js'];
        let found = false;
        for (const ext of exts) {
          if (window.__modules[resolveName + ext]) {
            resolveName = resolveName + ext;
            found = true;
            break;
          }
        }
        // Try index file in subdirectory
        if (!found) {
          for (const ext of exts) {
            if (window.__modules[resolveName + '/index' + ext]) {
              resolveName = resolveName + '/index' + ext;
              found = true;
              break;
            }
          }
        }
      }
      
      if (window.__cache[resolveName]) return window.__cache[resolveName].exports;
      if (!window.__modules[resolveName]) {
        const available = Object.keys(window.__modules).join(', ');
        throw new Error('Module not found: ' + name + '. Available: [' + available + ']');
      }
      
      const module = { exports: {} };
      window.__cache[resolveName] = module;
      window.__modules[resolveName](require, module, module.exports);
      return module.exports;
    }
  </script>
  <script src="${window.location.origin}/vendor/react.production.min.js"></script>
  <script src="${window.location.origin}/vendor/react-dom.production.min.js"></script>
  <script src="${window.location.origin}/vendor/ares-physics.min.js"></script>
</head>
<body>
  <div id="root"><div class="sim-loading">Loading Environment...</div></div>
  <script>
    window.onerror = function(msg, source, line, col, error) {
      window.parent.postMessage({ type: 'sim-error', message: String(msg) + (line ? ' (line ' + line + ')' : '') }, '${window.location.origin}');
      document.getElementById('root').innerHTML = '<div class="sim-error">' + msg + '</div>';
      return true;
    };
    
    ['log', 'warn', 'error', 'info'].forEach(level => {
      const original = console[level];
      console[level] = function(...args) {
        window.parent.postMessage({
          type: 'sim-console',
          level,
          args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)),
          timestamp: Date.now()
        }, '${window.location.origin}');
        original.apply(console, args);
      };
    });
    
    // Now that scripts are loaded, populate the virtual modules with the global exports
    window.__virtualModules["areslib"] = {
      exports: {
        useTelemetry: function(key, value) {
          React.useEffect(() => {
            window.parent.postMessage({ type: "ARES_TELEMETRY", key, value, timestamp: performance.now() }, "${window.location.origin}");
          }, [key, value]);
        }
      }
    };
    const createProxy = (moduleName) => new Proxy({}, {
      get: function(target, prop) {
        if (prop === '__esModule') return true;
        const base = window.AresPhysics;
        if (!base) return undefined;
        
        const mod = moduleName ? base[moduleName] : base;
        if (prop === 'default') return mod;
        return mod ? mod[prop] : undefined;
      }
    });

    window.__virtualModules["three"] = { exports: createProxy('THREE') };
    window.__virtualModules["@react-three/fiber"] = { exports: createProxy('R3F') };
    window.__virtualModules["@react-three/drei"] = { exports: createProxy('Drei') };
    window.__virtualModules["ares-physics"] = { exports: createProxy('') };

    try {
      if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
        throw new Error('React failed to load. Please refresh the page.');
      }
      
      ${moduleDefs}
      
      // Execute the entry point
      let SimComponent;
      
      // Try standard entry points first
      if (window.__modules['SimComponent.jsx']) {
        const entryExports = require('SimComponent.jsx');
        SimComponent = entryExports.default || entryExports.SimComponent || window.SimComponent;
      } 
      
      // If not found, use the first available module that looks like a component
      if (!SimComponent) {
        const availableModules = Object.keys(window.__modules);
        const entryFile = availableModules.find(f => f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.js'));
        
        if (entryFile) {
          const entryExports = require(entryFile);
          SimComponent = entryExports.default || entryExports[entryFile.replace(/\\.[^/.]+$/, "")] || window.SimComponent;
          
          // Fallback: if it exports exactly one thing, use that
          if (!SimComponent && Object.keys(entryExports).length === 1) {
            SimComponent = entryExports[Object.keys(entryExports)[0]];
          }
        }
      }
      
      if (typeof SimComponent !== 'undefined') {
        var root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(SimComponent));
        window.parent.postMessage({ type: 'sim-ready' }, '${window.location.origin}');
      } else {
        throw new Error('SimComponent is not defined. Your code must export a default React component.');
      }
    } catch(e) {
      window.parent.postMessage({ type: 'sim-error', message: e.message }, '${window.location.origin}');
      document.getElementById('root').innerHTML = '<div class="sim-error">' + e.message + '</div>';
    }

    // Listen for screenshot requests
    window.addEventListener('message', async (e) => {
      // Validate origin - only accept messages from parent window
      if (e.origin !== '${window.location.origin}') return;

      if (e.data?.type === 'ARES_REQUEST_SCREENSHOT' && window.html2canvas) {
        try {
          const canvas = await window.html2canvas(document.body, { useCORS: true, logging: false });
          window.parent.postMessage({ type: 'ARES_SCREENSHOT', dataUrl: canvas.toDataURL('image/png') }, '${window.location.origin}');
        } catch(err) {
          console.error("Screenshot failed inside sandbox:", err);
        }
      }
    });
    // FPS counter
    (function() {
      let frames = 0;
      let lastTime = performance.now();
      function countFrame() {
        frames++;
        const now = performance.now();
        if (now - lastTime >= 1000) {
          window.parent.postMessage({ type: 'sim-fps', fps: frames }, '${window.location.origin}');
          frames = 0;
          lastTime = now;
        }
        requestAnimationFrame(countFrame);
      }
      requestAnimationFrame(countFrame);
    })();
  </script>
</body>
</html>`;

    iframeRef.current.srcdoc = srcdoc;
  }, [compiledFiles, compileError]);

  const displayError = compileError || runtimeError;

  return (
    <div className="relative h-full flex flex-col">
      {displayError && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-red-950/90 border-b border-red-500/30 px-4 py-3 flex items-start gap-2 text-red-400 text-xs font-mono">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <pre className="whitespace-pre-wrap flex-1">{displayError}</pre>
          {onFixWithAI && (
            <button
              onClick={onFixWithAI}
              className="shrink-0 ml-2 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
            >
              ✨ Fix with AI
            </button>
          )}
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Simulation Preview"
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
        className="flex-1 w-full h-full bg-[#0d1117] border-0 rounded-b-lg"
      />
    </div>
  );
}
