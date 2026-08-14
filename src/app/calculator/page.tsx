"use client";

import { useId, useMemo, useState } from "react";
import {
  RotateCcw,
  Sparkles,
  Trophy,
  ShieldAlert,
  Zap,
  Info,
  TrendingUp,
  ArrowRightLeft,
  Share2,
  Check,
} from "lucide-react";
import SEO from "@/components/SEO";
import {
  AllianceScores,
  AutoParkState,
  EndgameAscentState,
  STRATEGY_PRESETS,
  calculateAllianceBreakdown,
  calculateMatchComparison,
  clampValue,
  createInitialAllianceScores,
  formatMatchClipboardSummary,
  SCORING_VALUES,
} from "@/lib/scoringCalculator";

interface NumberStepperProps {
  id: string;
  label: string;
  sublabel?: string;
  pointsEach: number;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  accentColor?: "red" | "blue" | "gold" | "cyan";
}

function NumberStepper({
  id,
  label,
  sublabel,
  pointsEach,
  value,
  min = 0,
  max = 99,
  onChange,
  accentColor = "gold",
}: NumberStepperProps) {
  const pointsTotal = value * pointsEach;

  const getBorderAccent = () => {
    switch (accentColor) {
      case "red":
        return "border-ares-red/30 focus-within:border-ares-red";
      case "blue":
        return "border-ares-cyan/30 focus-within:border-ares-cyan";
      case "cyan":
        return "border-ares-cyan/30 focus-within:border-ares-cyan";
      case "gold":
      default:
        return "border-ares-gold/30 focus-within:border-ares-gold";
    }
  };

  return (
    <div className={`flex flex-col justify-between gap-2 border bg-white/[0.02] p-3 rounded-sm transition-colors ${getBorderAccent()}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <label htmlFor={id} className="text-xs font-bold text-white block cursor-pointer">
            {label}
          </label>
          {sublabel && <p className="text-[10px] text-marble/60">{sublabel}</p>}
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black uppercase tracking-wider text-ares-gold block">
            +{pointsEach} {pointsEach === 1 ? "pt" : "pts"}
          </span>
          <span className="text-xs font-mono font-bold text-marble/80">
            = {pointsTotal} pts
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <button
          type="button"
          onClick={() => onChange(clampValue(value - 1, min, max))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="flex h-9 w-9 items-center justify-center border border-white/20 bg-white/5 text-base font-bold text-white transition-all hover:bg-white/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded-sm"
        >
          −
        </button>

        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value === 0 ? "0" : value}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10);
            onChange(clampValue(Number.isNaN(parsed) ? 0 : parsed, min, max));
          }}
          aria-label={label}
          className="h-9 w-full min-w-0 border border-white/20 bg-black/40 text-center font-mono text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded-sm [appearance:textfield]"
        />

        <button
          type="button"
          onClick={() => onChange(clampValue(value + 1, min, max))}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="flex h-9 w-9 items-center justify-center border border-white/20 bg-white/5 text-base font-bold text-white transition-all hover:bg-white/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded-sm"
        >
          +
        </button>
      </div>
    </div>
  );
}

interface ParkSelectorProps {
  idPrefix: string;
  robotName: string;
  value: AutoParkState;
  onChange: (value: AutoParkState) => void;
}

function ParkSelector({ idPrefix, robotName, value, onChange }: ParkSelectorProps) {
  const options: Array<{ value: AutoParkState; label: string; points: number }> = [
    { value: "none", label: "None", points: 0 },
    { value: "observation", label: "Observation Zone", points: 3 },
    { value: "submersible", label: "Submersible Zone", points: 3 },
  ];

  return (
    <fieldset className="border border-white/10 bg-white/[0.02] p-3 rounded-sm">
      <legend className="px-1 text-xs font-bold text-marble/90">{robotName} Auto Park</legend>
      <div className="grid grid-cols-3 gap-1.5 mt-1">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              id={`${idPrefix}-${opt.value}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(opt.value)}
              className={`flex flex-col items-center justify-center p-2 rounded-sm border text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                isSelected
                  ? "border-ares-gold bg-ares-gold/20 text-white font-bold shadow-sm"
                  : "border-white/10 bg-black/20 text-marble/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-[11px] leading-tight block">{opt.label}</span>
              <span className="text-[9px] font-mono text-ares-gold mt-0.5">
                +{opt.points} pts
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface AscentSelectorProps {
  idPrefix: string;
  robotName: string;
  value: EndgameAscentState;
  onChange: (value: EndgameAscentState) => void;
}

function AscentSelector({ idPrefix, robotName, value, onChange }: AscentSelectorProps) {
  const options: Array<{ value: EndgameAscentState; label: string; desc: string; points: number }> = [
    { value: "none", label: "None", desc: "No Hang", points: 0 },
    { value: "level1", label: "Level 1", desc: "Touching floor/zone", points: 3 },
    { value: "level2", label: "Level 2", desc: "Low Rung suspend", points: 15 },
    { value: "level3", label: "Level 3", desc: "High Rung suspend", points: 30 },
  ];

  return (
    <fieldset className="border border-white/10 bg-white/[0.02] p-3 rounded-sm">
      <legend className="px-1 text-xs font-bold text-marble/90">{robotName} Endgame Ascent</legend>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              id={`${idPrefix}-${opt.value}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(opt.value)}
              className={`flex flex-col items-center justify-center p-2 rounded-sm border text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                isSelected
                  ? "border-ares-gold bg-ares-gold/20 text-white font-bold shadow-md ring-1 ring-ares-gold/50"
                  : "border-white/10 bg-black/20 text-marble/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-xs font-bold block">{opt.label}</span>
              <span className="text-[9px] text-marble/60 block">{opt.desc}</span>
              <span className="text-[10px] font-mono text-ares-gold font-bold mt-1">
                +{opt.points} pts
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function MatchScoringCalculatorPage() {
  const [matchMode, setMatchMode] = useState<"dual" | "single">("dual");
  const [activeAllianceTab, setActiveAllianceTab] = useState<"red" | "blue">("red");
  const [matchTag, setMatchTag] = useState("");
  const [redScores, setRedScores] = useState<AllianceScores>(createInitialAllianceScores());
  const [blueScores, setBlueScores] = useState<AllianceScores>(createInitialAllianceScores());
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const matchTagId = useId();

  const currentScores = activeAllianceTab === "red" ? redScores : blueScores;
  const setCurrentScores = (updater: (prev: AllianceScores) => AllianceScores) => {
    if (activeAllianceTab === "red") {
      setRedScores(updater);
    } else {
      setBlueScores(updater);
    }
  };

  const updateCurrentScoreField = <K extends keyof AllianceScores>(
    field: K,
    value: AllianceScores[K],
  ) => {
    setCurrentScores((prev) => ({ ...prev, [field]: value }));
    setActivePreset(null);
  };

  const redBreakdown = useMemo(() => calculateAllianceBreakdown(redScores), [redScores]);
  const blueBreakdown = useMemo(() => calculateAllianceBreakdown(blueScores), [blueScores]);
  const matchComparison = useMemo(
    () => calculateMatchComparison(redScores, blueScores),
    [redScores, blueScores],
  );

  const handleResetAll = () => {
    setRedScores(createInitialAllianceScores());
    setBlueScores(createInitialAllianceScores());
    setActivePreset(null);
  };

  const handleApplyPreset = (preset: (typeof STRATEGY_PRESETS)[number]) => {
    setCurrentScores(() => ({ ...preset.scores }));
    setActivePreset(preset.id);
  };

  const handleCopyClipboard = async () => {
    const text = formatMatchClipboardSummary({
      redScores,
      blueScores: matchMode === "dual" ? blueScores : undefined,
      mode: matchMode,
      activeAlliance: activeAllianceTab,
      matchTag,
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopiedStatus(true);
      setTimeout(() => setCopiedStatus(false), 3000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedStatus(true);
      setTimeout(() => setCopiedStatus(false), 3000);
    }
  };

  return (
    <main className="min-h-screen bg-obsidian text-marble py-16 px-4 sm:px-6 lg:px-8">
      <SEO
        title="FTC Match Scoring Calculator & Strategy Planner"
        description="Interactive FIRST® Tech Challenge INTO THE DEEP game scoring calculator, dual alliance simulator, strategy projections, and match telemetry planner engineered by ARES 23247."
      />

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <header className="border-b border-ares-bronze/20 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 border border-ares-gold/40 bg-ares-gold/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-ares-gold rounded-sm mb-3">
                <Sparkles size={12} className="animate-pulse" />
                FIRST® Tech Challenge • Season 2024–2025
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-white font-heading">
                INTO THE DEEP <span className="text-ares-red">Calculator</span>
              </h1>
              <p className="text-sm text-marble/80 mt-1 max-w-2xl">
                Real-time match scoring simulator, autonomous cycle projector, endgame ascent calculator, and strategy differential analyzer.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleResetAll}
                className="inline-flex items-center gap-2 border border-white/20 bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-marble transition-all rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                aria-label="Reset all match scores"
              >
                <RotateCcw size={14} />
                Reset Scores
              </button>

              <button
                type="button"
                onClick={handleCopyClipboard}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-sm transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                  copiedStatus
                    ? "bg-green-600 text-white"
                    : "bg-ares-red hover:bg-ares-red/90 text-white"
                }`}
                aria-label="Copy match scoring summary to clipboard"
              >
                {copiedStatus ? (
                  <>
                    <Check size={14} className="text-white" />
                    Copied Summary!
                  </>
                ) : (
                  <>
                    <Share2 size={14} />
                    Copy Summary
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ARIA Live Notification */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {copiedStatus ? "Match summary successfully copied to clipboard" : ""}
          </div>
        </header>

        {/* Global Match Setup & Mode Selection Bar */}
        <section aria-labelledby="match-setup-heading" className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white/[0.02] border border-white/10 p-4 rounded-sm">
          <h2 id="match-setup-heading" className="sr-only">
            Match Simulator Settings
          </h2>

          <div className="md:col-span-4 flex items-center gap-3">
            <label htmlFor={matchTagId} className="text-xs font-bold text-marble/90 whitespace-nowrap">
              Match Tag:
            </label>
            <input
              id={matchTagId}
              type="text"
              placeholder="e.g. Qualification 12 or Finals 1"
              value={matchTag}
              onChange={(e) => setMatchTag(e.target.value)}
              className="w-full bg-black/40 border border-white/15 px-3 py-1.5 text-xs text-white placeholder:text-marble/40 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            />
          </div>

          <div className="md:col-span-4 flex items-center justify-center gap-2">
            <span className="text-xs font-bold text-marble/80">Mode:</span>
            <div className="inline-flex border border-white/15 bg-black/40 p-0.5 rounded-sm" role="radiogroup" aria-label="Calculator Mode">
              <button
                type="button"
                role="radio"
                aria-checked={matchMode === "dual"}
                onClick={() => setMatchMode("dual")}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                  matchMode === "dual"
                    ? "bg-ares-gold text-black shadow"
                    : "text-marble/70 hover:text-white"
                }`}
              >
                Dual Alliance
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={matchMode === "single"}
                onClick={() => setMatchMode("single")}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                  matchMode === "single"
                    ? "bg-ares-gold text-black shadow"
                    : "text-marble/70 hover:text-white"
                }`}
              >
                Single Alliance
              </button>
            </div>
          </div>

          <div className="md:col-span-4 flex items-center justify-end gap-2">
            <span className="text-xs font-bold text-marble/80">Active Tab:</span>
            <div className="inline-flex border border-white/15 bg-black/40 p-0.5 rounded-sm" role="tablist" aria-label="Active Alliance Selection">
              <button
                type="button"
                role="tab"
                aria-selected={activeAllianceTab === "red"}
                onClick={() => setActiveAllianceTab("red")}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                  activeAllianceTab === "red"
                    ? "bg-ares-red text-white shadow"
                    : "text-marble/70 hover:text-white"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-red-400 inline-block" />
                Red Alliance
              </button>
              {matchMode === "dual" && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeAllianceTab === "blue"}
                  onClick={() => setActiveAllianceTab("blue")}
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                    activeAllianceTab === "blue"
                      ? "bg-cyan-600 text-white shadow"
                      : "text-marble/70 hover:text-white"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-cyan-400 inline-block" />
                  Blue Alliance
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Live Score Projection Scoreboard */}
        <section aria-labelledby="live-scoreboard-heading" className="space-y-4">
          <h2 id="live-scoreboard-heading" className="sr-only">
            Alliance Score Projections and Differential
          </h2>

          <div className={`grid gap-4 ${matchMode === "dual" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
            {/* Red Alliance Card */}
            <div
              className={`p-5 rounded-sm border transition-all ${
                activeAllianceTab === "red"
                  ? "border-ares-red bg-ares-red/10 shadow-lg shadow-ares-red/5"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-ares-red animate-pulse" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">
                    Red Alliance {activeAllianceTab === "red" && <span className="text-[10px] text-ares-gold">(Editing)</span>}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
                    {redBreakdown.totalScore}
                  </span>
                  <span className="text-xs text-marble/60 uppercase ml-1">pts</span>
                </div>
              </div>

              {/* Sub-phase metric pills */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs pt-2 border-t border-white/10">
                <div className="bg-black/30 p-1.5 rounded-sm">
                  <span className="text-[10px] uppercase text-marble/60 block">Auto</span>
                  <span className="font-mono font-bold text-ares-gold">{redBreakdown.autoTotal}</span>
                </div>
                <div className="bg-black/30 p-1.5 rounded-sm">
                  <span className="text-[10px] uppercase text-marble/60 block">TeleOp</span>
                  <span className="font-mono font-bold text-ares-cyan">{redBreakdown.teleopTotal}</span>
                </div>
                <div className="bg-black/30 p-1.5 rounded-sm">
                  <span className="text-[10px] uppercase text-marble/60 block">Endgame</span>
                  <span className="font-mono font-bold text-ares-red">{redBreakdown.endgameTotal}</span>
                </div>
                <div className="bg-black/30 p-1.5 rounded-sm">
                  <span className="text-[10px] uppercase text-marble/60 block">Penalties</span>
                  <span className="font-mono font-bold text-marble">{redBreakdown.penaltiesTotal}</span>
                </div>
              </div>
            </div>

            {/* Blue Alliance Card */}
            {matchMode === "dual" && (
              <div
                className={`p-5 rounded-sm border transition-all ${
                  activeAllianceTab === "blue"
                    ? "border-ares-cyan bg-ares-cyan/10 shadow-lg shadow-ares-cyan/5"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-ares-cyan animate-pulse" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">
                      Blue Alliance {activeAllianceTab === "blue" && <span className="text-[10px] text-ares-gold">(Editing)</span>}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
                      {blueBreakdown.totalScore}
                    </span>
                    <span className="text-xs text-marble/60 uppercase ml-1">pts</span>
                  </div>
                </div>

                {/* Sub-phase metric pills */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs pt-2 border-t border-white/10">
                  <div className="bg-black/30 p-1.5 rounded-sm">
                    <span className="text-[10px] uppercase text-marble/60 block">Auto</span>
                    <span className="font-mono font-bold text-ares-gold">{blueBreakdown.autoTotal}</span>
                  </div>
                  <div className="bg-black/30 p-1.5 rounded-sm">
                    <span className="text-[10px] uppercase text-marble/60 block">TeleOp</span>
                    <span className="font-mono font-bold text-ares-cyan">{blueBreakdown.teleopTotal}</span>
                  </div>
                  <div className="bg-black/30 p-1.5 rounded-sm">
                    <span className="text-[10px] uppercase text-marble/60 block">Endgame</span>
                    <span className="font-mono font-bold text-ares-red">{blueBreakdown.endgameTotal}</span>
                  </div>
                  <div className="bg-black/30 p-1.5 rounded-sm">
                    <span className="text-[10px] uppercase text-marble/60 block">Penalties</span>
                    <span className="font-mono font-bold text-marble">{blueBreakdown.penaltiesTotal}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Differential Banner for Dual Mode */}
          {matchMode === "dual" && (
            <div className="border border-white/10 bg-black/40 p-3.5 rounded-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ArrowRightLeft size={16} className="text-ares-gold" />
                <span className="text-xs font-bold uppercase tracking-wide text-marble/90">
                  Score Differential:
                </span>
                <span
                  className={`font-mono text-sm font-black uppercase px-2 py-0.5 rounded-sm ${
                    matchComparison.leader === "red"
                      ? "bg-ares-red text-white"
                      : matchComparison.leader === "blue"
                        ? "bg-ares-cyan text-black"
                        : "bg-white/20 text-white"
                  }`}
                >
                  {matchComparison.leader === "tie"
                    ? "Tied Match (0 pts)"
                    : matchComparison.leader === "red"
                      ? `Red +${matchComparison.differential} pts`
                      : `Blue +${matchComparison.differential} pts`}
                </span>
              </div>

              {/* Progress Split Bar */}
              <div className="w-full sm:w-64 flex items-center gap-2">
                <span className="text-[10px] font-mono text-ares-red font-bold">
                  {matchComparison.redSharePercentage}%
                </span>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden flex" role="progressbar" aria-valuenow={matchComparison.redSharePercentage} aria-valuemin={0} aria-valuemax={100} aria-label="Alliance Point Share">
                  <div
                    style={{ width: `${matchComparison.redSharePercentage}%` }}
                    className="bg-ares-red h-full transition-all duration-300"
                  />
                  <div
                    style={{ width: `${matchComparison.blueSharePercentage}%` }}
                    className="bg-ares-cyan h-full transition-all duration-300"
                  />
                </div>
                <span className="text-[10px] font-mono text-ares-cyan font-bold">
                  {matchComparison.blueSharePercentage}%
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Strategy Presets Bar */}
        <section aria-labelledby="presets-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="presets-heading" className="text-xs font-black uppercase tracking-widest text-ares-gold flex items-center gap-1.5">
              <Zap size={14} /> Tactical Strategy Presets
            </h2>
            <span className="text-[11px] text-marble/60">
              Loads onto active alliance ({activeAllianceTab === "red" ? "Red" : "Blue"})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STRATEGY_PRESETS.map((preset) => {
              const isApplied = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={`text-left p-3 rounded-sm border transition-all relative overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                    isApplied
                      ? "border-ares-gold bg-ares-gold/15 shadow-sm"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white group-hover:text-ares-gold transition-colors">
                      {preset.name}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-marble/90">
                      {preset.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-marble/70 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Interactive Scoring Inputs Form */}
        <div className="space-y-8">
          {/* Phase 1: Autonomous Scoring */}
          <section
            aria-labelledby="autonomous-scoring-heading"
            className="border border-white/10 bg-white/[0.01] p-5 sm:p-6 rounded-sm space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-ares-gold/20 text-ares-gold">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h2 id="autonomous-scoring-heading" className="text-base sm:text-lg font-black uppercase tracking-wide text-white">
                    1. Autonomous Period (30 Seconds)
                  </h2>
                  <p className="text-xs text-marble/60">
                    Samples scored in baskets/net, specimens clipped on chambers, and parking navigation.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase text-marble/60 block">Auto Total</span>
                <span className="text-lg font-mono font-black text-ares-gold">
                  {currentScores === redScores ? redBreakdown.autoTotal : blueBreakdown.autoTotal} pts
                </span>
              </div>
            </div>

            {/* Auto Samples */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-ares-cyan mb-3">
                Autonomous Sample Scoring
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumberStepper
                  id="auto-net-zone"
                  label="Sample in Net Zone"
                  sublabel="Floor net target"
                  pointsEach={SCORING_VALUES.AUTO_NET_ZONE}
                  value={currentScores.autoNetZoneSamples}
                  onChange={(val) => updateCurrentScoreField("autoNetZoneSamples", val)}
                  accentColor="gold"
                />
                <NumberStepper
                  id="auto-low-basket"
                  label="Sample in Low Basket"
                  sublabel="Low basket drop"
                  pointsEach={SCORING_VALUES.AUTO_LOW_BASKET}
                  value={currentScores.autoLowBasketSamples}
                  onChange={(val) => updateCurrentScoreField("autoLowBasketSamples", val)}
                  accentColor="gold"
                />
                <NumberStepper
                  id="auto-high-basket"
                  label="Sample in High Basket"
                  sublabel="High basket drop"
                  pointsEach={SCORING_VALUES.AUTO_HIGH_BASKET}
                  value={currentScores.autoHighBasketSamples}
                  onChange={(val) => updateCurrentScoreField("autoHighBasketSamples", val)}
                  accentColor="gold"
                />
              </div>
            </div>

            {/* Auto Specimens */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-ares-cyan mb-3">
                Autonomous Specimen Scoring
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberStepper
                  id="auto-low-chamber"
                  label="Specimen on Low Chamber"
                  sublabel="Clipped on low bar"
                  pointsEach={SCORING_VALUES.AUTO_LOW_CHAMBER}
                  value={currentScores.autoLowChamberSpecimens}
                  onChange={(val) => updateCurrentScoreField("autoLowChamberSpecimens", val)}
                  accentColor="gold"
                />
                <NumberStepper
                  id="auto-high-chamber"
                  label="Specimen on High Chamber"
                  sublabel="Clipped on high bar"
                  pointsEach={SCORING_VALUES.AUTO_HIGH_CHAMBER}
                  value={currentScores.autoHighChamberSpecimens}
                  onChange={(val) => updateCurrentScoreField("autoHighChamberSpecimens", val)}
                  accentColor="gold"
                />
              </div>
            </div>

            {/* Auto Parking */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-ares-cyan mb-3">
                Autonomous Navigation / Parking
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ParkSelector
                  idPrefix="auto-park-r1"
                  robotName="Alliance Robot 1"
                  value={currentScores.autoRobot1Park}
                  onChange={(val) => updateCurrentScoreField("autoRobot1Park", val)}
                />
                <ParkSelector
                  idPrefix="auto-park-r2"
                  robotName="Alliance Robot 2"
                  value={currentScores.autoRobot2Park}
                  onChange={(val) => updateCurrentScoreField("autoRobot2Park", val)}
                />
              </div>
            </div>
          </section>

          {/* Phase 2: TeleOp Scoring */}
          <section
            aria-labelledby="teleop-scoring-heading"
            className="border border-white/10 bg-white/[0.01] p-5 sm:p-6 rounded-sm space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-ares-cyan/20 text-ares-cyan">
                  <Zap size={16} />
                </div>
                <div>
                  <h2 id="teleop-scoring-heading" className="text-base sm:text-lg font-black uppercase tracking-wide text-white">
                    2. Driver-Controlled / TeleOp Period (2 Minutes)
                  </h2>
                  <p className="text-xs text-marble/60">
                    High-volume sample cycling and specimen clipping on submersible chamber bars.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase text-marble/60 block">TeleOp Total</span>
                <span className="text-lg font-mono font-black text-ares-cyan">
                  {currentScores === redScores ? redBreakdown.teleopTotal : blueBreakdown.teleopTotal} pts
                </span>
              </div>
            </div>

            {/* TeleOp Samples */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-ares-cyan mb-3">
                TeleOp Sample Scoring
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumberStepper
                  id="teleop-net-zone"
                  label="Sample in Net Zone"
                  sublabel="Floor net target"
                  pointsEach={SCORING_VALUES.TELEOP_NET_ZONE}
                  value={currentScores.teleopNetZoneSamples}
                  onChange={(val) => updateCurrentScoreField("teleopNetZoneSamples", val)}
                  accentColor="cyan"
                />
                <NumberStepper
                  id="teleop-low-basket"
                  label="Sample in Low Basket"
                  sublabel="Low basket drop"
                  pointsEach={SCORING_VALUES.TELEOP_LOW_BASKET}
                  value={currentScores.teleopLowBasketSamples}
                  onChange={(val) => updateCurrentScoreField("teleopLowBasketSamples", val)}
                  accentColor="cyan"
                />
                <NumberStepper
                  id="teleop-high-basket"
                  label="Sample in High Basket"
                  sublabel="High basket drop"
                  pointsEach={SCORING_VALUES.TELEOP_HIGH_BASKET}
                  value={currentScores.teleopHighBasketSamples}
                  onChange={(val) => updateCurrentScoreField("teleopHighBasketSamples", val)}
                  accentColor="cyan"
                />
              </div>
            </div>

            {/* TeleOp Specimens */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-ares-cyan mb-3">
                TeleOp Specimen Scoring
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberStepper
                  id="teleop-low-chamber"
                  label="Specimen on Low Chamber"
                  sublabel="Clipped on low bar"
                  pointsEach={SCORING_VALUES.TELEOP_LOW_CHAMBER}
                  value={currentScores.teleopLowChamberSpecimens}
                  onChange={(val) => updateCurrentScoreField("teleopLowChamberSpecimens", val)}
                  accentColor="cyan"
                />
                <NumberStepper
                  id="teleop-high-chamber"
                  label="Specimen on High Chamber"
                  sublabel="Clipped on high bar"
                  pointsEach={SCORING_VALUES.TELEOP_HIGH_CHAMBER}
                  value={currentScores.teleopHighChamberSpecimens}
                  onChange={(val) => updateCurrentScoreField("teleopHighChamberSpecimens", val)}
                  accentColor="cyan"
                />
              </div>
            </div>
          </section>

          {/* Phase 3: Endgame Ascent Scoring */}
          <section
            aria-labelledby="endgame-scoring-heading"
            className="border border-white/10 bg-white/[0.01] p-5 sm:p-6 rounded-sm space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-ares-red/20 text-ares-red">
                  <Trophy size={16} />
                </div>
                <div>
                  <h2 id="endgame-scoring-heading" className="text-base sm:text-lg font-black uppercase tracking-wide text-white">
                    3. Endgame Submersible Ascent (Final 30 Seconds)
                  </h2>
                  <p className="text-xs text-marble/60">
                    Level 1 (floor/bar touch), Level 2 (low rung hang), and Level 3 (high rung hang) ascents.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase text-marble/60 block">Endgame Total</span>
                <span className="text-lg font-mono font-black text-ares-red">
                  {currentScores === redScores ? redBreakdown.endgameTotal : blueBreakdown.endgameTotal} pts
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AscentSelector
                idPrefix="endgame-r1"
                robotName="Alliance Robot 1"
                value={currentScores.endgameRobot1Ascent}
                onChange={(val) => updateCurrentScoreField("endgameRobot1Ascent", val)}
              />
              <AscentSelector
                idPrefix="endgame-r2"
                robotName="Alliance Robot 2"
                value={currentScores.endgameRobot2Ascent}
                onChange={(val) => updateCurrentScoreField("endgameRobot2Ascent", val)}
              />
            </div>
          </section>

          {/* Phase 4: Penalties Awarded */}
          <section
            aria-labelledby="penalties-heading"
            className="border border-white/10 bg-white/[0.01] p-5 sm:p-6 rounded-sm space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-amber-500/20 text-amber-400">
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <h2 id="penalties-heading" className="text-base sm:text-lg font-black uppercase tracking-wide text-white">
                    4. Penalties Awarded to This Alliance
                  </h2>
                  <p className="text-xs text-marble/60">
                    Points awarded from opposing alliance rule infractions (Minor: 5 pts, Major: 15 pts).
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase text-marble/60 block">Penalty Pts</span>
                <span className="text-lg font-mono font-black text-amber-400">
                  {currentScores === redScores ? redBreakdown.penaltiesTotal : blueBreakdown.penaltiesTotal} pts
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberStepper
                id="minor-penalties"
                label="Minor Penalties Awarded"
                sublabel="5 pts awarded per infraction"
                pointsEach={SCORING_VALUES.PENALTY_MINOR}
                value={currentScores.minorPenalties}
                onChange={(val) => updateCurrentScoreField("minorPenalties", val)}
                accentColor="gold"
              />
              <NumberStepper
                id="major-penalties"
                label="Major Penalties Awarded"
                sublabel="15 pts awarded per infraction"
                pointsEach={SCORING_VALUES.PENALTY_MAJOR}
                value={currentScores.majorPenalties}
                onChange={(val) => updateCurrentScoreField("majorPenalties", val)}
                accentColor="red"
              />
            </div>
          </section>
        </div>

        {/* Tactical Performance Analytics Matrix */}
        <section aria-labelledby="analytics-matrix-heading" className="border border-white/10 bg-white/[0.02] p-6 rounded-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="analytics-matrix-heading" className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-ares-cyan" />
              Match Analytics & Cycle Metrics
            </h2>
            <span className="text-xs font-mono text-ares-gold font-bold">
              Total Elements: {currentScores === redScores ? redBreakdown.totalSamples + redBreakdown.totalSpecimens : blueBreakdown.totalSamples + blueBreakdown.totalSpecimens}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="border border-white/10 bg-black/40 p-3.5 rounded-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60 block">Samples Scored</span>
              <span className="text-2xl font-black font-mono text-white mt-1 block">
                {currentScores === redScores ? redBreakdown.totalSamples : blueBreakdown.totalSamples}
              </span>
              <span className="text-[10px] text-ares-gold block mt-0.5">Net + Low + High</span>
            </div>

            <div className="border border-white/10 bg-black/40 p-3.5 rounded-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60 block">Specimens Clipped</span>
              <span className="text-2xl font-black font-mono text-white mt-1 block">
                {currentScores === redScores ? redBreakdown.totalSpecimens : blueBreakdown.totalSpecimens}
              </span>
              <span className="text-[10px] text-ares-cyan block mt-0.5">Low + High Chamber</span>
            </div>

            <div className="border border-white/10 bg-black/40 p-3.5 rounded-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60 block">High-Tier Cycles</span>
              <span className="text-2xl font-black font-mono text-white mt-1 block">
                {currentScores === redScores ? redBreakdown.highValueCycles : blueBreakdown.highValueCycles}
              </span>
              <span className="text-[10px] text-ares-red block mt-0.5">High Basket & Chamber</span>
            </div>

            <div className="border border-white/10 bg-black/40 p-3.5 rounded-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60 block">Ascent Efficiency</span>
              <span className="text-2xl font-black font-mono text-white mt-1 block">
                {currentScores === redScores ? redBreakdown.endgameTotal : blueBreakdown.endgameTotal} / 60
              </span>
              <span className="text-[10px] text-green-400 block mt-0.5">Dual Hang Maximum</span>
            </div>
          </div>
        </section>

        {/* Scoring Rules Quick Reference Table */}
        <section aria-labelledby="scoring-reference-heading" className="border border-white/10 bg-white/[0.01] p-6 rounded-sm space-y-4">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-ares-gold" />
            <h2 id="scoring-reference-heading" className="text-xs font-black uppercase tracking-widest text-white">
              FTC INTO THE DEEP Official Point Values Reference
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">Official Game Scoring Points Reference Table</caption>
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-marble/60">
                  <th scope="col" className="py-2 pr-4">Scoring Action</th>
                  <th scope="col" className="py-2 px-4 text-center">Autonomous</th>
                  <th scope="col" className="py-2 px-4 text-center">Driver-Controlled (TeleOp)</th>
                  <th scope="col" className="py-2 pl-4 text-right">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-marble/80">
                <tr>
                  <td className="py-2 pr-4 font-bold text-white">Sample in Net Zone</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-gold">2 pts</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-cyan">2 pts</td>
                  <td className="py-2 pl-4 text-right text-marble/60">Scored on field floor net zone</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-bold text-white">Sample in Low Basket</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-gold">4 pts</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-cyan">4 pts</td>
                  <td className="py-2 pl-4 text-right text-marble/60">Lower basket chamber</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-bold text-white">Sample in High Basket</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-gold">8 pts</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-cyan">8 pts</td>
                  <td className="py-2 pl-4 text-right text-marble/60">Upper high-value basket</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-bold text-white">Specimen on Low Chamber</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-gold">6 pts</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-cyan">6 pts</td>
                  <td className="py-2 pl-4 text-right text-marble/60">Clipped onto lower horizontal bar</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-bold text-white">Specimen on High Chamber</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-gold">10 pts</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-cyan">10 pts</td>
                  <td className="py-2 pl-4 text-right text-marble/60">Clipped onto upper chamber bar</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-bold text-white">Autonomous Parking / Nav</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-gold">3 pts / robot</td>
                  <td className="py-2 px-4 text-center text-marble/40">—</td>
                  <td className="py-2 pl-4 text-right text-marble/60">Observation or Submersible zone</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-bold text-white">Endgame Level 1 Ascent</td>
                  <td className="py-2 px-4 text-center text-marble/40">—</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-red">3 pts / robot</td>
                  <td className="py-2 pl-4 text-right text-marble/60">Touching observation zone/sub floor</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-bold text-white">Endgame Level 2 Ascent</td>
                  <td className="py-2 px-4 text-center text-marble/40">—</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-red">15 pts / robot</td>
                  <td className="py-2 pl-4 text-right text-marble/60">Suspended on low rung off floor</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-bold text-white">Endgame Level 3 Ascent</td>
                  <td className="py-2 px-4 text-center text-marble/40">—</td>
                  <td className="py-2 px-4 text-center font-mono text-ares-red">30 pts / robot</td>
                  <td className="py-2 pl-4 text-right text-marble/60">Suspended on high rung off floor</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
