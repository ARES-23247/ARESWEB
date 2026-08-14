"use client";

import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  FileText,
  MapPin,
  Package,
  Printer,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import SEO from "@/components/SEO";
import {
  AUTONOMOUS_PERIOD_LIMIT_SEC,
  PRELOAD_ORIENTATIONS,
  ROUTINE_CATALOG,
  STARTING_TILES,
  calculateAutonomousScore,
  calculateRiskProfile,
  generateAdjustedTimeline,
  getDefaultMatchConfiguration,
  getRoutineById,
  getStartingTileById,
  type AllianceColor,
  type MatchConfiguration,
  type StartingTileId,
} from "@/lib/autonomousRoutineData";

export default function AutonomousRoutineSelectorPage() {
  const [config, setConfig] = useState<MatchConfiguration>(getDefaultMatchConfiguration);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const matchInputId = useId();
  const delaySliderId = useId();
  const notesInputId = useId();

  const selectedRoutine = useMemo(() => {
    return getRoutineById(config.routineId);
  }, [config.routineId]);

  const selectedTile = useMemo(() => {
    return getStartingTileById(config.startingTileId);
  }, [config.startingTileId]);

  const selectedPreload = useMemo(() => {
    return (
      PRELOAD_ORIENTATIONS.find((p) => p.id === config.preloadOrientationId) ||
      PRELOAD_ORIENTATIONS[0]
    );
  }, [config.preloadOrientationId]);

  const scoreResult = useMemo(() => {
    return calculateAutonomousScore(
      selectedRoutine,
      config.delaySeconds,
      config.gyroCalibration.isCalibrated
    );
  }, [selectedRoutine, config.delaySeconds, config.gyroCalibration.isCalibrated]);

  const adjustedTimeline = useMemo(() => {
    return generateAdjustedTimeline(selectedRoutine, config.delaySeconds);
  }, [selectedRoutine, config.delaySeconds]);

  const riskProfile = useMemo(() => {
    return calculateRiskProfile(
      selectedRoutine,
      config.delaySeconds,
      config.gyroCalibration.isCalibrated,
      config.startingTileId
    );
  }, [
    selectedRoutine,
    config.delaySeconds,
    config.gyroCalibration.isCalibrated,
    config.startingTileId,
  ]);

  const handleAllianceChange = (newAlliance: AllianceColor) => {
    const matchingTiles = Object.values(STARTING_TILES).filter(
      (t) => t.alliance === newAlliance
    );
    const newTile = matchingTiles.find((t) => t.zone === selectedTile.zone) || matchingTiles[0];

    setConfig((prev) => ({
      ...prev,
      alliance: newAlliance,
      startingTileId: newTile.id,
      gyroCalibration: {
        ...prev.gyroCalibration,
        targetHeadingDeg: newTile.recommendedHeadingDeg,
        calibratedHeadingDeg: newTile.recommendedHeadingDeg,
      },
    }));
  };

  const handleRoutineSelect = (routineId: string) => {
    const routine = getRoutineById(routineId);
    let newTileId = config.startingTileId;
    if (!routine.allowedTiles.includes(newTileId)) {
      const allowedMatching = routine.allowedTiles.find(
        (tid) => STARTING_TILES[tid].alliance === config.alliance
      );
      newTileId = allowedMatching || routine.defaultStartingTileId;
    }

    const tile = getStartingTileById(newTileId);

    setConfig((prev) => ({
      ...prev,
      routineId,
      startingTileId: newTileId,
      preloadOrientationId: routine.defaultPreloadId,
      gyroCalibration: {
        ...prev.gyroCalibration,
        targetHeadingDeg: tile.recommendedHeadingDeg,
        calibratedHeadingDeg: tile.recommendedHeadingDeg,
      },
    }));
  };

  const handleTileSelect = (tileId: StartingTileId) => {
    const tile = getStartingTileById(tileId);
    setConfig((prev) => ({
      ...prev,
      alliance: tile.alliance,
      startingTileId: tileId,
      gyroCalibration: {
        ...prev.gyroCalibration,
        targetHeadingDeg: tile.recommendedHeadingDeg,
        calibratedHeadingDeg: tile.recommendedHeadingDeg,
      },
    }));
  };

  const handleDelayPreset = (seconds: number) => {
    setConfig((prev) => ({
      ...prev,
      delaySeconds: seconds,
    }));
  };

  const handleCalibrateGyro = () => {
    setIsCalibrating(true);
    setTimeout(() => {
      setConfig((prev) => ({
        ...prev,
        gyroCalibration: {
          ...prev.gyroCalibration,
          isCalibrated: true,
          offsetDeg: 0,
          calibratedHeadingDeg: prev.gyroCalibration.targetHeadingDeg,
          lastCheckedAt: new Date().toISOString(),
        },
      }));
      setIsCalibrating(false);
    }, 450);
  };

  const handleToggleGyroCalibration = () => {
    setConfig((prev) => ({
      ...prev,
      gyroCalibration: {
        ...prev.gyroCalibration,
        isCalibrated: !prev.gyroCalibration.isCalibrated,
        lastCheckedAt: new Date().toISOString(),
      },
    }));
  };

  const handlePrintCueCard = () => {
    window.print();
  };

  return (
    <main className="w-full min-h-screen bg-obsidian text-marble py-8 selection:bg-ares-red selection:text-white">
      <SEO
        title="Autonomous Routine Selector & Match Configurator"
        description="Interactive autonomous routine selector, pre-match positioning configurator, timeline breakdown, and printable driver cue card for ARES 23247."
      />

      {/* Screen view content (hidden when printing) */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 print:hidden">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/robots"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marble/70 hover:text-ares-gold transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:outline-none p-1 rounded"
          >
            <ArrowLeft aria-hidden="true" size={16} /> Back to Robot Fleet
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-marble/60 bg-white/5 px-3 py-1.5 ares-cut-sm border border-white/10">
              FTC INTO THE DEEP · Auto 30.0s
            </span>
            <button
              type="button"
              onClick={handlePrintCueCard}
              className="clipped-button bg-ares-red hover:bg-ares-bronze text-white text-xs font-black uppercase tracking-wider px-4 py-2 inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:outline-none shadow-lg"
              data-testid="print-cue-card-top-btn"
            >
              <Printer aria-hidden="true" size={14} /> Print Cue Card
            </button>
          </div>
        </div>

        {/* Page Header Banner */}
        <header className="relative glass-card border border-white/10 p-6 md:p-10 mb-10 overflow-hidden ares-cut">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-ares-red/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-ares-red/20 text-ares-gold border border-ares-bronze/40 px-3 py-1 text-xs font-black uppercase tracking-widest ares-cut-sm mb-4">
              <Sparkles aria-hidden="true" size={14} /> Autonomous Strategy Suite
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white font-heading mb-4">
              Autonomous Routine Selector
            </h1>
            <p className="text-marble/80 text-sm md:text-base max-w-3xl leading-relaxed mb-6 font-medium">
              Configure competition autonomous routines, optimize alliance partner start delays,
              verify IMU gyro heading zeros, and generate competition-ready match driver cue cards.
            </p>

            {/* Quick Match Controls Bar */}
            <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-white/10">
              {/* Match Number Input */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor={matchInputId}
                  className="text-xs font-black uppercase tracking-wider text-marble/70"
                >
                  Match:
                </label>
                <input
                  id={matchInputId}
                  type="text"
                  value={config.matchNumber}
                  onChange={(e) => setConfig({ ...config, matchNumber: e.target.value })}
                  placeholder="e.g. Q-42"
                  className="bg-black/60 border border-white/20 text-white font-mono text-sm px-3 py-1.5 rounded w-28 focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:outline-none"
                  data-testid="match-number-input"
                />
              </div>

              {/* Alliance Switcher */}
              <div className="flex items-center gap-2" role="group" aria-label="Alliance Color Selection">
                <span className="text-xs font-black uppercase tracking-wider text-marble/70">
                  Alliance:
                </span>
                <div className="inline-flex rounded p-0.5 bg-black/40 border border-white/15">
                  <button
                    type="button"
                    onClick={() => handleAllianceChange("red")}
                    className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded transition-all focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                      config.alliance === "red"
                        ? "bg-red-600 text-white shadow-md"
                        : "text-marble/60 hover:text-white"
                    }`}
                    aria-pressed={config.alliance === "red"}
                    data-testid="alliance-red-btn"
                  >
                    Red Alliance
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAllianceChange("blue")}
                    className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded transition-all focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                      config.alliance === "blue"
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-marble/60 hover:text-white"
                    }`}
                    aria-pressed={config.alliance === "blue"}
                    data-testid="alliance-blue-btn"
                  >
                    Blue Alliance
                  </button>
                </div>
              </div>

              {/* Projected Points Quick Badge */}
              <div className="ml-auto flex items-center gap-3 bg-ares-red/15 border border-ares-gold/30 px-4 py-1.5 ares-cut-sm">
                <Award aria-hidden="true" size={16} className="text-ares-gold" />
                <span className="text-xs font-bold text-marble/80">Projected:</span>
                <span
                  className="text-lg font-mono font-black text-ares-gold"
                  data-testid="header-projected-points"
                >
                  {scoreResult.effectivePoints} pts
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Section 1: Routine Catalog Selection */}
        <section className="mb-12" aria-labelledby="catalog-heading">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2
                id="catalog-heading"
                className="text-2xl font-black uppercase tracking-tight text-white font-heading"
              >
                1. Select Autonomous Routine
              </h2>
              <p className="text-xs text-marble/70 mt-1">
                Choose an optimized trajectory engineered for specific match objectives and alliance pairings.
              </p>
            </div>
            <span className="text-xs font-mono text-ares-gold uppercase tracking-widest hidden sm:inline-block">
              {ROUTINE_CATALOG.length} Routines Available
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ROUTINE_CATALOG.map((routine) => {
              const isSelected = routine.id === config.routineId;
              return (
                <button
                  key={routine.id}
                  type="button"
                  onClick={() => handleRoutineSelect(routine.id)}
                  aria-pressed={isSelected}
                  className={`text-left glass-card p-6 flex flex-col justify-between transition-all ares-cut cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:outline-none relative group ${
                    isSelected
                      ? "border-2 border-ares-gold bg-ares-red/10 shadow-2xl ring-1 ring-ares-gold/50"
                      : "border border-white/10 hover:border-white/30 hover:bg-white/5"
                  }`}
                  data-testid={`routine-card-${routine.id}`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 bg-ares-gold text-black p-1 rounded-full shadow">
                      <CheckCircle2 size={16} aria-label="Selected" />
                    </div>
                  )}

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          routine.complexity === "Elite"
                            ? "bg-purple-900/60 text-purple-300 border border-purple-500/40"
                            : routine.complexity === "Advanced"
                            ? "bg-blue-900/60 text-blue-300 border border-blue-500/40"
                            : "bg-emerald-900/60 text-emerald-300 border border-emerald-500/40"
                        }`}
                      >
                        {routine.complexity}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          routine.riskRating === "High"
                            ? "bg-red-900/60 text-red-300"
                            : routine.riskRating === "Moderate"
                            ? "bg-yellow-900/60 text-yellow-300"
                            : "bg-green-900/60 text-green-300"
                        }`}
                      >
                        {routine.riskRating} Risk
                      </span>
                    </div>

                    <h3 className="text-lg font-black uppercase tracking-tight text-white group-hover:text-ares-gold transition-colors mb-2">
                      {routine.name}
                    </h3>
                    <p className="text-xs text-marble/75 line-clamp-3 leading-relaxed mb-4">
                      {routine.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/10 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-marble/60">Base Points:</span>
                      <span className="font-mono font-bold text-ares-gold">{routine.basePoints} pts</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-marble/60">Execution Time:</span>
                      <span className="font-mono text-white">{routine.nominalDurationSec.toFixed(1)}s</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-marble/60">Target:</span>
                      <span className="text-white font-medium truncate max-w-[120px]">
                        {routine.targetPieces.specimens > 0
                          ? `${routine.targetPieces.specimens}x Specimen`
                          : `${routine.targetPieces.samples}x Sample`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-marble/60">End Park:</span>
                      <span className="text-white font-medium">{routine.parkType}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 2: Pre-Match Setup Configurator */}
        <section className="mb-12" aria-labelledby="config-heading">
          <div className="mb-6">
            <h2
              id="config-heading"
              className="text-2xl font-black uppercase tracking-tight text-white font-heading"
            >
              2. Pre-Match Setup Configurator
            </h2>
            <p className="text-xs text-marble/70 mt-1">
              Field tile placement, pre-loaded mechanism state, start delay deconfliction, and IMU calibration.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Tile & Preload Selector */}
            <div className="glass-card p-6 border border-white/10 ares-cut space-y-6">
              {/* Tile Selector */}
              <div>
                <span className="block text-xs font-black uppercase tracking-wider text-ares-gold mb-3 flex items-center gap-2">
                  <MapPin aria-hidden="true" size={14} /> Starting Alliance Tile
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Starting Tile">
                  {Object.values(STARTING_TILES)
                    .filter((tile) => tile.alliance === config.alliance)
                    .map((tile) => {
                      const isTileSelected = tile.id === config.startingTileId;
                      return (
                        <button
                          key={tile.id}
                          type="button"
                          role="radio"
                          aria-checked={isTileSelected}
                          onClick={() => handleTileSelect(tile.id)}
                          className={`p-4 text-left border rounded transition-all focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                            isTileSelected
                              ? "border-ares-red bg-ares-red/15 text-white ring-1 ring-ares-red"
                              : "border-white/10 bg-black/40 text-marble/80 hover:bg-white/5"
                          }`}
                          data-testid={`tile-option-${tile.id}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm text-white">{tile.shortName}</span>
                            <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-ares-gold">
                              {tile.fieldTileCoordinate}
                            </span>
                          </div>
                          <p className="text-[11px] text-marble/70 leading-normal">
                            {tile.description}
                          </p>
                          <div className="mt-2 text-[10px] text-marble/50 font-mono">
                            Target Heading: {tile.recommendedHeadingDeg}°
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Pre-load Orientation */}
              <div>
                <span className="block text-xs font-black uppercase tracking-wider text-ares-gold mb-3 flex items-center gap-2">
                  <Package aria-hidden="true" size={14} /> Pre-Loaded Game Piece Orientation
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRELOAD_ORIENTATIONS.map((preload) => {
                    const isPreloadSelected = preload.id === config.preloadOrientationId;
                    return (
                      <button
                        key={preload.id}
                        type="button"
                        onClick={() =>
                          setConfig({ ...config, preloadOrientationId: preload.id })
                        }
                        className={`p-3.5 text-left border rounded transition-all focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                          isPreloadSelected
                            ? "border-ares-gold bg-ares-gold/10 text-white ring-1 ring-ares-gold"
                            : "border-white/10 bg-black/40 text-marble/80 hover:bg-white/5"
                        }`}
                        data-testid={`preload-option-${preload.id}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-white">
                            {preload.shortLabel}
                          </span>
                          <span className="text-[10px] font-mono text-ares-gold">
                            {preload.gamePiece}
                          </span>
                        </div>
                        <p className="text-[11px] text-marble/70 line-clamp-2">
                          {preload.description}
                        </p>
                        <div className="mt-2 text-[10px] font-mono text-ares-gold/80 truncate">
                          State: {preload.intakeState}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Start Delay & Gyro Heading Checker */}
            <div className="glass-card p-6 border border-white/10 ares-cut space-y-6">
              {/* Delay Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor={delaySliderId}
                    className="text-xs font-black uppercase tracking-wider text-ares-gold flex items-center gap-2"
                  >
                    <Clock aria-hidden="true" size={14} /> Autonomous Start Delay Timer
                  </label>
                  <span
                    className="font-mono text-sm font-black text-ares-gold bg-black/60 px-3 py-1 rounded border border-white/10"
                    data-testid="delay-timer-value"
                  >
                    {config.delaySeconds.toFixed(1)}s
                  </span>
                </div>
                <p className="text-[11px] text-marble/70 mb-3">
                  Allows alliance partner robot to execute first cross-field trajectory without risk of collision.
                </p>

                <input
                  id={delaySliderId}
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={config.delaySeconds}
                  onChange={(e) =>
                    setConfig({ ...config, delaySeconds: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full accent-ares-red cursor-pointer mb-3"
                  aria-valuemin={0}
                  aria-valuemax={10}
                  aria-valuenow={config.delaySeconds}
                  data-testid="delay-slider"
                />

                {/* Preset Delay Buttons */}
                <div className="flex flex-wrap gap-2">
                  {[0, 1.5, 3.0, 5.0].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleDelayPreset(preset)}
                      className={`text-xs px-3 py-1.5 font-bold uppercase rounded border transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                        config.delaySeconds === preset
                          ? "bg-ares-red text-white border-ares-red"
                          : "border-white/15 bg-black/40 text-marble/80 hover:bg-white/10"
                      }`}
                      data-testid={`delay-preset-${preset}s`}
                    >
                      {preset === 0 ? "0.0s (Instant)" : `${preset.toFixed(1)}s`}
                    </button>
                  ))}
                </div>

                {scoreResult.isOvertime && (
                  <div
                    role="alert"
                    className="mt-3 p-3 bg-red-950/60 border border-red-500/50 rounded text-red-200 text-xs flex items-center gap-2"
                  >
                    <AlertTriangle size={16} className="text-red-400 shrink-0" />
                    <span>
                      <strong>Warning:</strong> Start delay causes total duration (
                      {scoreResult.totalDurationSec}s) to exceed 30.0s period! Final park points lost.
                    </span>
                  </div>
                )}
              </div>

              {/* Gyro Heading Calibration Check */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-ares-gold flex items-center gap-2">
                    <Compass aria-hidden="true" size={14} /> Gyro Heading Calibration Check
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleGyroCalibration}
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded uppercase transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                      config.gyroCalibration.isCalibrated
                        ? "bg-emerald-900/60 text-emerald-300 border border-emerald-500/50"
                        : "bg-red-900/60 text-red-300 border border-red-500/50"
                    }`}
                    data-testid="gyro-calibration-toggle"
                  >
                    {config.gyroCalibration.isCalibrated ? "Calibrated (0° Lock)" : "Uncalibrated"}
                  </button>
                </div>

                <div className="bg-black/50 p-4 border border-white/10 rounded space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-marble/70">Target Heading:</span>
                    <span className="font-mono font-bold text-white">
                      {config.gyroCalibration.targetHeadingDeg}° (Wall Reference)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-marble/70">Current Gyro Reading:</span>
                    <span className="font-mono font-bold text-ares-gold">
                      {config.gyroCalibration.calibratedHeadingDeg}° (Offset:{" "}
                      {config.gyroCalibration.offsetDeg.toFixed(1)}°)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-marble/70">Laser Zero Method:</span>
                    <span className="text-marble/90 font-medium">
                      {config.gyroCalibration.calibrationMethod}
                    </span>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      disabled={isCalibrating}
                      onClick={handleCalibrateGyro}
                      className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase py-2 px-3 rounded inline-flex items-center justify-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                      data-testid="run-gyro-zero-btn"
                    >
                      <RefreshCw
                        aria-hidden="true"
                        size={14}
                        className={isCalibrating ? "animate-spin" : ""}
                      />
                      {isCalibrating ? "Zeroing IMU..." : "Zero Gyro Heading"}
                    </button>
                  </div>
                </div>

                {!config.gyroCalibration.isCalibrated && (
                  <p className="text-[11px] text-red-400 mt-2 flex items-center gap-1.5">
                    <AlertTriangle size={12} className="shrink-0" />
                    Uncalibrated gyro applies 15% penalty to projected score due to path drift risk.
                  </p>
                )}
              </div>

              {/* Driver Strategy Notes Input */}
              <div className="pt-4 border-t border-white/10">
                <label
                  htmlFor={notesInputId}
                  className="block text-xs font-black uppercase tracking-wider text-marble/70 mb-2"
                >
                  Drive Team Notes & Alliance Strategy
                </label>
                <textarea
                  id={notesInputId}
                  rows={2}
                  value={config.driverNotes}
                  onChange={(e) => setConfig({ ...config, driverNotes: e.target.value })}
                  placeholder="Record partner team #, autonomous pathing deconfliction agreements, or field notes..."
                  className="w-full bg-black/60 border border-white/20 text-white text-xs p-2.5 rounded focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:outline-none"
                  data-testid="driver-notes-input"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Calculated Point Projections & Metrics Dashboard */}
        <section className="mb-12" aria-labelledby="projections-heading">
          <div className="mb-6">
            <h2
              id="projections-heading"
              className="text-2xl font-black uppercase tracking-tight text-white font-heading"
            >
              3. Calculated Point Projections & Match Metrics
            </h2>
            <p className="text-xs text-marble/70 mt-1">
              Real-time scoring breakdown calibrated to 30-second autonomous window and delay settings.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Projected Points */}
            <div className="glass-card p-4 border border-ares-gold/40 ares-cut bg-ares-red/10 flex flex-col justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-marble/70">
                Projected Points
              </span>
              <div className="my-2">
                <span
                  className="text-3xl font-black font-mono text-ares-gold"
                  data-testid="metric-projected-points"
                >
                  {scoreResult.effectivePoints}
                </span>
                <span className="text-xs text-marble/50 ml-1">/ {scoreResult.basePoints}</span>
              </div>
              <span className="text-[10px] text-marble/60">
                {scoreResult.accuracyMultiplier < 1.0 ? "85% uncalibrated" : "100% trajectory accuracy"}
              </span>
            </div>

            {/* Specimens Scored */}
            <div className="glass-card p-4 border border-white/10 ares-cut flex flex-col justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-marble/70">
                High Specimens
              </span>
              <div className="my-2">
                <span
                  className="text-3xl font-black font-mono text-white"
                  data-testid="metric-specimens-scored"
                >
                  {scoreResult.specimensScored}x
                </span>
              </div>
              <span className="text-[10px] text-ares-gold font-mono">
                {scoreResult.breakdown.specimenPoints} pts (10/ea)
              </span>
            </div>

            {/* Samples Scored */}
            <div className="glass-card p-4 border border-white/10 ares-cut flex flex-col justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-marble/70">
                High Basket Samples
              </span>
              <div className="my-2">
                <span
                  className="text-3xl font-black font-mono text-white"
                  data-testid="metric-samples-scored"
                >
                  {scoreResult.samplesScored}x
                </span>
              </div>
              <span className="text-[10px] text-ares-gold font-mono">
                {scoreResult.breakdown.samplePoints} pts (8/ea)
              </span>
            </div>

            {/* Parking Points */}
            <div className="glass-card p-4 border border-white/10 ares-cut flex flex-col justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-marble/70">
                Auto Park / Ascent
              </span>
              <div className="my-2">
                <span
                  className="text-3xl font-black font-mono text-white"
                  data-testid="metric-park-points"
                >
                  {scoreResult.parkPoints} pts
                </span>
              </div>
              <span className="text-[10px] text-marble/60">{selectedRoutine.parkType}</span>
            </div>

            {/* Duration */}
            <div className="glass-card p-4 border border-white/10 ares-cut flex flex-col justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-marble/70">
                Total Duration
              </span>
              <div className="my-2">
                <span
                  className={`text-3xl font-black font-mono ${
                    scoreResult.isOvertime ? "text-red-400" : "text-white"
                  }`}
                  data-testid="metric-total-duration"
                >
                  {scoreResult.totalDurationSec.toFixed(1)}s
                </span>
              </div>
              <span className="text-[10px] text-marble/60">Limit: 30.0s</span>
            </div>

            {/* Buffer Margin */}
            <div className="glass-card p-4 border border-white/10 ares-cut flex flex-col justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-marble/70">
                Timing Buffer
              </span>
              <div className="my-2">
                <span
                  className={`text-3xl font-black font-mono ${
                    scoreResult.timeRemainingSec < 2.0 ? "text-yellow-400" : "text-emerald-400"
                  }`}
                  data-testid="metric-buffer-margin"
                >
                  +{scoreResult.timeRemainingSec.toFixed(1)}s
                </span>
              </div>
              <span className="text-[10px] text-marble/60">Safety Margin</span>
            </div>
          </div>
        </section>

        {/* Section 4: Step-by-Step 30-Second Timeline Breakdown */}
        <section className="mb-12" aria-labelledby="timeline-heading">
          <div className="mb-6">
            <h2
              id="timeline-heading"
              className="text-2xl font-black uppercase tracking-tight text-white font-heading"
            >
              4. 30-Second Sequence Timeline Breakdown
            </h2>
            <p className="text-xs text-marble/70 mt-1">
              Continuous time-indexed breakdown of pathing vectors, elevator extensions, and scoring timestamps.
            </p>
          </div>

          {/* Graphical Timeline Bar */}
          <div className="glass-card p-6 border border-white/10 ares-cut mb-6">
            <div className="flex justify-between items-center text-xs font-mono text-marble/60 mb-2">
              <span>T+0.0s (Match Start)</span>
              <span>T+15.0s</span>
              <span>T+30.0s (Autonomous Buzzer)</span>
            </div>
            <div
              className="w-full h-4 bg-black/60 rounded overflow-hidden flex border border-white/20"
              role="progressbar"
              aria-label="Autonomous timeline representation"
              aria-valuemin={0}
              aria-valuemax={30}
              aria-valuenow={Math.min(30, scoreResult.totalDurationSec)}
            >
              {adjustedTimeline.map((step) => {
                const widthPct = (step.durationSec / AUTONOMOUS_PERIOD_LIMIT_SEC) * 100;
                let bgClass = "bg-ares-gold/70";
                if (step.isDelayStep) bgClass = "bg-white/20";
                else if (step.actionType === "clip") bgClass = "bg-ares-red";
                else if (step.actionType === "score_basket") bgClass = "bg-amber-500";
                else if (step.actionType === "park") bgClass = "bg-emerald-600";
                else if (step.actionType === "push") bgClass = "bg-blue-600";

                return (
                  <div
                    key={step.id}
                    style={{ width: `${widthPct}%` }}
                    className={`${bgClass} h-full border-r border-black/40 transition-all`}
                    title={`${step.title} (${step.adjustedStartSec}s - ${step.adjustedEndSec}s)`}
                  />
                );
              })}
            </div>
          </div>

          {/* Timeline Step Cards List */}
          <div className="space-y-3" role="list" aria-label="Timeline sequence steps">
            {adjustedTimeline.map((step, idx) => {
              return (
                <div
                  key={step.id}
                  role="listitem"
                  className={`glass-card p-4 border rounded flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    step.isTruncatedByTimeLimit
                      ? "border-red-500/50 bg-red-950/20 opacity-60"
                      : step.isDelayStep
                      ? "border-dashed border-white/20 bg-white/5"
                      : "border-white/10 hover:border-white/25 bg-black/40"
                  }`}
                  data-testid={`timeline-step-${idx}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center justify-center bg-black/60 border border-white/15 px-3 py-1.5 rounded min-w-[70px]">
                      <span className="text-[10px] font-mono text-marble/50">TIME</span>
                      <span className="text-xs font-mono font-bold text-ares-gold">
                        {step.adjustedStartSec.toFixed(1)}s
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-white">{step.title}</span>
                        <span className="text-[10px] font-mono uppercase bg-white/10 text-marble/80 px-2 py-0.5 rounded">
                          {step.fieldZone}
                        </span>
                        {step.isTruncatedByTimeLimit && (
                          <span className="text-[10px] font-black uppercase bg-red-900 text-red-200 px-2 py-0.5 rounded">
                            Exceeds 30.0s Limit
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-marble/70 leading-relaxed max-w-2xl">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 md:text-right">
                    <div className="text-xs">
                      <span className="text-marble/50 block text-[10px] uppercase font-mono">
                        Duration
                      </span>
                      <span className="font-mono text-white font-bold">
                        {step.durationSec.toFixed(1)}s
                      </span>
                    </div>
                    <div className="text-xs min-w-[60px]">
                      <span className="text-marble/50 block text-[10px] uppercase font-mono">
                        Points
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          step.pointsDelta.total > 0 ? "text-ares-gold" : "text-marble/40"
                        }`}
                      >
                        +{step.pointsDelta.total} pts
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 5: Risk Analysis Profile & Mitigation */}
        <section className="mb-12" aria-labelledby="risk-heading">
          <div className="mb-6">
            <h2
              id="risk-heading"
              className="text-2xl font-black uppercase tracking-tight text-white font-heading"
            >
              5. Risk Analysis Profile & Collision Probability
            </h2>
            <p className="text-xs text-marble/70 mt-1">
              Algorithmic field risk evaluation accounting for partner geometry, timing margins, and odometry reliability.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Risk Overview Card */}
            <div className="glass-card p-6 border border-white/10 ares-cut flex flex-col justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-marble/70 block mb-2">
                  Calculated Risk Level
                </span>
                <div className="flex items-center gap-3 mb-4">
                  <ShieldAlert
                    size={28}
                    className={
                      riskProfile.overallRisk === "CRITICAL"
                        ? "text-red-500"
                        : riskProfile.overallRisk === "HIGH"
                        ? "text-orange-500"
                        : riskProfile.overallRisk === "MODERATE"
                        ? "text-yellow-400"
                        : "text-emerald-400"
                    }
                  />
                  <div>
                    <span
                      className="text-2xl font-black font-heading uppercase text-white"
                      data-testid="overall-risk-level"
                    >
                      {riskProfile.overallRisk} RISK
                    </span>
                    <span className="block text-xs text-marble/60">
                      Success Rate: {riskProfile.successProbabilityPct}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-marble/70">Partner Collision Risk:</span>
                  <span className="font-mono font-bold text-white">
                    {riskProfile.collisionRiskPct}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-marble/70">Gyro Heading Drift Risk:</span>
                  <span
                    className={`font-mono font-bold ${
                      riskProfile.gyroDriftRiskPct > 20 ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {riskProfile.gyroDriftRiskPct}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-marble/70">Autonomous Timing Margin:</span>
                  <span className="font-mono font-bold text-ares-gold">
                    {riskProfile.timingMarginSec.toFixed(1)}s
                  </span>
                </div>
              </div>
            </div>

            {/* Risk Factors List */}
            <div className="glass-card p-6 border border-white/10 ares-cut lg:col-span-2 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-ares-gold">
                Identified Risk Factors & Strategic Mitigations
              </h3>

              <div className="space-y-3">
                {riskProfile.riskFactors.length === 0 ? (
                  <p className="text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 size={16} /> All risk parameters within nominal competition tolerances.
                  </p>
                ) : (
                  riskProfile.riskFactors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-black/40 border border-white/10 rounded flex items-start gap-3"
                    >
                      <AlertTriangle
                        size={16}
                        className={
                          factor.level === "high"
                            ? "text-red-400 shrink-0 mt-0.5"
                            : "text-yellow-400 shrink-0 mt-0.5"
                        }
                      />
                      <div>
                        <span className="text-xs font-bold text-white block mb-0.5">
                          {factor.title}
                        </span>
                        <p className="text-[11px] text-marble/70 leading-normal">
                          {factor.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Mitigation Checklist */}
              <div className="pt-3 border-t border-white/10">
                <span className="text-[11px] font-bold uppercase tracking-wider text-marble/60 block mb-2">
                  Drive Team Execution Protocol:
                </span>
                <ul className="space-y-1.5 text-xs text-marble/80">
                  {riskProfile.mitigationStrategies.map((strat, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <ChevronRight size={14} className="text-ares-gold shrink-0" />
                      <span>{strat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Printable Match Driver Cue Card Preview */}
        <section className="mb-12" aria-labelledby="cue-card-heading">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2
                id="cue-card-heading"
                className="text-2xl font-black uppercase tracking-tight text-white font-heading flex items-center gap-2"
              >
                <FileText aria-hidden="true" size={24} className="text-ares-gold" />
                6. Match Driver Cue Card
              </h2>
              <p className="text-xs text-marble/70 mt-1">
                Pocket-sized high-contrast reference card for drive team setup on the competition field.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePrintCueCard}
              className="clipped-button bg-ares-red hover:bg-ares-bronze text-white text-xs font-black uppercase tracking-wider px-5 py-2.5 inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-ares-cyan"
              data-testid="print-cue-card-btn"
            >
              <Printer aria-hidden="true" size={16} /> Print Match Cue Card
            </button>
          </div>

          {/* Screen Preview Container */}
          <div className="p-6 md:p-8 bg-neutral-900 border-2 border-ares-gold/50 rounded shadow-2xl text-white font-sans max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center border-b-2 border-ares-gold pb-4 mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-ares-gold">
                  ARES 23247 · FTC INTO THE DEEP
                </span>
                <h3 className="text-2xl font-black uppercase tracking-tight text-white">
                  Driver Autonomous Cue Card
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono uppercase bg-white/10 px-3 py-1 rounded font-bold">
                  MATCH: {config.matchNumber || "PRACTICE"}
                </span>
                <span
                  className={`block text-xs font-black uppercase mt-1 ${
                    config.alliance === "red" ? "text-red-400" : "text-blue-400"
                  }`}
                >
                  {config.alliance.toUpperCase()} ALLIANCE
                </span>
              </div>
            </div>

            {/* Quick Field Checklist */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-black/40 border border-white/10 rounded mb-4 text-xs">
              <div>
                <span className="text-marble/50 block text-[10px] uppercase font-mono">Routine</span>
                <span className="font-bold text-white truncate block">{selectedRoutine.shortName}</span>
              </div>
              <div>
                <span className="text-marble/50 block text-[10px] uppercase font-mono">Tile Pos</span>
                <span className="font-bold text-white">{selectedTile.fieldTileCoordinate}</span>
              </div>
              <div>
                <span className="text-marble/50 block text-[10px] uppercase font-mono">Heading Zero</span>
                <span className="font-bold text-ares-gold font-mono">{config.gyroCalibration.targetHeadingDeg}°</span>
              </div>
              <div>
                <span className="text-marble/50 block text-[10px] uppercase font-mono">Start Delay</span>
                <span className="font-bold text-white font-mono">{config.delaySeconds.toFixed(1)}s</span>
              </div>
            </div>

            {/* Preload details */}
            <div className="p-3 bg-white/5 border border-white/10 rounded mb-4 text-xs">
              <span className="text-ares-gold font-bold uppercase text-[10px] block mb-1">
                Pre-Loaded Piece & Mechanism State:
              </span>
              <p className="text-white font-medium">
                {selectedPreload.name} — <span className="text-marble/70">{selectedPreload.intakeState}</span>
              </p>
            </div>

            {/* Execution Sequence Summary */}
            <div className="mb-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-marble/60 block mb-2">
                Sequence Timeline ({scoreResult.totalDurationSec.toFixed(1)}s / 30.0s):
              </span>
              <div className="space-y-1 text-xs">
                {adjustedTimeline.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between p-1.5 bg-black/30 rounded border border-white/5"
                  >
                    <span className="font-mono text-ares-gold text-[11px] w-20 shrink-0">
                      T+{step.adjustedStartSec.toFixed(1)}s - {step.adjustedEndSec.toFixed(1)}s
                    </span>
                    <span className="font-medium text-white truncate flex-1 px-2">{step.title}</span>
                    <span className="font-mono text-marble/60 text-[11px] shrink-0">
                      +{step.pointsDelta.total} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Driver Notes */}
            {config.driverNotes && (
              <div className="p-3 bg-ares-red/15 border border-ares-bronze/40 rounded text-xs">
                <span className="text-ares-gold font-bold uppercase text-[10px] block mb-0.5">
                  Alliance Coordination Notes:
                </span>
                <p className="text-white">{config.driverNotes}</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* PRINT-ONLY DRIVER CUE CARD SHEET (Rendered exclusively when printing)    */}
      {/* ========================================================================= */}
      <div className="hidden print:block w-full max-w-4xl mx-auto p-8 bg-white text-black font-sans">
        <div className="border-4 border-black p-6 space-y-4">
          <div className="flex justify-between items-start border-b-2 border-black pb-3">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-neutral-700">
                ARES 23247 ROBOTICS · INTO THE DEEP
              </span>
              <h1 className="text-3xl font-black uppercase tracking-tight text-black">
                MATCH DRIVER CUE CARD
              </h1>
            </div>
            <div className="text-right">
              <span className="text-xl font-black font-mono border-2 border-black px-3 py-1 block">
                MATCH: {config.matchNumber || "Q-01"}
              </span>
              <span className="text-sm font-black uppercase mt-1 block">
                {config.alliance.toUpperCase()} ALLIANCE
              </span>
            </div>
          </div>

          {/* Key Parameters Matrix */}
          <div className="grid grid-cols-4 gap-2 border-2 border-black p-3 bg-neutral-100 text-xs font-bold">
            <div>
              <span className="text-[10px] block text-neutral-600 uppercase">Selected Routine</span>
              <span className="text-sm font-black">{selectedRoutine.shortName}</span>
            </div>
            <div>
              <span className="text-[10px] block text-neutral-600 uppercase">Starting Tile</span>
              <span className="text-sm font-black">{selectedTile.fieldTileCoordinate}</span>
            </div>
            <div>
              <span className="text-[10px] block text-neutral-600 uppercase">IMU Heading Zero</span>
              <span className="text-sm font-black">{config.gyroCalibration.targetHeadingDeg}°</span>
            </div>
            <div>
              <span className="text-[10px] block text-neutral-600 uppercase">Autonomous Delay</span>
              <span className="text-sm font-black">{config.delaySeconds.toFixed(1)}s</span>
            </div>
          </div>

          {/* Preload Configuration */}
          <div className="border border-black p-2 text-xs">
            <span className="font-black uppercase text-[10px] block text-neutral-700">
              Pre-Loaded Game Piece & Intake State:
            </span>
            <p className="font-bold text-black text-sm">
              {selectedPreload.name} — <span className="font-normal">{selectedPreload.intakeState}</span>
            </p>
          </div>

          {/* Step Sequence Checklist */}
          <div>
            <span className="font-black uppercase text-xs block mb-1">
              Autonomous Timeline Checklist ({scoreResult.totalDurationSec.toFixed(1)}s / 30.0s — Projected: {scoreResult.effectivePoints} pts):
            </span>
            <table className="w-full text-xs border-collapse border border-black">
              <thead>
                <tr className="bg-neutral-200 border-b border-black text-left">
                  <th className="p-1.5 border-r border-black w-24">Timestamp</th>
                  <th className="p-1.5 border-r border-black">Action / Target</th>
                  <th className="p-1.5 border-r border-black w-24">Field Zone</th>
                  <th className="p-1.5 text-right w-16">Points</th>
                </tr>
              </thead>
              <tbody>
                {adjustedTimeline.map((step) => (
                  <tr key={step.id} className="border-b border-neutral-300">
                    <td className="p-1.5 border-r border-black font-mono font-bold">
                      T+{step.adjustedStartSec.toFixed(1)}s - {step.adjustedEndSec.toFixed(1)}s
                    </td>
                    <td className="p-1.5 border-r border-black font-medium">{step.title}</td>
                    <td className="p-1.5 border-r border-black uppercase text-[10px]">
                      {step.fieldZone}
                    </td>
                    <td className="p-1.5 text-right font-mono font-bold">
                      +{step.pointsDelta.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Driver Notes & Tactical Protocol */}
          <div className="border-2 border-black p-3 text-xs space-y-1 bg-neutral-50">
            <span className="font-black uppercase text-[10px] block text-neutral-800">
              Strategy & Drive Team Field Protocol:
            </span>
            <p className="text-black font-medium">{config.driverNotes || "No specific partner deconfliction notes recorded."}</p>
            <p className="text-neutral-700 text-[11px] pt-1 border-t border-neutral-300">
              • Verify IMU heading laser zero before field referee buzzer.
              • If alliance partner moves off-path, drive team prepares TeleOp override switch.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
