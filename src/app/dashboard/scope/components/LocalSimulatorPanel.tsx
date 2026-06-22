import React, { useState, useEffect, useRef } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { 
  X, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Sliders, 
  Play, 
  Square, 
  Terminal, 
  Copy, 
  Check, 
  Trash2 
} from "lucide-react";
import TuningSettingsDrawer from "./TuningSettingsDrawer";

interface LocalSimulatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFieldConfigId: string;
  handleFieldConfigChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  fieldConfigs: any[];
  simState: "idle" | "building" | "running";
  setSimState: (state: "idle" | "building" | "running") => void;
  handleConnectLive: (targetIp?: string) => void;
}

export default function LocalSimulatorPanel({
  isOpen,
  onClose,
  selectedFieldConfigId,
  handleFieldConfigChange,
  fieldConfigs,
  simState,
  setSimState,
  handleConnectLive
}: LocalSimulatorPanelProps) {
  const simDrawerRef = useFocusTrap(isOpen, onClose);
  
  const [daemonUrl, setDaemonUrl] = useState("ws://localhost:8080");
  const [daemonStatus, setDaemonStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [daemonLogs, setDaemonLogs] = useState<string[]>([]);
  const [simAutoScrollLogs, setSimAutoScrollLogs] = useState(true);
  const [osTab, setOsTab] = useState<'windows' | 'mac' | 'linux'>('windows');
  const [copied, setCopied] = useState(false);
  const [logsCopied, setLogsCopied] = useState(false);

  // EKF config overrides states
  const [visionStdDevX, setVisionStdDevX] = useState(0.05);
  const [visionStdDevY, setVisionStdDevY] = useState(0.05);
  const [visionStdDevTheta, setVisionStdDevTheta] = useState(0.1);

  // WebSocket / Log refs and effects for Simulator
  const simWsRef = useRef<WebSocket | null>(null);
  const simTerminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (simAutoScrollLogs && simTerminalEndRef.current) {
      simTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [daemonLogs, simAutoScrollLogs]);

  const connectToDaemon = () => {
    if (simWsRef.current) {
      simWsRef.current.close();
    }

    setDaemonStatus('connecting');
    setDaemonLogs((prev) => [...prev, `[System] Connecting to sim launcher daemon at ${daemonUrl}...`]);

    try {
      const ws = new WebSocket(daemonUrl);
      simWsRef.current = ws;

      ws.onopen = () => {
        setDaemonStatus('connected');
        setDaemonLogs((prev) => [...prev, '[System] Connected to launcher daemon successfully.']);
      };

      ws.onclose = () => {
        setDaemonStatus('disconnected');
        setSimState('idle');
        setDaemonLogs((prev) => [...prev, '[System] Connection to daemon closed.']);
        simWsRef.current = null;
      };

      ws.onerror = () => {
        setDaemonLogs((prev) => [...prev, `[System Error] WebSocket connection failed. Verify daemon is running at ${daemonUrl}.`]);
        setDaemonStatus('disconnected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "status") {
            setSimState(msg.status);
            if (msg.status === "running") {
              setDaemonLogs((prev) => [...prev, '[System] Simulator is running. Auto-connecting live telemetry...']);
              
              let daemonHost = "127.0.0.1";
              try {
                // Ensure protocol prefix is valid for URL parser
                const urlToParse = daemonUrl.startsWith("ws") ? daemonUrl : `ws://${daemonUrl}`;
                const parsedUrl = new URL(urlToParse);
                daemonHost = parsedUrl.hostname || "127.0.0.1";
              } catch (e) {}
              
              handleConnectLive(daemonHost);
            }
          } 
          
          else if (msg.type === "log") {
            setDaemonLogs((prev) => [...prev, msg.line]);
          } 
          
          else if (msg.type === "exit") {
            setSimState('idle');
            setDaemonLogs((prev) => [...prev, `[System] Simulator exited with code ${msg.code} (Success: ${msg.success}).`]);
          }
        } catch (e) {
          console.error("Failed to parse daemon message:", e);
        }
      };
    } catch (err: any) {
      setDaemonLogs((prev) => [...prev, `[System Error] Failed to create WebSocket connection: ${err.message}`]);
      setDaemonStatus('disconnected');
    }
  };

  const disconnectFromDaemon = () => {
    if (simWsRef.current) {
      simWsRef.current.close();
      simWsRef.current = null;
    }
  };

  const startSimulator = () => {
    if (!simWsRef.current || daemonStatus !== 'connected') return;
    setDaemonLogs((prev) => [...prev, '[System] Requesting simulator launch with EKF and layout config...']);
    setSimState('building');
    
    const activeConfig = fieldConfigs.find(c => c.id === selectedFieldConfigId);
    const obstacles = activeConfig ? activeConfig.obstacles : [];
    const elements = activeConfig ? activeConfig.elements : [];
    const elementTypes = activeConfig ? activeConfig.elementTypes : [];

    simWsRef.current.send(JSON.stringify({
      type: "start",
      params: {
        visionStdDevX,
        visionStdDevY,
        visionStdDevTheta,
        obstacles,
        elements,
        elementTypes
      }
    }));
  };

  const stopSimulator = () => {
    if (!simWsRef.current || daemonStatus !== 'connected') return;
    setDaemonLogs((prev) => [...prev, '[System] Requesting simulator stop...']);
    simWsRef.current.send(JSON.stringify({ type: "stop" }));
  };

  // Clean up simulator WebSocket on unmount
  useEffect(() => {
    return () => {
      if (simWsRef.current) {
        simWsRef.current.close();
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-55 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="sim-drawer-title">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div
        ref={simDrawerRef}
        tabIndex={-1}
        className="relative w-full max-w-md h-full bg-obsidian border-l border-white/10 shadow-2xl flex flex-col justify-between p-6 overflow-y-auto animate-slide-in focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
          <div>
            <span className="inline-block bg-ares-red/10 text-ares-red px-2 py-0.5 ares-cut-sm font-black uppercase tracking-widest text-[8px] mb-1.5 border border-ares-red/20">
              Local Simulation
            </span>
            <h2 id="sim-drawer-title" className="text-xl font-black uppercase tracking-wider text-white font-heading">
              Simulator Controls
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
            aria-label="Close simulator panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-grow py-6 space-y-6 overflow-y-auto pr-1">
          
          {/* Connection Status Panel */}
          <div className="flex flex-col gap-3">
            <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
              <Wifi size={14} /> Connection Setup
            </h3>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] uppercase font-black tracking-widest text-marble/40">
                Daemon WebSocket URL
              </label>
              <input
                type="text"
                value={daemonUrl}
                onChange={(e) => setDaemonUrl(e.target.value)}
                placeholder="ws://localhost:8080"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-xs focus:outline-none focus:border-ares-gold transition-colors focus:ring-2 focus:ring-ares-cyan"
              />
            </div>
            
            <div className="flex gap-2">
              {daemonStatus === 'connected' ? (
                <button
                  onClick={disconnectFromDaemon}
                  className="w-full py-2.5 bg-ares-red/15 hover:bg-ares-red/25 text-ares-red-light border border-ares-red/20 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                >
                  <WifiOff size={12} /> Disconnect
                </button>
              ) : (
                <button
                  onClick={connectToDaemon}
                  disabled={daemonStatus === 'connecting'}
                  className="w-full py-2.5 bg-ares-gold text-black hover:bg-ares-gold-soft disabled:opacity-50 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
                >
                  {daemonStatus === 'connecting' ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" /> Connecting...
                    </>
                  ) : (
                    <>
                      <Wifi size={12} /> Connect Daemon
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Launcher Controls */}
          <div className="flex flex-col gap-3">
            <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
              <Sliders size={14} /> Sim Controls
            </h3>
            
            <div className="flex flex-col gap-2">
              <label className="text-[9px] uppercase font-black tracking-widest text-marble/40">
                Select Field Layout
              </label>
              <select
                value={selectedFieldConfigId}
                onChange={handleFieldConfigChange}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-ares-gold transition-colors cursor-pointer"
              >
                {fieldConfigs.map((c) => (
                  <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={startSimulator}
                disabled={daemonStatus !== 'connected' || simState !== 'idle'}
                className="flex-1 py-2.5 bg-ares-red hover:bg-ares-red-dark disabled:opacity-50 text-white rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
              >
                <Play size={12} className={simState === 'building' ? 'animate-pulse text-ares-gold' : simState === 'running' ? 'text-ares-success' : ''} />
                {simState === 'building' ? 'Building...' : simState === 'running' ? 'Running' : 'Start Simulator'}
              </button>
              <button
                onClick={stopSimulator}
                disabled={daemonStatus !== 'connected' || simState !== 'running'}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white border border-white/10 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
              >
                <Square size={12} /> Stop
              </button>
            </div>
          </div>

          {/* EKF Config Overrides */}
          <TuningSettingsDrawer
            visionStdDevX={visionStdDevX}
            setVisionStdDevX={setVisionStdDevX}
            visionStdDevY={visionStdDevY}
            setVisionStdDevY={setVisionStdDevY}
            visionStdDevTheta={visionStdDevTheta}
            setVisionStdDevTheta={setVisionStdDevTheta}
          />

          {/* Log Terminal Console */}
          <div className="flex flex-col gap-2 flex-1 min-h-[160px]">
            <div className="flex items-center justify-between">
              <label className="text-[9px] uppercase font-black tracking-widest text-marble/40 flex items-center gap-1.5">
                <Terminal size={10} /> Compilation & Run Logs
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (daemonLogs.length > 0) {
                      navigator.clipboard.writeText(daemonLogs.join("\n"));
                      setLogsCopied(true);
                      setTimeout(() => setLogsCopied(false), 2000);
                    }
                  }}
                  disabled={daemonLogs.length === 0}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] uppercase font-bold text-marble/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Copy entire log to clipboard"
                >
                  {logsCopied ? (
                    <>
                      <Check size={8} className="text-ares-success" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={8} />
                      <span>Copy Logs</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDaemonLogs([])}
                  disabled={daemonLogs.length === 0}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] uppercase font-bold text-marble/60 hover:text-white hover:bg-white/10 hover:border-ares-red/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Clear logs"
                >
                  <Trash2 size={8} />
                  <span>Clear</span>
                </button>
                <label className="flex items-center gap-1 text-[8px] uppercase font-bold text-marble/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simAutoScrollLogs}
                    onChange={(e) => setSimAutoScrollLogs(e.target.checked)}
                    className="rounded border-white/10 bg-black/40 text-ares-gold focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  Auto-scroll
                </label>
              </div>
            </div>
            <pre className="flex-grow bg-black/60 rounded-xl border border-white/5 p-4 font-mono text-[9px] text-marble/85 overflow-y-auto shadow-inner max-h-[180px] text-left select-text whitespace-pre-wrap break-all selection:bg-ares-gold/30 selection:text-white">
              {daemonLogs.length === 0 ? (
                <span className="text-marble/30 italic block">No logs received. Connect daemon to stream compiler stdout.</span>
              ) : (
                daemonLogs.join("\n")
              )}
              <span ref={simTerminalEndRef} className="inline-block" />
            </pre>
          </div>

          {/* Commands Copy Helper */}
          <div className="flex flex-col gap-3">
            <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
              <Terminal size={14} /> Daemon Startup Commands
            </h3>
            
            {/* OS Tabs */}
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1">
              {(['windows', 'mac', 'linux'] as const).map((os) => (
                <button
                  key={os}
                  onClick={() => setOsTab(os)}
                  className={`flex-1 py-1 text-[8px] uppercase tracking-wider font-black rounded-lg transition-all cursor-pointer ${
                    osTab === os
                      ? 'bg-ares-gold text-black font-black'
                      : 'text-marble/60 hover:text-white hover:bg-white/5 font-semibold'
                  }`}
                >
                  {os === 'windows' ? 'Windows' : os === 'mac' ? 'macOS' : 'Linux'}
                </button>
              ))}
            </div>

            {/* Command Block */}
            <div className="relative bg-black/60 rounded-xl border border-white/5 p-3 font-mono text-[9px] text-ares-cyan flex items-center justify-between group">
              <span className="truncate pr-8 select-all">
                {osTab === 'windows' 
                  ? 'cd tools\\sim-launcher-daemon; node daemon.js' 
                  : 'cd tools/sim-launcher-daemon && node daemon.js'}
              </span>
              <button
                onClick={() => {
                  const cmd = osTab === 'windows' 
                    ? 'cd tools\\sim-launcher-daemon; node daemon.js' 
                    : 'cd tools/sim-launcher-daemon && node daemon.js';
                  navigator.clipboard.writeText(cmd);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="absolute right-2 p-1 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center"
                title="Copy command"
              >
                {copied ? <Check size={10} className="text-ares-success" /> : <Copy size={10} />}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
