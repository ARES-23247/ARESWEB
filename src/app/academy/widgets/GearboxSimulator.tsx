"use client";

import React, { useState, useId, useMemo } from "react";
import { Copy, Check, RotateCcw, Play, Pause, Zap, Gauge, Cog, Info } from "lucide-react";

export type GearboxType = "spur" | "planetary" | "bevel";

export interface SpurStage {
  id: string;
  drivingTeeth: number;
  drivenTeeth: number;
}

export interface PlanetaryConfig {
  sunTeeth: number;
  planetTeeth: number;
  stages: number;
}

export interface BevelConfig {
  pinionTeeth: number;
  gearTeeth: number;
}

export interface MotorPreset {
  name: string;
  freeSpeedRpm: number;
  stallTorqueNm: number;
  nominalVoltage: number;
}

export const MOTOR_PRESETS: Record<string, MotorPreset> = {
  yellowjacket_base: {
    name: "goBILDA 5202 (Base Motor)",
    freeSpeedRpm: 6000,
    stallTorqueNm: 0.12,
    nominalVoltage: 12,
  },
  rev_hd_hex: {
    name: "REV HD Hex (Base Motor)",
    freeSpeedRpm: 6000,
    stallTorqueNm: 0.105,
    nominalVoltage: 12,
  },
  andymark_neverest: {
    name: "AndyMark NeveRest (Base)",
    freeSpeedRpm: 6600,
    stallTorqueNm: 0.087,
    nominalVoltage: 12,
  },
  neo_brushless: {
    name: "REV NEO Brushless",
    freeSpeedRpm: 5676,
    stallTorqueNm: 3.75,
    nominalVoltage: 12,
  },
  falcon_500: {
    name: "Falcon 500 / Kraken X60",
    freeSpeedRpm: 6380,
    stallTorqueNm: 4.69,
    nominalVoltage: 12,
  },
  cim_motor: {
    name: "FRC CIM Motor",
    freeSpeedRpm: 5330,
    stallTorqueNm: 2.41,
    nominalVoltage: 12,
  },
  custom: {
    name: "Custom Motor",
    freeSpeedRpm: 5000,
    stallTorqueNm: 0.25,
    nominalVoltage: 12,
  },
};

const DEFAULT_SPUR_STAGES: SpurStage[] = [
  { id: "stage-1", drivingTeeth: 14, drivenTeeth: 42 },
  { id: "stage-2", drivingTeeth: 16, drivenTeeth: 48 },
];

const DEFAULT_PLANETARY: PlanetaryConfig = {
  sunTeeth: 12,
  planetTeeth: 18,
  stages: 2,
};

const DEFAULT_BEVEL: BevelConfig = {
  pinionTeeth: 15,
  gearTeeth: 30,
};

