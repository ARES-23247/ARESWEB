"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, 
  Cpu, 
  Sliders, 
  AlertTriangle,
  Wifi,
  WifiOff,
  Terminal,
  Play,
  Square
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

export default function TrigRoboticsSimPage() {
  // Launcher WebSocket state
  const [daemonUrl, setDaemonUrl] = useState('ws://localhost:8080');
  const [daemonStatus, setDaemonStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [simState, setSimState] = useState<'idle' | 'building' | 'running'>('idle');
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  
  // EKF config overrides states
  const [visionStdDevX, setVisionStdDevX] = useState(0.05);
  const [visionStdDevY, setVisionStdDevY] = useState(0.05);
  const [visionStdDevTheta, setVisionStdDevTheta] = useState(0.1);

  // Field config selection states
  const [fieldConfigs, setFieldConfigs] = useState<{ id: string; name: string; obstacles: any[]; elements?: any[]; elementTypes?: any[] }[]>([]);
  const [selectedFieldConfigId, setSelectedFieldConfigId] = useState<string>('');

  useEffect(() => {
    const fetchFieldConfigs = async () => {
      try {
        const q = query(collection(db, "field_configs"), orderBy("updatedAt", "desc"));
        const querySnapshot = await getDocs(q);
        const configs: any[] = [];
        querySnapshot.forEach((docSnap) => {
          configs.push({ id: docSnap.id, ...docSnap.data() });
        });
        setFieldConfigs(configs);
        if (configs.length > 0) {
          setSelectedFieldConfigId(configs[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch field configurations in simulator page:", err);
      }
    };
    fetchFieldConfigs();
  }, []);
  
  const wsRef = useRef<WebSocket | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const connectToDaemon = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setDaemonStatus('connecting');
    setLogs((prev) => [...prev, `[System] Connecting to sim launcher daemon at ${daemonUrl}...`]);

    try {
      const ws = new WebSocket(daemonUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setDaemonStatus('connected');
        setLogs((prev) => [...prev, '[System] Connected to launcher daemon successfully.']);
      };

      ws.onclose = () => {
        setDaemonStatus('disconnected');
        setSimState('idle');
        setLogs((prev) => [...prev, '[System] Connection to daemon closed.']);
        wsRef.current = null;
      };

      ws.onerror = () => {
        setLogs((prev) => [...prev, `[System Error] WebSocket connection failed. Verify daemon is running at ${daemonUrl}.`]);
        setDaemonStatus('disconnected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "status") {
            setSimState(msg.status);
            setDiagnostics(msg.diagnostics);
          } 
          
          else if (msg.type === "log") {
            setLogs((prev) => [...prev, msg.line]);
          } 
          
          else if (msg.type === "exit") {
            setSimState('idle');
            setLogs((prev) => [...prev, `[System] Simulator exited with code ${msg.code} (Success: ${msg.success}).`]);
          }
        } catch (e) {
          console.error("Failed to parse daemon message:", e);
        }
      };
    } catch (err: any) {
      setLogs((prev) => [...prev, `[System Error] Failed to create WebSocket connection: ${err.message}`]);
      setDaemonStatus('disconnected');
    }
  };

  const disconnectFromDaemon = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const startSimulator = () => {
    if (!wsRef.current || daemonStatus !== 'connected') return;
    setLogs((prev) => [...prev, '[System] Requesting simulator launch with EKF and layout config...']);
    setSimState('building');
    
    const activeConfig = fieldConfigs.find(c => c.id === selectedFieldConfigId);
    const obstacles = activeConfig ? activeConfig.obstacles : [];
    const elements = activeConfig ? activeConfig.elements : [];
    const elementTypes = activeConfig ? activeConfig.elementTypes : [];

    wsRef.current.send(JSON.stringify({
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
    if (!wsRef.current || daemonStatus !== 'connected') return;
    setLogs((prev) => [...prev, '[System] Requesting simulator stop...']);
    wsRef.current.send(JSON.stringify({ type: "stop" }));
  };

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center">
        
        {/* Page Header */}
        <header className="text-center mb-10 w-full max-w-3xl">
          <div className="inline-block bg-ares-red/10 text-ares-red px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-6 border border-ares-red/20">
            ARES Math & Simulation
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 uppercase font-heading">
            Simulation <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl text-white font-bold inline-block mt-2">Engine</span>
          </h1>
          <p className="text-lg text-marble/60 max-w-2xl mx-auto font-medium leading-relaxed">
            Launch the FTC Desktop Robot Simulator via the local compiler daemon and configure sensor overrides.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-5xl">
          {/* Left Panel: Settings & Diagnostics */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* Connection Setup Card */}
            <div className="glass-card p-6 border border-white/10 bg-neutral-950/65 flex flex-col gap-4 shadow-xl">
              <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
                <Wifi size={14} /> Connection Setup
              </h3>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-marble/40">
                  Daemon WebSocket URL
                </label>
                <input
                  type="text"
                  value={daemonUrl}
                  onChange={(e) => setDaemonUrl(e.target.value)}
                  placeholder="ws://localhost:8080"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-xs focus:outline-none focus:border-ares-gold transition-colors"
                />
                {daemonUrl.startsWith('ws://') && (
                  <p className="text-[9px] text-ares-gold flex items-start gap-1 font-medium mt-0.5 leading-normal">
                    <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                    <span>Local WS is compatible with localhost development. Production HTTPS requires secure WSS.</span>
                  </p>
                )}
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
            <div className="glass-card p-6 border border-white/10 bg-neutral-950/65 flex flex-col gap-4 shadow-xl">
              <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
                <Sliders size={14} /> Sim Controls
              </h3>
              
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-marble/40">
                  Select Field Layout
                </label>
                <select
                  value={selectedFieldConfigId}
                  onChange={(e) => setSelectedFieldConfigId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-ares-gold transition-colors cursor-pointer"
                >
                  <option value="" className="bg-neutral-950">Default (No Custom Obstacles)</option>
                  {fieldConfigs.map((config) => (
                    <option key={config.id} value={config.id} className="bg-neutral-950">
                      {config.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={startSimulator}
                  disabled={daemonStatus !== 'connected' || simState !== 'idle'}
                  className="w-full py-3 bg-ares-success text-white hover:bg-ares-success/90 disabled:opacity-30 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                >
                  <Play size={12} className="fill-current" /> Build & Run Simulator
                </button>
                <button
                  onClick={stopSimulator}
                  disabled={daemonStatus !== 'connected' || simState === 'idle'}
                  className="w-full py-3 bg-ares-red text-white hover:bg-ares-red-dark disabled:opacity-30 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                >
                  <Square size={12} className="fill-current" /> Stop Simulator
                </button>
              </div>

              <div className="flex items-center justify-between text-xs bg-black/45 p-3 rounded-lg border border-white/5 font-mono">
                <span className="text-marble/55 uppercase text-[10px] tracking-wider">Sim Status:</span>
                <span className={`font-bold uppercase tracking-widest text-[10px] ${
                  simState === 'running' ? 'text-ares-success animate-pulse' :
                  simState === 'building' ? 'text-ares-gold animate-pulse' :
                  'text-marble/35'
                }`}>
                  {simState}
                </span>
              </div>
            </div>

            {/* EKF Config Overrides Card */}
            <div className="glass-card p-6 border border-white/10 bg-neutral-950/65 flex flex-col gap-4 shadow-xl">
              <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
                <Sliders size={14} /> EKF Std Dev Overrides
              </h3>
              <div className="flex flex-col gap-4 font-mono text-[10px]">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-marble/55">Vision Std Dev X:</span>
                    <span className="text-white font-bold">{visionStdDevX.toFixed(3)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="1.0"
                    step="0.01"
                    value={visionStdDevX}
                    onChange={(e) => setVisionStdDevX(parseFloat(e.target.value))}
                    className="w-full accent-ares-gold bg-black/40 h-1.5 rounded cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-marble/55">Vision Std Dev Y:</span>
                    <span className="text-white font-bold">{visionStdDevY.toFixed(3)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="1.0"
                    step="0.01"
                    value={visionStdDevY}
                    onChange={(e) => setVisionStdDevY(parseFloat(e.target.value))}
                    className="w-full accent-ares-gold bg-black/40 h-1.5 rounded cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-marble/55">Vision Std Dev Theta:</span>
                    <span className="text-white font-bold">{(visionStdDevTheta * 180 / Math.PI).toFixed(1)}°</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.5"
                    step="0.01"
                    value={visionStdDevTheta}
                    onChange={(e) => setVisionStdDevTheta(parseFloat(e.target.value))}
                    className="w-full accent-ares-gold bg-black/40 h-1.5 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Environment Diagnostics Card */}
            {diagnostics && (
              <div className="glass-card p-6 border border-white/10 bg-neutral-950/65 flex flex-col gap-4 shadow-xl">
                <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
                  <Cpu size={14} /> Env Diagnostics
                </h3>
                <div className="flex flex-col gap-3 font-mono text-xs">
                  <div className="flex justify-between items-center p-2 bg-black/35 rounded border border-white/5">
                    <span className="text-marble/55 text-[10px]">JDK 17+:</span>
                    <span className={`font-bold ${diagnostics.jdkValid ? 'text-ares-success' : 'text-ares-red-light'}`}>
                      {diagnostics.jdkValid ? 'Valid ✅' : 'Invalid ❌'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-black/35 rounded border border-white/5">
                    <span className="text-marble/55 text-[10px]">JDK Version:</span>
                    <span className="text-white font-bold">{diagnostics.jdkVersion}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-black/35 rounded border border-white/5">
                    <span className="text-marble/55 text-[10px]">Gradle Wrapper:</span>
                    <span className={`font-bold ${diagnostics.gradlewExists ? 'text-ares-success' : 'text-ares-red-light'}`}>
                      {diagnostics.gradlewExists ? 'Found ✅' : 'Missing ❌'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Terminal Logs Console */}
          <div className="lg:col-span-2 flex flex-col h-[500px] lg:h-auto">
            <div className="glass-card flex-1 p-6 border border-white/10 bg-neutral-950/90 flex flex-col gap-4 shadow-xl h-full min-h-[400px]">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
                  <Terminal size={14} /> Console Output
                </h3>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-[10px] text-marble/55 uppercase font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                      className="accent-ares-gold rounded cursor-pointer"
                    />
                    <span>Auto-Scroll</span>
                  </label>
                  <button
                    onClick={() => setLogs([])}
                    className="text-[10px] text-marble/40 hover:text-white uppercase font-bold tracking-wider transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Log Terminal Window */}
              <div className="flex-1 bg-black/60 p-4 rounded-xl border border-white/10 font-mono text-[10px] sm:text-xs overflow-y-auto text-ares-success h-96 min-h-[350px] max-h-[500px] flex flex-col gap-1.5 leading-relaxed selection:bg-ares-success/20">
                {logs.length === 0 ? (
                  <div className="text-marble/20 text-center py-12 select-none">
                    Console idle. Establish connection and launch simulator.
                  </div>
                ) : (
                  logs.map((log, index) => {
                    let colorClass = 'text-ares-success';
                    if (log.includes('[ERROR]') || log.includes('[Daemon Error]')) {
                      colorClass = 'text-ares-red-light font-bold';
                    } else if (log.includes('[System]')) {
                      colorClass = 'text-ares-cyan font-bold';
                    } else if (log.includes('[System Error]')) {
                      colorClass = 'text-ares-red font-black';
                    } else if (log.includes('[Daemon]')) {
                      colorClass = 'text-ares-gold';
                    }
                    return (
                      <div key={index} className={colorClass}>
                        {log}
                      </div>
                    );
                  })
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
