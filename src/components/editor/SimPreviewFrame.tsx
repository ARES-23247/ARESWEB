import { logger } from "@/utils/logger";
import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import simulationPreviewRuntimeUrl from "./simulationPreviewRuntime?worker&url";
import type { LogEntry, TestResult } from "./SimConsole";
import {
  isSafeScreenshotDataUrl,
  isSafeTelemetryKey,
} from "../../hooks/useSimulationTelemetry";

interface SimPreviewFrameProps {
  /** Transpiled JavaScript code modules to execute in the sandbox */
  compiledFiles: Record<string, string>;
  /** Compilation error message, if any */
  compileError: string | null;
  /** Callback to trigger AI error fixing from the preview overlay */
  onFixWithAI?: () => void;
  /** Callback for test runner results */
  onTestResult?: (result: TestResult) => void;
  /** Callback for validated numeric telemetry samples from the sandbox */
  onTelemetry?: (sample: { key: string; value: number; timestamp: number }) => void;
  /** Callback for validated image data URL screenshots from the sandbox */
  onScreenshot?: (dataUrl: string) => void;
  /** Callback for validated console output from the sandbox */
  onConsoleLog?: (entry: LogEntry) => void;
  /** Callback for validated FPS updates from the sandbox */
  onFps?: (fps: number) => void;
}

const VALID_CONSOLE_LEVELS = new Set<LogEntry["level"]>([
  "log",
  "warn",
  "error",
  "info",
]);

const SANDBOX_IFRAME_PATH = "/sandbox/simulation-preview.html";

/**
 * Sandboxed iframe that renders a React component from transpiled JS code.
 * Uses a static opaque-origin host document (/sandbox/simulation-preview.html)
 * with no inline scripts so strict production CSP applies to the parent app
 * while untrusted simulation code stays confined to an isolated opaque realm.
 */
