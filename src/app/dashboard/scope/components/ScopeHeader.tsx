import React, { useRef } from "react";
import { 
  Cpu, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Play, 
  Sliders, 
  Database, 
  Cloud, 
  FolderOpen, 
  X, 
  Activity, 
  Compass, 
  Eye 
} from "lucide-react";

interface ScopeHeaderProps {
  isStreaming: boolean;
  connectionStatus: string;
  simState: "idle" | "building" | "running";
  fieldConfigs: any[];
  selectedFieldConfigId: string;
  handleFieldConfigChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  selectedRunId: string;
  setSelectedRunId: (runId: string) => void;
  
  // Modals & Drawers Toggles
  setShowLiveModal: (show: boolean) => void;
  setShowSimDrawer: (show: boolean) => void;
  setShowSyncModal: (show: boolean) => void;
  handleDisconnectLive: () => void;

  // Comparison & Logs State
  comparisonTelemetryData: any;
  setComparisonTelemetryData: (val: any) => void;
  consoleLogs: any;
  setConsoleLogs: (val: any) => void;
  setVideoUrl: (val: string | null) => void;
  runs?: any[];

  // File Handlers
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleComparisonInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleConsoleInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePathInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ScopeHeader({
  isStreaming,
  connectionStatus,
  simState,
  fieldConfigs,
  selectedFieldConfigId,
  handleFieldConfigChange,
  selectedRunId,
  setSelectedRunId,
  setShowLiveModal,
  setShowSimDrawer,
  setShowSyncModal,
  handleDisconnectLive,
  comparisonTelemetryData,
  setComparisonTelemetryData,
  consoleLogs,
  setConsoleLogs,
  setVideoUrl,
  runs = [],
  handleFileInput,
  handleComparisonInput,
  handleConsoleInput,
  handlePathInput
}: ScopeHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const comparisonInputRef = useRef<HTMLInputElement | null>(null);
  const consoleInputRef = useRef<HTMLInputElement | null>(null);
  const pathInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <header className="border-b border-white/5 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
      <div>
        <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
          <Cpu size={12} className="animate-pulse" /> Diagnostic Tools
        </p>
        <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter font-heading">
          ARES-Scope Replay
        </h1>
        <p className="text-marble/70 text-xs md:text-sm mt-1.5 font-medium max-w-xl">
          High-performance browser-based AdvantageScope clone. Stream live telemetry, analyze motor binding, and review Vertex AI scouting roadmaps.
        </p>
      </div>

      {/* Database & File Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Connection Status Badge */}
        {isStreaming && (
          <div className={`flex items-center gap-2 border px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider ${
            connectionStatus === "connected"
              ? "bg-ares-success/10 text-ares-success border-ares-success/20"
              : connectionStatus === "connecting"
              ? "bg-ares-gold/10 text-ares-gold border-ares-gold/20"
              : "bg-white/5 text-marble/50 border-white/5"
          }`}>
            {connectionStatus === "connected" && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ares-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-ares-success"></span>
                </span>
                <span>Connected</span>
              </>
            )}
            {connectionStatus === "connecting" && (
              <>
                <RefreshCw size={12} className="animate-spin text-ares-gold" />
                <span>Connecting</span>
              </>
            )}
            {connectionStatus === "disconnected" && (
              <>
                <WifiOff size={12} className="text-marble/40" />
                <span>Disconnected</span>
              </>
            )}
          </div>
        )}

        {/* Live Stream Button */}
        {isStreaming ? (
          <button
            onClick={handleDisconnectLive}
            className="px-4 py-2.5 bg-ares-red/15 hover:bg-ares-red/25 text-ares-red-light border border-ares-red/20 hover:border-ares-red/30 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md font-bold focus:ring-2 focus:ring-ares-cyan focus:outline-none"
          >
            <WifiOff size={12} /> Disconnect
          </button>
        ) : (
          <button
            onClick={() => setShowLiveModal(true)}
            className="px-4 py-2.5 bg-ares-gold/10 hover:bg-ares-gold/20 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md font-bold"
          >
            <Wifi size={12} /> Go Live
          </button>
        )}

        {/* Local Simulator Controls Button */}
        <button
          onClick={() => setShowSimDrawer(true)}
          className={`px-4 py-2.5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md font-bold focus:ring-2 focus:ring-ares-cyan focus:outline-none ${
            simState !== "idle"
              ? "bg-ares-success/15 text-ares-success border border-ares-success/20 hover:bg-ares-success/25"
              : "bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10"
          }`}
          title="Open local simulator controls"
        >
          <Play size={12} className={simState === "building" ? "animate-pulse text-ares-gold" : simState === "running" ? "text-ares-success" : ""} />
          <span>Local Sim</span>
        </button>

