"use client";

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Gamepad2,
  Cpu,
  ShieldAlert,
  Sliders,
  Printer,
  Search,
  CheckCircle2,
  ChevronRight,
  Zap,
  Activity,
  Gauge,
  Lock,
  ArrowLeft,
  Layers,
} from "lucide-react";
import SEO from "@/components/SEO";
import {
  DRIVERS,
  CONTROLLER_BUTTONS,
  CONTROL_MAPPINGS,
  getMappingsForDriver,
  getMappingForButton,
  filterMappings,
  getAvailableCategories,
  getSafetyInterlockSummary,
  type DriverId,
  type ButtonLocation,
  type ControlCategory,
} from "@/lib/gamepadControlsData";

export default function RobotGamepadControlsPage() {
  const [activeDriver, setActiveDriver] = useState<DriverId>("driver1");
  const [selectedButtonId, setSelectedButtonId] = useState<ButtonLocation | null>("left_stick");
  const [hoveredButtonId, setHoveredButtonId] = useState<ButtonLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ControlCategory | "All">("All");

  const driverProfile = DRIVERS[activeDriver];
  const driverMappings = useMemo(() => getMappingsForDriver(activeDriver), [activeDriver]);
  const categories = useMemo(() => getAvailableCategories(activeDriver), [activeDriver]);
  const filteredMappings = useMemo(
    () => filterMappings(activeDriver, searchQuery, selectedCategory),
    [activeDriver, searchQuery, selectedCategory],
  );

  const selectedMapping = useMemo(() => {
    if (!selectedButtonId) return undefined;
    return getMappingForButton(activeDriver, selectedButtonId);
  }, [activeDriver, selectedButtonId]);

  const hoveredMapping = useMemo(() => {
    if (!hoveredButtonId) return undefined;
    return getMappingForButton(activeDriver, hoveredButtonId);
  }, [activeDriver, hoveredButtonId]);

  const safetySummary = useMemo(
    () => getSafetyInterlockSummary(activeDriver),
    [activeDriver],
  );

  const handleSelectButton = (btnId: ButtonLocation) => {
    setSelectedButtonId(btnId);
  };

  const handleDriverChange = (driverId: DriverId) => {
    setActiveDriver(driverId);
    setSearchQuery("");
    setSelectedCategory("All");
    if (!selectedButtonId) {
      setSelectedButtonId("left_stick");
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const categoryColor = (cat: ControlCategory) => {
    switch (cat) {
      case "Drivetrain":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "Intake":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "Scoring":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "Elevator":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "Endgame":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "Automation":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "System":
        return "bg-neutral-500/20 text-neutral-300 border-neutral-500/40";
      default:
        return "bg-white/10 text-white/80 border-white/20";
    }
  };

  return (
    <main className="w-full min-h-screen bg-obsidian text-marble py-8 selection:bg-ares-red selection:text-white">
      <SEO
        title="Gamepad Driver Controls"
        description="Interactive gamepad driver controls mapper, tele-op layout visualizer, and drive team quick-reference guide for FTC competition."
      />

      {/* Screen-Only Header & Navigation */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 print:hidden">
        {/* Breadcrumb & Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <Link
            to="/robots"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marble/70 hover:text-ares-gold transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Robot Fleet
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              aria-label="Print driver quick-reference cheat sheet"
              className="clipped-button-sm bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 border border-white/20 shadow-md focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Printer size={15} aria-hidden="true" />
              Print Cheat Sheet
            </button>
          </div>
        </div>

        {/* Hero Section */}
        <header className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 bg-ares-red/20 text-ares-gold px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-xs mb-4 border border-ares-bronze/40">
            <Gamepad2 size={16} aria-hidden="true" className="text-ares-gold" />
            Tele-Op Drive System Matrix
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight uppercase font-heading text-white mb-4">
            Driver Controls
          </h1>
          <p className="text-marble/80 text-sm sm:text-base leading-relaxed font-medium">
            Interactive Logitech F310 / Xbox 360 controller mapping for team ARES 23247. Select
            any button to inspect input deadbands, response algorithms, and automated safety interlocks.
          </p>
        </header>

        {/* Dual-Driver Mode Switcher */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-10">
          <div
            role="tablist"
            aria-label="Select active driver controls view"
            className="inline-flex p-1.5 bg-black/60 rounded-xl border border-white/15 backdrop-blur-md shadow-2xl"
          >
            <button
              type="button"
              role="tab"
              id="tab-driver1"
              aria-selected={activeDriver === "driver1"}
              aria-controls="controls-panel"
              onClick={() => handleDriverChange("driver1")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                activeDriver === "driver1"
                  ? "bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow-lg shadow-blue-900/40"
                  : "text-marble/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Zap size={16} aria-hidden="true" />
              <span>Driver 1: Field Pilot</span>
            </button>
            <button
              type="button"
              role="tab"
              id="tab-driver2"
              aria-selected={activeDriver === "driver2"}
              aria-controls="controls-panel"
              onClick={() => handleDriverChange("driver2")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                activeDriver === "driver2"
                  ? "bg-gradient-to-r from-ares-red to-amber-600 text-white shadow-lg shadow-red-900/40"
                  : "text-marble/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Sliders size={16} aria-hidden="true" />
              <span>Driver 2: Systems Operator</span>
            </button>
          </div>
        </div>

        {/* Driver Profile Summary Banner */}
        <div className="glass-card ares-cut p-6 border border-white/10 mb-10 bg-gradient-to-r from-white/[0.02] to-white/[0.05]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                    activeDriver === "driver1"
                      ? "bg-blue-500/20 text-cyan-300 border-cyan-500/40"
                      : "bg-ares-red/20 text-amber-300 border-ares-bronze/40"
                  }`}
                >
                  {driverProfile.badgeLabel}
                </span>
                <span className="text-xs font-semibold text-marble/60">
                  {driverMappings.length} Active Mappings
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase font-heading text-white">
                {driverProfile.title}
              </h2>
              <p className="text-xs sm:text-sm text-marble/80 max-w-3xl leading-relaxed">
                {driverProfile.description}
              </p>
            </div>
            <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
              <div className="bg-black/40 border border-white/10 rounded-lg p-3 text-xs">
                <div className="text-[10px] uppercase font-black tracking-widest text-ares-gold/90 mb-1">
                  Primary Subsystems
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {driverProfile.subsystems.map((sub, idx) => (
                    <span
                      key={idx}
                      className="bg-white/5 text-marble/90 px-2 py-0.5 rounded text-[11px] font-medium border border-white/5"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid: Interactive Controller Visualizer + Action Inspector */}
        <div id="controls-panel" role="tabpanel" aria-labelledby={`tab-${activeDriver}`} className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          {/* Controller SVG Visualizer (7 Columns) */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="glass-card ares-cut p-6 border border-white/10 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Gamepad2 size={20} className="text-ares-gold" aria-hidden="true" />
                  <h3 className="text-base font-black uppercase tracking-wider text-white font-heading">
                    Controller Vector Layout
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-marble/60 uppercase">
                  Logitech F310 / Xbox 360 Mode
                </span>
              </div>

              {/* Interactive Vector Gamepad SVG */}
              <div className="relative w-full aspect-[600/400] flex items-center justify-center bg-black/50 rounded-xl border border-white/10 p-2 overflow-hidden">
                <GamepadSvgVisualizer
                  activeDriver={activeDriver}
                  selectedButtonId={selectedButtonId}
                  hoveredButtonId={hoveredButtonId}
                  onSelectButton={handleSelectButton}
                  onHoverButton={setHoveredButtonId}
                />

                {/* Floating Hover Mini Badge */}
                {hoveredMapping && (
                  <div
                    aria-live="polite"
                    className="absolute bottom-3 left-3 right-3 bg-obsidian/95 border border-ares-cyan/50 backdrop-blur-md rounded-lg p-2.5 shadow-xl flex items-center justify-between gap-3 text-xs animate-fade-in pointer-events-none"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold text-ares-cyan shrink-0">
                        {hoveredMapping.buttonLabel}:
                      </span>
                      <span className="text-white font-medium truncate">
                        {hoveredMapping.actionName}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${categoryColor(
                        hoveredMapping.category,
                      )}`}
                    >
                      {hoveredMapping.category}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Controller Button Selector Ribbon */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-[11px] font-black uppercase tracking-widest text-marble/60 mb-2">
                  Quick Select Control Target
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CONTROLLER_BUTTONS.map((btn) => {
                    const isSelected = selectedButtonId === btn.id;
                    const mapping = getMappingForButton(activeDriver, btn.id);
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => handleSelectButton(btn.id)}
                        onMouseEnter={() => setHoveredButtonId(btn.id)}
                        onMouseLeave={() => setHoveredButtonId(null)}
                        aria-label={`Select ${btn.name}: ${mapping?.actionName ?? "Unassigned"}`}
                        className={`px-2.5 py-1 text-xs font-bold rounded transition-all duration-150 border focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                          isSelected
                            ? "bg-ares-gold text-black border-ares-gold shadow-md shadow-ares-gold/20 scale-105"
                            : "bg-white/5 text-marble/80 border-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {btn.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Action Inspector Card (5 Columns) */}
          <div className="lg:col-span-5 flex flex-col">
            <div
              className="glass-card ares-cut p-6 border border-white/10 flex-1 flex flex-col"
              data-testid="action-inspector"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Activity size={20} className="text-ares-cyan" aria-hidden="true" />
                  <h3 className="text-base font-black uppercase tracking-wider text-white font-heading">
                    Action Inspector
                  </h3>
                </div>
                {selectedMapping && (
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${categoryColor(
                      selectedMapping.category,
                    )}`}
                  >
                    {selectedMapping.category}
                  </span>
                )}
              </div>

              {selectedMapping ? (
                <div className="space-y-5 flex-1 overflow-y-auto pr-1">
                  {/* Action Name & Button ID */}
                  <div>
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-ares-gold mb-1">
                      {selectedMapping.buttonLabel}
                    </div>
                    <h4 className="text-xl font-black uppercase font-heading text-white leading-snug">
                      {selectedMapping.actionName}
                    </h4>
                  </div>

                  {/* Primary Description */}
                  <div className="bg-white/5 rounded-lg p-3.5 border border-white/10 text-xs sm:text-sm text-marble/90 leading-relaxed">
                    {selectedMapping.description}
                  </div>

                  {/* Technical & Firmware Implementation */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-black uppercase tracking-widest text-marble/60 flex items-center gap-1.5">
                      <Cpu size={13} aria-hidden="true" /> Firmware & Math Model
                    </div>
                    <p className="text-xs text-marble/80 leading-relaxed font-mono bg-black/40 p-2.5 rounded border border-white/5">
                      {selectedMapping.technicalDetails}
                    </p>
                  </div>

                  {/* Input Response & Deadband Parameters */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 p-3 rounded border border-white/10">
                      <div className="text-[10px] font-black uppercase tracking-widest text-marble/60 flex items-center gap-1 mb-1">
                        <Gauge size={12} aria-hidden="true" /> Deadband
                      </div>
                      <div className="text-xs font-bold text-ares-cyan">
                        {selectedMapping.deadband}
                      </div>
                    </div>
                    <div className="bg-white/5 p-3 rounded border border-white/10">
                      <div className="text-[10px] font-black uppercase tracking-widest text-marble/60 flex items-center gap-1 mb-1">
                        <Sliders size={12} aria-hidden="true" /> Response Curve
                      </div>
                      <div className="text-xs font-bold text-ares-gold truncate">
                        {selectedMapping.responseCurve}
                      </div>
                    </div>
                  </div>

                  {/* Hardware Target */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-black uppercase tracking-widest text-marble/60 flex items-center gap-1.5">
                      <Layers size={13} aria-hidden="true" /> Hardware Target Actuator
                    </div>
                    <div className="text-xs font-medium text-marble/90 bg-white/5 p-2.5 rounded border border-white/10">
                      {selectedMapping.hardwareTarget}
                    </div>
                  </div>

                  {/* Safety Interlocks & Safeguards */}
                  {selectedMapping.safetyInterlocks && selectedMapping.safetyInterlocks.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-black uppercase tracking-widest text-ares-gold flex items-center gap-1.5">
                        <ShieldAlert size={13} aria-hidden="true" /> Automated Safety Interlocks
                      </div>
                      <ul className="space-y-2">
                        {selectedMapping.safetyInterlocks.map((safety, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-amber-200/90 bg-amber-950/30 border border-amber-500/30 rounded p-2.5 flex items-start gap-2"
                          >
                            <Lock size={14} className="text-ares-gold shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{safety}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Emergency Notes */}
                  {selectedMapping.emergencyNotes && (
                    <div className="bg-red-950/30 border border-red-500/30 rounded p-2.5 text-xs text-red-200 flex items-start gap-2">
                      <ShieldAlert size={14} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{selectedMapping.emergencyNotes}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-marble/60">
                  <Gamepad2 size={48} className="mb-4 text-marble/30 animate-pulse" aria-hidden="true" />
                  <p className="text-sm font-bold text-white uppercase tracking-wider mb-1">
                    Select a controller button
                  </p>
                  <p className="text-xs max-w-xs">
                    Click any stick, bumper, trigger, D-pad arrow, or face button on the controller graphic to inspect its telemetry profile.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Safety & Safeguard Overview Matrix */}
        <div className="glass-card ares-cut p-6 border border-white/10 mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-2 text-ares-gold text-xs font-black uppercase tracking-wider mb-1">
                <ShieldAlert size={16} aria-hidden="true" />
                Fail-Safe Telemetry Registry
              </div>
              <h3 className="text-xl font-black uppercase font-heading text-white">
                Active Safety Interlocks ({safetySummary.count})
              </h3>
            </div>
            <span className="text-xs text-marble/60">
              Automated current-limiting, anti-tip governors, and coordinate boundary protections.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {safetySummary.items.map((item, idx) => (
              <div
                key={idx}
                className="bg-black/40 border border-white/10 rounded-lg p-4 flex flex-col justify-between"
              >
                <div className="text-xs font-black uppercase tracking-wider text-white mb-2 font-heading">
                  {item.action}
                </div>
                <div className="space-y-1.5">
                  {item.interlocks.map((interlock, sIdx) => (
                    <div
                      key={sIdx}
                      className="text-xs text-marble/80 flex items-start gap-1.5 leading-relaxed"
                    >
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{interlock}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Complete Mappings Filterable Roster Table */}
        <div className="glass-card ares-cut p-6 border border-white/10 mb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-black uppercase font-heading text-white">
                Complete {driverProfile.name} Binding Matrix
              </h3>
              <p className="text-xs text-marble/70">
                Filter by subsystem or search specific functions to inspect drive behavior.
              </p>
            </div>

            {/* Search & Category Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px]">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/50"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search actions or hardware..."
                  aria-label="Search mapped driver actions"
                  className="w-full bg-black/60 border border-white/15 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-marble/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("All")}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                    selectedCategory === "All"
                      ? "bg-ares-red text-white"
                      : "bg-white/5 text-marble/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                      selectedCategory === cat
                        ? "bg-ares-red text-white"
                        : "bg-white/5 text-marble/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table of Controls */}
          {filteredMappings.length === 0 ? (
            <div className="text-center py-12 text-marble/60">
              <p className="text-sm font-bold uppercase tracking-wider">No matching controls found</p>
              <p className="text-xs mt-1">Try clearing your search query or choosing another category.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
                className="mt-3 text-xs text-ares-gold underline hover:text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-marble/60 uppercase tracking-widest text-[10px]">
                    <th className="py-3 px-3">Button / Input</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Robot Function</th>
                    <th className="py-3 px-3">Response & Deadband</th>
                    <th className="py-3 px-3">Hardware Target</th>
                    <th className="py-3 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredMappings.map((mapping) => {
                    const isSelected = selectedButtonId === mapping.buttonId;
                    return (
                      <tr
                        key={mapping.id}
                        onClick={() => handleSelectButton(mapping.buttonId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-white/10 text-white"
                            : "hover:bg-white/5 text-marble/80"
                        }`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-ares-gold">
                          {mapping.buttonLabel}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded border ${categoryColor(
                              mapping.category,
                            )}`}
                          >
                            {mapping.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-white">
                          <div>{mapping.actionName}</div>
                          <div className="text-[11px] font-normal text-marble/60 line-clamp-1">
                            {mapping.description}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          <div>{mapping.deadband}</div>
                          <div className="text-marble/50 text-[10px]">{mapping.responseCurve}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-marble/70">
                          {mapping.hardwareTarget}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            aria-label={`Inspect ${mapping.actionName}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectButton(mapping.buttonId);
                            }}
                            className="p-1.5 rounded hover:bg-white/10 text-ares-gold transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan"
                          >
                            <ChevronRight size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          PRINT-OPTIMIZED QUICK-REFERENCE DRIVER CARD VIEW (@media print)
          Formatted specifically for pocket laminate drive team reference cards.
         ========================================================================= */}
      <section
        className="driver-cards-print hidden print:block bg-white text-black p-4 max-w-4xl mx-auto font-sans"
        aria-label="Drive team laminated cheat sheet print layout"
      >
        <div className="border-4 border-black p-4 mb-4">
          <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">
                ARES 23247 FTC · DRIVE TEAM CHEAT SHEET
              </h1>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                Logitech F310 / Xbox 360 Tele-Op Controls Reference
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm font-black bg-black text-white px-2 py-0.5 uppercase">
                INTO THE DEEP / DECODE
              </div>
              <div className="text-[10px] font-mono mt-1">v2.4 Match Calibration</div>
            </div>
          </div>

          {/* Side-by-side Dual Driver Card Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Driver 1 Card */}
            <div className="border-2 border-black p-2.5">
              <div className="bg-black text-white text-xs font-black uppercase px-2 py-1 mb-2 flex justify-between">
                <span>DRIVER 1: FIELD PILOT</span>
                <span>CHASSIS / YAW</span>
              </div>
              <table className="w-full text-[11px] border-collapse">
                <tbody>
                  {CONTROL_MAPPINGS.filter((m) => m.driverId === "driver1").map((m) => (
                    <tr key={m.id} className="border-b border-gray-300">
                      <td className="font-bold py-1 pr-1 w-28 uppercase text-[10px] text-gray-900">
                        {m.buttonLabel.split(" (")[0]}
                      </td>
                      <td className="py-1 text-black font-semibold">{m.actionName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-[9px] font-bold border-t border-black pt-1 uppercase">
                CRITICAL: Emergency Brake = Button B | Re-Zero IMU = Stationary Button Y
              </div>
            </div>

            {/* Driver 2 Card */}
            <div className="border-2 border-black p-2.5">
              <div className="bg-black text-white text-xs font-black uppercase px-2 py-1 mb-2 flex justify-between">
                <span>DRIVER 2: SYSTEMS OPERATOR</span>
                <span>SLIDES / MANIPULATOR</span>
              </div>
              <table className="w-full text-[11px] border-collapse">
                <tbody>
                  {CONTROL_MAPPINGS.filter((m) => m.driverId === "driver2").map((m) => (
                    <tr key={m.id} className="border-b border-gray-300">
                      <td className="font-bold py-1 pr-1 w-28 uppercase text-[10px] text-gray-900">
                        {m.buttonLabel.split(" (")[0]}
                      </td>
                      <td className="py-1 text-black font-semibold">{m.actionName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-[9px] font-bold border-t border-black pt-1 uppercase">
                CRITICAL: Climb Lock = Hold Start+Back 1s in Endgame (Final 30s)
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/**
 * High-fidelity Vector SVG Gamepad Controller Visualizer
 */
interface GamepadSvgProps {
  activeDriver: DriverId;
  selectedButtonId: ButtonLocation | null;
  hoveredButtonId: ButtonLocation | null;
  onSelectButton: (btnId: ButtonLocation) => void;
  onHoverButton: (btnId: ButtonLocation | null) => void;
}

function GamepadSvgVisualizer({
  activeDriver,
  selectedButtonId,
  hoveredButtonId,
  onSelectButton,
  onHoverButton,
}: GamepadSvgProps) {
  const getButtonState = (id: ButtonLocation) => {
    const isSelected = selectedButtonId === id;
    const isHovered = hoveredButtonId === id;
    const mapping = getMappingForButton(activeDriver, id);
    return { isSelected, isHovered, mapping };
  };

  const interactiveClasses = (id: ButtonLocation) => {
    const { isSelected, isHovered } = getButtonState(id);
    return `cursor-pointer transition-all duration-200 outline-none ${
      isSelected
        ? "filter drop-shadow-[0_0_8px_rgba(0,229,255,0.9)]"
        : isHovered
        ? "filter drop-shadow-[0_0_5px_rgba(255,215,0,0.8)]"
        : "hover:opacity-90"
    }`;
  };

  return (
    <svg
      viewBox="0 0 640 420"
      className="w-full h-full max-h-[380px] select-none"
      role="img"
      aria-label="Interactive Gamepad Controller Visualizer"
    >
      <defs>
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22242b" />
          <stop offset="50%" stopColor="#141518" />
          <stop offset="100%" stopColor="#0c0d0e" />
        </linearGradient>
        <linearGradient id="gripGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2e313b" />
          <stop offset="100%" stopColor="#121316" />
        </linearGradient>
        <linearGradient id="stickGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3d424e" />
          <stop offset="100%" stopColor="#1e2026" />
        </linearGradient>
      </defs>

      {/* Controller Body Shell */}
      <g id="controller-body">
        {/* Shadow Outer */}
        <path
          d="M 170,75 C 240,70 400,70 470,75 C 550,85 600,160 595,290 C 590,365 520,395 470,365 C 430,340 390,335 320,335 C 250,335 210,340 170,365 C 120,395 50,365 45,290 C 40,160 90,85 170,75 Z"
          fill="url(#bodyGrad)"
          stroke="#3f434d"
          strokeWidth="3"
        />
        {/* Ergonomic Hand Grips */}
        <path
          d="M 65,240 C 55,290 85,360 145,370 C 170,375 180,345 160,300 C 140,255 100,230 65,240 Z"
          fill="url(#gripGrad)"
          stroke="#25272e"
          strokeWidth="1.5"
          opacity="0.8"
        />
        <path
          d="M 575,240 C 585,290 555,360 495,370 C 470,375 460,345 480,300 C 500,255 540,230 575,240 Z"
          fill="url(#gripGrad)"
          stroke="#25272e"
          strokeWidth="1.5"
          opacity="0.8"
        />
        {/* Center ARES Badge Accent */}
        <circle cx="320" cy="130" r="22" fill="#18191c" stroke="#cd7f32" strokeWidth="2" />
        <path d="M 320,116 L 330,138 L 310,138 Z" fill="#c00000" />
      </g>

      {/* Left Trigger (LT) */}
      <g
        id="btn-left-trigger"
        tabIndex={0}
        role="button"
        aria-label="Left Trigger"
        aria-pressed={selectedButtonId === "left_trigger"}
        className={interactiveClasses("left_trigger")}
        onClick={() => onSelectButton("left_trigger")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectButton("left_trigger");
          }
        }}
        onMouseEnter={() => onHoverButton("left_trigger")}
        onMouseLeave={() => onHoverButton(null)}
      >
        <path
          d="M 130,45 C 130,25 180,25 210,40 L 195,65 L 140,65 Z"
          fill={getButtonState("left_trigger").isSelected ? "#00E5FF" : "#2a2d36"}
          stroke={getButtonState("left_trigger").isSelected ? "#FFFFFF" : "#505666"}
          strokeWidth={getButtonState("left_trigger").isSelected ? "3" : "1.5"}
        />
        <text
          x="165"
          y="50"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fill={getButtonState("left_trigger").isSelected ? "#000000" : "#A0A6B5"}
        >
          LT
        </text>
      </g>

      {/* Right Trigger (RT) */}
      <g
        id="btn-right-trigger"
        tabIndex={0}
        role="button"
        aria-label="Right Trigger"
        aria-pressed={selectedButtonId === "right_trigger"}
        className={interactiveClasses("right_trigger")}
        onClick={() => onSelectButton("right_trigger")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectButton("right_trigger");
          }
        }}
        onMouseEnter={() => onHoverButton("right_trigger")}
        onMouseLeave={() => onHoverButton(null)}
      >
        <path
          d="M 510,45 C 510,25 460,25 430,40 L 445,65 L 500,65 Z"
          fill={getButtonState("right_trigger").isSelected ? "#00E5FF" : "#2a2d36"}
          stroke={getButtonState("right_trigger").isSelected ? "#FFFFFF" : "#505666"}
          strokeWidth={getButtonState("right_trigger").isSelected ? "3" : "1.5"}
        />
        <text
          x="475"
          y="50"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fill={getButtonState("right_trigger").isSelected ? "#000000" : "#A0A6B5"}
        >
          RT
        </text>
      </g>

      {/* Left Bumper (LB) */}
      <g
        id="btn-left-bumper"
        tabIndex={0}
        role="button"
        aria-label="Left Bumper"
        aria-pressed={selectedButtonId === "left_bumper"}
        className={interactiveClasses("left_bumper")}
        onClick={() => onSelectButton("left_bumper")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectButton("left_bumper");
          }
        }}
        onMouseEnter={() => onHoverButton("left_bumper")}
        onMouseLeave={() => onHoverButton(null)}
      >
        <rect
          x="145"
          y="68"
          width="90"
          height="24"
          rx="6"
          fill={getButtonState("left_bumper").isSelected ? "#00E5FF" : "#363a45"}
          stroke={getButtonState("left_bumper").isSelected ? "#FFFFFF" : "#60677a"}
          strokeWidth={getButtonState("left_bumper").isSelected ? "3" : "1.5"}
        />
        <text
          x="190"
          y="84"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fill={getButtonState("left_bumper").isSelected ? "#000000" : "#FFFFFF"}
        >
          LB
        </text>
      </g>

      {/* Right Bumper (RB) */}
      <g
        id="btn-right-bumper"
        tabIndex={0}
        role="button"
        aria-label="Right Bumper"
        aria-pressed={selectedButtonId === "right_bumper"}
        className={interactiveClasses("right_bumper")}
        onClick={() => onSelectButton("right_bumper")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectButton("right_bumper");
          }
        }}
        onMouseEnter={() => onHoverButton("right_bumper")}
        onMouseLeave={() => onHoverButton(null)}
      >
        <rect
          x="405"
          y="68"
          width="90"
          height="24"
          rx="6"
          fill={getButtonState("right_bumper").isSelected ? "#00E5FF" : "#363a45"}
          stroke={getButtonState("right_bumper").isSelected ? "#FFFFFF" : "#60677a"}
          strokeWidth={getButtonState("right_bumper").isSelected ? "3" : "1.5"}
        />
        <text
          x="450"
          y="84"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fill={getButtonState("right_bumper").isSelected ? "#000000" : "#FFFFFF"}
        >
          RB
        </text>
      </g>

      {/* Left Stick (LS) */}
      <g
        id="btn-left-stick"
        tabIndex={0}
        role="button"
        aria-label="Left Thumbstick"
        aria-pressed={selectedButtonId === "left_stick"}
        className={interactiveClasses("left_stick")}
        onClick={() => onSelectButton("left_stick")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectButton("left_stick");
          }
        }}
        onMouseEnter={() => onHoverButton("left_stick")}
        onMouseLeave={() => onHoverButton(null)}
      >
        <circle cx="195" cy="175" r="44" fill="#0f1012" stroke="#2a2d36" strokeWidth="3" />
        <circle
          cx="195"
          cy="175"
          r="34"
          fill="url(#stickGrad)"
          stroke={getButtonState("left_stick").isSelected ? "#00E5FF" : "#555b6a"}
          strokeWidth={getButtonState("left_stick").isSelected ? "4" : "2"}
        />
        <circle cx="195" cy="175" r="18" fill="#18191f" stroke="#333742" strokeWidth="1.5" />
        <path d="M 195,150 L 195,162 M 195,188 L 195,200 M 170,175 L 182,175 M 208,175 L 220,175" stroke="#7e8699" strokeWidth="2" strokeLinecap="round" />
        <text
          x="195"
          y="179"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fill={getButtonState("left_stick").isSelected ? "#00E5FF" : "#FFFFFF"}
        >
          LS
        </text>
      </g>

      {/* Right Stick (RS) */}
      <g
        id="btn-right-stick"
        tabIndex={0}
        role="button"
        aria-label="Right Thumbstick"
        aria-pressed={selectedButtonId === "right_stick"}
        className={interactiveClasses("right_stick")}
        onClick={() => onSelectButton("right_stick")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectButton("right_stick");
          }
        }}
        onMouseEnter={() => onHoverButton("right_stick")}
        onMouseLeave={() => onHoverButton(null)}
      >
        <circle cx="395" cy="255" r="44" fill="#0f1012" stroke="#2a2d36" strokeWidth="3" />
        <circle
          cx="395"
          cy="255"
          r="34"
          fill="url(#stickGrad)"
          stroke={getButtonState("right_stick").isSelected ? "#00E5FF" : "#555b6a"}
          strokeWidth={getButtonState("right_stick").isSelected ? "4" : "2"}
        />
        <circle cx="395" cy="255" r="18" fill="#18191f" stroke="#333742" strokeWidth="1.5" />
        <path d="M 395,230 L 395,242 M 395,268 L 395,280 M 370,255 L 382,255 M 408,255 L 420,255" stroke="#7e8699" strokeWidth="2" strokeLinecap="round" />
        <text
          x="395"
          y="259"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fill={getButtonState("right_stick").isSelected ? "#00E5FF" : "#FFFFFF"}
        >
          RS
        </text>
      </g>

      {/* D-Pad */}
      <g id="dpad-group">
        <circle cx="245" cy="255" r="46" fill="#111215" stroke="#2a2d36" strokeWidth="2" />

        {/* Up */}
        <g
          id="btn-dpad-up"
          tabIndex={0}
          role="button"
          aria-label="D-Pad Up"
          aria-pressed={selectedButtonId === "dpad_up"}
          className={interactiveClasses("dpad_up")}
          onClick={() => onSelectButton("dpad_up")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectButton("dpad_up");
            }
          }}
          onMouseEnter={() => onHoverButton("dpad_up")}
          onMouseLeave={() => onHoverButton(null)}
        >
          <path
            d="M 235,243 L 255,243 L 255,218 L 245,210 L 235,218 Z"
            fill={getButtonState("dpad_up").isSelected ? "#00E5FF" : "#2d303a"}
            stroke={getButtonState("dpad_up").isSelected ? "#FFFFFF" : "#555b6a"}
            strokeWidth={getButtonState("dpad_up").isSelected ? "2.5" : "1"}
          />
          <path d="M 245,218 L 240,226 L 250,226 Z" fill={getButtonState("dpad_up").isSelected ? "#000" : "#FFF"} />
        </g>

        {/* Down */}
        <g
          id="btn-dpad-down"
          tabIndex={0}
          role="button"
          aria-label="D-Pad Down"
          aria-pressed={selectedButtonId === "dpad_down"}
          className={interactiveClasses("dpad_down")}
          onClick={() => onSelectButton("dpad_down")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectButton("dpad_down");
            }
          }}
          onMouseEnter={() => onHoverButton("dpad_down")}
          onMouseLeave={() => onHoverButton(null)}
        >
          <path
            d="M 235,267 L 255,267 L 255,292 L 245,300 L 235,292 Z"
            fill={getButtonState("dpad_down").isSelected ? "#00E5FF" : "#2d303a"}
            stroke={getButtonState("dpad_down").isSelected ? "#FFFFFF" : "#555b6a"}
            strokeWidth={getButtonState("dpad_down").isSelected ? "2.5" : "1"}
          />
          <path d="M 245,292 L 240,284 L 250,284 Z" fill={getButtonState("dpad_down").isSelected ? "#000" : "#FFF"} />
        </g>

        {/* Left */}
        <g
          id="btn-dpad-left"
          tabIndex={0}
          role="button"
          aria-label="D-Pad Left"
          aria-pressed={selectedButtonId === "dpad_left"}
          className={interactiveClasses("dpad_left")}
          onClick={() => onSelectButton("dpad_left")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectButton("dpad_left");
            }
          }}
          onMouseEnter={() => onHoverButton("dpad_left")}
          onMouseLeave={() => onHoverButton(null)}
        >
          <path
            d="M 233,245 L 233,265 L 208,265 L 200,255 L 208,245 Z"
            fill={getButtonState("dpad_left").isSelected ? "#00E5FF" : "#2d303a"}
            stroke={getButtonState("dpad_left").isSelected ? "#FFFFFF" : "#555b6a"}
            strokeWidth={getButtonState("dpad_left").isSelected ? "2.5" : "1"}
          />
          <path d="M 208,255 L 216,250 L 216,260 Z" fill={getButtonState("dpad_left").isSelected ? "#000" : "#FFF"} />
        </g>

        {/* Right */}
        <g
          id="btn-dpad-right"
          tabIndex={0}
          role="button"
          aria-label="D-Pad Right"
          aria-pressed={selectedButtonId === "dpad_right"}
          className={interactiveClasses("dpad_right")}
          onClick={() => onSelectButton("dpad_right")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectButton("dpad_right");
            }
          }}
          onMouseEnter={() => onHoverButton("dpad_right")}
          onMouseLeave={() => onHoverButton(null)}
        >
          <path
            d="M 257,245 L 257,265 L 282,265 L 290,255 L 282,245 Z"
            fill={getButtonState("dpad_right").isSelected ? "#00E5FF" : "#2d303a"}
            stroke={getButtonState("dpad_right").isSelected ? "#FFFFFF" : "#555b6a"}
            strokeWidth={getButtonState("dpad_right").isSelected ? "2.5" : "1"}
          />
          <path d="M 282,255 L 274,250 L 274,260 Z" fill={getButtonState("dpad_right").isSelected ? "#000" : "#FFF"} />
        </g>

        <rect x="233" y="243" width="24" height="24" fill="#202228" />
      </g>

      {/* Button Y (Top / Yellow) */}
      <g
        id="btn-button-y"
        tabIndex={0}
        role="button"
        aria-label="Button Y"
        aria-pressed={selectedButtonId === "button_y"}
        className={interactiveClasses("button_y")}
        onClick={() => onSelectButton("button_y")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectButton("button_y");
          }
        }}
        onMouseEnter={() => onHoverButton("button_y")}
        onMouseLeave={() => onHoverButton(null)}
      >
        <circle
          cx="475"
          cy="135"
          r="16"
          fill="#F59E0B"
          stroke={getButtonState("button_y").isSelected ? "#FFFFFF" : "#78350F"}
          strokeWidth={getButtonState("button_y").isSelected ? "3.5" : "1.5"}
        />
        <text x="475" y="140" textAnchor="middle" fontSize="13" fontWeight="900" fill="#000000">
          Y
        </text>
      </g>

      {/* Button B (Right / Red) */}
      <g
        id="btn-button-b"
        tabIndex={0}
        role="button"
        aria-label="Button B"
        aria-pressed={selectedButtonId === "button_b"}
        className={interactiveClasses("button_b")}
        onClick={() => onSelectButton("button_b")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectButton("button_b");
          }
        }}
        onMouseEnter={() => onHoverButton("button_b")}
        onMouseLeave={() => onHoverButton(null)}
      >
        <circle
          cx="515"
          cy="175"
          r="16"
          fill="#EF4444"
          stroke={getButtonState("button_b").isSelected ? "#FFFFFF" : "#7F1D1D"}
          strokeWidth={getButtonState("button_b").isSelected ? "3.5" : "1.5"}
        />
        <text x="515" y="180" textAnchor="middle" fontSize="13" fontWeight="900" fill="#FFFFFF">
          B
        </text>
      </g>

      {/* Button A (Bottom / Green) */}
      <g
        id="btn-button-a"
        tabIndex={0}
        role="button"
        aria-label="Button A"
        aria-pressed={selectedButtonId === "button_a"}
        className={interactiveClasses("button_a")}
        onClick={() => onSelectButton("button_a")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectButton("button_a");
          }
        }}
        onMouseEnter={() => onHoverButton("button_a")}
        onMouseLeave={() => onHoverButton(null)}
      >
        <circle
          cx="475"
          cy="215"
          r="16"
          fill="#10B981"
          stroke={getButtonState("button_a").isSelected ? "#FFFFFF" : "#064E3B"}
          strokeWidth={getButtonState("button_a").isSelected ? "3.5" : "1.5"}
        />
        <text x="475" y="220" textAnchor="middle" fontSize="13" fontWeight="900" fill="#000000">
          A
        </text>
      </g>

      {/* Button X (Left / Blue) */}
      <g
        id="btn-button-x"
        tabIndex={0}
        role="button"
        aria-label="Button X"
        aria-pressed={selectedButtonId === "button_x"}
        className={interactiveClasses("button_x")}
        onClick={() => onSelectButton("button_x")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectButton("button_x");
          }
        }}
        onMouseEnter={() => onHoverButton("button_x")}
        onMouseLeave={() => onHoverButton(null)}
      >
        <circle
          cx="435"
          cy="175"
          r="16"
          fill="#3B82F6"
          stroke={getButtonState("button_x").isSelected ? "#FFFFFF" : "#1E3A8A"}
          strokeWidth={getButtonState("button_x").isSelected ? "3.5" : "1.5"}
        />
        <text x="435" y="180" textAnchor="middle" fontSize="13" fontWeight="900" fill="#FFFFFF">
          X
        </text>
      </g>

      {/* Button Back */}
      <g
        id="btn-button-back"
        tabIndex={0}
        role="button"
        aria-label="Back Button"
        aria-pressed={selectedButtonId === "button_back"}
        className={interactiveClasses("button_back")}
        onClick={() => onSelectButton("button_back")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectButton("button_back");
          }
        }}
        onMouseEnter={() => onHoverButton("button_back")}
        onMouseLeave={() => onHoverButton(null)}
      >
        <rect
          x="270"
          y="160"
          width="28"
          height="14"
          rx="4"
          fill={getButtonState("button_back").isSelected ? "#00E5FF" : "#363a45"}
          stroke={getButtonState("button_back").isSelected ? "#FFFFFF" : "#555b6a"}
          strokeWidth={getButtonState("button_back").isSelected ? "2.5" : "1"}
        />
        <text
          x="284"
          y="171"
          textAnchor="middle"
          fontSize="8"
          fontWeight="900"
          fill={getButtonState("button_back").isSelected ? "#000000" : "#FFFFFF"}
        >
          BACK
        </text>
      </g>

      {/* Button Start */}
      <g
        id="btn-button-start"
        tabIndex={0}
        role="button"
        aria-label="Start Button"
        aria-pressed={selectedButtonId === "button_start"}
        className={interactiveClasses("button_start")}
        onClick={() => onSelectButton("button_start")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectButton("button_start");
          }
        }}
        onMouseEnter={() => onHoverButton("button_start")}
        onMouseLeave={() => onHoverButton(null)}
      >
        <rect
          x="342"
          y="160"
          width="28"
          height="14"
          rx="4"
          fill={getButtonState("button_start").isSelected ? "#00E5FF" : "#363a45"}
          stroke={getButtonState("button_start").isSelected ? "#FFFFFF" : "#555b6a"}
          strokeWidth={getButtonState("button_start").isSelected ? "2.5" : "1"}
        />
        <text
          x="356"
          y="171"
          textAnchor="middle"
          fontSize="8"
          fontWeight="900"
          fill={getButtonState("button_start").isSelected ? "#000000" : "#FFFFFF"}
        >
          START
        </text>
      </g>
    </svg>
  );
}
