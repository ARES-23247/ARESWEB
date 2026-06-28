import React, { Suspense, lazy } from "react";
import { TelemetryPanel } from "./editor/TelemetryPanel";

const SimPreviewFrame = lazy(() => import("./editor/SimPreviewFrame"));

interface SimulationPlaygroundPreviewProps {
  compileError: any;
  fps: number | null;
  compiledFiles: any;
  handleFixWithAI: (err: string) => void;
  handleTestResult: (result: any) => void;
  telemetry: any;
}

export default function SimulationPlaygroundPreview({
  compileError,
  fps,
  compiledFiles,
  handleFixWithAI,
  handleTestResult,
  telemetry
}: SimulationPlaygroundPreviewProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="px-3 py-1.5 border-b border-white/10 bg-obsidian-dark flex items-center gap-2 shrink-0">
        <span className="text-white/40 text-xs font-mono">Live Preview</span>
        <div className={`w-2 h-2 rounded-full ${compileError ? 'bg-ares-danger' : 'bg-ares-cyan'}`} />
        {fps !== null && (
          <span className={`text-[10px] font-mono ml-auto ${fps >= 50 ? 'text-ares-cyan' : fps >= 30 ? 'text-ares-bronze' : 'text-ares-danger'}`}>
            {fps} FPS
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 relative flex flex-col">
        <div className="flex-1 min-h-0">
          <Suspense fallback={<div className="flex items-center justify-center h-full bg-obsidian-dark text-white/40 text-sm">Loading preview...</div>}>
            <SimPreviewFrame
              compiledFiles={compiledFiles}
              compileError={compileError}
              onFixWithAI={() => handleFixWithAI("")}
              onTestResult={handleTestResult}
            />
          </Suspense>
        </div>
        <TelemetryPanel data={telemetry} />
      </div>
    </div>
  );
}