export default function SimPreviewFrame({
  compiledFiles,
  compileError,
  onFixWithAI,
  onTestResult,
  onTelemetry,
  onScreenshot,
  onConsoleLog,
  onFps,
}: SimPreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const compiledFilesRef = useRef(compiledFiles);
  const compileErrorRef = useRef(compileError);
  const isFirstRenderRef = useRef(true);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runNonce, setRunNonce] = useState(0);

  compiledFilesRef.current = compiledFiles;
  compileErrorRef.current = compileError;

  const ALLOWED_MESSAGE_TYPES = useMemo(
    () =>
      new Set([
        "sim-sandbox-ready",
        "sim-error",
        "sim-ready",
        "ARES_TELEMETRY",
        "ARES_SCREENSHOT",
        "sim-console",
        "sim-fps",
        "sim-test-result",
      ]),
    [],
  );

  const sanitizeMessageData = useCallback(
    (
      data: unknown,
      allowedTypes: Set<string>,
    ): { type: string; [key: string]: unknown } | null => {
      if (!data || typeof data !== "object" || Array.isArray(data)) return null;

      const raw = data as Record<string, unknown>;
      if (typeof raw.type !== "string" || !allowedTypes.has(raw.type)) {
        return null;
      }

      switch (raw.type) {
        case "sim-sandbox-ready":
        case "sim-ready":
          return { type: raw.type };

        case "ARES_TELEMETRY": {
          if (
            !isSafeTelemetryKey(raw.key) ||
            typeof raw.value !== "number" ||
            !Number.isFinite(raw.value)
          ) {
            return null;
          }
          const timestamp =
            typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp)
              ? raw.timestamp
              : Date.now();
          return {
            type: "ARES_TELEMETRY",
            key: raw.key.trim(),
            value: raw.value,
            timestamp,
          };
        }

        case "sim-fps": {
          if (
            typeof raw.fps !== "number" ||
            !Number.isFinite(raw.fps) ||
            raw.fps < 0 ||
            raw.fps > 1000
          ) {
            return null;
          }
          return { type: "sim-fps", fps: raw.fps };
        }

        case "sim-error": {
          if (typeof raw.message !== "string") return null;
          const message =
            raw.message.length > 10_000
              ? `${raw.message.slice(0, 10_000)}... (truncated)`
              : raw.message;
          return { type: "sim-error", message };
        }

        case "sim-console": {
          if (
            typeof raw.level !== "string" ||
            !VALID_CONSOLE_LEVELS.has(raw.level as LogEntry["level"]) ||
            !Array.isArray(raw.args) ||
            raw.args.length > 20
          ) {
            return null;
          }
          const args = raw.args.map((arg) => {
            const text = typeof arg === "string" ? arg : String(arg);
            return text.length > 2_000
              ? `${text.slice(0, 2_000)}... (truncated)`
              : text;
          });
          const timestamp =
            typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp)
              ? raw.timestamp
              : Date.now();
          return {
            type: "sim-console",
            level: raw.level as LogEntry["level"],
            args,
            timestamp,
          };
        }

        case "ARES_SCREENSHOT": {
          if (!isSafeScreenshotDataUrl(raw.dataUrl)) return null;
          return { type: "ARES_SCREENSHOT", dataUrl: raw.dataUrl };
        }

        case "sim-test-result": {
          const candidate = raw.result;
          if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
            return null;
          }
          const resultObj = candidate as Record<string, unknown>;
          if (
            typeof resultObj.name !== "string" ||
            resultObj.name.length === 0 ||
            resultObj.name.length > 200 ||
            typeof resultObj.passed !== "boolean"
          ) {
            return null;
          }
          const normalized: TestResult = {
            name: resultObj.name,
            passed: resultObj.passed,
          };
          if (typeof resultObj.error === "string") {
            normalized.error =
              resultObj.error.length > 2_000
                ? `${resultObj.error.slice(0, 2_000)}... (truncated)`
                : resultObj.error;
          }
          return { type: "sim-test-result", result: normalized };
        }

        default:
          return null;
      }
    },
    [],
  );

  const postCompiledBundle = useCallback(() => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow || compileErrorRef.current) return;
    const filesPayload: Record<string, string> = {};
    for (const [filename, content] of Object.entries(compiledFilesRef.current)) {
      if (typeof filename === "string" && typeof content === "string") {
        filesPayload[filename] = content;
      }
    }
    // Opaque sandbox has no target origin; payload holds only user-authored preview code.
    targetWindow.postMessage(
      {
        type: "sim-run",
        runtimeUrl: simulationPreviewRuntimeUrl,
        compiledFiles: filesPayload,
      },
      "*",
    );
  }, []);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // A sandbox without allow-same-origin has an opaque origin ("null").
      // Check both opaque origin and exact WindowProxy identity.
      if (
        (event.origin !== "null" && event.origin !== "") ||
        event.source !== iframeRef.current?.contentWindow
      ) {
        logger.warn("SimPreviewFrame: rejected message from unexpected source");
        return;
      }

      const sanitized = sanitizeMessageData(event.data, ALLOWED_MESSAGE_TYPES);
      if (!sanitized) {
        logger.warn("SimPreviewFrame: rejected message with invalid structure");
        return;
      }

      switch (sanitized.type) {
        case "sim-sandbox-ready":
          postCompiledBundle();
          break;
        case "sim-error":
          setRuntimeError(String(sanitized.message));
          break;
        case "sim-ready":
          setRuntimeError(null);
          break;
        case "sim-test-result":
          onTestResult?.(sanitized.result as TestResult);
          break;
        case "ARES_TELEMETRY":
          onTelemetry?.({
            key: sanitized.key as string,
            value: sanitized.value as number,
            timestamp: sanitized.timestamp as number,
          });
          break;
        case "ARES_SCREENSHOT":
          onScreenshot?.(sanitized.dataUrl as string);
          break;
        case "sim-console":
          onConsoleLog?.({
            level: sanitized.level as LogEntry["level"],
            args: sanitized.args as string[],
            timestamp: sanitized.timestamp as number,
          });
          break;
        case "sim-fps":
          onFps?.(sanitized.fps as number);
          break;
      }
    },
    [
      ALLOWED_MESSAGE_TYPES,
      onConsoleLog,
      onFps,
      onScreenshot,
      onTelemetry,
      onTestResult,
      postCompiledBundle,
      sanitizeMessageData,
    ],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Mount a fresh sandbox realm whenever compiledFiles changes after initial render.
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (compileError) return;
    setRuntimeError(null);
    setRunNonce((prev) => prev + 1);
  }, [compiledFiles, compileError]);

  const displayError = compileError || runtimeError;

  return (
    <div className="relative h-full flex flex-col">
      {displayError && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-ares-red/90 border-b border-white/30 px-4 py-3 flex items-start gap-2 text-white text-xs font-mono">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <pre className="whitespace-pre-wrap flex-1">{displayError}</pre>
          {onFixWithAI && (
            <button
              type="button"
              onClick={onFixWithAI}
              className="shrink-0 ml-2 px-2.5 py-1 bg-ares-red hover:bg-ares-bronze text-white border border-white/30 rounded transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
            >
              Fix with AI
            </button>
          )}
        </div>
      )}
      <iframe
        key={runNonce}
        ref={iframeRef}
        src={SANDBOX_IFRAME_PATH}
        title="Simulation Preview"
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="flex-1 w-full h-full bg-obsidian-dark border-0 rounded-b-lg"
      />
    </div>
  );
}
