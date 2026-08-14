"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  BookOpen,
  FileText,
  Video,
  Laptop,
  ExternalLink,
  Download,
  Quote,
  Copy,
  Check,
  Clock,
  Sparkles,
  ChevronRight,
  GraduationCap,
  X,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  Tag,
  FileCode,
  Compass,
} from "lucide-react";

import SEO from "@/components/SEO";
import { useFocusTrap } from "@/lib/useFocusTrap";
import {
  STEM_RESOURCES,
  STEM_CATEGORIES,
  STEM_FORMATS,
  STEM_DIFFICULTIES,
  STEM_SORT_OPTIONS,
  filterStemResources,
  formatCitation,
  getCategoryStats,
  type StemResource,
  type StemCategory,
  type StemFormat,
  type StemDifficulty,
  type StemSortOption,
  type StemCitationFormat,
} from "@/lib/stemLibraryData";

export default function AcademyLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState<StemCategory | "All">(() => {
    const cat = searchParams.get("category");
    return STEM_CATEGORIES.includes(cat as StemCategory) ? (cat as StemCategory) : "All";
  });
  const [selectedFormat, setSelectedFormat] = useState<StemFormat | "All">(() => {
    const fmt = searchParams.get("format");
    return STEM_FORMATS.includes(fmt as StemFormat) ? (fmt as StemFormat) : "All";
  });
  const [selectedDifficulty, setSelectedDifficulty] = useState<StemDifficulty | "All">(() => {
    const diff = searchParams.get("difficulty");
    return STEM_DIFFICULTIES.includes(diff as StemDifficulty) ? (diff as StemDifficulty) : "All";
  });
  const [selectedTag, setSelectedTag] = useState<string>(() => searchParams.get("tag") || "");
  const [sortBy, setSortBy] = useState<StemSortOption>(() => {
    const sort = searchParams.get("sort");
    return (sort as StemSortOption) || "featured";
  });

  const [activeCitationResource, setActiveCitationResource] = useState<StemResource | null>(null);
  const [citationFormat, setCitationFormat] = useState<StemCitationFormat>("ieee");
  const [copiedCitation, setCopiedCitation] = useState(false);

  const closeCitationModal = useCallback(() => {
    setActiveCitationResource(null);
    setCopiedCitation(false);
  }, []);

  const citationModalRef = useFocusTrap(Boolean(activeCitationResource), closeCitationModal);

  // Sync state changes to URL search parameters for link sharing
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (selectedCategory !== "All") params.set("category", selectedCategory);
    if (selectedFormat !== "All") params.set("format", selectedFormat);
    if (selectedDifficulty !== "All") params.set("difficulty", selectedDifficulty);
    if (selectedTag) params.set("tag", selectedTag);
    if (sortBy !== "featured") params.set("sort", sortBy);

    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedCategory, selectedFormat, selectedDifficulty, selectedTag, sortBy, setSearchParams]);

  const filteredResources = useMemo(() => {
    return filterStemResources({
      resources: STEM_RESOURCES,
      search: searchQuery,
      category: selectedCategory,
      format: selectedFormat,
      difficulty: selectedDifficulty,
      tag: selectedTag,
      sortBy,
    });
  }, [searchQuery, selectedCategory, selectedFormat, selectedDifficulty, selectedTag, sortBy]);

  const categoryStats = useMemo(() => getCategoryStats(STEM_RESOURCES), []);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      selectedCategory !== "All" ||
      selectedFormat !== "All" ||
      selectedDifficulty !== "All" ||
      selectedTag ||
      sortBy !== "featured"
  );

  const resetAllFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSelectedFormat("All");
    setSelectedDifficulty("All");
    setSelectedTag("");
    setSortBy("featured");
  }, []);

  const handleCopyCitation = useCallback(async () => {
    if (!activeCitationResource) return;
    const text = formatCitation(activeCitationResource, citationFormat);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 2500);
    } catch {
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 2500);
    }
  }, [activeCitationResource, citationFormat]);
  const getFormatIcon = (format: StemFormat) => {
    switch (format) {
      case "Whitepaper":
        return <FileText size={14} className="text-cyan-400" aria-hidden="true" />;
      case "Guide":
        return <BookOpen size={14} className="text-amber-400" aria-hidden="true" />;
      case "Interactive Tutorial":
        return <Laptop size={14} className="text-emerald-400" aria-hidden="true" />;
      case "Video":
        return <Video size={14} className="text-purple-400" aria-hidden="true" />;
    }
  };

  const getDifficultyBadge = (difficulty: StemDifficulty) => {
    switch (difficulty) {
      case "Novice":
        return "bg-emerald-950/60 text-emerald-300 border-emerald-500/40";
      case "Intermediate":
        return "bg-amber-950/60 text-amber-300 border-amber-500/40";
      case "Advanced":
        return "bg-purple-950/60 text-purple-300 border-purple-500/40";
    }
  };

  const getCategoryBadgeColor = (category: StemCategory) => {
    switch (category) {
      case "Controls & Math":
        return "bg-cyan-950/40 text-cyan-400 border-cyan-500/30";
      case "Mechanical Design":
        return "bg-amber-950/40 text-amber-400 border-amber-500/30";
      case "Software Architecture":
        return "bg-emerald-950/40 text-emerald-400 border-emerald-500/30";
      case "Vision & Sensors":
        return "bg-purple-950/40 text-purple-400 border-purple-500/30";
      case "Team Operations":
        return "bg-ares-gold/10 text-ares-gold border-ares-gold/30";
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col w-full selection:bg-ares-red selection:text-white pb-20">
      <SEO
        title="STEM & Robotics Resource Library | ARES 23247"
        description="Curated open-access technical whitepapers, mechanical CAD blueprints, control algorithms, vision tutorials, and team operations curricula engineered by ARES 23247."
      />

      {/* ── Breadcrumb & Hero Section ──────────────────────────────── */}
      <section className="pt-24 pb-12 px-6 lg:px-12 border-b border-white/10 bg-gradient-to-b from-black/60 to-transparent">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-marble/60 mb-6 flex-wrap">
            <Link to="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight size={12} aria-hidden="true" />
            <Link to="/academy" className="hover:text-white transition-colors">
              Academy
            </Link>
            <ChevronRight size={12} aria-hidden="true" />
            <span className="text-ares-gold font-bold" aria-current="page">
              STEM & Robotics Resource Library
            </span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-ares-red/10 border border-ares-red/30 ares-cut-sm text-ares-red-light text-xs font-bold uppercase tracking-widest mb-4">
                <GraduationCap size={14} aria-hidden="true" />
                <span>Open-Access Knowledge Repository</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-heading uppercase tracking-tight text-white mb-4">
                STEM & Robotics <span className="text-ares-gold">Resource Library</span>
              </h1>
              <p className="text-base sm:text-lg text-marble/80 leading-relaxed font-sans">
                Peer-reviewed control theory whitepapers, parametric Onshape CAD modeling blueprints,
                reactive Kotlin architectures, AprilTag vision calibration tutorials, and team business frameworks
                engineered for competitive robotics teams.
              </p>
            </div>

            {/* Quick action links to other academy areas */}
            <div className="flex flex-wrap gap-3">
              <Link
                to="/academy"
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white ares-cut-sm text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <BookOpen size={14} className="text-ares-gold" aria-hidden="true" />
                <span>Academy Lessons</span>
              </Link>
              <Link
                to="/academy/playground"
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white ares-cut-sm text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <Laptop size={14} className="text-ares-cyan" aria-hidden="true" />
                <span>Sim Playground</span>
              </Link>
              <Link
                to="/docs"
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white ares-cut-sm text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <FileCode size={14} className="text-amber-400" aria-hidden="true" />
                <span>ARESLib Docs</span>
              </Link>
            </div>
          </div>

          {/* Catalog Highlights Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/8">
            <div className="p-3 bg-black/40 border border-white/5 ares-cut-sm">
              <div className="text-2xl font-black text-white font-heading">{STEM_RESOURCES.length}</div>
              <div className="text-xs uppercase tracking-wider text-marble/60 font-bold">Curated Resources</div>
            </div>
            <div className="p-3 bg-black/40 border border-white/5 ares-cut-sm">
              <div className="text-2xl font-black text-ares-gold font-heading">{STEM_CATEGORIES.length}</div>
              <div className="text-xs uppercase tracking-wider text-marble/60 font-bold">Core Disciplines</div>
            </div>
            <div className="p-3 bg-black/40 border border-white/5 ares-cut-sm">
              <div className="text-2xl font-black text-ares-cyan font-heading">100%</div>
              <div className="text-xs uppercase tracking-wider text-marble/60 font-bold">Open Access</div>
            </div>
            <div className="p-3 bg-black/40 border border-white/5 ares-cut-sm">
              <div className="text-2xl font-black text-emerald-400 font-heading">Zero Tracker</div>
              <div className="text-xs uppercase tracking-wider text-marble/60 font-bold">Verified Links</div>
            </div>
          </div>
        </div>
      </section>
      {/* ── Search & Filter Controls ──────────────────────────────── */}
      <section className="py-8 px-6 lg:px-12 bg-black/20 border-b border-white/5 sticky top-16 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Primary Search and Reset Row */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-marble/40 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, author, topic tags, reading duration (< 20 min)..."
                aria-label="Search resources"
                className="w-full pl-11 pr-10 py-3 bg-black/60 border border-white/15 focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan ares-cut-sm text-sm text-white placeholder:text-marble/40 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search input"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-marble/50 hover:text-white"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Sort & Quick Filter Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 bg-black/60 border border-white/10 px-3 py-2 ares-cut-sm">
                <SlidersHorizontal size={14} className="text-marble/50" aria-hidden="true" />
                <label htmlFor="library-sort" className="text-xs uppercase font-bold text-marble/60">
                  Sort:
                </label>
                <select
                  id="library-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as StemSortOption)}
                  className="bg-transparent text-xs font-bold text-white uppercase tracking-wider outline-none cursor-pointer"
                >
                  {STEM_SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-obsidian text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="flex items-center gap-1 px-3 py-2 bg-ares-red/15 hover:bg-ares-red/25 border border-ares-red/40 text-ares-red-light text-xs font-bold uppercase tracking-wider ares-cut-sm transition-colors cursor-pointer"
                  title="Reset all active search and filter options"
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Category Chips Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" role="toolbar" aria-label="Category Filters">
            <button
              type="button"
              onClick={() => setSelectedCategory("All")}
              aria-pressed={selectedCategory === "All"}
              className={`px-3.5 py-1.5 ares-cut-sm text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === "All"
                  ? "bg-white text-black shadow-lg"
                  : "bg-white/5 text-marble/70 hover:text-white hover:bg-white/10 border border-white/10"
              }`}
            >
              <Compass size={12} aria-hidden="true" />
              <span>All Disciplines</span>
              <span className="text-[10px] opacity-75 font-mono">({STEM_RESOURCES.length})</span>
            </button>

            {STEM_CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category;
              const count = categoryStats[category] || 0;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  aria-pressed={isSelected}
                  className={`px-3.5 py-1.5 ares-cut-sm text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-ares-red text-white shadow-lg ring-1 ring-ares-red-light"
                      : "bg-white/5 text-marble/70 hover:text-white hover:bg-white/10 border border-white/10"
                  }`}
                >
                  <Layers size={12} aria-hidden="true" />
                  <span>{category}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Secondary Filters: Format & Difficulty */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/5">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {/* Format Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-marble/50 uppercase font-bold text-[10px] tracking-widest">Format:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedFormat("All")}
                    aria-pressed={selectedFormat === "All"}
                    className={`px-2 py-1 ares-cut-sm text-[11px] font-bold ${
                      selectedFormat === "All"
                        ? "bg-white/20 text-white"
                        : "text-marble/60 hover:text-white"
                    }`}
                  >
                    All
                  </button>
                  {STEM_FORMATS.map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setSelectedFormat(fmt)}
                      aria-pressed={selectedFormat === fmt}
                      className={`px-2 py-1 ares-cut-sm text-[11px] font-bold transition-colors ${
                        selectedFormat === fmt
                          ? "bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/40"
                          : "text-marble/60 hover:text-white"
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-marble/50 uppercase font-bold text-[10px] tracking-widest">Level:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedDifficulty("All")}
                    aria-pressed={selectedDifficulty === "All"}
                    className={`px-2 py-1 ares-cut-sm text-[11px] font-bold ${
                      selectedDifficulty === "All"
                        ? "bg-white/20 text-white"
                        : "text-marble/60 hover:text-white"
                    }`}
                  >
                    All
                  </button>
                  {STEM_DIFFICULTIES.map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setSelectedDifficulty(diff)}
                      aria-pressed={selectedDifficulty === diff}
                      className={`px-2 py-1 ares-cut-sm text-[11px] font-bold transition-colors ${
                        selectedDifficulty === diff
                          ? "bg-ares-gold/20 text-ares-gold border border-ares-gold/40"
                          : "text-marble/60 hover:text-white"
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Tag Filter Indicator */}
            {selectedTag && (
              <div className="flex items-center gap-2 bg-ares-cyan/10 border border-ares-cyan/30 px-2.5 py-1 ares-cut-sm text-xs text-ares-cyan">
                <Tag size={12} aria-hidden="true" />
                <span>Tag: <strong>{selectedTag}</strong></span>
                <button
                  type="button"
                  onClick={() => setSelectedTag("")}
                  aria-label={`Remove tag filter ${selectedTag}`}
                  className="hover:text-white ml-1"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
      {/* ── Main Catalog Grid ────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-10 w-full flex-1">
        {/* Results Counter & Live Region */}
        <div className="flex items-center justify-between gap-4 mb-6" role="status" aria-live="polite">
          <p className="text-xs uppercase tracking-wider font-bold text-marble/60">
            Showing <span className="text-white font-mono">{filteredResources.length}</span> of{" "}
            <span className="font-mono">{STEM_RESOURCES.length}</span> resources
          </p>
        </div>

        {filteredResources.length === 0 ? (
          <div className="text-center py-20 px-6 border border-white/10 bg-white/5 ares-cut-sm max-w-2xl mx-auto">
            <BookOpen size={48} className="mx-auto mb-4 text-marble/30" aria-hidden="true" />
            <h2 className="text-xl font-bold font-heading uppercase text-white mb-2">No Matching Resources Found</h2>
            <p className="text-sm text-marble/70 mb-6 max-w-md mx-auto">
              We couldn&apos;t find any open-access papers matching your current search parameters. Try adjusting your keywords or clearing active filters.
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-ares-red hover:bg-ares-bronze text-white text-xs font-bold uppercase tracking-wider ares-cut-sm transition-colors cursor-pointer"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Reset All Filters</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResources.map((resource) => (
              <motion.article
                key={resource.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col justify-between bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/25 ares-cut p-6 transition-all group relative overflow-hidden"
              >
                <div>
                  {/* Top Metadata Badges */}
                  <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Category Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${getCategoryBadgeColor(
                          resource.category
                        )}`}
                      >
                        {resource.category}
                      </span>

                      {/* Format Badge */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-white/5 border border-white/10 text-marble/80">
                        {getFormatIcon(resource.format)}
                        <span>{resource.format}</span>
                      </span>
                    </div>

                    {/* Difficulty Badge */}
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${getDifficultyBadge(
                        resource.difficulty
                      )}`}
                    >
                      {resource.difficulty}
                    </span>
                  </div>

                  {/* Featured Marker */}
                  {resource.featured && (
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-ares-gold mb-2">
                      <Sparkles size={11} aria-hidden="true" />
                      <span>Featured Resource</span>
                    </div>
                  )}

                  {/* Title */}
                  <h2 className="text-lg font-bold font-heading text-white group-hover:text-ares-gold transition-colors mb-2 leading-snug">
                    {resource.title}
                  </h2>

                  {/* Authors & Year */}
                  <div className="text-xs text-marble/60 mb-3 flex items-center gap-2 flex-wrap font-mono">
                    <span>{resource.authors.join(", ")}</span>
                    <span>•</span>
                    <span>{resource.publishedYear}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-marble/70">
                      <Clock size={11} aria-hidden="true" />
                      {resource.readingTimeMinutes} min read
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-marble/75 mb-4 line-clamp-3 leading-relaxed">
                    {resource.summary}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {resource.tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTag(t)}
                        aria-label={`Filter by tag ${t}`}
                        className={`text-[10px] px-2 py-0.5 ares-cut-sm transition-colors cursor-pointer ${
                          selectedTag === t
                            ? "bg-ares-cyan text-black font-bold"
                            : "bg-white/5 hover:bg-white/15 text-marble/70 hover:text-white"
                        }`}
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2 mt-auto">
                  <div className="flex items-center gap-2">
                    {resource.downloadUrl && (
                      <a
                        href={resource.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Download PDF for ${resource.title}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ares-red/15 hover:bg-ares-red text-ares-red-light hover:text-white border border-ares-red/40 ares-cut-sm text-xs font-bold uppercase tracking-wider transition-all"
                      >
                        <Download size={12} aria-hidden="true" />
                        <span>PDF</span>
                      </a>
                    )}

                    <a
                      href={resource.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open repository link for ${resource.title}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/15 text-white border border-white/10 ares-cut-sm text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      <ExternalLink size={12} aria-hidden="true" />
                      <span>View</span>
                    </a>
                  </div>

                  {/* Citation Modal Trigger */}
                  <button
                    type="button"
                    onClick={() => setActiveCitationResource(resource)}
                    aria-label={`Cite ${resource.title}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-marble/70 hover:text-ares-cyan hover:bg-ares-cyan/10 ares-cut-sm transition-colors cursor-pointer"
                    title="Generate bibliographic citation"
                  >
                    <Quote size={13} aria-hidden="true" />
                    <span className="font-bold uppercase tracking-wider text-[11px]">Cite</span>
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </main>

      {/* ── Citation Copy Dialog Modal ──────────────────────────────── */}
      <AnimatePresence>
        {activeCitationResource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeCitationModal}
          >
            <motion.div
              ref={citationModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="citation-dialog-title"
              tabIndex={-1}
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-2xl bg-obsidian border border-white/15 ares-cut p-6 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Quote size={20} className="text-ares-gold shrink-0" aria-hidden="true" />
                  <div>
                    <h2 id="citation-dialog-title" className="text-lg font-bold font-heading text-white">
                      Cite This Resource
                    </h2>
                    <p className="text-xs text-marble/60 line-clamp-1">{activeCitationResource.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCitationModal}
                  aria-label="Close citation modal"
                  className="p-1 text-marble/60 hover:text-white ares-cut-sm hover:bg-white/10 transition-colors"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              {/* Format Selection Tabs */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs uppercase font-bold text-marble/50">Style:</span>
                {(["ieee", "apa", "bibtex"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => {
                      setCitationFormat(fmt);
                      setCopiedCitation(false);
                    }}
                    aria-pressed={citationFormat === fmt}
                    className={`px-3 py-1 text-xs font-mono uppercase font-bold ares-cut-sm transition-colors cursor-pointer ${
                      citationFormat === fmt
                        ? "bg-ares-gold text-black font-black"
                        : "bg-white/5 text-marble/70 hover:text-white border border-white/10"
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              {/* Formatted Citation Block */}
              <div className="relative mb-6">
                <pre className="p-4 bg-black/70 border border-white/10 ares-cut-sm text-xs font-mono text-marble/90 whitespace-pre-wrap break-words leading-relaxed select-all max-h-48 overflow-y-auto">
                  {formatCitation(activeCitationResource, citationFormat)}
                </pre>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between gap-4 pt-2">
                <span className="text-xs text-marble/50">
                  Strict zero-tracker URL with DOI attribution.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeCitationModal}
                    className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white ares-cut-sm text-xs font-bold uppercase tracking-wider"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCitation}
                    className={`inline-flex items-center gap-1.5 px-5 py-2 ares-cut-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      copiedCitation
                        ? "bg-emerald-600 text-white"
                        : "bg-ares-red hover:bg-ares-bronze text-white"
                    }`}
                  >
                    {copiedCitation ? (
                      <>
                        <Check size={14} aria-hidden="true" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} aria-hidden="true" />
                        <span>Copy Citation</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
