"use client";

import React, { useState, useId, useMemo } from "react";
import { Copy, Check, RotateCcw, AlertTriangle, ShieldCheck, Scale, Compass, Plus, Trash2 } from "lucide-react";

export interface RobotComponent {
  id: string;
  name: string;
  massKg: number;
  xCm: number;
  yCm: number;
  color: string;
}

const DEFAULT_WHEELBASE_CM = 42; // Front axle at x=42, Rear axle at x=0
const DEFAULT_CHASSIS_HEIGHT_CM = 35;

export const INITIAL_COMPONENTS: RobotComponent[] = [
  { id: "chassis", name: "Chassis Frame & Electronics", massKg: 4.2, xCm: 21, yCm: 4, color: "#94a3b8" },
  { id: "battery", name: "12V Slim Battery", massKg: 2.4, xCm: 10, yCm: 3, color: "#f59e0b" },
  { id: "motors", name: "Drivetrain Gearmotors", massKg: 3.2, xCm: 21, yCm: 5, color: "#06b6d4" },
  { id: "arm", name: "Articulating Arm / Lift", massKg: 3.6, xCm: 24, yCm: 26, color: "#a855f7" },
  { id: "intake", name: "Front Compliant Intake", massKg: 1.6, xCm: 44, yCm: 11, color: "#f43f5e" },
];

const COMPONENT_PALETTE = ["#94a3b8", "#f59e0b", "#06b6d4", "#a855f7", "#f43f5e", "#10b981", "#ec4899", "#3b82f6"];