        {/* Field Layout Selector */}
        <div className="flex items-center bg-black/50 border border-white/5 px-3 py-2 rounded-xl text-xs gap-2">
          <Sliders size={14} className="text-ares-gold" />
          <select
            value={selectedFieldConfigId}
            onChange={handleFieldConfigChange}
            className="bg-transparent text-white focus:outline-none font-bold uppercase cursor-pointer"
          >
            {fieldConfigs.length === 0 ? (
              <option value="" className="bg-neutral-900 text-white">No Obstacles</option>
            ) : (
              <>
                <option value="" className="bg-neutral-900 text-white">Clear Obstacles</option>
                {fieldConfigs.map((c) => (
                  <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                    {c.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Active Run Selector */}
        <div className="flex items-center bg-black/50 border border-white/5 px-3 py-2 rounded-xl text-xs gap-2">
          <Database size={14} className="text-ares-gold" />
          <select
            value={selectedRunId}
            onChange={(e) => setSelectedRunId(e.target.value)}
            className="bg-transparent text-white focus:outline-none font-bold uppercase cursor-pointer max-w-[160px] truncate"
          >
            {runs.length === 0 ? (
              <>
                <option value="run_2026_championship_finals" className="bg-neutral-900 text-white">Championship Finals</option>
                <option value="run_2026_qualifiers_3" className="bg-neutral-900 text-white">Qualifier Run #3</option>
                <option value="run_2026_practice_slippage" className="bg-neutral-900 text-white">Practice Slippage Run</option>
              </>
            ) : (
              runs.map((r) => (
                <option key={r.runId} value={r.runId} className="bg-neutral-900 text-white">
                  {r.matchNumber ? `Match ${r.matchNumber}` : r.runId.substring(0, 16)}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Sync Robot Logs over Wi-Fi */}
        <button
          onClick={() => {
            setShowSyncModal(true);
          }}
          className="px-4 py-2.5 bg-ares-gold/10 hover:bg-ares-gold/20 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md focus:ring-2 focus:ring-ares-cyan focus:outline-none"
        >
          <Cloud size={12} /> Sync Robot Logs
        </button>

        {/* Local Log Upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md"
        >
          <FolderOpen size={12} /> Local Log
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          accept=".csv,.txt"
          className="hidden"
        />

        {/* Comparison Log Upload */}
        <button
          onClick={() => comparisonTelemetryData ? setComparisonTelemetryData(null) : comparisonInputRef.current?.click()}
          className={`px-4 py-2.5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md focus:ring-2 focus:ring-ares-cyan focus:outline-none ${
            comparisonTelemetryData 
              ? "bg-ares-red/15 text-ares-red-light border border-ares-red/25 hover:bg-ares-red/25" 
              : "bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10"
          }`}
          title={comparisonTelemetryData ? "Clear comparison log" : "Upload comparison CSV log"}
        >
          {comparisonTelemetryData ? (
            <>
              <X size={12} /> Comparison Active
            </>
          ) : (
            <>
              <Activity size={12} /> Compare Log
            </>
          )}
        </button>
        <input
          type="file"
          ref={comparisonInputRef}
          onChange={handleComparisonInput}
          accept=".csv,.txt"
          className="hidden"
        />

        {/* Console Log Upload */}
        <button
          onClick={() => consoleLogs ? setConsoleLogs(null) : consoleInputRef.current?.click()}
          className={`px-4 py-2.5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md ${
            consoleLogs 
              ? "bg-ares-gold/15 text-ares-gold border border-ares-gold/25 hover:bg-ares-gold/25" 
              : "bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10"
          }`}
          title={consoleLogs ? "Clear console log" : "Upload system console text log"}
        >
          {consoleLogs ? (
            <>
              <X size={12} /> Clear Console
            </>
          ) : (
            <>
              <Sliders size={12} /> System Console
            </>
          )}
        </button>
        <input
          type="file"
          ref={consoleInputRef}
          onChange={handleConsoleInput}
          accept=".txt,.log"
          className="hidden"
        />

        {/* Planned Path Upload */}
        <button
          onClick={() => pathInputRef.current?.click()}
          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md"
        >
          <Compass size={12} /> Planned Path
        </button>
        <input
          type="file"
          ref={pathInputRef}
          onChange={handlePathInput}
          accept=".path,.json"
          className="hidden"
        />

        {/* Match Video Upload */}
        <button
          onClick={() => videoInputRef.current?.click()}
          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md"
        >
          <Eye size={12} /> Match Video
        </button>
        <input
          type="file"
          ref={videoInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              const url = URL.createObjectURL(e.target.files[0]);
              setVideoUrl(url);
            }
          }}
          accept="video/*"
          className="hidden"
        />
      </div>
    </header>
  );
}
