"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  HelpCircle, 
  RefreshCw, 
  Info, 
  Cpu, 
  Sliders, 
  AlertTriangle,
  Wifi,
  WifiOff,
  Terminal,
  Play,
  Square
} from 'lucide-react';

type KinematicsMode = 'ik' | 'fk';
type ElbowConfig = 'up' | 'down';
type AngleMode = 'degrees' | 'radians';

export default function TrigRoboticsSimPage() {

  const [mode, setMode] = useState<KinematicsMode>('ik');
  const [elbow, setElbow] = useState<ElbowConfig>('up');
  const [angleMode, setAngleMode] = useState<AngleMode>('degrees');

  // Link Lengths (in pixels/units inside 400x400 grid)
  const [l1, setL1] = useState<number>(100);
  const [l2, setL2] = useState<number>(80);

  // Target coordinates for IK mode
  const [targetX, setTargetX] = useState<number>(110);
  const [targetY, setTargetY] = useState<number>(90);

  // Joint Angles for FK mode (in degrees)
  const [fkTheta1, setFkTheta1] = useState<number>(45);
  const [fkTheta2, setFkTheta2] = useState<number>(45);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tab control
  const [activeTab, setActiveTab] = useState<'kinematics' | 'launcher'>('kinematics');

  // Launcher WebSocket state
  const [daemonUrl, setDaemonUrl] = useState('ws://localhost:8080');
  const [daemonStatus, setDaemonStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [simState, setSimState] = useState<'idle' | 'building' | 'running'>('idle');
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  
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
    setLogs((prev) => [...prev, '[System] Requesting simulator launch...']);
    setSimState('building');
    wsRef.current.send(JSON.stringify({ type: "start" }));
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

  // Grid coordinates center
  const cx = 200;
  const cy = 200;

  // Real-time calculated states
  let theta1Deg: number;
  let theta2Deg: number;
  let currentX: number;
  let currentY: number;
  let isOutOfReach: boolean;

  // Forward Kinematics (FK) calculations
  const calculateFK = useCallback((t1Deg: number, t2Deg: number, len1: number, len2: number) => {
    const r1 = (t1Deg * Math.PI) / 180;
    const r2 = (t2Deg * Math.PI) / 180;
    
    // Joint coordinates
    const j1x = len1 * Math.cos(r1);
    const j1y = len1 * Math.sin(r1);
    
    // End effector coordinates (relative to origin)
    const endX = j1x + len2 * Math.cos(r1 + r2);
    const endY = j1y + len2 * Math.sin(r1 + r2);

    return { j1x, j1y, endX, endY };
  }, []);

  // Inverse Kinematics (IK) calculations
  const calculateIK = useCallback((tx: number, ty: number, len1: number, len2: number, elb: ElbowConfig) => {
    const dSq = tx * tx + ty * ty;
    const d = Math.sqrt(dSq);
    
    // Bounds check
    let clampedX = tx;
    let clampedY = ty;
    let outOfReach = false;

    if (d > len1 + len2) {
      outOfReach = true;
      // Clamp to maximum reach boundary
      clampedX = tx * ((len1 + len2 - 0.1) / d);
      clampedY = ty * ((len1 + len2 - 0.1) / d);
    } else if (d < Math.abs(len1 - len2)) {
      outOfReach = true;
      // Clamp to minimum boundary
      const minDist = Math.max(0.1, Math.abs(len1 - len2) + 0.1);
      clampedX = tx * (minDist / d);
      clampedY = ty * (minDist / d);
    }

    const cDistSq = clampedX * clampedX + clampedY * clampedY;
    const cDist = Math.sqrt(cDistSq);

    // Law of cosines for elbow angle: theta2
    let cosTheta2 = (cDistSq - len1 * len1 - len2 * len2) / (2 * len1 * len2);
    cosTheta2 = Math.max(-1, Math.min(1, cosTheta2));
    
    let t2Rad = Math.acos(cosTheta2);
    if (elb === 'down') {
      t2Rad = -t2Rad;
    }

    // Shoulder angle: theta1
    const alpha = Math.atan2(clampedY, clampedX);
    let cosBeta = (len1 * len1 + cDistSq - len2 * len2) / (2 * len1 * cDist);
    cosBeta = Math.max(-1, Math.min(1, cosBeta));
    const beta = Math.acos(cosBeta);

    const t1Rad = elb === 'up' ? alpha - beta : alpha + beta;

    // Convert back to degrees
    let t1Deg = (t1Rad * 180) / Math.PI;
    const t2Deg = (t2Rad * 180) / Math.PI;

    // Normalize base angle between 0 and 360
    t1Deg = (t1Deg + 360) % 360;

    return {
      t1Deg,
      t2Deg,
      actualX: clampedX,
      actualY: clampedY,
      outOfReach
    };
  }, []);

  if (mode === 'ik') {
    const ikResult = calculateIK(targetX, targetY, l1, l2, elbow);
    theta1Deg = ikResult.t1Deg;
    theta2Deg = ikResult.t2Deg;
    currentX = ikResult.actualX;
    currentY = ikResult.actualY;
    isOutOfReach = ikResult.outOfReach;
  } else {
    const fkResult = calculateFK(fkTheta1, fkTheta2, l1, l2);
    currentX = fkResult.endX;
    currentY = fkResult.endY;
    theta1Deg = fkTheta1;
    theta2Deg = fkTheta2;
    const dist = Math.sqrt(currentX * currentX + currentY * currentY);
    isOutOfReach = dist > l1 + l2 || dist < Math.abs(l1 - l2);
  }

  // Derive joint coordinates for SVG visualization
  const r1 = (theta1Deg * Math.PI) / 180;
  const j1x = l1 * Math.cos(r1);
  const j1y = l1 * Math.sin(r1);

  // SVG Positions
  const baseSvgX = cx;
  const baseSvgY = cy;
  const elbowSvgX = cx + j1x;
  const elbowSvgY = cy - j1y;
  const wristSvgX = cx + currentX;
  const wristSvgY = cy - currentY;
  const targetSvgX = cx + targetX;
  const targetSvgY = cy - targetY;

  // Handlers for pointer interactions
  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || mode !== 'ik') return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const viewX = (clientX / rect.width) * 400;
    const viewY = (clientY / rect.height) * 400;

    const dx = viewX - cx;
    const dy = cy - viewY;

    setTargetX(Math.round(dx));
    setTargetY(Math.round(dy));
  }, [isDragging, mode]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  const handleReset = () => {
    setMode('ik');
    setElbow('up');
    setAngleMode('degrees');
    setL1(100);
    setL2(80);
    setTargetX(110);
    setTargetY(90);
    setFkTheta1(45);
    setFkTheta2(45);
  };

  const formatAngle = (degVal: number) => {
    if (angleMode === 'degrees') {
      return `${degVal.toFixed(1)}°`;
    }
    const radVal = (degVal * Math.PI) / 180;
    return `${radVal.toFixed(3)} rad`;
  };

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center">
        
        {/* Page Header */}
        <header className="text-center mb-6 w-full max-w-3xl">
          <div className="inline-block bg-ares-red/10 text-ares-red px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-6 border border-ares-red/20">
            ARES Math & Simulation
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 uppercase font-heading">
            Simulation <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl text-white font-bold inline-block mt-2">Engine</span>
          </h1>
          <p className="text-lg text-marble/60 max-w-2xl mx-auto font-medium leading-relaxed">
            Solve kinematic trigonometry in real-time or launch the FTC Desktop Robot Simulator via the local compiler daemon.
          </p>
        </header>

        {/* Tab Switcher */}
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 mb-8 max-w-md w-full shadow-lg">
          <button
            onClick={() => setActiveTab('kinematics')}
            className={`flex-1 py-2 text-xs uppercase tracking-wider font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'kinematics'
                ? 'bg-ares-red text-white shadow font-black'
                : 'text-marble/65 hover:text-white hover:bg-white/5'
            }`}
          >
            Trig Arm Solver
          </button>
          <button
            onClick={() => setActiveTab('launcher')}
            className={`flex-1 py-2 text-xs uppercase tracking-wider font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'launcher'
                ? 'bg-ares-red text-white shadow font-black'
                : 'text-marble/65 hover:text-white hover:bg-white/5'
            }`}
          >
            Desktop Sim Launcher
          </button>
        </div>

        {activeTab === 'kinematics' ? (
          <>
            {/* Desktop restriction reminder */}
        <div className="flex md:hidden flex-col items-center justify-center p-8 text-center bg-white/5 border border-white/10 ares-cut max-w-md w-full mb-8">
          <div className="bg-ares-red/10 p-4 rounded-full mb-4 border border-ares-red/30">
            <AlertTriangle className="text-ares-red" size={32} />
          </div>
          <h2 className="text-xl font-bold font-heading text-white mb-2">Desktop Recommended</h2>
          <p className="text-xs text-marble/60 leading-relaxed">
            The ARES arm math simulation requires higher canvas resolution and hardware pointer events to run optimally. Please open this page on a desktop or laptop device.
          </p>
        </div>

        {/* Simulator Container */}
        <div
          ref={containerRef}
          className="glass-card hero-card flex flex-col gap-6 p-6 sm:p-8 text-marble border border-white/10 max-w-3xl mx-auto w-full"
        >
          {/* Interactive Visual Canvas Area */}
          <div className="w-full flex flex-col items-center gap-4 bg-black/40 p-4 rounded-xl border border-white/5 relative">
            <div className="w-full flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-sm sm:text-base">
                  Planar 2-DOF Arm Kinematics
                </span>
                <div className="group relative">
                  <Info size={14} className="text-marble/40 hover:text-ares-gold cursor-help" />
                  <div className="absolute left-0 bottom-6 hidden group-hover:block bg-obsidian border border-white/10 p-3 rounded shadow-xl text-xs w-64 z-10 leading-relaxed text-marble/90">
                    Robotic arms use trigonometry to calculate motion. Drag the glowing red target handle around the envelope. Observe how standard angles (θ₁ base, θ₂ elbow) calculate dynamically in real-time!
                  </div>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="p-1 text-xs font-bold text-ares-red/80 hover:text-white flex items-center gap-1 transition-all hover:bg-ares-red/10 px-2.5 py-1 rounded"
              >
                <RefreshCw size={12} /> RESET
              </button>
            </div>

            {/* The SVG Cartesian Grid */}
            <div className="relative bg-black/60 p-3 rounded-lg border border-white/10 shadow-2xl max-w-full">
              <svg
                width="400"
                height="400"
                viewBox="0 0 400 400"
                onPointerMove={handlePointerMove}
                className="w-full max-w-[400px] h-auto select-none touch-none"
              >
                {/* Grid background lines */}
                <line x1="20" y1={cy} x2="380" y2={cy} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                <line x1={cx} y1="20" x2={cx} y2="380" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

                {/* Grid ticks and limits */}
                <circle cx={cx} cy={cy} r="50" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />
                <circle cx={cx} cy={cy} r="100" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />
                <circle cx={cx} cy={cy} r="150" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />

                {/* Reach boundaries */}
                <circle cx={cx} cy={cy} r={Math.abs(l1 - l2)} fill="none" stroke="rgba(192, 0, 0, 0.15)" strokeWidth="1.5" strokeDasharray="4,4" />
                <circle cx={cx} cy={cy} r={l1 + l2} fill="rgba(255, 184, 28, 0.02)" stroke="#FFB81C" strokeWidth="1.5" strokeDasharray="3,3" />

                {/* Grid Coordinate text labels */}
                <text x="390" y={cy + 14} fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="monospace" textAnchor="end">X axis</text>
                <text x={cx + 6} y="22" fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="monospace">Y axis</text>

                <text x={cx + l1 + l2} y={cy + 14} fill="#FFB81C" fillOpacity="0.4" fontSize="8" fontFamily="monospace" textAnchor="middle">+{l1 + l2}</text>
                <text x={cx - (l1 + l2)} y={cy + 14} fill="#FFB81C" fillOpacity="0.4" fontSize="8" fontFamily="monospace" textAnchor="middle">-{l1 + l2}</text>

                {/* Reachable envelope filled zone (annulus) */}
                <path
                  d={`
                    M ${cx + (l1 + l2)} ${cy}
                    A ${l1 + l2} ${l1 + l2} 0 1 0 ${cx - (l1 + l2)} ${cy}
                    A ${l1 + l2} ${l1 + l2} 0 1 0 ${cx + (l1 + l2)} ${cy}
                    Z
                    M ${cx + Math.abs(l1 - l2)} ${cy}
                    A ${Math.abs(l1 - l2)} ${Math.abs(l1 - l2)} 0 1 1 ${cx - Math.abs(l1 - l2)} ${cy}
                    A ${Math.abs(l1 - l2)} ${Math.abs(l1 - l2)} 0 1 1 ${cx + Math.abs(l1 - l2)} ${cy}
                    Z
                  `}
                  fill="rgba(255, 184, 28, 0.015)"
                  fillRule="evenodd"
                />

                {/* Target position line from base (hypotenuse projection) */}
                {mode === 'ik' && (
                  <line
                    x1={baseSvgX}
                    y1={baseSvgY}
                    x2={targetSvgX}
                    y2={targetSvgY}
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                  />
                )}

                {/* Arm Link 1 (Shoulder to Elbow) */}
                <line
                  x1={baseSvgX}
                  y1={baseSvgY}
                  x2={elbowSvgX}
                  y2={elbowSvgY}
                  stroke="#CD7F32"
                  strokeWidth="7"
                  strokeLinecap="round"
                />

                {/* Arm Link 2 (Elbow to Wrist) */}
                <line
                  x1={elbowSvgX}
                  y1={elbowSvgY}
                  x2={wristSvgX}
                  y2={wristSvgY}
                  stroke="#FFB81C"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />

                {/* Base joint dot */}
                <circle cx={baseSvgX} cy={baseSvgY} r="10" fill="#CD7F32" stroke="#fff" strokeWidth="2" />
                <circle cx={baseSvgX} cy={baseSvgY} r="4" fill="#0A0A0A" />

                {/* Elbow joint dot */}
                <circle cx={elbowSvgX} cy={elbowSvgY} r="7" fill="#FFB81C" stroke="#fff" strokeWidth="1.5" />
                <circle cx={elbowSvgX} cy={elbowSvgY} r="2.5" fill="#0A0A0A" />

                {/* Wrist / end effector dot */}
                <circle cx={wristSvgX} cy={wristSvgY} r="5.5" fill="#C00000" stroke="#fff" strokeWidth="1.5" />

                {/* IK target dragging handle handle */}
                {mode === 'ik' && (
                  <g>
                    <circle
                      cx={targetSvgX}
                      cy={targetSvgY}
                      r="14"
                      fill="none"
                      stroke="#C00000"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                      className="animate-spin"
                      style={{ transformOrigin: `${targetSvgX}px ${targetSvgY}px`, animationDuration: '6s' }}
                    />
                    <circle
                      cx={targetSvgX}
                      cy={targetSvgY}
                      r="9"
                      fill="#C00000"
                      stroke="#fff"
                      strokeWidth="2"
                      cursor="grab"
                      className="hover:fill-white hover:stroke-[#C00000] transition-colors duration-150 active:cursor-grabbing"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                    />
                  </g>
                )}

                {/* Realtime angle display arches */}
                {theta1Deg > 0 && (
                  <path
                    d={`
                      M ${cx + 30} ${cy}
                      A 30 30 0 ${theta1Deg > 180 ? 1 : 0} 0
                      ${cx + 30 * Math.cos(r1)} ${cy - 30 * Math.sin(r1)}
                    `}
                    fill="none"
                    stroke="#CD7F32"
                    strokeWidth="2"
                  />
                )}
              </svg>

              {/* Out of Reach Alarm Notification */}
              {isOutOfReach && (
                <div className="absolute top-4 left-4 bg-ares-red/95 text-white font-mono text-[9px] font-bold px-2 py-1 rounded shadow-md border border-white/20 select-none animate-pulse">
                  ⚠️ REACH BOUNDARY / SINGULARITY
                </div>
              )}

              {/* Target Location coordinate tooltip overlay */}
              <div className="absolute bottom-4 right-4 bg-obsidian/90 border border-white/10 px-2 py-1.5 rounded text-[10px] font-mono text-white select-none">
                <span className="text-marble/50 uppercase">Actual: </span>
                X={<span className="font-bold text-white">{Math.round(currentX)}</span>}, 
                Y={<span className="font-bold text-white">{Math.round(currentY)}</span>}
              </div>
            </div>
            <p className="text-[10px] text-marble/30 uppercase tracking-widest font-mono select-none">
              ARES Robotics Engine // 2-DOF Plane Kinematics Model
            </p>
          </div>

          {/* Control Module & Mathematics Cards */}
          <div className="w-full flex flex-col gap-5 mt-4">
            {/* Toggle Mode: IK (Solver) vs FK (Joint Sliders) */}
            <div className="grid grid-cols-2 bg-black/40 p-1.5 rounded-lg border border-white/10 shadow">
              {([
                { id: 'ik', label: 'Inverse Kinematics (IK)' },
                { id: 'fk', label: 'Forward Kinematics (FK)' },
              ] as const).map((tMode) => {
                const isActive = mode === tMode.id;
                return (
                  <button
                    key={tMode.id}
                    onClick={() => setMode(tMode.id)}
                    className={`py-2 px-1 text-xs uppercase tracking-wider font-bold rounded transition-all select-none ${
                      isActive
                        ? 'bg-ares-red text-white shadow-md'
                        : 'text-marble/75 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tMode.label}
                  </button>
                );
              })}
            </div>

            {/* Sliders Container Card */}
            <div className="bg-black/20 border border-white/5 rounded-xl p-5 shadow-lg flex flex-col gap-4">
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
                  <Sliders size={14} /> Control Sliders
                </h3>
                
                {/* Units display switcher */}
                <div className="flex bg-black/40 p-0.5 rounded border border-white/10">
                  {(['degrees', 'radians'] as const).map((amode) => (
                    <button
                      key={amode}
                      onClick={() => setAngleMode(amode)}
                      className={`px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded transition-all ${
                        angleMode === amode ? 'bg-ares-red text-white' : 'text-marble/60 hover:text-white'
                      }`}
                    >
                      {amode === 'degrees' ? 'deg' : 'rad'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Link Lengths Adjusters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-white/5">
                <div>
                  <div className="flex justify-between font-mono text-xs mb-1 text-marble/60">
                    <span>Link 1 Length (L₁)</span>
                    <span className="font-bold text-white">{l1}px</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="140"
                    step="1"
                    value={l1}
                    onChange={(e) => setL1(parseInt(e.target.value))}
                    className="w-full accent-ares-bronze cursor-ew-resize bg-black/40 h-1 rounded"
                  />
                </div>
                <div>
                  <div className="flex justify-between font-mono text-xs mb-1 text-marble/60">
                    <span>Link 2 Length (L₂)</span>
                    <span className="font-bold text-white">{l2}px</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="120"
                    step="1"
                    value={l2}
                    onChange={(e) => setL2(parseInt(e.target.value))}
                    className="w-full accent-ares-gold cursor-ew-resize bg-black/40 h-1 rounded"
                  />
                </div>
              </div>

              {/* Mode-Specific Parameter Sliders */}
              {mode === 'ik' ? (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center mb-1 bg-black/20 p-2.5 rounded border border-white/5">
                    <span className="text-[10px] font-mono text-marble/60 uppercase">Elbow Configuration:</span>
                    <div className="flex gap-1">
                      {(['up', 'down'] as const).map((elb) => (
                        <button
                          key={elb}
                          onClick={() => setElbow(elb)}
                          className={`px-3 py-1 text-[10px] font-bold rounded uppercase tracking-wider transition-all ${
                            elbow === elb ? 'bg-ares-gold text-obsidian font-black shadow-md animate-pulse' : 'text-marble/60 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {elb === 'up' ? 'Elbow Up' : 'Elbow Down'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between font-mono text-xs mb-1 text-ares-red">
                        <span>Target X</span>
                        <span className="font-bold text-white">{targetX}</span>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={targetX}
                        onChange={(e) => setTargetX(parseInt(e.target.value))}
                        className="w-full accent-ares-red cursor-ew-resize bg-black/40 h-1 rounded"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-mono text-xs mb-1 text-ares-red">
                        <span>Target Y</span>
                        <span className="font-bold text-white">{targetY}</span>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={targetY}
                        onChange={(e) => setTargetY(parseInt(e.target.value))}
                        className="w-full accent-ares-red cursor-ew-resize bg-black/40 h-1 rounded"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between font-mono text-xs mb-1 text-ares-bronze">
                      <span>Base Angle (θ₁)</span>
                      <span className="font-bold text-white">{formatAngle(fkTheta1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="1"
                      value={fkTheta1}
                      onChange={(e) => setFkTheta1(parseInt(e.target.value))}
                      className="w-full accent-ares-bronze cursor-ew-resize bg-black/40 h-1 rounded"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between font-mono text-xs mb-1 text-ares-gold">
                      <span>Elbow Angle (θ₂)</span>
                      <span className="font-bold text-white">{formatAngle(fkTheta2)}</span>
                    </div>
                    <input
                      type="range"
                      min="-150"
                      max="150"
                      step="1"
                      value={fkTheta2}
                      onChange={(e) => setFkTheta2(parseInt(e.target.value))}
                      className="w-full accent-ares-gold cursor-ew-resize bg-black/40 h-1 rounded"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Solved Output */}
            <div className="bg-black/20 border border-white/5 rounded-xl p-5 shadow-lg">
              <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-red mb-4 flex items-center gap-2">
                <Cpu size={14} className="text-ares-cyan animate-pulse" /> Solved Kinematic Coordinates
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Shoulder joint card */}
                <div className="p-4 rounded-lg border border-white/10 bg-white/5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-mono text-marble/55 uppercase tracking-widest">
                      Shoulder Angle (θ₁)
                    </span>
                    <span className="text-[9px] font-mono text-ares-bronze font-bold">Base Joint</span>
                  </div>
                  <div className="font-mono text-lg font-bold text-white leading-tight">
                    θ₁ = <span className="text-ares-bronze font-black">{formatAngle(theta1Deg)}</span>
                  </div>
                </div>

                {/* Elbow joint card */}
                <div className="p-4 rounded-lg border border-white/10 bg-white/5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-mono text-marble/55 uppercase tracking-widest">
                      Elbow Angle (θ₂)
                    </span>
                    <span className="text-[9px] font-mono text-ares-gold font-bold">Elbow Joint</span>
                  </div>
                  <div className="font-mono text-lg font-bold text-white leading-tight">
                    θ₂ = <span className="text-ares-gold font-black">{formatAngle(theta2Deg)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Math Breakdown */}
            <div className="bg-black/20 border border-white/5 rounded-xl p-5 shadow-lg">
              <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold mb-3 flex items-center gap-2">
                <HelpCircle size={14} /> Robotics Math breakdown
              </h3>

              <div className="text-xs sm:text-sm font-sans leading-relaxed text-marble/75 space-y-4">
                <p>
                  Planar linkage systems translate rotational motors (Joint Space) into reach points (Coordinate Space) using vector geometry.
                </p>
                
                <div className="border-l-2 border-ares-bronze pl-4 space-y-2">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">1. Forward Kinematics (Angles → Coordinates)</h4>
                  <p className="text-marble/70">
                    Solves for end coordinate $(x,y)$ using simple vector projection:
                  </p>
                  <div className="font-mono bg-black/40 p-3 rounded text-center text-xs text-white border border-white/5 space-y-1">
                    <div>x = L₁·cos(θ₁) + L₂·cos(θ₁ + θ₂)</div>
                    <div>x = {l1}·cos({theta1Deg.toFixed(1)}°) + {l2}·cos({(theta1Deg + theta2Deg).toFixed(1)}°) = <span className="text-ares-gold font-bold">{Math.round(currentX)}</span></div>
                    <div className="mt-1.5">y = L₁·sin(θ₁) + L₂·sin(θ₁ + θ₂)</div>
                    <div>y = {l1}·sin({theta1Deg.toFixed(1)}°) + {l2}·sin({(theta1Deg + theta2Deg).toFixed(1)}°) = <span className="text-ares-gold font-bold">{Math.round(currentY)}</span></div>
                  </div>
                </div>

                <div className="border-l-2 border-ares-red pl-4 space-y-2">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">2. Inverse Kinematics (Coordinates → Angles)</h4>
                  <p className="text-marble/70">
                    Solves for joint angles given desired end position. **ARESLib** EKF pathing libraries run this math dynamically at **200Hz** during autonomous runs:
                  </p>
                  <div className="font-mono bg-black/40 p-3 rounded text-center text-xs text-white border border-white/5">
                    cos(θ₂) = (x² + y² - L₁² - L₂²) / (2·L₁·L₂) = {( (currentX * currentX + currentY * currentY - l1*l1 - l2*l2) / (2 * l1 * l2) ).toFixed(3)}
                  </div>
                  <p className="text-marble/70 mt-2">
                    Under the hood, we solve θ₁ via two-argument arctangent coordinates:
                  </p>
                  <div className="font-mono bg-black/40 p-3 rounded text-center text-xs text-white border border-white/5">
                    θ₁ = atan2(y, x) - acos( (L₁² + D² - L₂²) / (2·L₁·D) )
                  </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-5xl">
            {/* Left Panel: Settings & Diagnostics */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              {/* Connection Card */}
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
                    <p className="text-[9px] text-amber-400 flex items-start gap-1 font-medium mt-0.5 leading-normal">
                      <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                      <span>Local WS is compatible with localhost development. Production HTTPS requires secure WSS.</span>
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {daemonStatus === 'connected' ? (
                    <button
                      onClick={disconnectFromDaemon}
                      className="w-full py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
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
                <div className="flex flex-col gap-3">
                  <button
                    onClick={startSimulator}
                    disabled={daemonStatus !== 'connected' || simState !== 'idle'}
                    className="w-full py-3 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-30 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
                  >
                    <Play size={12} className="fill-current" /> Build & Run Simulator
                  </button>
                  <button
                    onClick={stopSimulator}
                    disabled={daemonStatus !== 'connected' || simState === 'idle'}
                    className="w-full py-3 bg-red-600 text-white hover:bg-red-500 disabled:opacity-30 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
                  >
                    <Square size={12} className="fill-current" /> Stop Simulator
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs bg-black/45 p-3 rounded-lg border border-white/5 font-mono">
                  <span className="text-marble/55 uppercase text-[10px] tracking-wider">Sim Status:</span>
                  <span className={`font-bold uppercase tracking-widest text-[10px] ${
                    simState === 'running' ? 'text-emerald-400 animate-pulse' :
                    simState === 'building' ? 'text-amber-400 animate-pulse' :
                    'text-marble/35'
                  }`}>
                    {simState}
                  </span>
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
                      <span className={`font-bold ${diagnostics.jdkValid ? 'text-emerald-400' : 'text-red-400'}`}>
                        {diagnostics.jdkValid ? 'Valid ✅' : 'Invalid ❌'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-black/35 rounded border border-white/5">
                      <span className="text-marble/55 text-[10px]">JDK Version:</span>
                      <span className="text-white font-bold">{diagnostics.jdkVersion}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-black/35 rounded border border-white/5">
                      <span className="text-marble/55 text-[10px]">Gradle Wrapper:</span>
                      <span className={`font-bold ${diagnostics.gradlewExists ? 'text-emerald-400' : 'text-red-400'}`}>
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
                <div className="flex-1 bg-black/60 p-4 rounded-xl border border-white/10 font-mono text-[10px] sm:text-xs overflow-y-auto text-emerald-400 h-96 min-h-[350px] max-h-[500px] flex flex-col gap-1.5 leading-relaxed selection:bg-emerald-500/20">
                  {logs.length === 0 ? (
                    <div className="text-marble/20 text-center py-12 select-none">
                      Console idle. Establish connection and launch simulator.
                    </div>
                  ) : (
                    logs.map((log, index) => {
                      let colorClass = 'text-emerald-400';
                      if (log.includes('[ERROR]') || log.includes('[Daemon Error]')) {
                        colorClass = 'text-red-400 font-bold';
                      } else if (log.includes('[System]')) {
                        colorClass = 'text-cyan-400 font-bold';
                      } else if (log.includes('[System Error]')) {
                        colorClass = 'text-rose-500 font-black';
                      } else if (log.includes('[Daemon]')) {
                        colorClass = 'text-amber-400';
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
        )}

      </div>
    </div>
  );
}