export default function CenterOfMassEstimator() {
  const [wheelbaseCm, setWheelbaseCm] = useState<number>(DEFAULT_WHEELBASE_CM);
  const [components, setComponents] = useState<RobotComponent[]>(INITIAL_COMPONENTS);
  const [inclineDeg, setInclineDeg] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const wheelbaseInputId = useId();
  const inclineInputId = useId();

  // Mathematical Calculations
  const {
    totalMassKg,
    xComCm,
    yComCm,
    rearWeightFrac,
    frontWeightFrac,
    rearNormalForceN,
    frontNormalForceN,
    forwardTipAngleDeg,
    backwardTipAngleDeg,
    maxSafeInclineDeg,
    maxFwdAccelG,
    maxRevAccelG,
    isTippingOnIncline,
    effectiveXonIncline,
  } = useMemo(() => {
    const totalMass = components.reduce((sum, c) => sum + Math.max(0, c.massKg), 0);
    const safeTotalMass = Math.max(0.001, totalMass);

    const sumMx = components.reduce((sum, c) => sum + Math.max(0, c.massKg) * c.xCm, 0);
    const sumMy = components.reduce((sum, c) => sum + Math.max(0, c.massKg) * c.yCm, 0);

    const xCom = sumMx / safeTotalMass;
    const yCom = Math.max(0.1, sumMy / safeTotalMass);

    const safeWheelbase = Math.max(1, wheelbaseCm);
    const rearFrac = Math.max(0, Math.min(1, (safeWheelbase - xCom) / safeWheelbase));
    const frontFrac = Math.max(0, Math.min(1, xCom / safeWheelbase));

    const g = 9.81;
    const totalWeightN = safeTotalMass * g;
    const rearNormal = totalWeightN * rearFrac;
    const frontNormal = totalWeightN * frontFrac;

    // Critical Tipping Angle calculations on flat ground (limits before tip)
    const distToFront = safeWheelbase - xCom;
    const fwdTipRad = Math.atan2(Math.max(0, distToFront), yCom);
    const fwdTipDeg = (fwdTipRad * 180) / Math.PI;

    const distToRear = xCom;
    const bwdTipRad = Math.atan2(Math.max(0, distToRear), yCom);
    const bwdTipDeg = (bwdTipRad * 180) / Math.PI;

    const maxSafeIncline = Math.min(fwdTipDeg, bwdTipDeg);

    // Max dynamic accelerations (in Gs: a/g)
    const maxFwdG = distToRear / yCom;
    const maxRevG = distToFront / yCom;

    // Tipping condition on tilted incline
    const incRad = (inclineDeg * Math.PI) / 180;
    const xProj = xCom + yCom * Math.tan(incRad);
    const isTipping = xProj < 0 || xProj > safeWheelbase;

    return {
      totalMassKg: safeTotalMass,
      xComCm: xCom,
      yComCm: yCom,
      rearWeightFrac: rearFrac,
      frontWeightFrac: frontFrac,
      rearNormalForceN: rearNormal,
      frontNormalForceN: frontNormal,
      forwardTipAngleDeg: fwdTipDeg,
      backwardTipAngleDeg: bwdTipDeg,
      maxSafeInclineDeg: maxSafeIncline,
      maxFwdAccelG: maxFwdG,
      maxRevAccelG: maxRevG,
      isTippingOnIncline: isTipping,
      effectiveXonIncline: xProj,
    };
  }, [components, wheelbaseCm, inclineDeg]);

  // Presets
  const applyPreset = (presetName: "balanced" | "high_arm" | "climber" | "nose_heavy") => {
    if (presetName === "balanced") {
      setWheelbaseCm(42);
      setInclineDeg(0);
      setComponents(INITIAL_COMPONENTS);
    } else if (presetName === "high_arm") {
      setWheelbaseCm(42);
      setInclineDeg(0);
      setComponents([
        { id: "chassis", name: "Chassis Frame", massKg: 4.0, xCm: 21, yCm: 4, color: "#94a3b8" },
        { id: "battery", name: "Battery", massKg: 2.4, xCm: 18, yCm: 4, color: "#f59e0b" },
        { id: "motors", name: "Motors", massKg: 3.0, xCm: 21, yCm: 5, color: "#06b6d4" },
        { id: "arm", name: "Extended High Arm (Forward)", massKg: 5.5, xCm: 38, yCm: 42, color: "#a855f7" },
        { id: "intake", name: "Game Piece Loaded Intake", massKg: 2.8, xCm: 46, yCm: 32, color: "#f43f5e" },
      ]);
    } else if (presetName === "climber") {
      setWheelbaseCm(45);
      setInclineDeg(25);
      setComponents([
        { id: "chassis", name: "Chassis Frame", massKg: 4.2, xCm: 22, yCm: 4, color: "#94a3b8" },
        { id: "battery", name: "Rear Ballast Battery", massKg: 3.5, xCm: 6, yCm: 3, color: "#f59e0b" },
        { id: "motors", name: "Drivetrain Gearmotors", massKg: 3.6, xCm: 12, yCm: 5, color: "#06b6d4" },
        { id: "arm", name: "Compact Lift Mast", massKg: 3.0, xCm: 18, yCm: 15, color: "#a855f7" },
        { id: "intake", name: "Intake", massKg: 1.4, xCm: 40, yCm: 8, color: "#f43f5e" },
      ]);
    } else if (presetName === "nose_heavy") {
      setWheelbaseCm(40);
      setInclineDeg(0);
      setComponents([
        { id: "chassis", name: "Chassis Frame", massKg: 3.8, xCm: 20, yCm: 4, color: "#94a3b8" },
        { id: "battery", name: "Battery", massKg: 2.4, xCm: 24, yCm: 5, color: "#f59e0b" },
        { id: "motors", name: "Motors", massKg: 3.0, xCm: 22, yCm: 5, color: "#06b6d4" },
        { id: "arm", name: "Heavy Intake Overhang", massKg: 4.8, xCm: 45, yCm: 14, color: "#f43f5e" },
      ]);
    }
  };

  const handleReset = () => {
    setWheelbaseCm(DEFAULT_WHEELBASE_CM);
    setInclineDeg(0);
    setComponents(INITIAL_COMPONENTS);
  };

  const handleAddComponent = () => {
    const nextIdx = components.length + 1;
    const color = COMPONENT_PALETTE[(nextIdx - 1) % COMPONENT_PALETTE.length];
    setComponents([
      ...components,
      {
        id: "custom-" + Date.now(),
        name: "Component " + nextIdx,
        massKg: 1.5,
        xCm: Math.round(wheelbaseCm / 2),
        yCm: 12,
        color,
      },
    ]);
  };

  const handleRemoveComponent = (id: string) => {
    if (components.length <= 1) return;
    setComponents(components.filter((c) => c.id !== id));
  };

  const handleUpdateComponent = (id: string, updates: Partial<RobotComponent>) => {
    setComponents(components.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const formulaSummaryText = "=== ARES STEM CENTER OF MASS & TIPPING ANALYSIS ===\n" +
    "Robot Total Mass: " + totalMassKg.toFixed(2) + " kg\n" +
    "Wheelbase (L): " + wheelbaseCm.toFixed(1) + " cm (Rear axle: 0 cm, Front axle: " + wheelbaseCm.toFixed(1) + " cm)\n\n" +
    "1. Center of Mass Coordinates:\n" +
    "   X_com = ∑(m_i · x_i) / M_total = " + xComCm.toFixed(2) + " cm (" + ((xComCm / wheelbaseCm) * 100).toFixed(1) + "% of wheelbase)\n" +
    "   Y_com = ∑(m_i · y_i) / M_total = " + yComCm.toFixed(2) + " cm height above ground\n\n" +
    "2. Static Wheel Normal Force Distribution:\n" +
    "   F_rear  = M · g · (L - X_com) / L = " + rearNormalForceN.toFixed(1) + " N (" + (rearWeightFrac * 100).toFixed(1) + "% weight)\n" +
    "   F_front = M · g · (X_com) / L     = " + frontNormalForceN.toFixed(1) + " N (" + (frontWeightFrac * 100).toFixed(1) + "% weight)\n\n" +
    "3. Critical Tipping Angles (Flat Incline Limits):\n" +
    "   θ_tip_forward  = arctan((L - X_com) / Y_com) = " + forwardTipAngleDeg.toFixed(1) + "°\n" +
    "   θ_tip_backward = arctan(X_com / Y_com)       = " + backwardTipAngleDeg.toFixed(1) + "°\n" +
    "   Max Safe Slope Incline = " + maxSafeInclineDeg.toFixed(1) + "°\n\n" +
    "4. Dynamic Acceleration Limits:\n" +
    "   a_max_forward  = g · (X_com / Y_com)       = " + maxFwdAccelG.toFixed(2) + " g (" + (maxFwdAccelG * 9.81).toFixed(2) + " m/s²)\n" +
    "   a_max_braking  = g · ((L - X_com) / Y_com) = " + maxRevAccelG.toFixed(2) + " g (" + (maxRevAccelG * 9.81).toFixed(2) + " m/s²)\n\n" +
    "5. Current Ramp Simulation (" + inclineDeg + "° Incline):\n" +
    "   Projected CoM Contact: " + effectiveXonIncline.toFixed(2) + " cm (Baseline: 0 to " + wheelbaseCm + " cm)\n" +
    "   Status: " + (isTippingOnIncline ? "TIPPING RISK / UNSTABLE" : "STABLE GROUND CONTACT");

  const copyFormulasToClipboard = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formulaSummaryText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="w-full space-y-6 text-white" data-testid="com-estimator">
      {/* Top Bar & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
        <div>
          <h2 className="font-heading text-xl font-black uppercase tracking-wider text-white sm:text-2xl flex items-center gap-2">
            <Scale className="text-ares-gold h-6 w-6" />
            Center of Mass & Tipping Estimator
          </h2>
          <p className="text-xs text-marble/70">
            Compute 2D chassis mass distribution, center of gravity (X, Y), wheel normal loads, and critical slope tipping margins.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-marble/60 mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset("balanced")}
            className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300 transition hover:bg-emerald-400 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
          >
            Balanced FTC Bot
          </button>
          <button
            type="button"
            onClick={() => applyPreset("high_arm")}
            className="rounded-lg border border-ares-red/40 bg-ares-red/10 px-2.5 py-1 text-xs font-bold text-ares-red transition hover:bg-ares-red hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red cursor-pointer"
          >
            High Arm (Tipping Risk)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("climber")}
            className="rounded-lg border border-ares-gold/40 bg-ares-gold/10 px-2.5 py-1 text-xs font-bold text-ares-gold transition hover:bg-ares-gold hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold cursor-pointer"
          >
            Ramp Climber (25° Slope)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("nose_heavy")}
            className="rounded-lg border border-ares-cyan/40 bg-ares-cyan/10 px-2.5 py-1 text-xs font-bold text-ares-cyan transition hover:bg-ares-cyan hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan cursor-pointer"
          >
            Heavy Front Intake
          </button>
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset center of mass estimator to defaults"
            className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs font-bold uppercase text-marble/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Component Coordinates & Mass Table (5 cols) */}
        <div className="space-y-5 lg:col-span-5">
          {/* Chassis Settings */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold flex items-center gap-1.5">
                <Compass className="h-4 w-4 text-ares-gold" /> Chassis Geometry & Test Slope
              </span>
              <span className="text-[10px] text-marble/50 uppercase font-mono">2D Plane (X, Y)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={wheelbaseInputId} className="block text-xs font-medium text-marble/80 mb-1">
                  Wheelbase (L, cm)
                </label>
                <input
                  id={wheelbaseInputId}
                  type="number"
                  min={20}
                  max={100}
                  step={1}
                  value={wheelbaseCm}
                  onChange={(e) => setWheelbaseCm(Math.max(10, Number(e.target.value) || 10))}
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 text-sm text-white font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
                />
              </div>

              <div>
                <label htmlFor={inclineInputId} className="block text-xs font-medium text-marble/80 mb-1">
                  Slope Incline (°): <span className="font-mono text-ares-cyan">{inclineDeg}°</span>
                </label>
                <input
                  id={inclineInputId}
                  type="range"
                  min={-45}
                  max={45}
                  step={1}
                  value={inclineDeg}
                  onChange={(e) => setInclineDeg(Number(e.target.value))}
                  className="w-full accent-ares-cyan cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-marble/50">
                  <span>-45° (Tail-down)</span>
                  <span>0°</span>
                  <span>+45° (Nose-down)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subsystem Components List */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold">
                Components & Masses ({components.length})
              </span>
              <button
                type="button"
                onClick={handleAddComponent}
                className="flex items-center gap-1 text-[11px] font-bold text-ares-cyan hover:underline uppercase cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Add Component
              </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
              {components.map((comp, idx) => (
                <div key={comp.id} className="rounded-lg border border-white/5 bg-black/40 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: comp.color }}
                      />
                      <input
                        type="text"
                        value={comp.name}
                        onChange={(e) => handleUpdateComponent(comp.id, { name: e.target.value })}
                        aria-label={"Component " + (idx + 1) + " name"}
                        className="bg-transparent text-xs font-bold text-white border-b border-transparent focus:border-ares-gold outline-none w-full truncate"
                      />
                    </div>
                    {components.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveComponent(comp.id)}
                        className="text-marble/40 hover:text-ares-red transition p-1 cursor-pointer"
                        aria-label={"Delete " + comp.name}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label htmlFor={"comp-mass-" + comp.id} className="block text-[10px] text-marble/60">
                        Mass (kg)
                      </label>
                      <input
                        id={"comp-mass-" + comp.id}
                        type="number"
                        min={0.1}
                        max={50}
                        step={0.1}
                        value={comp.massKg}
                        onChange={(e) =>
                          handleUpdateComponent(comp.id, { massKg: Math.max(0.01, Number(e.target.value) || 0) })
                        }
                        className="w-full rounded border border-white/10 bg-black/60 px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor={"comp-x-" + comp.id} className="block text-[10px] text-marble/60">
                        X Pos (cm)
                      </label>
                      <input
                        id={"comp-x-" + comp.id}
                        type="number"
                        min={-10}
                        max={wheelbaseCm + 20}
                        step={1}
                        value={comp.xCm}
                        onChange={(e) => handleUpdateComponent(comp.id, { xCm: Number(e.target.value) || 0 })}
                        className="w-full rounded border border-white/10 bg-black/60 px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor={"comp-y-" + comp.id} className="block text-[10px] text-marble/60">
                        Y Pos (cm)
                      </label>
                      <input
                        id={"comp-y-" + comp.id}
                        type="number"
                        min={0}
                        max={80}
                        step={1}
                        value={comp.yCm}
                        onChange={(e) => handleUpdateComponent(comp.id, { yCm: Number(e.target.value) || 0 })}
                        className="w-full rounded border border-white/10 bg-black/60 px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: 2D Interactive Visualizer & Telemetry (7 cols) */}
        <div className="space-y-5 lg:col-span-7">
          {/* Visual 2D Robot Chassis Canvas */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold flex items-center gap-1.5">
                <Scale className="h-4 w-4" /> 2D Dynamic Stability & Center of Gravity
              </span>
              <div className="flex items-center gap-2">
                {isTippingOnIncline ? (
                  <span className="flex items-center gap-1 rounded bg-ares-red/20 border border-ares-red/40 px-2.5 py-0.5 text-xs font-bold text-ares-red animate-pulse">
                    <AlertTriangle className="h-3.5 w-3.5" /> TIPPING RISK!
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" /> STABLE BASE
                  </span>
                )}
              </div>
            </div>

            {/* SVG Visualizer */}
            <div className="h-72 w-full bg-obsidian/80 rounded-lg border border-white/5 flex items-center justify-center p-2 relative">
              <svg
                viewBox="-80 -180 560 260"
                className="w-full h-full select-none"
                role="img"
                aria-label="2D Robot Center of Mass and Tipping Visualization"
              >
                {/* Ground Plane line */}
                <line x1="-70" y1="30" x2="470" y2="30" stroke="#334155" strokeWidth="3" />

                {/* Transform group with incline tilt rotation */}
                <g transform={"rotate(" + inclineDeg + " 180 30)"}>
                  {/* Inclined Ramp surface */}
                  <line x1="-60" y1="20" x2="450" y2="20" stroke="#0ea5e9" strokeWidth="3" strokeDasharray="6 3" opacity="0.4" />

                  {/* Robot coordinate scale mapping */}
                  <g transform="translate(60, 20)">
                    {/* Chassis Outline Frame */}
                    <rect
                      x="-10"
                      y={-DEFAULT_CHASSIS_HEIGHT_CM * 3.5}
                      width={wheelbaseCm * 6 + 20}
                      height={DEFAULT_CHASSIS_HEIGHT_CM * 3.5}
                      rx="8"
                      fill="#18181b"
                      stroke="#475569"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                      opacity="0.6"
                    />

                    {/* Wheel Contacts at x=0 (Rear) and x=L (Front) */}
                    <circle cx="0" cy="0" r="14" fill="#09090b" stroke="#38bdf8" strokeWidth="3" />
                    <circle cx="0" cy="0" r="4" fill="#38bdf8" />
                    <text x="0" y="24" fill="#38bdf8" fontSize="10" textAnchor="middle" fontWeight="bold">
                      Rear (0cm)
                    </text>

                    <circle cx={wheelbaseCm * 6} cy="0" r="14" fill="#09090b" stroke="#38bdf8" strokeWidth="3" />
                    <circle cx={wheelbaseCm * 6} cy="0" r="4" fill="#38bdf8" />
                    <text x={wheelbaseCm * 6} y="24" fill="#38bdf8" fontSize="10" textAnchor="middle" fontWeight="bold">
                      {"Front (" + wheelbaseCm + "cm)"}
                    </text>

                    <line x1="0" y1="-8" x2={wheelbaseCm * 6} y2="-8" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
                    <text x={(wheelbaseCm * 6) / 2} y="-12" fill="#38bdf8" fontSize="10" textAnchor="middle">
                      {"L = " + wheelbaseCm + " cm"}
                    </text>

                    {/* Components Dots */}
                    {components.map((comp) => {
                      const cx = comp.xCm * 6;
                      const cy = -comp.yCm * 3.5;
                      const r = Math.max(5, Math.min(16, 5 + comp.massKg * 1.5));
                      return (
                        <g key={comp.id}>
                          <circle cx={cx} cy={cy} r={r} fill={comp.color} fillOpacity="0.85" stroke="#ffffff" strokeWidth="1.5" />
                          <text x={cx} y={cy - r - 4} fill={comp.color} fontSize="9" textAnchor="middle" fontWeight="bold">
                            {comp.name + " (" + comp.massKg + "kg)"}
                          </text>
                        </g>
                      );
                    })}

                    {/* CENTER OF MASS Marker */}
                    {(() => {
                      const comX = xComCm * 6;
                      const comY = -yComCm * 3.5;
                      return (
                        <g>
                          <circle cx={comX} cy={comY} r="18" fill="none" stroke="#fbbf24" strokeWidth="2" className="animate-ping" opacity="0.7" />
                          <circle cx={comX} cy={comY} r="12" fill="#fbbf24" fillOpacity="0.9" stroke="#ffffff" strokeWidth="2" />
                          <line x1={comX - 16} y1={comY} x2={comX + 16} y2={comY} stroke="#09090b" strokeWidth="2" />
                          <line x1={comX} y1={comY - 16} x2={comX} y2={comY + 16} stroke="#09090b" strokeWidth="2" />

                          <rect x={comX + 16} y={comY - 26} width="110" height="36" rx="4" fill="#09090b" stroke="#fbbf24" strokeWidth="1" />
                          <text x={comX + 22} y={comY - 14} fill="#fbbf24" fontSize="10" fontWeight="bold">
                            CoM (X, Y)
                          </text>
                          <text x={comX + 22} y={comY - 2} fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace">
                            {"(" + xComCm.toFixed(1) + ", " + yComCm.toFixed(1) + ") cm"}
                          </text>

                          <line
                            x1={comX}
                            y1={comY}
                            x2={comX}
                            y2={0}
                            stroke={isTippingOnIncline ? "#f43f5e" : "#22d3ee"}
                            strokeWidth="2.5"
                            strokeDasharray="4 2"
                          />
                          <circle cx={comX} cy="0" r="4" fill={isTippingOnIncline ? "#f43f5e" : "#22d3ee"} />
                        </g>
                      );
                    })()}
                  </g>
                </g>
              </svg>
            </div>
          </div>

          {/* Telemetry Output Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">Total Mass</span>
              <div className="mt-1 font-mono text-xl font-black text-white">
                {totalMassKg.toFixed(2)} <span className="text-xs text-white/50">kg</span>
              </div>
              <span className="text-[10px] text-marble/50">{(totalMassKg * 2.20462).toFixed(1)} lbs</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">CoM Location</span>
              <div className="mt-1 font-mono text-lg font-black text-ares-gold">
                {"X:" + xComCm.toFixed(1)} <span className="text-xs text-white/50">{"Y:" + yComCm.toFixed(1)}</span>
              </div>
              <span className="text-[10px] text-marble/50">{((xComCm / wheelbaseCm) * 100).toFixed(0)}% from rear</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">Max Safe Incline</span>
              <div className="mt-1 font-mono text-xl font-black text-ares-cyan">
                {maxSafeInclineDeg.toFixed(1)}°
              </div>
              <span className="text-[10px] text-marble/50">{"Fwd: " + forwardTipAngleDeg.toFixed(0) + "° / Bwd: " + backwardTipAngleDeg.toFixed(0) + "°"}</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">Weight Distribution</span>
              <div className="mt-1 font-mono text-base font-black text-emerald-400">
                {(rearWeightFrac * 100).toFixed(0)}% / {(frontWeightFrac * 100).toFixed(0)}%
              </div>
              <span className="text-[10px] text-marble/50">Rear / Front</span>
            </div>
          </div>

          {/* Normal Forces and Dynamic Acceleration limits */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold">
                Static Wheel Loads & Acceleration Limits
              </span>
              <span className="text-xs font-mono text-marble/60">g = 9.81 m/s²</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-marble/60 block uppercase">Rear Normal Force</span>
                <span className="font-mono text-sm font-bold text-white">
                  {rearNormalForceN.toFixed(1)} N
                </span>
                <span className="text-[10px] text-marble/40 block">{(rearNormalForceN / 9.81).toFixed(2)} kg-f</span>
              </div>
              <div>
                <span className="text-[10px] text-marble/60 block uppercase">Front Normal Force</span>
                <span className="font-mono text-sm font-bold text-white">
                  {frontNormalForceN.toFixed(1)} N
                </span>
                <span className="text-[10px] text-marble/40 block">{(frontNormalForceN / 9.81).toFixed(2)} kg-f</span>
              </div>
              <div>
                <span className="text-[10px] text-marble/60 block uppercase">Max Forward Accel</span>
                <span className="font-mono text-sm font-bold text-ares-cyan">
                  {maxFwdAccelG.toFixed(2)} g
                </span>
                <span className="text-[10px] text-marble/40 block">{(maxFwdAccelG * 9.81).toFixed(1)} m/s²</span>
              </div>
              <div>
                <span className="text-[10px] text-marble/60 block uppercase">Max Braking Decel</span>
                <span className="font-mono text-sm font-bold text-ares-red">
                  {maxRevAccelG.toFixed(2)} g
                </span>
                <span className="text-[10px] text-marble/40 block">{(maxRevAccelG * 9.81).toFixed(1)} m/s²</span>
              </div>
            </div>
          </div>

          {/* Formula Summary & Copy Card */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold">
                Mathematical Model & Tipping Equations
              </span>
              <button
                type="button"
                onClick={() => void copyFormulasToClipboard()}
                className="flex items-center gap-1.5 rounded-lg border border-ares-cyan/40 bg-ares-cyan/10 px-3 py-1 text-xs font-bold text-ares-cyan transition hover:bg-ares-cyan hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied to Clipboard!" : "Copy Formulas"}
              </button>
            </div>

            <div className="rounded-lg bg-black/70 p-3 font-mono text-xs text-marble/80 space-y-1.5 border border-white/5 overflow-x-auto">
              <p className="text-ares-cyan font-bold">
                {"1. Center of Mass: X_com = ∑(m_i · x_i) / M_total = " + xComCm.toFixed(2) + " cm, Y_com = " + yComCm.toFixed(2) + " cm"}
              </p>
              <p>{"2. Forward Tipping Limit: θ_tip = arctan((L - X_com) / Y_com) = " + forwardTipAngleDeg.toFixed(1) + "°"}</p>
              <p>{"3. Backward Tipping Limit: θ_tip = arctan(X_com / Y_com) = " + backwardTipAngleDeg.toFixed(1) + "°"}</p>
              <p className="text-ares-gold">
                {"4. Max Dynamic Acceleration: a_max = g · (X_com / Y_com) = " + maxFwdAccelG.toFixed(2) + " g"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
