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
  Trash2,
  Cpu,
  Layers,
  AlertTriangle,
  FolderOpen,
  Laptop
} from "lucide-react";
import TuningSettingsDrawer from "./TuningSettingsDrawer";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface LocalSimulatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFieldConfigId: string;
  handleFieldConfigChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  fieldConfigs: any[];
  simState: "idle" | "building" | "running";
  setSimState: (state: "idle" | "building" | "running") => void;
  handleConnectLive: (targetIp?: string) => void;
  ipAddress: string;
}

export default function LocalSimulatorPanel({
  isOpen,
  onClose,
  selectedFieldConfigId,
  handleFieldConfigChange,
  fieldConfigs,
  simState,
  setSimState,
  handleConnectLive,
  ipAddress
}: LocalSimulatorPanelProps) {
  const simDrawerRef = useFocusTrap(isOpen, onClose);
  
  // Tauri environment detection
  const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

  // Tauri States
  const [targetPlatform, setTargetPlatform] = useState<"ftc" | "frc">("ftc");
  const [diagnostics, setDiagnostics] = useState<{
    jdk_valid: boolean;
    jdk_version: string;
    gradlew_exists: boolean;
    repo_root: string;
  } | null>(null);
  const [checkingEnv, setCheckingEnv] = useState(false);
  const [activeTaskName, setActiveTaskName] = useState<string | null>(null);

  // Web daemon States (Fallback)
  const [daemonUrl, setDaemonUrl] = useState("ws://localhost:8080");
  const [daemonStatus, setDaemonStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  // Logs
  const [daemonLogs, setDaemonLogs] = useState<string[]>([]);
  const [simAutoScrollLogs, setSimAutoScrollLogs] = useState(true);
  const [osTab, setOsTab] = useState<'windows' | 'mac' | 'linux'>('windows');
  const [copied, setCopied] = useState(false);
  const [logsCopied, setLogsCopied] = useState(false);

  // EKF config overrides states
  const [visionStdDevX, setVisionStdDevX] = useState(0.05);
  const [visionStdDevY, setVisionStdDevY] = useState(0.05);
  const [visionStdDevTheta, setVisionStdDevTheta] = useState(0.1);

  // WebSocket / Log refs for Web Mode
  const simWsRef = useRef<WebSocket | null>(null);
  const simTerminalEndRef = useRef<HTMLDivElement | null>(null);

  const isEnvReady = !!(diagnostics && diagnostics.jdk_valid && diagnostics.gradlew_exists);

  // Auto-scroll logs
  useEffect(() => {
    if (simAutoScrollLogs && simTerminalEndRef.current) {
      simTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [daemonLogs, simAutoScrollLogs]);

  // 1. TAURI MODE: Event listeners and checks
  useEffect(() => {
    if (!isTauri) return;

    let unlistenLog: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;

    async function setupListeners() {
      try {
        unlistenLog = await listen<{ line: string }>("sim-log", (event) => {
          setDaemonLogs((prev) => [...prev, event.payload.line]);
        });

        unlistenExit = await listen<{ code: number; success: boolean }>("sim-exit", (event) => {
          setSimState("idle");
          setDaemonLogs((prev) => [
            ...prev,
            `[System] Process exited with code ${event.payload.code} (Success: ${event.payload.success}).`
          ]);

          // Re-check system environment diagnostic state
          invoke<{
            jdk_valid: boolean;
            jdk_version: string;
            gradlew_exists: boolean;
            repo_root: string;
          }>("check_env")
            .then((result) => {
              setDiagnostics(result);
              setDaemonLogs((prev) => [...prev, "[Tauri] Environment diagnostics updated."]);
            })
            .catch((err) => console.error("Failed to recheck diagnostics on exit:", err));

          setActiveTaskName(null);
        });
      } catch (err) {
        console.error("Failed to setup Tauri event listeners:", err);
      }
    }

    setupListeners();

    return () => {
      if (unlistenLog) unlistenLog();
      if (unlistenExit) unlistenExit();
    };
  }, [isTauri]);

  const checkEnvironment = async () => {
    if (!isTauri) return;
    setCheckingEnv(true);
    try {
      const result = await invoke<{
        jdk_valid: boolean;
        jdk_version: string;
        gradlew_exists: boolean;
        repo_root: string;
      }>("check_env");
      setDiagnostics(result);
    } catch (err: any) {
      setDaemonLogs((prev) => [
        ...prev,
        `[Tauri Error] Environment check failed: ${err.message || err}`
      ]);
    } finally {
      setCheckingEnv(false);
    }
  };

  useEffect(() => {
    if (isOpen && isTauri) {
      checkEnvironment();
    }
  }, [isOpen, isTauri]);

  // Tauri Action Methods
  const startTauriTask = async (taskName: string, args: string[], useConfig: boolean = false) => {
    try {
      setSimState("building");
      setActiveTaskName(taskName);
      setDaemonLogs((prev) => [
        ...prev,
        `[Tauri] Spawning Gradle task "${taskName}" (${args.join(" ")})...`
      ]);

      let obstaclesJson = null;
      let elementsJson = null;
      let configId = null;

      if (useConfig) {
        const activeConfig = fieldConfigs.find(c => c.id === selectedFieldConfigId);
        obstaclesJson = JSON.stringify(activeConfig ? activeConfig.obstacles : []);
        elementsJson = JSON.stringify(activeConfig ? activeConfig.elements : []);
        configId = selectedFieldConfigId;
      }

      await invoke("start_task", {
        taskName,
        args,
        obstaclesJson,
        elementsJson,
        configId
      });

      setSimState("running");

      // Auto-connect live telemetry if we launched simulation
      if (taskName.toLowerCase().includes("simulator") || taskName.toLowerCase().includes("simulation")) {
        setDaemonLogs((prev) => [...prev, "[Tauri] Connecting live telemetry to localhost..."]);
        handleConnectLive("127.0.0.1");
      }
    } catch (err: any) {
      setSimState("idle");
      setActiveTaskName(null);
      setDaemonLogs((prev) => [...prev, `[Tauri Error] Gradle task failed: ${err.message || err}`]);
    }
  };

  const stopTauriTask = async () => {
    try {
      setDaemonLogs((prev) => [...prev, "[Tauri] Terminating active process tree..."]);
      await invoke("stop_process");
      setSimState("idle");
      setActiveTaskName(null);
      setDaemonLogs((prev) => [...prev, "[Tauri] Process terminated."]);
    } catch (err: any) {
      setDaemonLogs((prev) => [...prev, `[Tauri Error] Failed to stop task: ${err.message || err}`]);
    }
  };

  const deployFtcAdb = async () => {
    try {
      setSimState("building");
      setActiveTaskName("Deploy to REV Hub");
      setDaemonLogs((prev) => [...prev, `[Tauri] Pushing APK to Control Hub at ${ipAddress}...`]);
      await invoke("deploy_via_adb", { robotIp: ipAddress });
    } catch (err: any) {
      setSimState("idle");
      setActiveTaskName(null);
      setDaemonLogs((prev) => [...prev, `[Tauri Error] ADB Deployment failed: ${err.message || err}`]);
    }
  };

  const runJdkInstaller = async () => {
    try {
      setSimState("building");
      setActiveTaskName("Install JDK 17");
      setDaemonLogs((prev) => [...prev, "[Tauri] Initiating JDK 17 automated installation via winget..."]);
      const result = await invoke<string>("install_jdk_winget");
      setDaemonLogs((prev) => [...prev, `[Tauri] ${result}`]);
      setSimState("running");
    } catch (err: any) {
      setSimState("idle");
      setActiveTaskName(null);
      setDaemonLogs((prev) => [...prev, `[Tauri Error] Automated JDK installation failed: ${err.message || err}`]);
    }
  };

  const runRepoCloner = async () => {
    try {
      setSimState("building");
      setActiveTaskName("Clone ARESLib Repository");
      setDaemonLogs((prev) => [...prev, "[Tauri] Initiating ARESLib-Kotlin Git clone..."]);
      const result = await invoke<string>("clone_robot_repo");
      setDaemonLogs((prev) => [...prev, `[Tauri] ${result}`]);
      setSimState("running");
    } catch (err: any) {
      setSimState("idle");
      setActiveTaskName(null);
      setDaemonLogs((prev) => [...prev, `[Tauri Error] Repository clone failed: ${err.message || err}`]);
    }
  };

  // 2. WEB DAEOM MODE: Connection & control
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

  const startSimulatorWeb = () => {
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
        elementTypes,
        configId: selectedFieldConfigId
      }
    }));
  };

  const stopSimulatorWeb = () => {
    if (!simWsRef.current || daemonStatus !== 'connected') return;
    setDaemonLogs((prev) => [...prev, '[System] Requesting simulator stop...']);
    simWsRef.current.send(JSON.stringify({ type: "stop" }));
  };

  // Clean up simulator connections on unmount
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
              {isTauri ? "Native Workspace" : "Local Simulation"}
            </span>
            <h2 id="sim-drawer-title" className="text-xl font-black uppercase tracking-wider text-white font-heading">
              {isTauri ? "Workspace Controls" : "Simulator Controls"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
            aria-label="Close panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-grow py-6 space-y-6 overflow-y-auto pr-1">

          {isTauri ? (
            /* ================= NATIVE TAURI CONTROLS ================= */
            <>
              {/* Target Project Selection */}
              <div className="flex flex-col gap-3">
                <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
                  <Layers size={14} /> Target Platform
                </h3>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1">
                  <button
                    onClick={() => {
                      if (simState === "idle") setTargetPlatform("ftc");
                    }}
                    disabled={simState !== "idle"}
                    className={`flex-1 py-2 text-[9px] uppercase tracking-wider font-black rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      targetPlatform === "ftc"
                        ? "bg-ares-red text-white shadow-lg font-black"
                        : "text-marble/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    FTC (Control Hub)
                  </button>
                  <button
                    onClick={() => {
                      if (simState === "idle") setTargetPlatform("frc");
                    }}
                    disabled={simState !== "idle"}
                    className={`flex-1 py-2 text-[9px] uppercase tracking-wider font-black rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      targetPlatform === "frc"
                        ? "bg-ares-red text-white shadow-lg font-black"
                        : "text-marble/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    FRC (RoboRIO)
                  </button>
                </div>
              </div>

              {/* Workspace Environment Diagnostics */}
              <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-marble/60 flex items-center gap-1.5">
                    <Laptop size={12} /> Local Environment
                  </span>
                  <button
                    onClick={checkEnvironment}
                    disabled={checkingEnv || simState !== "idle"}
                    className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-marble/60 transition-all cursor-pointer disabled:opacity-40"
                    title="Refresh diagnostics"
                  >
                    <RefreshCw size={10} className={checkingEnv ? "animate-spin" : ""} />
                  </button>
                </div>

                {diagnostics ? (
                  <div className="space-y-3 text-[10px]">
                    {/* JDK status row */}
                    <div className="flex flex-col gap-1.5 border-b border-white/5 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-marble/40">JDK Version (17+)</span>
                        <span className="flex items-center gap-1">
                          {diagnostics.jdk_valid ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          ) : (
                            <AlertTriangle size={10} className="text-ares-red animate-pulse" />
                          )}
                          <span className={diagnostics.jdk_valid ? "text-marble/80" : "text-ares-red font-bold"}>
                            {diagnostics.jdk_version}
                          </span>
                        </span>
                      </div>
                      
                      {!diagnostics.jdk_valid && (
                        <div className="bg-ares-red/10 border border-ares-red/20 rounded-lg p-2.5 flex flex-col gap-2 animate-fade-in">
                          <span className="text-[8px] text-marble/80 leading-normal">
                            JDK 17 is missing. Automate the setup via Windows `winget` or download adopting packages manually.
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={runJdkInstaller}
                              disabled={simState !== "idle"}
                              className="flex-1 bg-ares-red text-white py-1.5 px-2 rounded font-black uppercase tracking-wider text-[8px] hover:bg-ares-red/80 disabled:opacity-50 cursor-pointer"
                            >
                              ⚡ Auto-Install JDK 17
                            </button>
                            <a
                              href="https://adoptium.net/temurin/releases/?version=17"
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 bg-white/5 border border-white/10 text-white text-center py-1.5 px-2 rounded font-black uppercase tracking-wider text-[8px] hover:bg-white/10 flex items-center justify-center"
                            >
                              🌐 Download Page
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Gradle Wrapper status row */}
                    <div className="flex flex-col gap-1.5 border-b border-white/5 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-marble/40">Gradle Wrapper</span>
                        <span className="flex items-center gap-1">
                          {diagnostics.gradlew_exists ? (
                            <span className="text-emerald-500 font-bold">FOUND</span>
                          ) : (
                            <span className="text-ares-red font-bold flex items-center gap-1">
                              <AlertTriangle size={10} /> MISSING
                            </span>
                          )}
                        </span>
                      </div>
                      
                      {!diagnostics.gradlew_exists && (
                        <div className="bg-ares-red/10 border border-ares-red/20 rounded-lg p-2.5 flex flex-col gap-2 animate-fade-in">
                          <span className="text-[8px] text-marble/80 leading-normal">
                            Sibling robot repository `ARESLib-Kotlin` not found or incomplete. Clone the project to run local builds.
                          </span>
                          <button
                            onClick={runRepoCloner}
                            disabled={simState !== "idle"}
                            className="w-full bg-ares-red text-white py-1.5 px-2 rounded font-black uppercase tracking-wider text-[8px] hover:bg-ares-red/80 disabled:opacity-50 cursor-pointer"
                          >
                            ⚡ Auto-Clone ARESLib
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-marble/40">Workspace Path</span>
                      <span className="font-mono text-[8px] text-marble/60 truncate select-all block bg-black/40 px-2 py-1 rounded border border-white/5" title={diagnostics.repo_root}>
                        {diagnostics.repo_root}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-marble/30 italic py-2 text-center">
                    Loading local workspace status...
                  </div>
                )}
              </div>

              {/* Workspace Action Buttons */}
              <div className="flex flex-col gap-4 border-t border-white/5 pt-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] uppercase font-black tracking-widest text-marble/40">
                    Simulation Runtime
                  </label>
                  {targetPlatform === "ftc" ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] uppercase font-bold text-marble/55">
                          Select Field Layout
                        </label>
                        <select
                          value={selectedFieldConfigId}
                          onChange={handleFieldConfigChange}
                          disabled={!isEnvReady}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-ares-gold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                          onClick={() => startTauriTask("ARES Simulator", [":simulator:run"], true)}
                          disabled={simState !== "idle" || !isEnvReady}
                          className="w-full py-2.5 bg-ares-red hover:bg-ares-red/80 disabled:opacity-55 text-white rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer font-bold disabled:cursor-not-allowed"
                        >
                          <Play size={12} /> Launch ARES Sim
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => startTauriTask("WPILib Simulation", [":frc-app:simulateJava"], false)}
                      disabled={simState !== "idle" || !isEnvReady}
                      className="w-full py-2.5 bg-ares-red hover:bg-ares-red/80 disabled:opacity-55 text-white rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer font-bold disabled:cursor-not-allowed"
                    >
                      <Play size={12} /> Launch WPILib Sim
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] uppercase font-black tracking-widest text-marble/40">
                    Robot Code Pipeline
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const compileTask = targetPlatform === "ftc" ? ":TeamCode:assembleDebug" : ":frc-app:build";
                        startTauriTask(`Compile ${targetPlatform.toUpperCase()}`, [compileTask], false);
                      }}
                      disabled={simState !== "idle" || !isEnvReady}
                      className="flex-1 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 disabled:opacity-55 text-white rounded-xl text-[10px] uppercase font-black tracking-widest transition-all cursor-pointer font-bold disabled:cursor-not-allowed"
                    >
                      Compile Code
                    </button>

                    <button
                      onClick={() => {
                        if (targetPlatform === "ftc") {
                          deployFtcAdb();
                        } else {
                          startTauriTask("Deploy FRC RoboRIO", [":frc-app:deploy"], false);
                        }
                      }}
                      disabled={simState !== "idle" || !isEnvReady}
                      className="flex-1 py-2.5 bg-ares-gold text-black hover:bg-ares-gold/90 disabled:opacity-55 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all cursor-pointer font-bold disabled:cursor-not-allowed"
                    >
                      Deploy to Robot
                    </button>
                  </div>
                </div>

                {simState !== "idle" && (
                  <button
                    onClick={stopTauriTask}
                    className="w-full py-2.5 bg-ares-red/15 hover:bg-ares-red/25 text-ares-red border border-ares-red/30 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bold"
                  >
                    <Square size={12} /> Stop Active Task {activeTaskName ? `(${activeTaskName})` : ""}
                  </button>
                )}
              </div>
            </>
          ) : (
            /* ================= WEB DAEMON CONTROLS (FALLBACK) ================= */
            <>
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
                      className="w-full py-2.5 bg-ares-red/15 hover:bg-ares-red/25 text-ares-red border border-ares-red/20 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                    >
                      <WifiOff size={12} /> Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={connectToDaemon}
                      disabled={daemonStatus === 'connecting'}
                      className="w-full py-2.5 bg-ares-gold text-black hover:bg-ares-gold/90 disabled:opacity-50 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
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
                    onClick={startSimulatorWeb}
                    disabled={daemonStatus !== 'connected' || simState !== 'idle'}
                    className="flex-1 py-2.5 bg-ares-red hover:bg-ares-red/80 disabled:opacity-50 text-white rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
                  >
                    <Play size={12} className={simState === 'building' ? 'animate-pulse text-ares-gold' : simState === 'running' ? 'text-emerald-500' : ''} />
                    {simState === 'building' ? 'Building...' : simState === 'running' ? 'Running' : 'Start Simulator'}
                  </button>
                  <button
                    onClick={stopSimulatorWeb}
                    disabled={daemonStatus !== 'connected' || simState !== 'running'}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white border border-white/10 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
                  >
                    <Square size={12} /> Stop
                  </button>
                </div>
              </div>
            </>
          )}

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
                      <Check size={8} className="text-emerald-500" />
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
                <span className="text-marble/30 italic block">
                  {isTauri ? "No task outputs yet. Launch a simulation or compile project." : "No logs received. Connect daemon to stream compiler stdout."}
                </span>
              ) : (
                daemonLogs.join("\n")
              )}
              <span ref={simTerminalEndRef} className="inline-block" />
            </pre>
          </div>

          {!isTauri && (
            /* Commands Copy Helper (Web Mode Only) */
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
                  {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
