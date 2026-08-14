"use client";

import React, { useState, useMemo } from "react";
import { 
  BookOpen, 
  Search, 
  Layers, 
  Cpu, 
  Activity, 
  Printer, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  ChevronRight, 
  Sliders, 
  RotateCcw,
  Sparkles,
  Award,
  Zap
} from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import SEO from "@/components/SEO";
import {
  DESIGN_PROCESS_STAGES,
  SUBSYSTEM_ITERATIONS,
  NOTEBOOK_ENTRIES,
  calculateNotebookMetrics,
  filterNotebookEntries,
  getAllNotebookTags,
  getAllAuthorRoles,
  getSubsystemTimeline,
  type SubsystemIteration,
} from "@/lib/engineeringNotebookData";

type ActiveTab = "stages" | "subsystems" | "reader" | "portfolio";

export default function EngineeringNotebookPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("stages");
  const [selectedStageId, setSelectedStageId] = useState<string>("problem-statement");
  const [selectedSubsystem, setSelectedSubsystem] = useState<SubsystemIteration["subsystemName"]>("Intake Mechanism");
  
  // Search and filter states for Chapter & Entry Reader
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("all");
  const [selectedStageFilter, setSelectedStageFilter] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedAuthorRole, setSelectedAuthorRole] = useState("all");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>("entry-01");

  // Calculated aggregated metrics
  const metrics = useMemo(() => calculateNotebookMetrics(), []);
  const allTags = useMemo(() => getAllNotebookTags(), []);
  const allRoles = useMemo(() => getAllAuthorRoles(), []);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return filterNotebookEntries(NOTEBOOK_ENTRIES, {
      query: searchQuery,
      chapterId: selectedChapter,
      stageId: selectedStageFilter,
      tag: selectedTag,
      authorRole: selectedAuthorRole,
    });
  }, [searchQuery, selectedChapter, selectedStageFilter, selectedTag, selectedAuthorRole]);

  // Current active stage for deep-dive
  const currentStage = useMemo(() => {
    return DESIGN_PROCESS_STAGES.find((s) => s.id === selectedStageId) || DESIGN_PROCESS_STAGES[0];
  }, [selectedStageId]);

  // Current subsystem timeline
  const currentTimeline = useMemo(() => {
    return getSubsystemTimeline(selectedSubsystem);
  }, [selectedSubsystem]);

  const handlePrint = () => {
    setActiveTab("portfolio");
    if (typeof window !== "undefined" && typeof window.print === "function") {
      window.print();
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedChapter("all");
    setSelectedStageFilter("all");
    setSelectedTag("all");
    setSelectedAuthorRole("all");
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble print:bg-white print:text-black">
      <SEO 
        title="Engineering Notebook & Design Process" 
        description="Explore the interactive ARES 23247 Engineering Notebook, iterative CAD/FEA simulation logs, subsystem timelines, and championship design rationales."
      />

      {/* Screen-Only Header & Hero Banner */}
      <section className="py-20 md:py-28 bg-obsidian relative overflow-hidden flex items-center print:hidden border-b border-white/5">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute top-0 left-0" />
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10 w-full">
          <div className="inline-flex items-center gap-2 bg-ares-red/20 border border-ares-red/40 px-3 py-1 ares-cut-sm text-[10px] font-black uppercase tracking-widest text-ares-gold mb-6">
            <Award size={14} className="text-ares-gold" />
            FTC Championship Engineering Exhibit
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading">
            Engineering <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-xl text-white">Notebook</span>
          </h1>

          <p className="text-marble/85 text-base md:text-lg max-w-3xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-4">
            Documenting the engineering design process of <strong>ARES #23247</strong>. From initial game theory breakdown and CAD finite element simulations to high-speed intake iterations and championship field-tested software control loops.
          </p>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
            <button
              onClick={handlePrint}
              type="button"
              className="clipped-button bg-ares-red text-white hover:bg-ares-bronze font-black text-xs uppercase tracking-widest py-3 px-6 inline-flex items-center gap-2 shadow-lg hover:scale-105 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              aria-label="Print or download Engineering Design Portfolio"
            >
              <Printer size={16} />
              Print / Export Portfolio PDF
            </button>
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2.5 ares-cut-sm text-xs font-bold text-marble/80">
              <ShieldCheck size={16} className="text-ares-cyan" />
              Zero-PII Verified · Official Judge Format
            </div>
          </div>
        </div>
      </section>

      {/* Engineering Metrics Dashboard Cards */}
      <section className="py-12 bg-black/20 border-b border-white/5 print:py-4 print:border-b-2 print:border-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white/5 border border-white/10 p-5 rounded-xl text-center hero-card hover:border-ares-red/50 transition-all print:border-gray-300 print:bg-gray-50">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ares-gold font-bold mb-1">
                Subsystem Iterations
              </p>
              <div className="text-3xl md:text-4xl font-black text-white font-heading print:text-black">
                {metrics.totalIterations}+
              </div>
              <p className="text-[11px] text-marble/60 mt-1 print:text-gray-600">v1 Prototype to v4 Active</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-5 rounded-xl text-center hero-card hover:border-ares-gold/50 transition-all print:border-gray-300 print:bg-gray-50">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ares-gold font-bold mb-1">
                CAD Parts Designed
              </p>
              <div className="text-3xl md:text-4xl font-black text-white font-heading print:text-black">
                {metrics.cadPartsDesigned}+
              </div>
              <p className="text-[11px] text-marble/60 mt-1 print:text-gray-600">Onshape Digital Assemblies</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-5 rounded-xl text-center hero-card hover:border-ares-cyan/50 transition-all print:border-gray-300 print:bg-gray-50">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ares-gold font-bold mb-1">
                Engineering Hours Logged
              </p>
              <div className="text-3xl md:text-4xl font-black text-white font-heading print:text-black">
                {metrics.totalHoursLogged.toLocaleString()}+
              </div>
              <p className="text-[11px] text-marble/60 mt-1 print:text-gray-600">Design, Fab & Testing</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-5 rounded-xl text-center hero-card hover:border-ares-bronze/50 transition-all print:border-gray-300 print:bg-gray-50">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ares-gold font-bold mb-1">
                Bench & Match Trials
              </p>
              <div className="text-3xl md:text-4xl font-black text-white font-heading print:text-black">
                {metrics.prototypeTestsCompleted}+
              </div>
              <p className="text-[11px] text-marble/60 mt-1 print:text-gray-600">{metrics.averageSuccessRate}% Target Success</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Tabs Navigation (Hidden when printing) */}
      <nav aria-label="Engineering Notebook Navigation" className="sticky top-20 z-30 bg-obsidian/95 backdrop-blur border-b border-white/10 py-4 print:hidden">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between overflow-x-auto gap-4 scrollbar-none">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {[
              { id: "stages", label: "1. Design Process Stages", icon: Layers },
              { id: "subsystems", label: "2. Subsystem Iterations", icon: Cpu },
              { id: "reader", label: "3. Chapter & Entry Reader", icon: BookOpen },
              { id: "portfolio", label: "4. Portfolio Binder View", icon: Award },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                    isActive
                      ? "bg-ares-red text-white shadow-lg shadow-ares-red/20 scale-105"
                      : "bg-white/5 text-marble/70 hover:text-white hover:bg-white/10"
                  }`}
                  role="tab"
                  aria-selected={isActive}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[10px] font-mono text-marble/40 uppercase hidden lg:block tracking-widest">
            ARES #23247 Design Engine
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main id="notebook-exhibit-content" className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full print:p-0">

        {/* TAB 1: DESIGN PROCESS STAGES */}
        {activeTab === "stages" && (
          <section className="space-y-12 animate-fade-in" aria-label="Design Process Stages">
            <div className="border-b border-white/10 pb-6">
              <h2 className="text-2xl md:text-3xl font-black uppercase text-white font-heading tracking-tight">
                Iterative Engineering Design Process
              </h2>
              <p className="text-xs text-marble/60 uppercase tracking-widest mt-1">
                Click any milestone stage to explore engineering principles, calculations, and deliverables
              </p>
            </div>

            {/* Stages Step Timeline */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {DESIGN_PROCESS_STAGES.map((stage) => {
                const isSelected = selectedStageId === stage.id;
                return (
                  <button
                    key={stage.id}
                    onClick={() => setSelectedStageId(stage.id)}
                    className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                      isSelected
                        ? "bg-ares-red/10 border-ares-red shadow-lg shadow-ares-red/10 scale-102"
                        : "bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/8"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded ${isSelected ? "bg-ares-red text-white" : "bg-white/10 text-marble/60"}`}>
                          STAGE 0{stage.stageNumber}
                        </span>
                        <ChevronRight size={14} className={`transition-transform ${isSelected ? "rotate-90 text-ares-gold" : "text-white/20 group-hover:translate-x-1"}`} />
                      </div>
                      <h3 className="text-xs font-black uppercase font-heading text-white line-clamp-2">
                        {stage.title}
                      </h3>
                    </div>
                    <div className="text-[10px] text-marble/50 mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                      <span>{stage.metricsSummary.totalHours} hrs</span>
                      <span>{stage.metricsSummary.totalEntries} logs</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Stage Detail Card */}
            <article className="glass-card ares-cut border border-white/15 p-8 md:p-10 relative overflow-hidden bg-black/40 shadow-2xl">
              <div className="flex flex-col lg:flex-row gap-8 justify-between items-start">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="bg-ares-red text-white text-xs font-black px-3 py-1 ares-cut-sm uppercase">
                      Stage {currentStage.stageNumber} Deep-Dive
                    </span>
                    <span className="text-xs font-mono text-ares-gold font-semibold uppercase tracking-wider">
                      {currentStage.subtitle}
                    </span>
                  </div>

                  <h3 className="text-2xl md:text-4xl font-black text-white uppercase font-heading tracking-tight">
                    {currentStage.title}
                  </h3>

                  <p className="text-sm md:text-base text-marble/85 leading-relaxed">
                    {currentStage.fullOverview}
                  </p>
                </div>

                <div className="w-full lg:w-80 bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4 shrink-0">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-ares-cyan flex items-center gap-2">
                    <Activity size={14} /> Stage Impact Metrics
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-marble/60">Dedicated Hours</span>
                      <span className="font-bold text-white font-mono">{currentStage.metricsSummary.totalHours} hrs</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-marble/60">Documentation Logs</span>
                      <span className="font-bold text-white font-mono">{currentStage.metricsSummary.totalEntries} entries</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-marble/60">Subsystems Analyzed</span>
                      <span className="font-bold text-white font-mono">{currentStage.metricsSummary.subsystemsInvolved} modules</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Engineering Principles & Deliverables Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-8 border-t border-white/10">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-ares-gold flex items-center gap-2">
                    <Zap size={14} /> Core Engineering Principles Applied
                  </h4>
                  <ul className="space-y-2">
                    {currentStage.engineeringPrinciples.map((principle, idx) => (
                      <li key={idx} className="text-xs text-marble/80 flex items-start gap-2 bg-white/5 p-2.5 rounded-lg border border-white/5">
                        <CheckCircle2 size={14} className="text-ares-gold shrink-0 mt-0.5" />
                        <span>{principle}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-ares-cyan flex items-center gap-2">
                    <CheckCircle2 size={14} /> Technical Deliverables & Milestones
                  </h4>
                  <ul className="space-y-2">
                    {currentStage.deliverables.map((deliverable, idx) => (
                      <li key={idx} className="text-xs text-marble/80 flex items-start gap-2 bg-white/5 p-2.5 rounded-lg border border-white/5">
                        <ChevronRight size={14} className="text-ares-cyan shrink-0 mt-0.5" />
                        <span>{deliverable}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Stage Quick Switch to Reader */}
              <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedStageFilter(currentStage.id);
                    setActiveTab("reader");
                  }}
                  className="clipped-button bg-ares-red/80 hover:bg-ares-red text-white text-xs font-black uppercase tracking-wider py-2.5 px-5 inline-flex items-center gap-2"
                >
                  <Search size={14} /> Read Stage {currentStage.stageNumber} Technical Logs ({currentStage.metricsSummary.totalEntries})
                </button>
              </div>
            </article>
          </section>
        )}

        {/* TAB 2: SUBSYSTEM ITERATIONS */}
        {activeTab === "subsystems" && (
          <section className="space-y-10 animate-fade-in" aria-label="Subsystem Iterations">
            <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black uppercase text-white font-heading tracking-tight">
                  Subsystem Evolution & Prototyping Timeline
                </h2>
                <p className="text-xs text-marble/60 uppercase tracking-widest mt-1">
                  Empirical cycle-time testing, failure mode analyses, and progressive mechanism refinement
                </p>
              </div>

              {/* Subsystem Picker */}
              <div className="flex items-center gap-2">
                <label htmlFor="subsystem-select" className="text-xs text-marble/60 font-bold uppercase tracking-wider">
                  Subsystem:
                </label>
                <select
                  id="subsystem-select"
                  value={selectedSubsystem}
                  onChange={(e) => setSelectedSubsystem(e.target.value as SubsystemIteration["subsystemName"])}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-ares-cyan"
                >
                  <option value="Intake Mechanism" className="bg-obsidian">Intake Mechanism (v1 -&gt; v4)</option>
                  <option value="Linear Slide Lift" className="bg-obsidian">Linear Slide Lift (v1 -&gt; v2)</option>
                </select>
              </div>
            </div>

            {/* Subsystem Progression Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {currentTimeline.map((iteration) => {
                const isVerified = iteration.status === "Field Verified";
                return (
                  <article
                    key={iteration.id}
                    className={`glass-card ares-cut border p-6 md:p-8 flex flex-col justify-between relative overflow-hidden transition-all ${
                      isVerified
                        ? "border-ares-gold/60 bg-ares-gold/5 shadow-2xl shadow-ares-gold/10"
                        : "border-white/10 bg-white/5 opacity-90"
                    }`}
                  >
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
                        <div>
                          <span className={`text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded ${
                            isVerified ? "bg-ares-gold text-black" : "bg-white/10 text-marble/60"
                          }`}>
                            {iteration.version}
                          </span>
                          <h3 className="text-lg md:text-xl font-black text-white uppercase font-heading mt-2">
                            {iteration.title}
                          </h3>
                        </div>
                        <span className={`text-xs font-bold uppercase px-3 py-1 ares-cut-sm ${
                          isVerified ? "bg-ares-red text-white" : "bg-white/10 text-marble/60"
                        }`}>
                          {iteration.status}
                        </span>
                      </div>

                      <p className="text-xs text-marble/80 leading-relaxed">
                        {iteration.description}
                      </p>

                      {/* Bench Test Stats */}
                      <div className="grid grid-cols-3 gap-3 bg-black/40 p-4 rounded-xl border border-white/5 text-center font-mono">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-marble/40">Cycle Time</p>
                          <p className="text-sm md:text-base font-bold text-ares-gold mt-0.5">{iteration.benchTestMetrics.cycleTimeSec}s</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-marble/40">Success Rate</p>
                          <p className="text-sm md:text-base font-bold text-ares-cyan mt-0.5">{iteration.benchTestMetrics.successRatePercent}%</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-marble/40">Weight</p>
                          <p className="text-sm md:text-base font-bold text-white mt-0.5">{iteration.benchTestMetrics.weightGrams}g</p>
                        </div>
                      </div>

                      {/* Improvements & Failure Modes */}
                      <div className="space-y-3 pt-2">
                        <div>
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-ares-cyan mb-1.5 flex items-center gap-1.5">
                            <Sparkles size={13} /> Engineering Upgrades
                          </h4>
                          <ul className="space-y-1">
                            {iteration.improvements.map((imp, idx) => (
                              <li key={idx} className="text-xs text-marble/75 flex items-start gap-2">
                                <span className="text-ares-cyan font-bold">•</span>
                                <span>{imp}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {iteration.failureModesIdentified.length > 0 && (
                          <div className="pt-2">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-ares-red mb-1.5 flex items-center gap-1.5">
                              <AlertCircle size={13} /> Failure Modes & Diagnostics
                            </h4>
                            <ul className="space-y-1">
                              {iteration.failureModesIdentified.map((fail, idx) => (
                                <li key={idx} className="text-xs text-marble/75 flex items-start gap-2">
                                  <span className="text-ares-red font-bold">✕</span>
                                  <span>{fail}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Trade-off Matrix */}
                    <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-2 gap-4 text-[11px]">
                      <div>
                        <span className="text-emerald-400 font-bold uppercase block mb-1">Pros:</span>
                        <p className="text-marble/70">{iteration.pros.join(" · ")}</p>
                      </div>
                      <div>
                        <span className="text-ares-red font-bold uppercase block mb-1">Cons:</span>
                        <p className="text-marble/70">{iteration.cons.join(" · ")}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 3: CHAPTER & ENTRY READER */}
        {activeTab === "reader" && (
          <section className="space-y-8 animate-fade-in" aria-label="Engineering Entry Reader">
            <div className="border-b border-white/10 pb-6">
              <h2 className="text-2xl md:text-3xl font-black uppercase text-white font-heading tracking-tight">
                Searchable Chapter & Technical Entry Reader
              </h2>
              <p className="text-xs text-marble/60 uppercase tracking-widest mt-1">
                Filter official design rationale entries, equations, author roles, and physics simulations
              </p>
            </div>

            {/* Search & Filter Controls */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4 bg-black/30">
              {/* Search Bar */}
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-marble/40" />
                <input
                  type="text"
                  placeholder="Search entries by keyword, math equation, tag, or author role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl pl-12 pr-4 py-3.5 text-xs text-white placeholder-marble/40 focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-all"
                  aria-label="Search engineering notebook entries"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-marble/50 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Filter Selectors Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                <div>
                  <label htmlFor="chapter-filter" className="text-[10px] font-mono uppercase tracking-widest text-marble/60 block mb-1">
                    Chapter
                  </label>
                  <select
                    id="chapter-filter"
                    value={selectedChapter}
                    onChange={(e) => setSelectedChapter(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-ares-cyan"
                  >
                    <option value="all" className="bg-obsidian">All Chapters</option>
                    <option value="strategy" className="bg-obsidian">Game Strategy</option>
                    <option value="cad-fea" className="bg-obsidian">CAD & FEA Simulations</option>
                    <option value="mechanisms" className="bg-obsidian">Mechanism Design</option>
                    <option value="software-controls" className="bg-obsidian">Software & Controls</option>
                    <option value="field-ops" className="bg-obsidian">Field & Pit Operations</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="stage-filter" className="text-[10px] font-mono uppercase tracking-widest text-marble/60 block mb-1">
                    Process Stage
                  </label>
                  <select
                    id="stage-filter"
                    value={selectedStageFilter}
                    onChange={(e) => setSelectedStageFilter(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-ares-cyan"
                  >
                    <option value="all" className="bg-obsidian">All Stages (1-6)</option>
                    {DESIGN_PROCESS_STAGES.map((s) => (
                      <option key={s.id} value={s.id} className="bg-obsidian">
                        Stage {s.stageNumber}: {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="tag-filter" className="text-[10px] font-mono uppercase tracking-widest text-marble/60 block mb-1">
                    Engineering Tag
                  </label>
                  <select
                    id="tag-filter"
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-ares-cyan"
                  >
                    <option value="all" className="bg-obsidian">All Tags</option>
                    {allTags.map((t) => (
                      <option key={t} value={t} className="bg-obsidian">{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="role-filter" className="text-[10px] font-mono uppercase tracking-widest text-marble/60 block mb-1">
                    Author Role (Zero-PII)
                  </label>
                  <select
                    id="role-filter"
                    value={selectedAuthorRole}
                    onChange={(e) => setSelectedAuthorRole(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-ares-cyan"
                  >
                    <option value="all" className="bg-obsidian">All Engineering Roles</option>
                    {allRoles.map((r) => (
                      <option key={r} value={r} className="bg-obsidian">{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Filter Indicators & Reset */}
              {(selectedChapter !== "all" || selectedStageFilter !== "all" || selectedTag !== "all" || selectedAuthorRole !== "all" || searchQuery !== "") && (
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-marble/60">
                  <span>Found {filteredEntries.length} matching entries</span>
                  <button
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 text-ares-gold hover:underline font-bold"
                  >
                    <RotateCcw size={12} /> Reset all filters
                  </button>
                </div>
              )}
            </div>

            {/* Entries List */}
            {filteredEntries.length === 0 ? (
              <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10 p-8">
                <Filter size={40} className="mx-auto text-marble/30 mb-4" />
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">No matching entries found</h3>
                <p className="text-xs text-marble/60 mt-1 mb-6">Try refining your search query or resetting filters.</p>
                <button onClick={handleResetFilters} className="clipped-button bg-ares-red text-white text-xs font-black uppercase py-2.5 px-6">
                  Reset Search Filters
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredEntries.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id;
                  return (
                    <article
                      key={entry.id}
                      className={`glass-card ares-cut border transition-all overflow-hidden ${
                        isExpanded ? "border-white/25 bg-white/8 shadow-2xl" : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}
                    >
                      {/* Entry Header Accordion Trigger */}
                      <button
                        onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                        className="w-full text-left p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                        aria-expanded={isExpanded}
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-ares-red text-white text-[10px] font-black px-2.5 py-0.5 ares-cut-sm font-mono">
                              {entry.entryNumber}
                            </span>
                            <span className="text-[10px] font-mono text-ares-gold font-bold">
                              {entry.date}
                            </span>
                            <span className="text-[10px] bg-white/10 text-marble/80 px-2 py-0.5 rounded font-medium">
                              {entry.authorRole}
                            </span>
                          </div>

                          <h3 className="text-lg md:text-2xl font-black text-white uppercase font-heading tracking-tight">
                            {entry.title}
                          </h3>

                          <p className="text-xs text-marble/75 line-clamp-2">
                            {entry.summary}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                          <div className="flex flex-wrap gap-1.5 max-w-xs justify-end hidden sm:flex">
                            {entry.tags.map((t) => (
                              <span key={t} className="text-[9px] bg-white/5 border border-white/10 text-marble/60 px-2 py-0.5 rounded font-mono">
                                #{t}
                              </span>
                            ))}
                          </div>
                          <div className={`w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white transition-transform ${isExpanded ? "rotate-90 bg-ares-red" : ""}`}>
                            <ChevronRight size={16} />
                          </div>
                        </div>
                      </button>

                      {/* Expanded Entry Deep Content */}
                      {isExpanded && (
                        <div className="px-6 md:px-8 pb-8 pt-2 border-t border-white/10 space-y-8 animate-fade-in text-xs">
                          {/* Decision Rationale Section */}
                          <div className="bg-black/40 p-6 rounded-xl border border-white/10 space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-ares-gold flex items-center gap-2 font-heading">
                              <Sliders size={14} /> Design Decision Rationale & Trade-Study
                            </h4>
                            
                            <div className="space-y-2">
                              <p className="text-marble/60 font-bold uppercase text-[10px]">Problem Statement:</p>
                              <p className="text-marble/90 bg-white/5 p-3 rounded border border-white/5">{entry.rationale.problemStatement}</p>
                            </div>

                            <div className="space-y-2">
                              <p className="text-marble/60 font-bold uppercase text-[10px]">Options Considered:</p>
                              <ul className="space-y-1.5 pl-2">
                                {entry.rationale.optionsConsidered.map((opt, i) => (
                                  <li key={i} className="text-marble/80 flex items-start gap-2">
                                    <span className="text-ares-cyan">▹</span>
                                    <span>{opt}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                              <div className="bg-ares-red/10 border border-ares-red/30 p-3 rounded">
                                <span className="text-ares-gold font-bold uppercase text-[10px] block mb-1">Selected Design:</span>
                                <p className="text-white font-semibold">{entry.rationale.selectedChoice}</p>
                                <p className="text-marble/75 mt-2 text-[11px]">{entry.rationale.rationale}</p>
                              </div>
                              <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded">
                                <span className="text-emerald-400 font-bold uppercase text-[10px] block mb-1">Empirical Result & Validation:</span>
                                <p className="text-marble/90 text-[11px]">{entry.rationale.empiricalOutcome}</p>
                              </div>
                            </div>
                          </div>

                          {/* Math Calculations & Physics Section */}
                          {entry.mathCalculations && entry.mathCalculations.length > 0 && (
                            <div className="bg-black/40 p-6 rounded-xl border border-white/10 space-y-4">
                              <h4 className="text-xs font-black uppercase tracking-widest text-ares-cyan flex items-center gap-2 font-heading">
                                <Cpu size={14} /> Mathematical Model & Physics Calculations
                              </h4>
                              {entry.mathCalculations.map((calc, idx) => (
                                <div key={idx} className="space-y-3 bg-white/5 p-4 rounded-lg border border-white/5 font-mono">
                                  <p className="text-ares-gold font-bold uppercase text-xs">{calc.title}</p>
                                  <div className="bg-black/60 p-3 rounded border border-white/10 text-white font-mono text-sm overflow-x-auto">
                                    {calc.formula}
                                  </div>
                                  <p className="text-marble/70 text-[11px] font-sans">{calc.explanation}</p>
                                  
                                  <div className="pt-2 border-t border-white/5 text-[10px]">
                                    <span className="text-marble/50 uppercase block mb-1 font-sans font-bold">Variables & Parameters:</span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {Object.entries(calc.variables).map(([k, v]) => (
                                        <div key={k} className="flex gap-2">
                                          <span className="text-ares-cyan font-bold">{k}:</span>
                                          <span className="text-marble/80">{v}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Key Takeaways & Log Metadata */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-white/10 text-[11px] text-marble/60">
                            <div className="space-y-1">
                              <span className="font-bold text-white uppercase text-[10px] block">Key Engineering Takeaways:</span>
                              <ul className="space-y-1">
                                {entry.keyTakeaways.map((takeaway, idx) => (
                                  <li key={idx} className="flex items-center gap-2 text-marble/80">
                                    <CheckCircle2 size={12} className="text-ares-gold" />
                                    <span>{takeaway}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="flex gap-4 font-mono bg-white/5 p-3 rounded-lg border border-white/5 shrink-0 self-stretch sm:self-auto justify-around">
                              <div>
                                <span className="text-[9px] uppercase block text-marble/40">Logged Time</span>
                                <span className="font-bold text-white">{entry.hoursSpent} hrs</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase block text-marble/40">Trials</span>
                                <span className="font-bold text-ares-gold">{entry.testTrialsCount} runs</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase block text-marble/40">CAD Parts</span>
                                <span className="font-bold text-ares-cyan">{entry.cadPartsReferenced}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 4: PORTFOLIO BINDER VIEW */}
        {activeTab === "portfolio" && (
          <section className="space-y-10 animate-fade-in" aria-label="Design Portfolio Binder View">
            {/* Binder Header */}
            <div className="border-b-2 border-ares-red pb-6 print:border-black">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-ares-gold print:text-gray-700 font-bold">
                    FIRST® Tech Challenge #23247 · Morgantown, WV
                  </p>
                  <h2 className="text-3xl md:text-5xl font-black uppercase text-white print:text-black font-heading tracking-tight mt-1">
                    Engineering Design Portfolio
                  </h2>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="text-xs font-mono bg-ares-red text-white px-3 py-1 font-black uppercase print:bg-black">
                    Official Judge Copy
                  </span>
                </div>
              </div>
              <p className="text-sm text-marble/80 print:text-gray-800 mt-4 leading-relaxed">
                Executive design overview documenting robot architecture, finite element calculations, iterative testing loops, and competitive match outcomes.
              </p>
            </div>

            {/* Executive Summary Matrix */}
            <div className="glass-card p-6 rounded-xl border border-white/15 print:border-gray-400 print:bg-white print:p-4">
              <h3 className="text-lg font-black uppercase text-white print:text-black font-heading mb-4 border-b border-white/10 print:border-gray-300 pb-2">
                I. Executive Engineering Metrics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center font-mono">
                <div className="p-3 bg-white/5 rounded border border-white/10 print:border-gray-300 print:bg-gray-50">
                  <p className="text-[10px] uppercase text-marble/50 print:text-gray-600">Total Iterations</p>
                  <p className="text-2xl font-black text-white print:text-black mt-1">{metrics.totalIterations}</p>
                </div>
                <div className="p-3 bg-white/5 rounded border border-white/10 print:border-gray-300 print:bg-gray-50">
                  <p className="text-[10px] uppercase text-marble/50 print:text-gray-600">CAD Models</p>
                  <p className="text-2xl font-black text-white print:text-black mt-1">{metrics.cadPartsDesigned}+</p>
                </div>
                <div className="p-3 bg-white/5 rounded border border-white/10 print:border-gray-300 print:bg-gray-50">
                  <p className="text-[10px] uppercase text-marble/50 print:text-gray-600">Engineering Hours</p>
                  <p className="text-2xl font-black text-white print:text-black mt-1">{metrics.totalHoursLogged}h</p>
                </div>
                <div className="p-3 bg-white/5 rounded border border-white/10 print:border-gray-300 print:bg-gray-50">
                  <p className="text-[10px] uppercase text-marble/50 print:text-gray-600">Auto Reliability</p>
                  <p className="text-2xl font-black text-white print:text-black mt-1">{metrics.averageSuccessRate}%</p>
                </div>
              </div>
            </div>

            {/* Subsystem Iteration Evolution Table */}
            <div className="glass-card p-6 rounded-xl border border-white/15 print:border-gray-400 print:bg-white print:p-4">
              <h3 className="text-lg font-black uppercase text-white print:text-black font-heading mb-4 border-b border-white/10 print:border-gray-300 pb-2">
                II. Subsystem Prototyping Evolution Matrix
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="border-b border-white/15 print:border-gray-400 text-[10px] font-mono uppercase text-ares-gold print:text-gray-800">
                      <th className="py-2.5 px-3">Subsystem & Version</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Cycle Time</th>
                      <th className="py-2.5 px-3">Success Rate</th>
                      <th className="py-2.5 px-3">Mass</th>
                      <th className="py-2.5 px-3">Key Design Upgrades</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 print:divide-gray-300">
                    {SUBSYSTEM_ITERATIONS.map((it) => (
                      <tr key={it.id} className="hover:bg-white/5 print:hover:bg-transparent">
                        <td className="py-3 px-3 font-bold text-white print:text-black">
                          {it.subsystemName} ({it.version})
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 text-[9px] rounded font-mono font-bold ${
                            it.status === "Field Verified" ? "bg-emerald-900/60 text-emerald-300 print:bg-gray-200 print:text-black" : "bg-white/10 text-marble/60 print:bg-gray-100 print:text-gray-700"
                          }`}>
                            {it.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-ares-gold print:text-black">{it.benchTestMetrics.cycleTimeSec}s</td>
                        <td className="py-3 px-3 font-mono text-ares-cyan print:text-black">{it.benchTestMetrics.successRatePercent}%</td>
                        <td className="py-3 px-3 font-mono text-marble print:text-black">{it.benchTestMetrics.weightGrams}g</td>
                        <td className="py-3 px-3 text-marble/80 print:text-gray-800">{it.improvements.join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Core Decision Rationale Summary */}
            <div className="glass-card p-6 rounded-xl border border-white/15 print:border-gray-400 print:bg-white print:p-4 space-y-6">
              <h3 className="text-lg font-black uppercase text-white print:text-black font-heading mb-4 border-b border-white/10 print:border-gray-300 pb-2">
                III. Key Design Decisions & Physical Equations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {NOTEBOOK_ENTRIES.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="bg-white/5 p-4 rounded-lg border border-white/10 print:border-gray-300 print:bg-gray-50 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="font-bold text-ares-red print:text-black">{entry.entryNumber}</span>
                      <span className="text-marble/50 print:text-gray-600">{entry.authorRole}</span>
                    </div>
                    <h4 className="font-bold text-white print:text-black text-sm uppercase font-heading">{entry.title}</h4>
                    <p className="text-[11px] text-marble/80 print:text-gray-800">{entry.rationale.rationale}</p>
                    {entry.mathCalculations && entry.mathCalculations[0] && (
                      <div className="bg-black/50 print:bg-gray-200 p-2 rounded text-[10px] font-mono text-white print:text-black mt-2">
                        {entry.mathCalculations[0].formula}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Binder Footer */}
            <div className="pt-6 border-t border-white/10 print:border-gray-300 flex justify-between items-center text-[10px] font-mono text-marble/40 print:text-gray-600">
              <span>ARES 23247 FTC Robotics Engineering Portfolio</span>
              <span>Morgantown, West Virginia · Zero-PII Certified</span>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