export default function GearboxSimulator() {
  const [gearboxType, setGearboxType] = useState<GearboxType>("spur");
  const [motorPresetKey, setMotorPresetKey] = useState<string>("yellowjacket_base");
  const [freeSpeedRpm, setFreeSpeedRpm] = useState<number>(6000);
  const [stallTorqueNm, setStallTorqueNm] = useState<number>(0.12);
  const [efficiencyPerStage, setEfficiencyPerStage] = useState<number>(95);
  const [appliedLoadNm, setAppliedLoadNm] = useState<number>(0.5);

  const [spurStages, setSpurStages] = useState<SpurStage[]>(DEFAULT_SPUR_STAGES);
  const [planetaryConfig, setPlanetaryConfig] = useState<PlanetaryConfig>(DEFAULT_PLANETARY);
  const [bevelConfig, setBevelConfig] = useState<BevelConfig>(DEFAULT_BEVEL);

  const [isAnimating, setIsAnimating] = useState<boolean>(true);
  const [animSpeed, setAnimSpeed] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);

  const speedInputId = useId();
  const torqueInputId = useId();
  const efficiencyInputId = useId();
  const loadInputId = useId();

  const handleMotorChange = (presetKey: string) => {
    setMotorPresetKey(presetKey);
    const preset = MOTOR_PRESETS[presetKey];
    if (preset) {
      setFreeSpeedRpm(preset.freeSpeedRpm);
      setStallTorqueNm(preset.stallTorqueNm);
    }
  };

  const { totalRatio, totalEfficiency, stageCount, ringTeeth } = useMemo(() => {
    if (gearboxType === "spur") {
      const ratio = spurStages.reduce((acc, stage) => {
        const stageRatio = (stage.drivenTeeth > 0 && stage.drivingTeeth > 0)
          ? stage.drivenTeeth / stage.drivingTeeth
          : 1;
        return acc * stageRatio;
      }, 1);
      const count = spurStages.length;
      const eff = Math.pow(efficiencyPerStage / 100, Math.max(1, count));
      return { totalRatio: Math.max(0.0001, ratio), totalEfficiency: eff, stageCount: count, ringTeeth: 0 };
    } else if (gearboxType === "planetary") {
      const sun = Math.max(1, planetaryConfig.sunTeeth);
      const planet = Math.max(1, planetaryConfig.planetTeeth);
      const ring = sun + 2 * planet;
      const singleStageRatio = 1 + ring / sun;
      const ratio = Math.pow(singleStageRatio, planetaryConfig.stages);
      const count = planetaryConfig.stages;
      const eff = Math.pow(efficiencyPerStage / 100, Math.max(1, count));
      return { totalRatio: Math.max(0.0001, ratio), totalEfficiency: eff, stageCount: count, ringTeeth: ring };
    } else {
      const pinion = Math.max(1, bevelConfig.pinionTeeth);
      const gear = Math.max(1, bevelConfig.gearTeeth);
      const ratio = gear / pinion;
      const eff = efficiencyPerStage / 100;
      return { totalRatio: Math.max(0.0001, ratio), totalEfficiency: eff, stageCount: 1, ringTeeth: 0 };
    }
  }, [gearboxType, spurStages, planetaryConfig, bevelConfig, efficiencyPerStage]);

  const outputFreeSpeedRpm = totalRatio > 0 ? freeSpeedRpm / totalRatio : 0;
  const outputFreeSpeedRadS = (outputFreeSpeedRpm * 2 * Math.PI) / 60;
  const outputStallTorqueNm = stallTorqueNm * totalRatio * totalEfficiency;
  const outputStallTorqueOzIn = outputStallTorqueNm * 141.612;
  const outputStallTorqueLbFt = outputStallTorqueNm * 0.737562;
  const mechanicalAdvantage = totalRatio * totalEfficiency;
  const maxPowerWatts = 0.25 * stallTorqueNm * (freeSpeedRpm * (2 * Math.PI / 60)) * totalEfficiency;

  const isStalled = appliedLoadNm >= outputStallTorqueNm;
  const operatingSpeedRpm = isStalled
    ? 0
    : outputFreeSpeedRpm * (1 - appliedLoadNm / Math.max(0.0001, outputStallTorqueNm));
  const operatingPowerWatts = isStalled
    ? 0
    : appliedLoadNm * (operatingSpeedRpm * 2 * Math.PI / 60);

  const applyPreset = (presetName: "yellowjacket_19_2" | "frc_toughbox" | "arm_planetary" | "bevel_intake") => {
    if (presetName === "yellowjacket_19_2") {
      setGearboxType("planetary");
      setMotorPresetKey("yellowjacket_base");
      setFreeSpeedRpm(6000);
      setStallTorqueNm(0.12);
      setEfficiencyPerStage(95);
      setPlanetaryConfig({ sunTeeth: 14, planetTeeth: 24, stages: 2 });
      setAppliedLoadNm(1.2);
    } else if (presetName === "frc_toughbox") {
      setGearboxType("spur");
      setMotorPresetKey("neo_brushless");
      setFreeSpeedRpm(5676);
      setStallTorqueNm(3.75);
      setEfficiencyPerStage(96);
      setSpurStages([
        { id: "tb-1", drivingTeeth: 14, drivenTeeth: 50 },
        { id: "tb-2", drivingTeeth: 16, drivenTeeth: 48 },
      ]);
      setAppliedLoadNm(15.0);
    } else if (presetName === "arm_planetary") {
      setGearboxType("planetary");
      setMotorPresetKey("rev_hd_hex");
      setFreeSpeedRpm(6000);
      setStallTorqueNm(0.105);
      setEfficiencyPerStage(92);
      setPlanetaryConfig({ sunTeeth: 12, planetTeeth: 18, stages: 3 });
      setAppliedLoadNm(8.0);
    } else if (presetName === "bevel_intake") {
      setGearboxType("bevel");
      setMotorPresetKey("yellowjacket_base");
      setFreeSpeedRpm(6000);
      setStallTorqueNm(0.12);
      setEfficiencyPerStage(94);
      setBevelConfig({ pinionTeeth: 15, gearTeeth: 30 });
      setAppliedLoadNm(0.15);
    }
  };

  const handleReset = () => {
    setGearboxType("spur");
    setMotorPresetKey("yellowjacket_base");
    setFreeSpeedRpm(6000);
    setStallTorqueNm(0.12);
    setEfficiencyPerStage(95);
    setAppliedLoadNm(0.5);
    setSpurStages(DEFAULT_SPUR_STAGES);
    setPlanetaryConfig(DEFAULT_PLANETARY);
    setBevelConfig(DEFAULT_BEVEL);
    setIsAnimating(true);
    setAnimSpeed(1);
  };

  const formulaSummaryText = "=== ARES STEM GEARBOX & TORQUE SIMULATION FORMULAS ===\n" +
    "Gearbox Type: " + gearboxType.toUpperCase() + "\n" +
    "Total Reduction Ratio: " + totalRatio.toFixed(3) + ":1\n" +
    "Overall Efficiency (η): " + (totalEfficiency * 100).toFixed(1) + "% (" + stageCount + " stage(s) @ " + efficiencyPerStage + "%/stage)\n\n" +
    "1. Reduction Ratio (R):\n" +
    "   - Spur Train: R = ∏ (N_driven,i / N_driving,i)\n" +
    "   - Planetary (Ring Fixed): R_stage = 1 + (N_ring / N_sun), where N_ring = N_sun + 2·N_planet\n" +
    "   - Bevel Pair: R = N_gear / N_pinion\n\n" +
    "2. Output Free Speed (ω_out):\n" +
    "   ω_out = ω_in / R = " + outputFreeSpeedRpm.toFixed(1) + " RPM (" + outputFreeSpeedRadS.toFixed(2) + " rad/s)\n\n" +
    "3. Output Stall Torque (τ_out):\n" +
    "   τ_out = τ_in × R × η_total = " + outputStallTorqueNm.toFixed(2) + " N·m (" + outputStallTorqueOzIn.toFixed(1) + " oz-in)\n\n" +
    "4. Operating Point under Applied Load (" + appliedLoadNm.toFixed(2) + " N·m):\n" +
    "   ω_load = " + operatingSpeedRpm.toFixed(1) + " RPM | P_mech = " + operatingPowerWatts.toFixed(1) + " W";

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
    <div className="w-full space-y-6 text-white" data-testid="gearbox-simulator">
      {/* Top Bar & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
        <div>
          <h2 className="font-heading text-xl font-black uppercase tracking-wider text-white sm:text-2xl flex items-center gap-2">
            <Cog className="text-ares-gold h-6 w-6" />
            Gear Ratio & Torque Simulator
          </h2>
          <p className="text-xs text-marble/70">
            Simulate mechanical reduction stages, torque multiplication, meshing pitch velocity, and operating power.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-marble/60 mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset("yellowjacket_19_2")}
            className="rounded-lg border border-ares-gold/40 bg-ares-gold/10 px-2.5 py-1 text-xs font-bold text-ares-gold transition hover:bg-ares-gold hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold cursor-pointer"
          >
            FTC YellowJacket 19.2:1
          </button>
          <button
            type="button"
            onClick={() => applyPreset("frc_toughbox")}
            className="rounded-lg border border-ares-cyan/40 bg-ares-cyan/10 px-2.5 py-1 text-xs font-bold text-ares-cyan transition hover:bg-ares-cyan hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan cursor-pointer"
          >
            FRC Toughbox 10.71:1
          </button>
          <button
            type="button"
            onClick={() => applyPreset("arm_planetary")}
            className="rounded-lg border border-purple-400/40 bg-purple-400/10 px-2.5 py-1 text-xs font-bold text-purple-300 transition hover:bg-purple-400 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-pointer"
          >
            Arm Planetary 125:1
          </button>
          <button
            type="button"
            onClick={() => applyPreset("bevel_intake")}
            className="rounded-lg border border-ares-red/40 bg-ares-red/10 px-2.5 py-1 text-xs font-bold text-ares-red transition hover:bg-ares-red hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red cursor-pointer"
          >
            Bevel 2:1 Right-Angle
          </button>
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset gearbox simulator to defaults"
            className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs font-bold uppercase text-marble/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Controls (5 cols) */}
        <div className="space-y-5 lg:col-span-5">
          {/* Gearbox Architecture Selector */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <label className="block text-xs font-black uppercase tracking-wider text-ares-gold mb-3">
              Gearbox Architecture
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["spur", "planetary", "bevel"] as GearboxType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setGearboxType(type)}
                  className={"rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer " +
                    (gearboxType === type
                      ? "border-ares-gold bg-ares-gold text-black shadow-lg shadow-ares-gold/20"
                      : "border-white/10 bg-white/5 text-marble/80 hover:bg-white/10 hover:text-white")}
                >
                  {type === "spur" ? "Spur Train" : type === "planetary" ? "Planetary" : "Bevel (90°)"}
                </button>
              ))}
            </div>
          </div>

          {/* Motor Specifications */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-ares-gold" /> Motor Specifications
              </span>
              <span className="text-[10px] text-marble/50 uppercase font-mono">12V DC Baseline</span>
            </div>

            <div>
              <label htmlFor="motor-preset-select" className="block text-xs font-medium text-marble/80 mb-1">
                Motor Model Preset
              </label>
              <select
                id="motor-preset-select"
                value={motorPresetKey}
                onChange={(e) => handleMotorChange(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold cursor-pointer"
              >
                {Object.entries(MOTOR_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key} className="bg-obsidian text-white">
                    {preset.name} ({preset.freeSpeedRpm} RPM, {preset.stallTorqueNm} N·m)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={speedInputId} className="block text-xs font-medium text-marble/80 mb-1">
                  Free Speed (RPM)
                </label>
                <input
                  id={speedInputId}
                  type="number"
                  min={100}
                  max={30000}
                  step={100}
                  value={freeSpeedRpm}
                  onChange={(e) => {
                    setMotorPresetKey("custom");
                    setFreeSpeedRpm(Math.max(1, Number(e.target.value) || 0));
                  }}
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 text-sm text-white font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
                />
              </div>
              <div>
                <label htmlFor={torqueInputId} className="block text-xs font-medium text-marble/80 mb-1">
                  Stall Torque (N·m)
                </label>
                <input
                  id={torqueInputId}
                  type="number"
                  min={0.01}
                  max={50}
                  step={0.01}
                  value={stallTorqueNm}
                  onChange={(e) => {
                    setMotorPresetKey("custom");
                    setStallTorqueNm(Math.max(0.001, Number(e.target.value) || 0));
                  }}
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 text-sm text-white font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={efficiencyInputId} className="block text-xs font-medium text-marble/80 mb-1">
                  Stage Efficiency (%)
                </label>
                <input
                  id={efficiencyInputId}
                  type="range"
                  min={70}
                  max={100}
                  step={1}
                  value={efficiencyPerStage}
                  onChange={(e) => setEfficiencyPerStage(Number(e.target.value))}
                  className="w-full accent-ares-gold cursor-pointer"
                />
                <div className="text-right text-xs font-mono text-ares-gold">{efficiencyPerStage}% / stage</div>
              </div>
              <div>
                <label htmlFor={loadInputId} className="block text-xs font-medium text-marble/80 mb-1">
                  Applied Load (N·m)
                </label>
                <input
                  id={loadInputId}
                  type="number"
                  min={0}
                  max={Math.max(10, outputStallTorqueNm * 1.2)}
                  step={0.1}
                  value={appliedLoadNm}
                  onChange={(e) => setAppliedLoadNm(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 text-sm text-white font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
                />
              </div>
            </div>
          </div>

          {/* Stage Tooth Controls */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold">
                {gearboxType === "spur"
                  ? ("Spur Gear Stages (" + spurStages.length + ")")
                  : gearboxType === "planetary"
                  ? ("Planetary (" + planetaryConfig.stages + " Stage" + (planetaryConfig.stages > 1 ? "s" : "") + ")")
                  : "Bevel Gear Pair (90°)"}
              </span>
              {gearboxType === "spur" && spurStages.length < 4 && (
                <button
                  type="button"
                  onClick={() =>
                    setSpurStages([
                      ...spurStages,
                      { id: "stage-" + (spurStages.length + 1), drivingTeeth: 16, drivenTeeth: 48 },
                    ])
                  }
                  className="text-[11px] font-bold text-ares-cyan hover:underline uppercase cursor-pointer"
                >
                  + Add Stage
                </button>
              )}
            </div>

            {/* Spur gear stages */}
            {gearboxType === "spur" && (
              <div className="space-y-3">
                {spurStages.map((stage, idx) => (
                  <div key={stage.id} className="rounded-lg border border-white/5 bg-black/40 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white/90">Stage {idx + 1}</span>
                      <span className="font-mono text-ares-cyan">
                        Ratio: {(stage.drivingTeeth > 0 ? stage.drivenTeeth / stage.drivingTeeth : 0).toFixed(2)}:1
                      </span>
                      {spurStages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSpurStages(spurStages.filter((s) => s.id !== stage.id))}
                          className="text-[11px] text-ares-red hover:underline cursor-pointer"
                          aria-label={"Remove stage " + (idx + 1)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={"stage-driving-" + stage.id} className="block text-[11px] text-marble/60">
                          Driving Pinion Teeth
                        </label>
                        <input
                          id={"stage-driving-" + stage.id}
                          type="number"
                          min={8}
                          max={120}
                          value={stage.drivingTeeth}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setSpurStages(
                              spurStages.map((s) => (s.id === stage.id ? { ...s, drivingTeeth: val } : s))
                            );
                          }}
                          className="w-full rounded-md border border-white/10 bg-black/60 px-2 py-1 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label htmlFor={"stage-driven-" + stage.id} className="block text-[11px] text-marble/60">
                          Driven Gear Teeth
                        </label>
                        <input
                          id={"stage-driven-" + stage.id}
                          type="number"
                          min={8}
                          max={160}
                          value={stage.drivenTeeth}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setSpurStages(
                              spurStages.map((s) => (s.id === stage.id ? { ...s, drivenTeeth: val } : s))
                            );
                          }}
                          className="w-full rounded-md border border-white/10 bg-black/60 px-2 py-1 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Planetary gear configuration */}
            {gearboxType === "planetary" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="planetary-sun-teeth" className="block text-xs text-marble/70 mb-1">
                      Sun Gear (Ns) Teeth
                    </label>
                    <input
                      id="planetary-sun-teeth"
                      type="number"
                      min={8}
                      max={60}
                      value={planetaryConfig.sunTeeth}
                      onChange={(e) =>
                        setPlanetaryConfig({
                          ...planetaryConfig,
                          sunTeeth: Math.max(6, Number(e.target.value) || 6),
                        })
                      }
                      className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="planetary-planet-teeth" className="block text-xs text-marble/70 mb-1">
                      Planet Gears (Np) Teeth
                    </label>
                    <input
                      id="planetary-planet-teeth"
                      type="number"
                      min={8}
                      max={60}
                      value={planetaryConfig.planetTeeth}
                      onChange={(e) =>
                        setPlanetaryConfig({
                          ...planetaryConfig,
                          planetTeeth: Math.max(6, Number(e.target.value) || 6),
                        })
                      }
                      className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="planetary-stages-count" className="block text-xs text-marble/70 mb-1">
                      Stacked Stages
                    </label>
                    <select
                      id="planetary-stages-count"
                      value={planetaryConfig.stages}
                      onChange={(e) =>
                        setPlanetaryConfig({
                          ...planetaryConfig,
                          stages: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white cursor-pointer"
                    >
                      <option value={1}>1 Stage</option>
                      <option value={2}>2 Stages</option>
                      <option value={3}>3 Stages</option>
                      <option value={4}>4 Stages</option>
                    </select>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/5 p-2.5 flex flex-col justify-center">
                    <span className="text-[11px] text-marble/60">Fixed Ring Gear (Nr):</span>
                    <span className="font-mono text-xs font-bold text-ares-gold">
                      {ringTeeth} Teeth <span className="text-[10px] text-marble/40">(Ns + 2·Np)</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bevel gear configuration */}
            {gearboxType === "bevel" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bevel-pinion-teeth" className="block text-xs text-marble/70 mb-1">
                    Pinion Gear (Driving)
                  </label>
                  <input
                    id="bevel-pinion-teeth"
                    type="number"
                    min={8}
                    max={60}
                    value={bevelConfig.pinionTeeth}
                    onChange={(e) =>
                      setBevelConfig({
                        ...bevelConfig,
                        pinionTeeth: Math.max(6, Number(e.target.value) || 6),
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="bevel-gear-teeth" className="block text-xs text-marble/70 mb-1">
                    Miter / Bevel Gear (Driven)
                  </label>
                  <input
                    id="bevel-gear-teeth"
                    type="number"
                    min={8}
                    max={120}
                    value={bevelConfig.gearTeeth}
                    onChange={(e) =>
                      setBevelConfig({
                        ...bevelConfig,
                        gearTeeth: Math.max(6, Number(e.target.value) || 6),
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visualizer & Telemetry (7 cols) */}
        <div className="space-y-5 lg:col-span-7">
          {/* Visual Gear Meshing SVG */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold flex items-center gap-1.5">
                <Gauge className="h-4 w-4" /> Live Gear Kinematics & Meshing
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAnimating(!isAnimating)}
                  className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-bold text-marble/90 hover:bg-white/10 cursor-pointer"
                  aria-label={isAnimating ? "Pause gear animation" : "Play gear animation"}
                >
                  {isAnimating ? <Pause className="h-3 w-3 text-ares-gold" /> : <Play className="h-3 w-3 text-ares-cyan" />}
                  {isAnimating ? "Pause" : "Play"}
                </button>
                <div className="flex items-center gap-1 text-[11px] text-marble/60">
                  <span>Speed:</span>
                  <input
                    type="range"
                    min={0.2}
                    max={3}
                    step={0.2}
                    value={animSpeed}
                    onChange={(e) => setAnimSpeed(Number(e.target.value))}
                    aria-label="Animation speed"
                    className="w-16 accent-ares-cyan h-1 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="h-64 w-full bg-obsidian/80 rounded-lg border border-white/5 flex items-center justify-center p-2">
              <svg
                viewBox="0 0 500 240"
                className="w-full h-full select-none"
                role="img"
                aria-label="Interactive gear meshing visualization"
              >
                <defs>
                  <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#b45309" stopOpacity="0.9" />
                  </radialGradient>
                  <radialGradient id="planetGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#0e7490" stopOpacity="0.9" />
                  </radialGradient>
                  <radialGradient id="gearGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#9f1239" stopOpacity="0.9" />
                  </radialGradient>
                </defs>

                {gearboxType === "spur" && (
                  <g transform="translate(40, 120)">
                    <g className={isAnimating ? "animate-spin" : ""} style={{ animationDuration: (2 / animSpeed) + "s", transformOrigin: "60px 0px" }}>
                      <circle cx="60" cy="0" r="32" fill="url(#sunGrad)" stroke="#fbbf24" strokeWidth="2" />
                      {Array.from({ length: 12 }).map((_, i) => {
                        const angle = (i * 360) / 12;
                        return (
                          <rect
                            key={i}
                            x="57"
                            y="-36"
                            width="6"
                            height="8"
                            rx="1"
                            fill="#fbbf24"
                            transform={"rotate(" + angle + " 60 0)"}
                          />
                        );
                      })}
                      <circle cx="60" cy="0" r="8" fill="#18181b" stroke="#fbbf24" strokeWidth="1.5" />
                    </g>
                    <text x="60" y="52" fill="#fbbf24" fontSize="11" textAnchor="middle" fontWeight="bold">
                      Motor Pinion ({spurStages[0]?.drivingTeeth || 14}T)
                    </text>
                    <text x="60" y="66" fill="#a1a1aa" fontSize="9" textAnchor="middle">
                      {freeSpeedRpm.toLocaleString()} RPM
                    </text>

                    <g
                      className={isAnimating ? "animate-spin" : ""}
                      style={{
                        animationDuration: ((2 * (spurStages[0]?.drivenTeeth / (spurStages[0]?.drivingTeeth || 1))) / animSpeed) + "s",
                        animationDirection: "reverse",
                        transformOrigin: "170px 0px",
                      }}
                    >
                      <circle cx="170" cy="0" r="76" fill="url(#gearGrad)" stroke="#f43f5e" strokeWidth="2" opacity="0.9" />
                      {Array.from({ length: 24 }).map((_, i) => {
                        const angle = (i * 360) / 24;
                        return (
                          <rect
                            key={i}
                            x="167"
                            y="-82"
                            width="6"
                            height="10"
                            rx="1"
                            fill="#f43f5e"
                            transform={"rotate(" + angle + " 170 0)"}
                          />
                        );
                      })}
                      <circle cx="170" cy="0" r="14" fill="#18181b" stroke="#f43f5e" strokeWidth="2" />
                    </g>
                    <text x="170" y="98" fill="#f43f5e" fontSize="11" textAnchor="middle" fontWeight="bold">
                      Output Stage ({spurStages[0]?.drivenTeeth || 42}T)
                    </text>

                    <circle cx="93" cy="0" r="4" fill="#22d3ee" className="animate-ping" />
                    <circle cx="93" cy="0" r="3" fill="#22d3ee" />
                    <text x="93" y="-12" fill="#22d3ee" fontSize="8" textAnchor="middle" fontWeight="bold">
                      Mesh Point
                    </text>

                    <g transform="translate(300, -20)">
                      <rect x="0" y="0" width="120" height="40" rx="6" fill="#18181b" stroke="rgba(255,255,255,0.1)" />
                      <text x="10" y="16" fill="#22d3ee" fontSize="10" fontWeight="bold">
                        Mechanical Ratio
                      </text>
                      <text x="10" y="32" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="monospace">
                        {totalRatio.toFixed(2)}:1 Reduction
                      </text>
                    </g>
                  </g>
                )}

                {gearboxType === "planetary" && (
                  <g transform="translate(200, 120)">
                    <circle cx="0" cy="0" r="95" fill="none" stroke="#64748b" strokeWidth="6" strokeDasharray="4 2" />
                    <text x="0" y="-102" fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="bold">
                      Fixed Ring ({ringTeeth}T)
                    </text>

                    <g
                      className={isAnimating ? "animate-spin" : ""}
                      style={{
                        animationDuration: ((4 * (1 + ringTeeth / planetaryConfig.sunTeeth)) / animSpeed) + "s",
                        transformOrigin: "0px 0px",
                      }}
                    >
                      <line x1="0" y1="0" x2="0" y2="-52" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                      <line x1="0" y1="0" x2="45" y2="26" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                      <line x1="0" y1="0" x2="-45" y2="26" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />

                      <circle cx="0" cy="-52" r="24" fill="url(#planetGrad)" stroke="#38bdf8" strokeWidth="1.5" />
                      <circle cx="45" cy="26" r="24" fill="url(#planetGrad)" stroke="#38bdf8" strokeWidth="1.5" />
                      <circle cx="-45" cy="26" r="24" fill="url(#planetGrad)" stroke="#38bdf8" strokeWidth="1.5" />
                    </g>

                    <g
                      className={isAnimating ? "animate-spin" : ""}
                      style={{ animationDuration: (2 / animSpeed) + "s", transformOrigin: "0px 0px" }}
                    >
                      <circle cx="0" cy="0" r="20" fill="url(#sunGrad)" stroke="#fbbf24" strokeWidth="2" />
                      <circle cx="0" cy="0" r="6" fill="#18181b" stroke="#fbbf24" strokeWidth="1.5" />
                    </g>
                    <text x="0" y="4" fill="#18181b" fontSize="8" textAnchor="middle" fontWeight="bold">
                      Sun
                    </text>

                    <g transform="translate(130, -50)">
                      <rect x="0" y="0" width="130" height="90" rx="6" fill="#18181b" stroke="rgba(255,255,255,0.1)" />
                      <text x="10" y="18" fill="#fbbf24" fontSize="10" fontWeight="bold">
                        Sun: {planetaryConfig.sunTeeth}T
                      </text>
                      <text x="10" y="36" fill="#38bdf8" fontSize="10" fontWeight="bold">
                        3x Planets: {planetaryConfig.planetTeeth}T
                      </text>
                      <text x="10" y="54" fill="#94a3b8" fontSize="10" fontWeight="bold">
                        Ring: {ringTeeth}T
                      </text>
                      <text x="10" y="76" fill="#22d3ee" fontSize="12" fontWeight="bold" fontFamily="monospace">
                        Ratio: {totalRatio.toFixed(2)}:1
                      </text>
                    </g>
                  </g>
                )}

                {gearboxType === "bevel" && (
                  <g transform="translate(160, 110)">
                    <g
                      className={isAnimating ? "animate-spin" : ""}
                      style={{ animationDuration: (2 / animSpeed) + "s", transformOrigin: "0px 0px" }}
                    >
                      <ellipse cx="0" cy="0" rx="20" ry="35" fill="url(#sunGrad)" stroke="#fbbf24" strokeWidth="2" />
                      <line x1="-30" y1="0" x2="0" y2="0" stroke="#fbbf24" strokeWidth="4" />
                    </g>
                    <text x="-40" y="-30" fill="#fbbf24" fontSize="11" textAnchor="middle" fontWeight="bold">
                      Input Pinion ({bevelConfig.pinionTeeth}T)
                    </text>

                    <g
                      className={isAnimating ? "animate-spin" : ""}
                      style={{
                        animationDuration: ((2 * (bevelConfig.gearTeeth / bevelConfig.pinionTeeth)) / animSpeed) + "s",
                        animationDirection: "reverse",
                        transformOrigin: "45px 35px",
                      }}
                    >
                      <ellipse cx="45" cy="35" rx="45" ry="25" fill="url(#gearGrad)" stroke="#f43f5e" strokeWidth="2" />
                      <line x1="45" y1="35" x2="45" y2="90" stroke="#f43f5e" strokeWidth="4" />
                    </g>
                    <text x="115" y="60" fill="#f43f5e" fontSize="11" textAnchor="start" fontWeight="bold">
                      90° Output Crown ({bevelConfig.gearTeeth}T)
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Telemetry Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">Total Reduction</span>
              <div className="mt-1 font-mono text-xl font-black text-ares-gold">
                {totalRatio.toFixed(2)}<span className="text-xs text-white/50">:1</span>
              </div>
              <span className="text-[10px] text-marble/50">{stageCount} Stage(s)</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">Output Free Speed</span>
              <div className="mt-1 font-mono text-xl font-black text-ares-cyan">
                {outputFreeSpeedRpm.toFixed(0)} <span className="text-xs text-white/50">RPM</span>
              </div>
              <span className="text-[10px] text-marble/50">{outputFreeSpeedRadS.toFixed(1)} rad/s</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">Output Stall Torque</span>
              <div className="mt-1 font-mono text-xl font-black text-ares-red">
                {outputStallTorqueNm.toFixed(2)} <span className="text-xs text-white/50">N·m</span>
              </div>
              <span className="text-[10px] text-marble/50">{outputStallTorqueOzIn.toFixed(0)} oz-in ({outputStallTorqueLbFt.toFixed(2)} ft-lb)</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">Mech Advantage</span>
              <div className="mt-1 font-mono text-xl font-black text-emerald-400">
                {mechanicalAdvantage.toFixed(2)}x
              </div>
              <span className="text-[10px] text-marble/50">η = {(totalEfficiency * 100).toFixed(1)}%</span>
            </div>
          </div>

          {/* Operating Point Telemetry */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold flex items-center gap-1">
                <Info className="h-3.5 w-3.5" /> Operating Point Under Load ({appliedLoadNm} N·m)
              </span>
              <span
                className={"text-xs font-bold px-2 py-0.5 rounded " +
                  (isStalled
                    ? "bg-ares-red/20 text-ares-red border border-ares-red/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40")}
              >
                {isStalled ? "STALLED / OVERLOAD" : "OPERATING HEALTHY"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-marble/60 block uppercase">Loaded Speed</span>
                <span className="font-mono text-base font-bold text-white">
                  {operatingSpeedRpm.toFixed(1)} RPM
                </span>
              </div>
              <div>
                <span className="text-[10px] text-marble/60 block uppercase">Mechanical Power</span>
                <span className="font-mono text-base font-bold text-ares-cyan">
                  {operatingPowerWatts.toFixed(1)} W
                </span>
              </div>
              <div>
                <span className="text-[10px] text-marble/60 block uppercase">Peak Power Limit</span>
                <span className="font-mono text-base font-bold text-ares-gold">
                  {maxPowerWatts.toFixed(1)} W
                </span>
              </div>
            </div>
          </div>

          {/* Formula Card */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-ares-gold">
                Mathematical Model & Formulas
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
                1. Reduction Ratio: R = ∏ (N_driven / N_driving) = {totalRatio.toFixed(3)}:1
              </p>
              <p>2. Output Free Speed: ω_out = ω_in / R = {outputFreeSpeedRpm.toFixed(1)} RPM</p>
              <p>
                3. Output Stall Torque: τ_out = τ_in × R × η = {stallTorqueNm.toFixed(3)} × {totalRatio.toFixed(2)} × {(totalEfficiency).toFixed(2)} ={" "}
                <span className="text-ares-gold font-bold">{outputStallTorqueNm.toFixed(2)} N·m</span>
              </p>
              <p className="text-marble/60">
                4. Operating Power: P = τ_load × ω_load = {operatingPowerWatts.toFixed(1)} Watts
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
