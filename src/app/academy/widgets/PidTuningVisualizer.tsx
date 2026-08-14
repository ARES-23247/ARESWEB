"use client";

import React, { useState, useId, useMemo } from "react";
import { Copy, Check, RotateCcw, Activity, Sliders, LineChart, Sparkles } from "lucide-react";

export type PlantType = "arm_position" | "flywheel_velocity" | "drivetrain_heading";

export interface PidTelemetry {
  overshootPercent: number;
  riseTimeSec: number | null;
  peakTimeSec: number | null;
  settlingTimeSec: number | null;
  steadyStateError: number;
  dampingClassification: string;
}

export interface SimPoint {
  timeSec: number;
  setpoint: number;
  output: number;
  controlEffort: number;
  error: number;
}

export default function PidTuningVisualizer() {
  const [plantType, setPlantType] = useState<PlantType>("arm_position");
  const [kp, setKp] = useState<number>(1.8);
  const [ki, setKi] = useState<number>(0.4);
  const [kd, setKd] = useState<number>(0.32);
  const [kff, setKff] = useState<number>(0.0);
  const [setpoint, setSetpoint] = useState<number>(100);
  const [hasDisturbance, setHasDisturbance] = useState<boolean>(true);
  const [disturbanceMagnitude] = useState<number>(20);
  const [disturbanceTime] = useState<number>(2.5);
  const [showControlEffort, setShowControlEffort] = useState<boolean>(true);
  const [hoverPoint, setHoverPoint] = useState<SimPoint | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const kpInputId = useId();
  const kiInputId = useId();
  const kdInputId = useId();
  const kffInputId = useId();
  const setpointInputId = useId();

  // Numerical Simulation over 5.0 seconds with dt = 0.01 s
  const { points, telemetry } = useMemo(() => {
    const dt = 0.01;
    const totalTime = 5.0;
    const steps = Math.floor(totalTime / dt);
    const simPoints: SimPoint[] = [];

    let currentPos = 0;
    let currentVel = 0;
    let integralError = 0;
    let prevError = setpoint - currentPos;

    let inertia = 1.0;
    let damping = 0.8;
    let isVelocityPlant = false;

    if (plantType === "arm_position") {
      inertia = 1.2;
      damping = 0.6;
    } else if (plantType === "flywheel_velocity") {
      isVelocityPlant = true;
      inertia = 0.5;
      damping = 1.0;
    } else if (plantType === "drivetrain_heading") {
      inertia = 2.0;
      damping = 1.2;
    }

    const maxIntegralWindup = 100;
    const maxControlEffort = 120;

    let maxOutput = 0;
    let peakTime: number | null = null;
    let t10: number | null = null;
    let t90: number | null = null;
    const target10 = setpoint * 0.1;
    const target90 = setpoint * 0.9;

    for (let i = 0; i <= steps; i++) {
      const t = i * dt;
      const target = setpoint;
      const error = target - currentPos;

      integralError += error * dt;
      integralError = Math.max(-maxIntegralWindup, Math.min(maxIntegralWindup, integralError));

      const derivative = (error - prevError) / dt;
      prevError = error;

      let u = kp * error + ki * integralError + kd * derivative + kff * target;
      u = Math.max(-maxControlEffort, Math.min(maxControlEffort, u));

      let dist = 0;
      if (hasDisturbance && t >= disturbanceTime && t <= disturbanceTime + 0.8) {
        dist = -disturbanceMagnitude;
      }

      if (isVelocityPlant) {
        const dv = ((u + dist) - currentPos * damping) / inertia;
        currentPos += dv * dt;
        currentPos = Math.max(0, currentPos);
      } else {
        const accel = (u + dist - damping * currentVel) / inertia;
        currentVel += accel * dt;
        currentPos += currentVel * dt;
      }

      simPoints.push({
        timeSec: t,
        setpoint: target,
        output: currentPos,
        controlEffort: u,
        error,
      });

      if (t10 === null && currentPos >= target10) t10 = t;
      if (t90 === null && currentPos >= target90) t90 = t;

      if (currentPos > maxOutput) {
        maxOutput = currentPos;
        peakTime = t;
      }
    }

    const overshootPercent = setpoint > 0 && maxOutput > setpoint
      ? ((maxOutput - setpoint) / setpoint) * 100
      : 0;

    const riseTimeSec = t10 !== null && t90 !== null && t90 >= t10 ? t90 - t10 : null;

    const toleranceBand = setpoint * 0.02;
    let settlingTime: number | null = null;
    for (let i = simPoints.length - 1; i >= 0; i--) {
      const pt = simPoints[i];
      if (Math.abs(pt.output - setpoint) > toleranceBand) {
        settlingTime = pt.timeSec;
        break;
      }
    }

    const lastPoint = simPoints[simPoints.length - 1];
    const steadyStateError = Math.abs((lastPoint?.output || 0) - setpoint);

    let classification = "Critically Damped (Ideal)";
    if (overshootPercent > 25) {
      classification = "Underdamped / Ringing";
    } else if (overshootPercent > 0.5) {
      classification = "Slightly Underdamped";
    } else if (riseTimeSec && riseTimeSec > 1.2) {
      classification = "Overdamped (Sluggish)";
    } else if (steadyStateError > 5) {
      classification = "Steady-State Error Offset";
    }

    return {
      points: simPoints,
      telemetry: {
        overshootPercent,
        riseTimeSec,
        peakTimeSec: peakTime,
        settlingTimeSec: settlingTime,
        steadyStateError,
        dampingClassification: classification,
      },
    };
  }, [plantType, kp, ki, kd, kff, setpoint, hasDisturbance, disturbanceMagnitude, disturbanceTime]);

  const applyPreset = (presetName: "critical" | "underdamped" | "overdamped" | "flywheel" | "unstable") => {
    if (presetName === "critical") {
      setPlantType("arm_position");
      setKp(1.8);
      setKi(0.4);
      setKd(0.32);
      setKff(0.0);
      setSetpoint(100);
      setHasDisturbance(true);
    } else if (presetName === "underdamped") {
      setPlantType("arm_position");
      setKp(2.8);
      setKi(0.15);
      setKd(0.06);
      setKff(0.0);
      setSetpoint(100);
      setHasDisturbance(true);
    } else if (presetName === "overdamped") {
      setPlantType("arm_position");
      setKp(0.8);
      setKi(0.1);
      setKd(0.55);
      setKff(0.0);
      setSetpoint(100);
      setHasDisturbance(true);
    } else if (presetName === "flywheel") {
      setPlantType("flywheel_velocity");
      setKp(0.45);
      setKi(1.6);
      setKd(0.02);
      setKff(0.85);
      setSetpoint(150);
      setHasDisturbance(true);
    } else if (presetName === "unstable") {
      setPlantType("drivetrain_heading");
      setKp(7.5);
      setKi(2.8);
      setKd(0.01);
      setKff(0.0);
      setSetpoint(100);
      setHasDisturbance(false);
    }
  };

  const handleReset = () => {
    setPlantType("arm_position");
    setKp(1.8);
    setKi(0.4);
    setKd(0.32);
    setKff(0.0);
    setSetpoint(100);
    setHasDisturbance(true);
    setShowControlEffort(true);
  };

  const formulaSummaryText = "=== ARES STEM PID CONTROLLER STEP-RESPONSE SIMULATION ===\n" +
    "Plant Model: " + plantType.toUpperCase() + "\n" +
    "Gains: Kp = " + kp.toFixed(2) + ", Ki = " + ki.toFixed(2) + ", Kd = " + kd.toFixed(2) + ", Kff = " + kff.toFixed(2) + "\n" +
    "Setpoint Target: " + setpoint + "\n\n" +
    "1. Continuous & Discrete PID Control Law:\n" +
    "   u(t) = Kp · e(t) + Ki · ∫ e(τ)dτ + Kd · (de/dt) + Kff · r(t)\n\n" +
    "2. Telemetry Step-Response Metrics:\n" +
    "   - Peak Overshoot: " + telemetry.overshootPercent.toFixed(1) + "%\n" +
    "   - Rise Time (10% → 90%): " + (telemetry.riseTimeSec ? (telemetry.riseTimeSec.toFixed(2) + " s") : "N/A") + "\n" +
    "   - Settling Time (±2% band): " + (telemetry.settlingTimeSec ? (telemetry.settlingTimeSec.toFixed(2) + " s") : "N/A") + "\n" +
    "   - Steady-State Error: " + telemetry.steadyStateError.toFixed(2) + "\n" +
    "   - Dynamic Regime: " + telemetry.dampingClassification;

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

  const svgWidth = 560;
  const svgHeight = 260;
  const margin = { top: 20, right: 25, bottom: 35, left: 45 };
  const graphWidth = svgWidth - margin.left - margin.right;
  const graphHeight = svgHeight - margin.top - margin.bottom;

  const maxVal = Math.max(setpoint * 1.5, ...points.map((p) => p.output), 120);
  const minVal = Math.min(0, ...points.map((p) => p.output));

  const scaleX = (t: number) => margin.left + (t / 5.0) * graphWidth;
  const scaleY = (v: number) => margin.top + graphHeight - ((v - minVal) / Math.max(1, maxVal - minVal)) * graphHeight;

  const outputSvgPath = points
    .map((p, idx) => (idx === 0 ? "M" : "L") + " " + scaleX(p.timeSec).toFixed(1) + " " + scaleY(p.output).toFixed(1))
    .join(" ");

  const controlEffortSvgPath = points
    .map((p, idx) => {
      const scaledEffort = (p.controlEffort / 120) * setpoint;
      return (idx === 0 ? "M" : "L") + " " + scaleX(p.timeSec).toFixed(1) + " " + scaleY(scaledEffort).toFixed(1);
    })
    .join(" ");

  return (
    <div className="w-full space-y-6 text-white" data-testid="pid-visualizer">
      {/* Top Bar & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
        <div>
          <h2 className="font-heading text-xl font-black uppercase tracking-wider text-white sm:text-2xl flex items-center gap-2">
            <Activity className="text-ares-gold h-6 w-6" />
            PID Controller Step-Response Visualizer
          </h2>
          <p className="text-xs text-marble/70">
            Simulate closed-loop Proportional-Integral-Derivative control response curves, overshoot, rise time, and stability margins.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-marble/60 mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset("critical")}
            className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300 transition hover:bg-emerald-400 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
          >
            Critically Damped
          </button>
          <button
            type="button"
            onClick={() => applyPreset("underdamped")}
            className="rounded-lg border border-ares-cyan/40 bg-ares-cyan/10 px-2.5 py-1 text-xs font-bold text-ares-cyan transition hover:bg-ares-cyan hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan cursor-pointer"
          >
            Underdamped (Fast)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("overdamped")}
            className="rounded-lg border border-purple-400/40 bg-purple-400/10 px-2.5 py-1 text-xs font-bold text-purple-300 transition hover:bg-purple-400 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-pointer"
          >
            Overdamped
          </button>
          <button
            type="button"
            onClick={() => applyPreset("flywheel")}
            className="rounded-lg border border-ares-gold/40 bg-ares-gold/10 px-2.5 py-1 text-xs font-bold text-ares-gold transition hover:bg-ares-gold hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold cursor-pointer"
          >
            Flywheel Velocity + FF
          </button>
          <button
            type="button"
            onClick={() => applyPreset("unstable")}
            className="rounded-lg border border-ares-red/40 bg-ares-red/10 px-2.5 py-1 text-xs font-bold text-ares-red transition hover:bg-ares-red hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red cursor-pointer"
          >
            Oscillatory Hunting
          </button>
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset PID tuner to defaults"
            className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs font-bold uppercase text-marble/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Gain Sliders & Configuration (5 cols) */}
        <div className="space-y-5 lg:col-span-5">
          {/* Plant Selector */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <label className="block text-xs font-black uppercase tracking-wider text-ares-gold mb-3">
              Physical Plant Model
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["arm_position", "flywheel_velocity", "drivetrain_heading"] as PlantType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPlantType(type)}
                  className={"rounded-lg border px-2.5 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer " +
                    (plantType === type
                      ? "border-ares-gold bg-ares-gold text-black shadow-lg shadow-ares-gold/20"
                      : "border-white/10 bg-white/5 text-marble/80 hover:bg-white/10 hover:text-white")}
                >
                  {type === "arm_position" ? "Rotary Arm" : type === "flywheel_velocity" ? "Flywheel" : "Heading / Gyro"}
                </button>
              ))}
            </div>
          </div>

          {/* PID Gain Sliders */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-ares-gold" /> Controller Gains
              </span>
              <span className="text-[10px] text-marble/50 uppercase font-mono">Parallel Form PID+FF</span>
            </div>

            {/* Kp Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label htmlFor={kpInputId} className="font-bold text-ares-cyan flex items-center gap-1">
                  Proportional Gain (Kp)
                </label>
                <span className="font-mono text-sm font-bold text-ares-cyan">{kp.toFixed(2)}</span>
              </div>
              <input
                id={kpInputId}
                type="range"
                min={0}
                max={10}
                step={0.05}
                value={kp}
                onChange={(e) => setKp(Number(e.target.value))}
                className="w-full accent-ares-cyan cursor-pointer"
              />
              <p className="text-[10px] text-marble/50">Reacts directly to present error magnitude.</p>
            </div>

            {/* Ki Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label htmlFor={kiInputId} className="font-bold text-ares-gold flex items-center gap-1">
                  Integral Gain (Ki)
                </label>
                <span className="font-mono text-sm font-bold text-ares-gold">{ki.toFixed(2)}</span>
              </div>
              <input
                id={kiInputId}
                type="range"
                min={0}
                max={5}
                step={0.05}
                value={ki}
                onChange={(e) => setKi(Number(e.target.value))}
                className="w-full accent-ares-gold cursor-pointer"
              />
              <p className="text-[10px] text-marble/50">Eliminates steady-state bias over accumulated time.</p>
            </div>

            {/* Kd Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label htmlFor={kdInputId} className="font-bold text-purple-400 flex items-center gap-1">
                  Derivative Gain (Kd)
                </label>
                <span className="font-mono text-sm font-bold text-purple-300">{kd.toFixed(2)}</span>
              </div>
              <input
                id={kdInputId}
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={kd}
                onChange={(e) => setKd(Number(e.target.value))}
                className="w-full accent-purple-400 cursor-pointer"
              />
              <p className="text-[10px] text-marble/50">Dampens oscillations and predicts future trajectory rate.</p>
            </div>

            {/* Kff Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label htmlFor={kffInputId} className="font-bold text-emerald-400 flex items-center gap-1">
                  Feedforward Gain (Kff)
                </label>
                <span className="font-mono text-sm font-bold text-emerald-300">{kff.toFixed(2)}</span>
              </div>
              <input
                id={kffInputId}
                type="range"
                min={0}
                max={2}
                step={0.02}
                value={kff}
                onChange={(e) => setKff(Number(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <p className="text-[10px] text-marble/50">Anticipatory baseline output for target setpoint.</p>
            </div>
          </div>

          {/* Target & Disturbance Settings */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={setpointInputId} className="block text-xs font-medium text-marble/80 mb-1">
                  Step Setpoint (Target)
                </label>
                <input
                  id={setpointInputId}
                  type="number"
                  min={10}
                  max={300}
                  step={5}
                  value={setpoint}
                  onChange={(e) => setSetpoint(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 text-sm text-white font-mono"
                />
              </div>

              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2 text-xs font-medium text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasDisturbance}
                    onChange={(e) => setHasDisturbance(e.target.checked)}
                    className="rounded accent-ares-gold"
                  />
                  <span>Disturbance Step (t=2.5s)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-white cursor-pointer select-none mt-2">
                  <input
                    type="checkbox"
                    checked={showControlEffort}
                    onChange={(e) => setShowControlEffort(e.target.checked)}
                    className="rounded accent-purple-400"
                  />
                  <span>Plot Control Effort u(t)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Graph & Telemetry (7 cols) */}
        <div className="space-y-5 lg:col-span-7">
          {/* Live SVG Graph */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold flex items-center gap-1.5">
                <LineChart className="h-4 w-4" /> Real-time Step-Response Curve (0 - 5.0 s)
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-ares-gold font-mono text-[11px]">
                  <span className="h-2 w-3 border-t-2 border-dashed border-ares-gold inline-block" /> Setpoint ({setpoint})
                </span>
                <span className="flex items-center gap-1 text-ares-cyan font-mono text-[11px]">
                  <span className="h-2 w-3 bg-ares-cyan inline-block rounded" /> Output y(t)
                </span>
                {showControlEffort && (
                  <span className="flex items-center gap-1 text-purple-300 font-mono text-[11px]">
                    <span className="h-2 w-3 bg-purple-400 inline-block rounded" /> Effort u(t)
                  </span>
                )}
              </div>
            </div>

            {/* SVG Plot */}
            <div className="h-72 w-full bg-obsidian/80 rounded-lg border border-white/5 flex items-center justify-center p-1 relative">
              <svg
                viewBox={"0 0 " + svgWidth + " " + svgHeight}
                className="w-full h-full select-none"
                role="img"
                aria-label="PID Controller Step Response Time Graph"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const xRel = e.clientX - rect.left;
                  const ratio = (xRel - (margin.left / svgWidth) * rect.width) / ((graphWidth / svgWidth) * rect.width);
                  const tHover = Math.max(0, Math.min(5.0, ratio * 5.0));
                  const idx = Math.round((tHover / 5.0) * (points.length - 1));
                  setHoverPoint(points[idx] || null);
                }}
                onMouseLeave={() => setHoverPoint(null)}
              >
                {/* Grid X */}
                {[0, 1, 2, 3, 4, 5].map((t) => (
                  <g key={"grid-x-" + t}>
                    <line
                      x1={scaleX(t)}
                      y1={margin.top}
                      x2={scaleX(t)}
                      y2={margin.top + graphHeight}
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="1"
                    />
                    <text x={scaleX(t)} y={svgHeight - 12} fill="#71717a" fontSize="10" textAnchor="middle">
                      {t + "s"}
                    </text>
                  </g>
                ))}

                {/* Grid Y */}
                {[0, Math.round(setpoint * 0.5), setpoint, Math.round(setpoint * 1.25)].map((v) => (
                  <g key={"grid-y-" + v}>
                    <line
                      x1={margin.left}
                      y1={scaleY(v)}
                      x2={margin.left + graphWidth}
                      y2={scaleY(v)}
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="1"
                    />
                    <text x={margin.left - 8} y={scaleY(v) + 3} fill="#71717a" fontSize="10" textAnchor="end">
                      {v}
                    </text>
                  </g>
                ))}

                {/* Tolerance Band */}
                <rect
                  x={margin.left}
                  y={scaleY(setpoint * 1.02)}
                  width={graphWidth}
                  height={Math.max(2, scaleY(setpoint * 0.98) - scaleY(setpoint * 1.02))}
                  fill="#10b981"
                  fillOpacity="0.12"
                />

                {/* Setpoint Reference Line */}
                <line
                  x1={margin.left}
                  y1={scaleY(setpoint)}
                  x2={margin.left + graphWidth}
                  y2={scaleY(setpoint)}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeDasharray="5 3"
                />

                {/* Disturbance Marker */}
                {hasDisturbance && (
                  <g>
                    <line
                      x1={scaleX(disturbanceTime)}
                      y1={margin.top}
                      x2={scaleX(disturbanceTime)}
                      y2={margin.top + graphHeight}
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <text x={scaleX(disturbanceTime) + 4} y={margin.top + 12} fill="#f43f5e" fontSize="9" fontWeight="bold">
                      Disturbance Step
                    </text>
                  </g>
                )}

                {/* Effort Path */}
                {showControlEffort && (
                  <path d={controlEffortSvgPath} fill="none" stroke="#c084fc" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.7" />
                )}

                {/* Output Path */}
                <path d={outputSvgPath} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />

                {/* Hover Tooltip */}
                {hoverPoint && (
                  <g>
                    <line
                      x1={scaleX(hoverPoint.timeSec)}
                      y1={margin.top}
                      x2={scaleX(hoverPoint.timeSec)}
                      y2={margin.top + graphHeight}
                      stroke="#ffffff"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle cx={scaleX(hoverPoint.timeSec)} cy={scaleY(hoverPoint.output)} r="5" fill="#22d3ee" stroke="#ffffff" strokeWidth="2" />
                    <rect
                      x={Math.min(scaleX(hoverPoint.timeSec) + 8, svgWidth - 140)}
                      y={Math.max(margin.top + 10, scaleY(hoverPoint.output) - 45)}
                      width="125"
                      height="48"
                      rx="4"
                      fill="#09090b"
                      stroke="#22d3ee"
                      strokeWidth="1"
                    />
                    <text
                      x={Math.min(scaleX(hoverPoint.timeSec) + 14, svgWidth - 134)}
                      y={Math.max(margin.top + 24, scaleY(hoverPoint.output) - 31)}
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {"t = " + hoverPoint.timeSec.toFixed(2) + "s"}
                    </text>
                    <text
                      x={Math.min(scaleX(hoverPoint.timeSec) + 14, svgWidth - 134)}
                      y={Math.max(margin.top + 38, scaleY(hoverPoint.output) - 17)}
                      fill="#22d3ee"
                      fontSize="10"
                    >
                      {"Output: " + hoverPoint.output.toFixed(1)}
                    </text>
                    <text
                      x={Math.min(scaleX(hoverPoint.timeSec) + 14, svgWidth - 134)}
                      y={Math.max(margin.top + 50, scaleY(hoverPoint.output) - 5)}
                      fill="#fbbf24"
                      fontSize="9"
                    >
                      {"Error: " + hoverPoint.error.toFixed(1)}
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Telemetry Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">Peak Overshoot</span>
              <div className="mt-1 font-mono text-xl font-black text-ares-red">
                {telemetry.overshootPercent.toFixed(1)}<span className="text-xs text-white/50">%</span>
              </div>
              <span className="text-[10px] text-marble/50">
                {telemetry.peakTimeSec ? ("Peak at " + telemetry.peakTimeSec.toFixed(2) + "s") : "No Overshoot"}
              </span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">Rise Time (10-90%)</span>
              <div className="mt-1 font-mono text-xl font-black text-ares-cyan">
                {telemetry.riseTimeSec ? (telemetry.riseTimeSec.toFixed(2) + "s") : "N/A"}
              </div>
              <span className="text-[10px] text-marble/50">Speed of response</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">Settling Time (±2%)</span>
              <div className="mt-1 font-mono text-xl font-black text-emerald-400">
                {telemetry.settlingTimeSec ? (telemetry.settlingTimeSec.toFixed(2) + "s") : "<0.5s"}
              </div>
              <span className="text-[10px] text-marble/50">Within ±2% band</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">Steady-State Error</span>
              <div className="mt-1 font-mono text-xl font-black text-ares-gold">
                {telemetry.steadyStateError.toFixed(2)}
              </div>
              <span className="text-[10px] text-marble/50">Offset |y(end) - r|</span>
            </div>
          </div>

          {/* Damping Regime Analysis */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Controller Response Regime Analysis
              </span>
              <span className="font-mono text-xs font-bold text-ares-cyan">
                {telemetry.dampingClassification}
              </span>
            </div>

            <p className="text-xs text-marble/80 leading-relaxed">
              {telemetry.overshootPercent > 20
                ? "The loop is significantly underdamped. Consider increasing Kd to introduce derivative damping or slightly reducing Kp to prevent aggressive mechanical ringing."
                : telemetry.steadyStateError > 3
                ? "There is residual steady-state offset under load. Increase Ki (integral action) to force the long-term error to zero."
                : telemetry.riseTimeSec && telemetry.riseTimeSec > 1.0
                ? "The response is sluggish/overdamped. You can safely increase Kp or add Feedforward (Kff) to improve tracking velocity without causing instability."
                : "Excellent tuned response: crisp rise time, minimal overshoot, and robust rejection of step disturbances."}
            </p>
          </div>

          {/* Formula Card */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold">
                Mathematical Model & Control Equations
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
                {"1. PID Control Law: u(t) = " + kp.toFixed(2) + "·e(t) + " + ki.toFixed(2) + "·∫e(τ)dτ + " + kd.toFixed(2) + "·(de/dt) + " + kff.toFixed(2) + "·r(t)"}
              </p>
              <p>
                {"2. Peak Overshoot: M_p = " + telemetry.overshootPercent.toFixed(1) + "% | Rise Time: " + (telemetry.riseTimeSec ? (telemetry.riseTimeSec.toFixed(2) + " s") : "N/A")}
              </p>
              <p className="text-emerald-400">
                {"3. Settling Time: t_s = " + (telemetry.settlingTimeSec ? (telemetry.settlingTimeSec.toFixed(2) + " s") : "<0.5 s") + " | Steady-State Error: " + telemetry.steadyStateError.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
