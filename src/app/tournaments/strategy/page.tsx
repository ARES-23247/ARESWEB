"use client";

import { useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import {
  Compass,
  Layers,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Printer,
  Sparkles,
  Shield,
  Zap,
  Target,
  Clock,
  Info,
  Crosshair,
} from "lucide-react";
import {
  FIELD_SIZE_INCHES,
  TILE_SIZE_INCHES,
  TILE_COUNT,
  DEFENSE_PROFILES,
  PRESET_ROUTINES,
  ACTION_DEFINITIONS,
  calculateRoutineScore,
  calculateSynergyScore,
  type StrategyRoutine,
  type StrategyStep,
  type StrategyActionType,
  type MatchPhase,
  type AllianceColor,
  type DefenseProfileId,
  type AlliancePartnerConfig,
  type FieldCoordinate,
} from "@/lib/fieldStrategyData";

export default function FieldStrategyPlannerPage() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"canvas" | "builder" | "synergy" | "printSheet">("canvas");

  // Selected routine state
  const [currentRoutine, setCurrentRoutine] = useState<StrategyRoutine>(() => {
    return JSON.parse(JSON.stringify(PRESET_ROUTINES[0]));
  });

  // Selected step index in canvas / builder
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(0);

  // Field canvas settings
  const [showGridCoordinates, setShowGridCoordinates] = useState(true);
  const [showPathOverlay, setShowPathOverlay] = useState(true);
  const [fieldCursorCoord, setFieldCursorCoord] = useState<FieldCoordinate | null>(null);

  // Partner Synergy configuration
  const [partnerConfig, setPartnerConfig] = useState<AlliancePartnerConfig>({
    teamNumber: "19376",
    teamName: "Valhalla Robotics",
    autoSpecimensHigh: 2,
    autoSamplesHigh: 0,
    autoPark: "observation",
    teleopSpecimensHigh: 3,
    teleopSamplesHigh: 0,
    endgameAscent: "level_2",
    reliabilityFactor: 0.85,
    preferredRole: "specimen_cycler",
  });

  // Opponent Defense Profile
  const [selectedDefenseProfile, setSelectedDefenseProfile] = useState<DefenseProfileId>("none");

  // Match Sheet Metadata
  const [matchNumber] = useState("Qualification 14");
  const [oppTeam1] = useState("16091 - TWCA");
  const [oppTeam2] = useState("20403 - Eagle Robotics");
  const [matchStrategyNotes] = useState(
    "ARES leads 5-Specimen Auto from Red Observation wall. Partner pushes initial spike samples and hangs 2 specimens on low chamber. Teleop: ARES runs high chamber clips; partner rotates submersible entry lane."
  );

  const fieldSvgRef = useRef<SVGSVGElement | null>(null);

  // Calculated Scores for active routine
  const routineScores = useMemo(() => {
    return calculateRoutineScore(currentRoutine);
  }, [currentRoutine]);

  // Calculated Synergy projection
  const synergyResult = useMemo(() => {
    const defense = DEFENSE_PROFILES[selectedDefenseProfile];
    return calculateSynergyScore(currentRoutine, partnerConfig, defense);
  }, [currentRoutine, partnerConfig, selectedDefenseProfile]);

  // Handle Canvas Click to add or update waypoint
  const handleFieldSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!fieldSvgRef.current) return;
    const rect = fieldSvgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert pixels to 144" coordinate
    const inchX = Math.max(0, Math.min(144, Math.round((clickX / rect.width) * FIELD_SIZE_INCHES)));
    const inchY = Math.max(0, Math.min(144, Math.round((clickY / rect.height) * FIELD_SIZE_INCHES)));

    if (selectedStepIndex !== null && currentRoutine.steps[selectedStepIndex]) {
      // Update existing selected step coordinate
      const updatedSteps = [...currentRoutine.steps];
      updatedSteps[selectedStepIndex] = {
        ...updatedSteps[selectedStepIndex],
        targetCoordinate: { x: inchX, y: inchY },
      };
      setCurrentRoutine({
        ...currentRoutine,
        steps: updatedSteps,
      });
    } else {
      // Add a new custom waypoint step
      const newStep: StrategyStep = {
        id: `step-${Date.now()}`,
        phase: "auto",
        action: "custom_waypoint",
        label: `Waypoint (${inchX}", ${inchY}")`,
        targetCoordinate: { x: inchX, y: inchY },
        durationSeconds: 2.5,
        points: 0,
        riskFactor: "low",
      };
      setCurrentRoutine({
        ...currentRoutine,
        steps: [...currentRoutine.steps, newStep],
      });
      setSelectedStepIndex(currentRoutine.steps.length);
    }
  };

  const handleFieldMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!fieldSvgRef.current) return;
    const rect = fieldSvgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const inchX = Math.max(0, Math.min(144, Math.round((clickX / rect.width) * FIELD_SIZE_INCHES)));
    const inchY = Math.max(0, Math.min(144, Math.round((clickY / rect.height) * FIELD_SIZE_INCHES)));
    setFieldCursorCoord({ x: inchX, y: inchY });
  };

  // Step manipulation handlers
  const handleAddStep = (phase: MatchPhase = "auto") => {
    const defaultAction: StrategyActionType =
      phase === "auto" ? "auto_specimen_high" : phase === "teleop" ? "teleop_specimen_high" : "endgame_ascent_level_3";
    const def = ACTION_DEFINITIONS[defaultAction];

    const newStep: StrategyStep = {
      id: `step-${Date.now()}`,
      phase,
      action: defaultAction,
      label: def.label,
      targetCoordinate: { ...def.defaultCoordinate },
      durationSeconds: def.defaultDuration,
      points: def.points,
      riskFactor: "low",
    };

    setCurrentRoutine({
      ...currentRoutine,
      steps: [...currentRoutine.steps, newStep],
    });
    setSelectedStepIndex(currentRoutine.steps.length);
  };

  const handleRemoveStep = (index: number) => {
    const updated = currentRoutine.steps.filter((_, i) => i !== index);
    setCurrentRoutine({
      ...currentRoutine,
      steps: updated,
    });
    if (selectedStepIndex === index) {
      setSelectedStepIndex(updated.length > 0 ? Math.max(0, index - 1) : null);
    } else if (selectedStepIndex !== null && selectedStepIndex > index) {
      setSelectedStepIndex(selectedStepIndex - 1);
    }
  };

  const handleMoveStep = (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === currentRoutine.steps.length - 1)) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...currentRoutine.steps];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setCurrentRoutine({
      ...currentRoutine,
      steps: updated,
    });
    setSelectedStepIndex(targetIndex);
  };

  const handleStepActionChange = (index: number, action: StrategyActionType) => {
    const def = ACTION_DEFINITIONS[action];
    const updated = [...currentRoutine.steps];
    updated[index] = {
      ...updated[index],
      action,
      phase: def.phase,
      label: def.label,
      points: def.points,
      durationSeconds: def.defaultDuration,
      targetCoordinate: { ...def.defaultCoordinate },
    };
    setCurrentRoutine({
      ...currentRoutine,
      steps: updated,
    });
  };

  const handleStepDurationChange = (index: number, duration: number) => {
    const updated = [...currentRoutine.steps];
    updated[index] = {
      ...updated[index],
      durationSeconds: Math.max(0.5, Math.round(duration * 10) / 10),
    };
    setCurrentRoutine({
      ...currentRoutine,
      steps: updated,
    });
  };

  const handleStepLabelChange = (index: number, label: string) => {
    const updated = [...currentRoutine.steps];
    updated[index] = {
      ...updated[index],
      label,
    };
    setCurrentRoutine({
      ...currentRoutine,
      steps: updated,
    });
  };

  const handleStepRiskChange = (index: number, riskFactor: "low" | "medium" | "high") => {
    const updated = [...currentRoutine.steps];
    updated[index] = {
      ...updated[index],
      riskFactor,
    };
    setCurrentRoutine({
      ...currentRoutine,
      steps: updated,
    });
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = PRESET_ROUTINES.find((p) => p.id === presetId);
    if (preset) {
      setCurrentRoutine(JSON.parse(JSON.stringify(preset)));
      setSelectedStepIndex(0);
    }
  };

  const handleAllianceColorToggle = (alliance: AllianceColor) => {
    setCurrentRoutine({
      ...currentRoutine,
      alliance,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8 print:p-0 print:bg-white print:text-black">
      <SEO
        title="Field Strategy Planner & Match Run Estimator"
        description="Interactive 144-inch FTC INTO THE DEEP field strategy canvas, autonomous sequence builder, partner synergy calculator, and printable match sheets."
      />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-12 print:max-w-none print:p-0">
        {/* Top Header & Breadcrumb (Screen only) */}
        <header className="mb-8 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Link
                to="/tournaments"
                className="text-xs font-bold uppercase tracking-widest text-ares-gold hover:text-white transition-colors"
              >
                Tournaments Vault
              </Link>
              <span className="text-marble/40">/</span>
              <span className="text-xs font-bold uppercase tracking-widest text-white">
                Field Strategy &amp; Match Estimator
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="clipped-button bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2 px-4 py-2 border border-white/20 transition-all cursor-pointer"
                aria-label="Print Match Strategy Sheet"
              >
                <Printer size={14} className="text-ares-gold" />
                <span>Print Binder Sheet</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-ares-red/15 text-ares-gold border border-ares-bronze/40 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">
                <Compass size={12} className="text-ares-gold" aria-hidden="true" />
                <span>FIRST® Tech Challenge · INTO THE DEEP · 144&quot; × 144&quot; Field</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight font-heading text-white">
                Autonomous Strategy{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-ares-gold">
                  &amp; Match Estimator
                </span>
              </h1>
            </div>

            {/* Total Estimated Score Card */}
            <div className="bg-white/5 border border-ares-gold/30 rounded-xl p-4 flex items-center gap-6 shadow-xl backdrop-blur-md">
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-widest text-marble/60 block">
                  Projected Run Score
                </span>
                <span className="text-3xl font-black text-ares-gold font-heading">
                  {routineScores.totalScore}{" "}
                  <span className="text-xs font-normal text-marble/60">pts</span>
                </span>
              </div>
              <div className="border-l border-white/10 pl-4 space-y-0.5 text-xs text-marble/70">
                <div>
                  <span className="text-ares-gold font-bold">Auto:</span> {routineScores.autoScore} pts ({routineScores.autoDuration}s)
                </div>
                <div>
                  <span className="text-ares-cyan font-bold">Teleop:</span> {routineScores.teleopScore} pts
                </div>
                <div>
                  <span className="text-purple-400 font-bold">Endgame:</span> {routineScores.endgameScore} pts
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* View Mode Navigation Tabs (Screen only) */}
        <nav className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4 mb-8 print:hidden" aria-label="Strategy Tool Navigation">
          <button
            type="button"
            onClick={() => setActiveTab("canvas")}
            aria-pressed={activeTab === "canvas"}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "canvas"
                ? "bg-ares-red text-white shadow-lg"
                : "bg-white/5 text-marble/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <Crosshair size={14} />
            <span>Interactive 144&quot; Field Canvas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("builder")}
            aria-pressed={activeTab === "builder"}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "builder"
                ? "bg-ares-red text-white shadow-lg"
                : "bg-white/5 text-marble/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <Layers size={14} />
            <span>Sequence Step Builder ({currentRoutine.steps.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("synergy")}
            aria-pressed={activeTab === "synergy"}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "synergy"
                ? "bg-ares-red text-white shadow-lg"
                : "bg-white/5 text-marble/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <Sparkles size={14} />
            <span>Partner Synergy &amp; Defense Simulator</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("printSheet")}
            aria-pressed={activeTab === "printSheet"}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "printSheet"
                ? "bg-ares-gold text-black font-black shadow-lg"
                : "bg-white/5 text-marble/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <Printer size={14} />
            <span>Match Strategy Binder Sheet</span>
          </button>
        </nav>

        {/* ========================================================================= */}
        {/* TAB 1: INTERACTIVE 144" FIELD CANVAS */}
        {/* ========================================================================= */}
        {activeTab === "canvas" && (
          <section className="space-y-8 animate-fadeIn print:hidden" aria-label="Interactive Field Canvas">
            {/* Control Strip */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              {/* Preset Selector */}
              <div className="flex items-center gap-3">
                <label htmlFor="preset-select" className="text-xs font-bold uppercase text-marble/60">
                  Routine Preset:
                </label>
                <select
                  id="preset-select"
                  value={currentRoutine.id}
                  onChange={(e) => handleLoadPreset(e.target.value)}
                  className="bg-black/60 border border-white/20 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-ares-gold"
                >
                  {PRESET_ROUTINES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Alliance Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-marble/60">Alliance:</span>
                <button
                  type="button"
                  onClick={() => handleAllianceColorToggle("red")}
                  className={`px-3 py-1 text-xs font-bold uppercase rounded transition-colors cursor-pointer ${
                    currentRoutine.alliance === "red"
                      ? "bg-ares-red text-white ring-1 ring-white/50"
                      : "bg-white/5 text-marble/50 hover:text-white"
                  }`}
                >
                  Red Alliance
                </button>
                <button
                  type="button"
                  onClick={() => handleAllianceColorToggle("blue")}
                  className={`px-3 py-1 text-xs font-bold uppercase rounded transition-colors cursor-pointer ${
                    currentRoutine.alliance === "blue"
                      ? "bg-blue-600 text-white ring-1 ring-white/50"
                      : "bg-white/5 text-marble/50 hover:text-white"
                  }`}
                >
                  Blue Alliance
                </button>
              </div>

              {/* Canvas Toggles */}
              <div className="flex items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showGridCoordinates}
                    onChange={(e) => setShowGridCoordinates(e.target.checked)}
                    className="accent-ares-gold rounded"
                  />
                  <span>Show 24&quot; Tile Grid</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPathOverlay}
                    onChange={(e) => setShowPathOverlay(e.target.checked)}
                    className="accent-ares-gold rounded"
                  />
                  <span>Show Waypoint Trajectory</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Field SVG Display (7 cols) */}
              <div className="lg:col-span-7 bg-black/80 border border-white/15 rounded-2xl p-4 shadow-2xl relative flex flex-col items-center">
                {/* Field Coordinate Inspector Display */}
                <div className="w-full flex items-center justify-between text-xs text-marble/60 mb-2 px-2">
                  <div className="flex items-center gap-2">
                    <Crosshair size={14} className="text-ares-gold" />
                    <span>
                      Cursor:{" "}
                      <span className="text-white font-mono font-bold">
                        {fieldCursorCoord ? `X: ${fieldCursorCoord.x}", Y: ${fieldCursorCoord.y}"` : "Hover over field"}
                      </span>
                    </span>
                  </div>
                  <span className="text-[10px] text-marble/40 uppercase">
                    Click field to set waypoint coordinate
                  </span>
                </div>

                {/* SVG 144x144 Field */}
                <div className="w-full aspect-square max-w-[600px] relative border-2 border-white/20 rounded-lg overflow-hidden bg-neutral-900 shadow-inner select-none">
                  <svg
                    ref={fieldSvgRef}
                    viewBox="0 0 144 144"
                    className="w-full h-full cursor-crosshair"
                    onClick={handleFieldSvgClick}
                    onMouseMove={handleFieldMouseMove}
                    onMouseLeave={() => setFieldCursorCoord(null)}
                    aria-label="144 inch by 144 inch FTC Field Canvas"
                  >
                    {/* SVG Definitions */}
                    <defs>
                      <marker
                        id="arrowhead"
                        markerWidth="6"
                        markerHeight="6"
                        refX="4"
                        refY="3"
                        orient="auto"
                      >
                        <polygon points="0 0, 6 3, 0 6" fill="#F4B400" />
                      </marker>
                    </defs>

                    {/* Foam Tile 6x6 Grid */}
                    {Array.from({ length: TILE_COUNT }).map((_, row) =>
                      Array.from({ length: TILE_COUNT }).map((_, col) => (
                        <rect
                          key={`tile-${row}-${col}`}
                          x={col * TILE_SIZE_INCHES}
                          y={row * TILE_SIZE_INCHES}
                          width={TILE_SIZE_INCHES}
                          height={TILE_SIZE_INCHES}
                          fill={(row + col) % 2 === 0 ? "#1e1e1e" : "#171717"}
                          stroke={showGridCoordinates ? "#333333" : "transparent"}
                          strokeWidth="0.5"
                        />
                      ))
                    )}

                    {/* Perimeter Walls */}
                    <rect
                      x="0"
                      y="0"
                      width="144"
                      height="144"
                      fill="none"
                      stroke="#555555"
                      strokeWidth="1.5"
                    />

                    {/* Red Observation Zone (0,0 to 36,36) */}
                    <rect
                      x="0"
                      y="0"
                      width="36"
                      height="36"
                      fill="rgba(220, 38, 38, 0.18)"
                      stroke="#DC2626"
                      strokeWidth="1"
                    />
                    <text x="4" y="10" fill="#EF4444" fontSize="4" fontWeight="bold">
                      RED OBSERVATION
                    </text>

                    {/* Blue Observation Zone (108,108 to 144,144) */}
                    <rect
                      x="108"
                      y="108"
                      width="36"
                      height="36"
                      fill="rgba(37, 99, 235, 0.18)"
                      stroke="#2563EB"
                      strokeWidth="1"
                    />
                    <text x="110" y="118" fill="#60A5FA" fontSize="4" fontWeight="bold">
                      BLUE OBSERVATION
                    </text>

                    {/* Red Sample Baskets (Top-Left 0,120 to 24,144) */}
                    <rect
                      x="0"
                      y="120"
                      width="24"
                      height="24"
                      fill="rgba(220, 38, 38, 0.3)"
                      stroke="#DC2626"
                      strokeWidth="1"
                    />
                    <text x="3" y="130" fill="#F87171" fontSize="3.5" fontWeight="bold">
                      RED BASKETS
                    </text>

                    {/* Blue Sample Baskets (Bottom-Right 120,0 to 144,24) */}
                    <rect
                      x="120"
                      y="0"
                      width="24"
                      height="24"
                      fill="rgba(37, 99, 235, 0.3)"
                      stroke="#2563EB"
                      strokeWidth="1"
                    />
                    <text x="122" y="10" fill="#93C5FD" fontSize="3.5" fontWeight="bold">
                      BLUE BASKETS
                    </text>

                    {/* Central Submersible Zone (48,48 to 96,96) */}
                    <rect
                      x="48"
                      y="48"
                      width="48"
                      height="48"
                      fill="rgba(244, 180, 0, 0.08)"
                      stroke="#F4B400"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                    />
                    <text x="52" y="54" fill="#FCD34D" fontSize="4" fontWeight="bold">
                      SUBMERSIBLE STRUCTURE
                    </text>

                    {/* High Chamber Hang Bars */}
                    {/* Red Chamber */}
                    <rect
                      x="48"
                      y="78"
                      width="24"
                      height="6"
                      fill="#DC2626"
                      stroke="#FFFFFF"
                      strokeWidth="0.5"
                    />
                    <text x="50" y="82.5" fill="#FFFFFF" fontSize="2.8" fontWeight="bold">
                      RED HIGH CHAMBER
                    </text>

                    {/* Blue Chamber */}
                    <rect
                      x="72"
                      y="78"
                      width="24"
                      height="6"
                      fill="#2563EB"
                      stroke="#FFFFFF"
                      strokeWidth="0.5"
                    />
                    <text x="74" y="82.5" fill="#FFFFFF" fontSize="2.8" fontWeight="bold">
                      BLUE HIGH CHAMBER
                    </text>

                    {/* Ascent Rungs (60,60 to 84,72) */}
                    <rect
                      x="60"
                      y="62"
                      width="24"
                      height="12"
                      fill="rgba(168, 85, 247, 0.2)"
                      stroke="#A855F7"
                      strokeWidth="0.75"
                    />
                    <text x="63" y="69" fill="#E9D5FF" fontSize="3" fontWeight="bold">
                      ASCENT RUNGS L1-L3
                    </text>

                    {/* Start Spot Marker */}
                    <circle
                      cx={currentRoutine.startingPosition.x}
                      cy={currentRoutine.startingPosition.y}
                      r="4"
                      fill={currentRoutine.alliance === "red" ? "#DC2626" : "#2563EB"}
                      stroke="#FFFFFF"
                      strokeWidth="1"
                    />
                    <text
                      x={currentRoutine.startingPosition.x + 5}
                      y={currentRoutine.startingPosition.y + 2}
                      fill="#FFFFFF"
                      fontSize="3.2"
                      fontWeight="bold"
                    >
                      START
                    </text>

                    {/* Routine Path Polylines */}
                    {showPathOverlay && currentRoutine.steps.length > 0 && (
                      <>
                        {/* Connecting Line from Start to all waypoints */}
                        <path
                          d={`M ${currentRoutine.startingPosition.x} ${currentRoutine.startingPosition.y} ${currentRoutine.steps
                            .map((s) => `L ${s.targetCoordinate.x} ${s.targetCoordinate.y}`)
                            .join(" ")}`}
                          fill="none"
                          stroke={currentRoutine.alliance === "red" ? "#EF4444" : "#60A5FA"}
                          strokeWidth="1.2"
                          strokeDasharray="2,1"
                          markerEnd="url(#arrowhead)"
                        />

                        {/* Numbered Waypoint Badges */}
                        {currentRoutine.steps.map((step, idx) => {
                          const isSelected = selectedStepIndex === idx;
                          const phaseColor =
                            step.phase === "auto" ? "#F4B400" : step.phase === "teleop" ? "#06B6D4" : "#A855F7";

                          return (
                            <g
                              key={step.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStepIndex(idx);
                              }}
                              className="cursor-pointer"
                            >
                              <circle
                                cx={step.targetCoordinate.x}
                                cy={step.targetCoordinate.y}
                                r={isSelected ? "4.5" : "3.5"}
                                fill={phaseColor}
                                stroke={isSelected ? "#FFFFFF" : "#111827"}
                                strokeWidth={isSelected ? "1.5" : "0.75"}
                              />
                              <text
                                x={step.targetCoordinate.x}
                                y={step.targetCoordinate.y + 1.2}
                                textAnchor="middle"
                                fill="#000000"
                                fontSize="2.8"
                                fontWeight="bold"
                              >
                                {idx + 1}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    )}
                  </svg>
                </div>

                {/* Field Landmark Legend */}
                <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-[11px] text-marble/70">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-ares-red/40 border border-ares-red rounded-sm" />
                    <span>Observation Zone</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-ares-gold/30 border border-ares-gold rounded-sm" />
                    <span>Submersible Zone</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-purple-500/30 border border-purple-400 rounded-sm" />
                    <span>Ascent Rungs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-ares-cyan/30 border border-ares-cyan rounded-sm" />
                    <span>Sample Baskets</span>
                  </div>
                </div>
              </div>

              {/* Waypoint Sequence List & Step Detail Inspector (5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Target size={16} className="text-ares-gold" />
                      Sequence Waypoints ({currentRoutine.steps.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => handleAddStep("auto")}
                      className="px-2.5 py-1 rounded bg-ares-gold/20 hover:bg-ares-gold/30 text-ares-gold text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                      Add Step
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {currentRoutine.steps.map((step, idx) => {
                      const isSelected = selectedStepIndex === idx;
                      return (
                        <div
                          key={step.id}
                          onClick={() => setSelectedStepIndex(idx)}
                          className={`p-3 rounded-lg border text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-white/15 border-ares-gold text-white shadow-md"
                              : "bg-black/30 border-white/10 text-marble/70 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                step.phase === "auto"
                                  ? "bg-ares-gold text-black"
                                  : step.phase === "teleop"
                                  ? "bg-ares-cyan text-black"
                                  : "bg-purple-500 text-white"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div className="truncate">
                              <span className="font-bold block truncate">{step.label}</span>
                              <span className="text-[10px] text-marble/50">
                                ({step.targetCoordinate.x}&quot;, {step.targetCoordinate.y}&quot;) · {step.durationSeconds}s · +{step.points} pts
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveStep(idx, "up");
                              }}
                              disabled={idx === 0}
                              className="p-1 text-marble/40 hover:text-white disabled:opacity-20 cursor-pointer"
                              title="Move step up"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveStep(idx, "down");
                              }}
                              disabled={idx === currentRoutine.steps.length - 1}
                              className="p-1 text-marble/40 hover:text-white disabled:opacity-20 cursor-pointer"
                              title="Move step down"
                            >
                              <ChevronDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveStep(idx);
                              }}
                              className="p-1 text-ares-red/60 hover:text-ares-red cursor-pointer"
                              title="Delete step"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Step Inspector Card */}
                {selectedStepIndex !== null && currentRoutine.steps[selectedStepIndex] && (
                  <div className="bg-black/50 border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-black uppercase text-ares-gold">
                        Editing Step #{selectedStepIndex + 1}
                      </span>
                      <span className="text-[10px] font-mono text-marble/50">
                        ID: {currentRoutine.steps[selectedStepIndex].id}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label htmlFor="step-action-select" className="block text-[10px] font-bold text-marble/60 uppercase mb-1">
                          Action / Target
                        </label>
                        <select
                          id="step-action-select"
                          value={currentRoutine.steps[selectedStepIndex].action}
                          onChange={(e) =>
                            handleStepActionChange(selectedStepIndex, e.target.value as StrategyActionType)
                          }
                          className="w-full bg-black/60 border border-white/20 rounded px-2.5 py-1.5 text-white text-xs"
                        >
                          {Object.entries(ACTION_DEFINITIONS).map(([key, def]) => (
                            <option key={key} value={key}>
                              [{def.phase.toUpperCase()}] {def.label} (+{def.points} pts)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="step-duration-input" className="block text-[10px] font-bold text-marble/60 uppercase mb-1">
                          Duration (Sec)
                        </label>
                        <input
                          id="step-duration-input"
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="30"
                          value={currentRoutine.steps[selectedStepIndex].durationSeconds}
                          onChange={(e) =>
                            handleStepDurationChange(selectedStepIndex, parseFloat(e.target.value) || 1)
                          }
                          className="w-full bg-black/60 border border-white/20 rounded px-2.5 py-1.5 text-white text-xs"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label htmlFor="step-label-input" className="block text-[10px] font-bold text-marble/60 uppercase mb-1">
                        Step Label / Name
                      </label>
                      <input
                        id="step-label-input"
                        type="text"
                        value={currentRoutine.steps[selectedStepIndex].label}
                        onChange={(e) => handleStepLabelChange(selectedStepIndex, e.target.value)}
                        className="w-full bg-black/60 border border-white/20 rounded px-2.5 py-1.5 text-white text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label htmlFor="step-risk-select" className="block text-[10px] font-bold text-marble/60 uppercase mb-1">
                          Risk Factor
                        </label>
                        <select
                          id="step-risk-select"
                          value={currentRoutine.steps[selectedStepIndex].riskFactor}
                          onChange={(e) =>
                            handleStepRiskChange(selectedStepIndex, e.target.value as "low" | "medium" | "high")
                          }
                          className="w-full bg-black/60 border border-white/20 rounded px-2.5 py-1.5 text-white text-xs"
                        >
                          <option value="low">Low Risk</option>
                          <option value="medium">Medium Risk</option>
                          <option value="high">High Risk</option>
                        </select>
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold text-marble/60 uppercase mb-1">
                          Field Coord (X, Y)
                        </span>
                        <div className="text-xs font-mono py-1.5 text-marble/80">
                          {currentRoutine.steps[selectedStepIndex].targetCoordinate.x}&quot;,{" "}
                          {currentRoutine.steps[selectedStepIndex].targetCoordinate.y}&quot;
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SEQUENCE STEP BUILDER */}
        {/* ========================================================================= */}
        {activeTab === "builder" && (
          <section className="space-y-8 animate-fadeIn print:hidden" aria-label="Sequence Step Builder">
            {/* Routine Summary Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label htmlFor="routine-name-input" className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
                  Routine Title:
                </label>
                <input
                  id="routine-name-input"
                  type="text"
                  value={currentRoutine.name}
                  onChange={(e) => setCurrentRoutine({ ...currentRoutine, name: e.target.value })}
                  className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-sm text-white font-bold"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="start-pos-input" className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
                  Starting Tile:
                </label>
                <input
                  id="start-pos-input"
                  type="text"
                  value={currentRoutine.startingPositionName}
                  onChange={(e) => setCurrentRoutine({ ...currentRoutine, startingPositionName: e.target.value })}
                  className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3 pt-4 md:pt-0">
                <button
                  type="button"
                  onClick={() => handleAddStep("auto")}
                  className="clipped-button bg-ares-gold text-black font-bold text-xs uppercase px-4 py-2 flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Plus size={14} />
                  Add Auto Step
                </button>
                <button
                  type="button"
                  onClick={() => handleAddStep("teleop")}
                  className="clipped-button bg-ares-cyan text-black font-bold text-xs uppercase px-4 py-2 flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Plus size={14} />
                  Add Teleop Step
                </button>
              </div>
            </div>

            {/* Autonomous Timing Budget Gauge */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-white flex items-center gap-2">
                  <Clock size={14} className="text-ares-gold" />
                  Autonomous Period Time Budget (30.0s Limit)
                </span>
                <span
                  className={`text-xs font-mono font-bold ${
                    routineScores.autoDuration > 30 ? "text-ares-red" : "text-ares-gold"
                  }`}
                >
                  {routineScores.autoDuration}s / 30.0s
                </span>
              </div>
              <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden border border-white/10">
                <div
                  className={`h-full transition-all duration-300 ${
                    routineScores.autoDuration > 30
                      ? "bg-ares-red"
                      : routineScores.autoDuration > 25
                      ? "bg-ares-gold"
                      : "bg-ares-cyan"
                  }`}
                  style={{ width: `${Math.min(100, (routineScores.autoDuration / 30) * 100)}%` }}
                />
              </div>
              {routineScores.autoDuration > 30 && (
                <p className="text-xs text-ares-red mt-2 font-bold flex items-center gap-1">
                  <Info size={14} />
                  Autonomous routine exceeds official 30.0s time cutoff by {(routineScores.autoDuration - 30).toFixed(1)}s!
                </p>
              )}
            </div>

            {/* Full Steps Table */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Configured Routine Steps ({currentRoutine.steps.length})
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/50 border-b border-white/10 text-marble/60 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Phase</th>
                      <th className="p-3">Action Description</th>
                      <th className="p-3">Field Coord</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Points</th>
                      <th className="p-3">Risk</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {currentRoutine.steps.map((step, idx) => (
                      <tr key={step.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-mono font-bold text-marble/60">{idx + 1}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              step.phase === "auto"
                                ? "bg-ares-gold/20 text-ares-gold border border-ares-gold/30"
                                : step.phase === "teleop"
                                ? "bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/30"
                                : "bg-purple-500/20 text-purple-300 border border-purple-400/30"
                            }`}
                          >
                            {step.phase}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-white">{step.label}</td>
                        <td className="p-3 font-mono text-marble/70">
                          {step.targetCoordinate.x}&quot;, {step.targetCoordinate.y}&quot;
                        </td>
                        <td className="p-3 font-mono text-marble/70">{step.durationSeconds}s</td>
                        <td className="p-3 font-mono font-bold text-ares-gold">+{step.points}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              step.riskFactor === "low"
                                ? "text-emerald-400 bg-emerald-950/40"
                                : step.riskFactor === "medium"
                                ? "text-amber-400 bg-amber-950/40"
                                : "text-rose-400 bg-rose-950/40"
                            }`}
                          >
                            {step.riskFactor}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveStep(idx, "up")}
                              disabled={idx === 0}
                              className="p-1 text-marble/40 hover:text-white disabled:opacity-20 cursor-pointer"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStep(idx, "down")}
                              disabled={idx === currentRoutine.steps.length - 1}
                              className="p-1 text-marble/40 hover:text-white disabled:opacity-20 cursor-pointer"
                            >
                              <ChevronDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(idx)}
                              className="p-1 text-ares-red/60 hover:text-ares-red cursor-pointer ml-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ALLIANCE PARTNER SYNERGY CALCULATOR */}
        {/* ========================================================================= */}
        {activeTab === "synergy" && (
          <section className="space-y-8 animate-fadeIn print:hidden" aria-label="Alliance Partner Synergy Simulator">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Partner Capabilities Config (6 cols) */}
              <div className="lg:col-span-6 space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-5">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <Shield size={18} className="text-ares-cyan" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Alliance Partner Capability Profile
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <label htmlFor="partner-team-num" className="block text-[10px] font-bold text-marble/60 uppercase mb-1">
                        Partner Team #
                      </label>
                      <input
                        id="partner-team-num"
                        type="text"
                        value={partnerConfig.teamNumber}
                        onChange={(e) => setPartnerConfig({ ...partnerConfig, teamNumber: e.target.value })}
                        className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="partner-team-name" className="block text-[10px] font-bold text-marble/60 uppercase mb-1">
                        Team Name
                      </label>
                      <input
                        id="partner-team-name"
                        type="text"
                        value={partnerConfig.teamName}
                        onChange={(e) => setPartnerConfig({ ...partnerConfig, teamName: e.target.value })}
                        className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="text-xs">
                    <label htmlFor="partner-role-select" className="block text-[10px] font-bold text-marble/60 uppercase mb-1">
                      Preferred Strategic Role
                    </label>
                    <select
                      id="partner-role-select"
                      value={partnerConfig.preferredRole}
                      onChange={(e) =>
                        setPartnerConfig({
                          ...partnerConfig,
                          preferredRole: e.target.value as AlliancePartnerConfig["preferredRole"],
                        })
                      }
                      className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-white"
                    >
                      <option value="specimen_cycler">Specimen Cycler (High Chamber Hangs)</option>
                      <option value="basket_cycler">Basket Cycler (High Basket Samples)</option>
                      <option value="hybrid">Hybrid All-Rounder</option>
                      <option value="defense_anchor">Defense Anchor / Observation Pusher</option>
                    </select>
                  </div>

                  {/* Partner Auto capabilities */}
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3 text-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-ares-gold block">
                      Partner Autonomous Capabilities
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="partner-auto-spec" className="block text-[10px] text-marble/60 mb-1">Auto Specimens</label>
                        <input
                          id="partner-auto-spec"
                          type="number"
                          min="0"
                          max="5"
                          value={partnerConfig.autoSpecimensHigh}
                          onChange={(e) =>
                            setPartnerConfig({ ...partnerConfig, autoSpecimensHigh: parseInt(e.target.value) || 0 })
                          }
                          className="w-full bg-black/60 border border-white/20 rounded px-2 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="partner-auto-samples" className="block text-[10px] text-marble/60 mb-1">Auto Samples</label>
                        <input
                          id="partner-auto-samples"
                          type="number"
                          min="0"
                          max="4"
                          value={partnerConfig.autoSamplesHigh}
                          onChange={(e) =>
                            setPartnerConfig({ ...partnerConfig, autoSamplesHigh: parseInt(e.target.value) || 0 })
                          }
                          className="w-full bg-black/60 border border-white/20 rounded px-2 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="partner-auto-park" className="block text-[10px] text-marble/60 mb-1">Auto Park</label>
                        <select
                          id="partner-auto-park"
                          value={partnerConfig.autoPark}
                          onChange={(e) =>
                            setPartnerConfig({
                              ...partnerConfig,
                              autoPark: e.target.value as AlliancePartnerConfig["autoPark"],
                            })
                          }
                          className="w-full bg-black/60 border border-white/20 rounded px-2 py-1.5 text-white"
                        >
                          <option value="none">None (0)</option>
                          <option value="observation">Observation (3)</option>
                          <option value="submersible">Submersible (3)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Partner Teleop & Endgame */}
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3 text-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-ares-cyan block">
                      Partner Teleop &amp; Endgame Capabilities
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="partner-teleop-spec" className="block text-[10px] text-marble/60 mb-1">Teleop Specimens</label>
                        <input
                          id="partner-teleop-spec"
                          type="number"
                          min="0"
                          max="10"
                          value={partnerConfig.teleopSpecimensHigh}
                          onChange={(e) =>
                            setPartnerConfig({ ...partnerConfig, teleopSpecimensHigh: parseInt(e.target.value) || 0 })
                          }
                          className="w-full bg-black/60 border border-white/20 rounded px-2 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="partner-teleop-samples" className="block text-[10px] text-marble/60 mb-1">Teleop Samples</label>
                        <input
                          id="partner-teleop-samples"
                          type="number"
                          min="0"
                          max="10"
                          value={partnerConfig.teleopSamplesHigh}
                          onChange={(e) =>
                            setPartnerConfig({ ...partnerConfig, teleopSamplesHigh: parseInt(e.target.value) || 0 })
                          }
                          className="w-full bg-black/60 border border-white/20 rounded px-2 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="partner-endgame-ascent" className="block text-[10px] text-marble/60 mb-1">Endgame Ascent</label>
                        <select
                          id="partner-endgame-ascent"
                          value={partnerConfig.endgameAscent}
                          onChange={(e) =>
                            setPartnerConfig({
                              ...partnerConfig,
                              endgameAscent: e.target.value as AlliancePartnerConfig["endgameAscent"],
                            })
                          }
                          className="w-full bg-black/60 border border-white/20 rounded px-2 py-1.5 text-white"
                        >
                          <option value="none">None (0)</option>
                          <option value="level_1">Level 1 (3)</option>
                          <option value="level_2">Level 2 (15)</option>
                          <option value="level_3">Level 3 (30)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Partner Reliability Slider */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <label htmlFor="partner-reliability-range" className="text-[10px] font-bold text-marble/60 uppercase">
                        Execution Consistency Factor:
                      </label>
                      <span className="font-mono font-bold text-ares-gold">
                        {Math.round(partnerConfig.reliabilityFactor * 100)}%
                      </span>
                    </div>
                    <input
                      id="partner-reliability-range"
                      type="range"
                      min="0.5"
                      max="1.0"
                      step="0.05"
                      value={partnerConfig.reliabilityFactor}
                      onChange={(e) =>
                        setPartnerConfig({ ...partnerConfig, reliabilityFactor: parseFloat(e.target.value) })
                      }
                      className="w-full accent-ares-gold"
                    />
                  </div>
                </div>

                {/* Opponent Defense Profile Selector */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <Zap size={18} className="text-ares-red" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Opponent Defense Simulation Profile
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {Object.values(DEFENSE_PROFILES).map((dp) => (
                      <button
                        key={dp.id}
                        type="button"
                        onClick={() => setSelectedDefenseProfile(dp.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          selectedDefenseProfile === dp.id
                            ? "bg-ares-red/20 border-ares-red text-white shadow-lg"
                            : "bg-black/30 border-white/10 text-marble/60 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span className="font-bold block text-white mb-1">{dp.name}</span>
                        <p className="text-[11px] text-marble/60 leading-relaxed mb-2">{dp.description}</p>
                        <span className="text-[10px] font-mono text-ares-gold">
                          Teleop Efficiency: {Math.round(dp.teleopEfficiencyMultiplier * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Combined Alliance Projection & Tactical Advice (6 cols) */}
              <div className="lg:col-span-6 space-y-6">
                {/* Total Alliance Score Summary Banner */}
                <div className="bg-gradient-to-br from-ares-red/30 via-black/80 to-ares-gold/20 border border-ares-gold/40 rounded-2xl p-6 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-ares-gold block">
                        Projected Alliance Match Score
                      </span>
                      <span className="text-5xl font-black text-white font-heading mt-1 block">
                        {synergyResult.defenseAdjustedScore}{" "}
                        <span className="text-sm font-normal text-marble/60">pts</span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          synergyResult.synergyRating === "Exceptional"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/40"
                            : synergyResult.synergyRating === "Balanced"
                            ? "bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/40"
                            : synergyResult.synergyRating === "Congested"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                            : "bg-rose-500/20 text-rose-300 border border-rose-400/40"
                        }`}
                      >
                        {synergyResult.synergyRating} Synergy
                      </span>
                    </div>
                  </div>

                  {/* Score Breakdown Bars */}
                  <div className="grid grid-cols-3 gap-3 text-center border-t border-b border-white/10 py-4 text-xs">
                    <div className="bg-white/5 p-3 rounded-lg">
                      <span className="text-[10px] text-marble/50 uppercase block mb-1">Alliance Auto</span>
                      <span className="text-lg font-bold text-ares-gold font-mono">
                        {synergyResult.autoAllianceScore} pts
                      </span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg">
                      <span className="text-[10px] text-marble/50 uppercase block mb-1">Alliance Teleop</span>
                      <span className="text-lg font-bold text-ares-cyan font-mono">
                        {synergyResult.teleopAllianceScore} pts
                      </span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg">
                      <span className="text-[10px] text-marble/50 uppercase block mb-1">Alliance Endgame</span>
                      <span className="text-lg font-bold text-purple-300 font-mono">
                        {synergyResult.endgameAllianceScore} pts
                      </span>
                    </div>
                  </div>

                  {/* Individual Contribution Comparison */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-[11px] text-marble/70">
                      <span>ARES 23247 Contribution: {synergyResult.robot1Score} pts</span>
                      <span>Partner #{partnerConfig.teamNumber} Contribution: {synergyResult.robot2Score} pts</span>
                    </div>
                    <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden flex border border-white/10">
                      <div
                        className="bg-ares-red h-full"
                        style={{
                          width: `${
                            (synergyResult.robot1Score / (synergyResult.robot1Score + synergyResult.robot2Score || 1)) * 100
                          }%`,
                        }}
                      />
                      <div
                        className="bg-ares-gold h-full"
                        style={{
                          width: `${
                            (synergyResult.robot2Score / (synergyResult.robot1Score + synergyResult.robot2Score || 1)) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Submersible Congestion Risk & Tactical Plan */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Info size={16} className="text-ares-gold" />
                      Submersible Lane Congestion Assessment
                    </h3>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                        synergyResult.submersibleCongestionRisk === "Low"
                          ? "bg-emerald-950/40 text-emerald-400"
                          : synergyResult.submersibleCongestionRisk === "Moderate"
                          ? "bg-amber-950/40 text-amber-300"
                          : "bg-rose-950/40 text-rose-300"
                      }`}
                    >
                      {synergyResult.submersibleCongestionRisk} Risk
                    </span>
                  </div>

                  <p className="text-xs text-marble/70 leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5">
                    {synergyResult.strategicRecommendation}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PRINTABLE MATCH STRATEGY SHEET (Optimized for Drive Team Binder) */}
        {/* ========================================================================= */}
        {(activeTab === "printSheet" || true) && (
          <section
            className={`space-y-6 animate-fadeIn ${activeTab !== "printSheet" ? "hidden print:block" : ""}`}
            aria-label="Printable Match Strategy Sheet"
          >
            {/* Screen Helper Banner */}
            <div className="bg-ares-gold/10 border border-ares-gold/30 rounded-xl p-4 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2 text-xs text-ares-gold">
                <Printer size={16} />
                <span>
                  <strong>Drive Team Binder Mode:</strong> Click below to print or save a high-contrast strategy sheet PDF.
                </span>
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="clipped-button bg-ares-gold text-black font-black text-xs uppercase px-4 py-2 flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Printer size={14} />
                Print Strategy Sheet
              </button>
            </div>

            {/* Printable Binder Document Container */}
            <div className="bg-white text-neutral-900 border border-neutral-300 rounded-xl p-8 shadow-2xl print:border-none print:p-0 print:shadow-none">
              {/* Document Header */}
              <div className="border-b-2 border-neutral-900 pb-4 mb-6 flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600">
                    FIRST® Tech Challenge · Team 23247 ARES
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-neutral-900 mt-1">
                    Official Match Strategy &amp; Autonomous Plan
                  </h2>
                </div>

                <div className="text-right">
                  <div className="inline-block bg-neutral-900 text-white font-mono font-bold text-sm px-3 py-1 rounded">
                    {matchNumber}
                  </div>
                  <div className="text-[10px] font-bold text-neutral-600 mt-1 uppercase">
                    Alliance: <span className="text-neutral-900">{currentRoutine.alliance.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {/* Match Alliance Overview Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
                <div className="border border-neutral-300 rounded-lg p-3 bg-neutral-50">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block mb-1">
                    Our Alliance Robots
                  </span>
                  <div className="font-bold text-neutral-900">
                    Robot 1: ARES #23247 ({currentRoutine.name})
                  </div>
                  <div className="font-medium text-neutral-700">
                    Robot 2: #{partnerConfig.teamNumber} {partnerConfig.teamName} ({partnerConfig.preferredRole})
                  </div>
                  <div className="text-[11px] font-mono text-neutral-600 mt-1">
                    Combined Projected OPR: {synergyResult.defenseAdjustedScore} pts
                  </div>
                </div>

                <div className="border border-neutral-300 rounded-lg p-3 bg-neutral-50">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block mb-1">
                    Opposing Alliance
                  </span>
                  <div className="font-bold text-neutral-900">{oppTeam1}</div>
                  <div className="font-medium text-neutral-700">{oppTeam2}</div>
                  <div className="text-[11px] text-neutral-600 mt-1">
                    Anticipated Defense: {DEFENSE_PROFILES[selectedDefenseProfile].name}
                  </div>
                </div>
              </div>

              {/* Autonomous Step Timeline Table */}
              <div className="mb-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 border-b border-neutral-400 pb-1 mb-2">
                  Autonomous 30-Second Sequence Timeline ({routineScores.autoDuration}s · {routineScores.autoScore} pts)
                </h3>
                <table className="w-full text-left text-xs border border-neutral-300">
                  <thead className="bg-neutral-100 border-b border-neutral-300 text-[10px] font-bold text-neutral-700 uppercase">
                    <tr>
                      <th className="p-2 border-r border-neutral-300">#</th>
                      <th className="p-2 border-r border-neutral-300">Time (s)</th>
                      <th className="p-2 border-r border-neutral-300">Action &amp; Target</th>
                      <th className="p-2 border-r border-neutral-300">Coordinates</th>
                      <th className="p-2 border-r border-neutral-300">Pts</th>
                      <th className="p-2">Risk / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {currentRoutine.steps
                      .filter((s) => s.phase === "auto")
                      .map((step, idx) => (
                        <tr key={step.id}>
                          <td className="p-2 font-mono font-bold border-r border-neutral-300">{idx + 1}</td>
                          <td className="p-2 font-mono border-r border-neutral-300">{step.durationSeconds}s</td>
                          <td className="p-2 font-bold text-neutral-900 border-r border-neutral-300">{step.label}</td>
                          <td className="p-2 font-mono text-neutral-600 border-r border-neutral-300">
                            ({step.targetCoordinate.x}&quot;, {step.targetCoordinate.y}&quot;)
                          </td>
                          <td className="p-2 font-mono font-bold border-r border-neutral-300">+{step.points}</td>
                          <td className="p-2 text-[11px] text-neutral-600">{step.notes || step.riskFactor}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Teleop & Endgame Gameplan Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
                <div className="border border-neutral-300 rounded-lg p-3">
                  <h4 className="text-[10px] font-black uppercase text-neutral-700 mb-1">
                    Teleop Cycling Protocol (120s)
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-neutral-800 text-[11px]">
                    <li><strong>ARES 23247:</strong> Primary High Chamber Specimen Cycler via Observation Wall</li>
                    <li><strong>Partner #{partnerConfig.teamNumber}:</strong> {partnerConfig.preferredRole.replace("_", " ")}</li>
                    <li><strong>Submersible Flow:</strong> Clockwise rotation, zero blocking inside gate</li>
                  </ul>
                </div>

                <div className="border border-neutral-300 rounded-lg p-3">
                  <h4 className="text-[10px] font-black uppercase text-neutral-700 mb-1">
                    Endgame Climb Protocol (0:30 Warning)
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-neutral-800 text-[11px]">
                    <li><strong>0:30 Mark:</strong> Abort teleop cycle, proceed to Submersible Ascent Rungs</li>
                    <li><strong>ARES Target:</strong> Level 3 Ascent High Hang (30 pts)</li>
                    <li><strong>Partner Target:</strong> {partnerConfig.endgameAscent.toUpperCase()} Climb</li>
                  </ul>
                </div>
              </div>

              {/* Coach Strategy Notes */}
              <div className="border border-neutral-300 rounded-lg p-3 bg-neutral-50 text-xs">
                <span className="text-[10px] font-black uppercase text-neutral-600 block mb-1">
                  Tactical Coach Notes &amp; Contingency Plan:
                </span>
                <p className="text-neutral-800 text-[11px] leading-relaxed font-mono">
                  {matchStrategyNotes}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
