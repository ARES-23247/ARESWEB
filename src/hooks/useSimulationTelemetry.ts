import { useEffect } from "react";
import { LogEntry } from "../components/editor/SimConsole";

interface UseSimulationTelemetryProps {
  setTelemetry: React.Dispatch<React.SetStateAction<Record<string, { time: number; value: number }[]>>>;
  setAttachedImage: (url: string | null) => void;
  setConsoleLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  setFps: React.Dispatch<React.SetStateAction<number | null>>;
}

export function useSimulationTelemetry({
  setTelemetry,
  setAttachedImage,
  setConsoleLogs,
  setFps
}: UseSimulationTelemetryProps) {
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "ARES_TELEMETRY") {
        setTelemetry(prev => {
          const key = e.data.key;
          const current = prev[key] || [];
          const next = [...current, { time: e.data.timestamp, value: e.data.value }].slice(-100);
          return { ...prev, [key]: next };
        });
      }
      if (e.data?.type === "ARES_SCREENSHOT") {
        setAttachedImage(e.data.dataUrl);
      }
      if (e.data?.type === "sim-console") {
        setConsoleLogs(prev => [...prev, e.data]);
      }
      if (e.data?.type === "sim-fps") {
        setFps(e.data.fps);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setTelemetry, setAttachedImage, setConsoleLogs, setFps]);
}
