import { useCallback } from "react";
import { LogEntry } from "../components/editor/SimConsole";

export const MAX_TELEMETRY_SERIES = 16;
export const MAX_TELEMETRY_POINTS = 100;
export const MAX_CONSOLE_LOGS = 200;

export const ALLOWED_SCREENSHOT_DATA_URL =
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

const FORBIDDEN_TELEMETRY_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export function isSafeTelemetryKey(key: unknown): key is string {
  if (typeof key !== "string") return false;
  const trimmed = key.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return false;
  if (FORBIDDEN_TELEMETRY_KEYS.has(trimmed)) return false;
  if (trimmed in Object.prototype) return false;
  return true;
}

export function isSafeScreenshotDataUrl(dataUrl: unknown): dataUrl is string {
  return (
    typeof dataUrl === "string" &&
    dataUrl.length <= 5 * 1024 * 1024 &&
    ALLOWED_SCREENSHOT_DATA_URL.test(dataUrl)
  );
}

interface UseSimulationTelemetryProps {
  setTelemetry: React.Dispatch<React.SetStateAction<Record<string, { time: number; value: number }[]>>>;
  setAttachedImage: (url: string | null) => void;
  setConsoleLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  setFps: React.Dispatch<React.SetStateAction<number | null>>;
}

export interface SimulationTelemetryHandlers {
  onTelemetry: (sample: { key: string; value: number; timestamp: number }) => void;
  onScreenshot: (dataUrl: string) => void;
  onConsoleLog: (entry: LogEntry) => void;
  onFps: (fps: number) => void;
}

/**
 * Provides bounded, prototype-safe state handlers for validated messages
 * forwarded exclusively by SimPreviewFrame from its opaque sandbox iframe.
 */
export function useSimulationTelemetry({
  setTelemetry,
  setAttachedImage,
  setConsoleLogs,
  setFps,
}: UseSimulationTelemetryProps): SimulationTelemetryHandlers {
  const onTelemetry = useCallback(
    ({ key, value, timestamp }: { key: string; value: number; timestamp: number }) => {
      if (!isSafeTelemetryKey(key)) return;
      if (!Number.isFinite(value) || !Number.isFinite(timestamp)) return;
      setTelemetry((prev) => {
        const hasKey = Object.hasOwn(prev, key);
        if (!hasKey && Object.keys(prev).length >= MAX_TELEMETRY_SERIES) {
          return prev;
        }
        const current = hasKey ? prev[key] : [];
        const next = [...current, { time: timestamp, value }].slice(-MAX_TELEMETRY_POINTS);
        return { ...prev, [key]: next };
      });
    },
    [setTelemetry],
  );

  const onScreenshot = useCallback(
    (dataUrl: string) => {
      if (!isSafeScreenshotDataUrl(dataUrl)) return;
      setAttachedImage(dataUrl);
    },
    [setAttachedImage],
  );

  const onConsoleLog = useCallback(
    (entry: LogEntry) => {
      setConsoleLogs((prev) => [...prev, entry].slice(-MAX_CONSOLE_LOGS));
    },
    [setConsoleLogs],
  );

  const onFps = useCallback(
    (fps: number) => {
      if (!Number.isFinite(fps) || fps < 0 || fps > 1000) return;
      setFps(fps);
    },
    [setFps],
  );

  return { onTelemetry, onScreenshot, onConsoleLog, onFps };
}
