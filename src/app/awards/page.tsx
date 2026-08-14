"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Trophy,
  Award,
  Cpu,
  Sparkles,
  Flame,
  GraduationCap,
  Compass,
  Star,
  MapPin,
  Calendar,
  Search,
  X,
  ExternalLink,
  ShieldCheck,
  BookOpen,
  Copy,
  Check,
  Filter,
  History,
  Layers,
  ChevronRight,
} from "lucide-react";
import SEO from "@/components/SEO";
import {
  AWARDS_DATA,
  AwardHonor,
  AwardCategory,
  SeasonFilter,
  filterAwards,
  getTrophyCaseStats,
} from "@/lib/awardsData";

const SEASON_OPTIONS: SeasonFilter[] = [
  "All",
  "2025-2026",
  "2024-2025",
  "2023-2024",
  "Legacy Archive",
];

const CATEGORY_OPTIONS: Array<"All" | AwardCategory> = [
  "All",
  "Technical",
  "Community",
  "Championship",
];

function getAwardIcon(iconName: AwardHonor["iconName"], size = 20, className = "") {
  switch (iconName) {
    case "Trophy":
      return <Trophy size={size} className={className} />;
    case "Flame":
      return <Flame size={size} className={className} />;
    case "Cpu":
      return <Cpu size={size} className={className} />;
    case "Sparkles":
      return <Sparkles size={size} className={className} />;
    case "Compass":
      return <Compass size={size} className={className} />;
    case "GraduationCap":
      return <GraduationCap size={size} className={className} />;
    case "Star":
      return <Star size={size} className={className} />;
    case "Award":
    default:
      return <Award size={size} className={className} />;
  }
}

function getThemeStyles(theme: AwardHonor["bannerTheme"]) {
  switch (theme) {
    case "gold":
      return {
        badgeBg: "bg-ares-gold/20 text-ares-gold border-ares-gold/40",
        bannerBg: "bg-gradient-to-b from-amber-500/20 via-ares-gold/10 to-transparent",
        bannerBorder: "border-ares-gold/50",
        accentText: "text-ares-gold",
        glow: "shadow-[0_0_25px_rgba(218,165,32,0.25)]",
        tagBg: "bg-ares-gold text-black font-black",
      };
    case "red":
      return {
        badgeBg: "bg-ares-red/20 text-ares-red border-ares-red/40",
        bannerBg: "bg-gradient-to-b from-ares-red/20 via-red-950/20 to-transparent",
        bannerBorder: "border-ares-red/50",
        accentText: "text-ares-red",
        glow: "shadow-[0_0_25px_rgba(192,0,0,0.25)]",
        tagBg: "bg-ares-red text-white font-black",
      };
    case "cyan":
      return {
        badgeBg: "bg-ares-cyan/20 text-ares-cyan border-ares-cyan/40",
        bannerBg: "bg-gradient-to-b from-ares-cyan/20 via-cyan-950/20 to-transparent",
        bannerBorder: "border-ares-cyan/50",
        accentText: "text-ares-cyan",
        glow: "shadow-[0_0_25px_rgba(0,210,255,0.25)]",
        tagBg: "bg-ares-cyan text-black font-black",
      };
    case "purple":
      return {
        badgeBg: "bg-purple-500/20 text-purple-300 border-purple-500/40",
        bannerBg: "bg-gradient-to-b from-purple-500/20 via-purple-950/20 to-transparent",
        bannerBorder: "border-purple-500/50",
        accentText: "text-purple-300",
        glow: "shadow-[0_0_25px_rgba(168,85,247,0.25)]",
        tagBg: "bg-purple-600 text-white font-black",
      };
    case "emerald":
      return {
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        bannerBg: "bg-gradient-to-b from-emerald-500/20 via-emerald-950/20 to-transparent",
        bannerBorder: "border-emerald-500/50",
        accentText: "text-emerald-300",
        glow: "shadow-[0_0_25px_rgba(16,185,129,0.25)]",
        tagBg: "bg-emerald-600 text-white font-black",
      };
    case "bronze":
    default:
      return {
        badgeBg: "bg-ares-bronze/20 text-ares-bronze border-ares-bronze/40",
        bannerBg: "bg-gradient-to-b from-ares-bronze/20 via-amber-950/20 to-transparent",
        bannerBorder: "border-ares-bronze/50",
        accentText: "text-ares-bronze",
        glow: "shadow-[0_0_25px_rgba(205,127,50,0.25)]",
        tagBg: "bg-ares-bronze text-white font-black",
      };
  }
}

export default function AwardsPage() {
  const [selectedSeason, setSelectedSeason] = useState<SeasonFilter>("All");
  const [selectedCategory, setSelectedCategory] = useState<"All" | AwardCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModalAward, setActiveModalAward] = useState<AwardHonor | null>(null);
  const [copiedCitation, setCopiedCitation] = useState(false);
  const modalCloseButtonRef = useRef<HTMLButtonElement>(null);

  const stats = useMemo(() => getTrophyCaseStats(AWARDS_DATA), []);

  const filteredAwards = useMemo(
    () => filterAwards(AWARDS_DATA, selectedSeason, selectedCategory, searchQuery),
    [selectedSeason, selectedCategory, searchQuery]
  );

  const championshipBanners = useMemo(
    () => AWARDS_DATA.filter((award) => award.isChampionshipBanner),
    []
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && activeModalAward) {
        setActiveModalAward(null);
      }
    }
    if (activeModalAward) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      setTimeout(() => modalCloseButtonRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeModalAward]);

  const handleCopyCitation = async (citation: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(citation);
        setCopiedCitation(true);
        setTimeout(() => setCopiedCitation(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const handleClearFilters = () => {
    setSelectedSeason("All");
    setSelectedCategory("All");
    setSearchQuery("");
  };

  return (
    <div className="flex flex-col w-full bg-obsidian min-h-screen text-marble relative overflow-hidden">
      <SEO
        title="Team Awards & Honors"
        description="Explore official FIRST® Tech Challenge awards, official judge citations, championship banners, and honors won by ARES 23247."
      />

      {/* Hero Section */}
      <section className="py-24 md:py-32 px-6 relative z-10 text-center bg-obsidian border-b border-white/5">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 ares-cut-sm bg-white/5 border border-ares-gold/30 text-ares-gold text-xs font-bold uppercase tracking-widest mb-6"
        >
          <Trophy size={14} className="text-ares-gold" />
          FIRST® Tech Challenge Honors Showcase
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 tracking-tighter"
        >
          Trophy <span className="bg-ares-red px-5 py-1 ares-cut inline-block text-white">Case</span> & Citations.
        </motion.h1>

        <p className="text-marble text-lg md:text-xl max-w-3xl mx-auto leading-relaxed font-medium mb-8">
          Celebrating competitive excellence, mechanical innovation, control systems mastery, and community impact across all seasons of ARES 23247.
        </p>

        {/* Zero-PII Compliance & Verification Badge */}
        <div className="max-w-2xl mx-auto p-3.5 ares-cut-sm bg-white/5 border border-ares-cyan/30 text-left flex items-start gap-3 shadow-lg">
          <ShieldCheck size={20} className="text-ares-cyan shrink-0 mt-0.5" />
          <p className="text-xs text-marble/80 leading-snug">
            <strong className="text-white uppercase font-bold tracking-wider">Zero-PII Compliance: </strong>
            All published records strictly reflect official public FIRST® judge citations, team honors, and authorized public student leadership roles in accordance with FIRST® Youth Protection Policies.
          </p>
        </div>

        {/* Navigation Breadcrumb to Seasons */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs font-bold uppercase tracking-widest">
          <Link
            to="/seasons"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 ares-cut-sm text-marble hover:text-white hover:bg-white/10 hover:border-ares-gold/40 transition-all"
          >
            <History size={14} className="text-ares-gold" />
            Explore Seasonal Timeline
          </Link>
          <Link
            to="/robots"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 ares-cut-sm text-marble hover:text-white hover:bg-white/10 hover:border-ares-cyan/40 transition-all"
          >
            <Layers size={14} className="text-ares-cyan" />
            Inspect Robot Fleet
          </Link>
        </div>
      </section>

      {/* Trophy Case Statistics Counter */}
      <section data-testid="trophy-case-stats" className="py-12 px-6 bg-obsidian/70 border-b border-white/5 relative z-10">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="p-6 bg-white/5 border border-white/10 ares-cut text-center">
            <span className="block text-4xl md:text-5xl font-black text-white font-heading">
              {stats.totalAwards}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-ares-gold mt-1 block">
              Honors Won
            </span>
          </div>

          <div className="p-6 bg-white/5 border border-ares-gold/30 ares-cut text-center">
            <span className="block text-4xl md:text-5xl font-black text-ares-gold font-heading">
              {stats.championshipBanners}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-white mt-1 block">
              Championship Banners
            </span>
          </div>

          <div className="p-6 bg-white/5 border border-white/10 ares-cut text-center">
            <span className="block text-4xl md:text-5xl font-black text-ares-cyan font-heading">
              {stats.technicalAwards}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-marble mt-1 block">
              Technical Awards
            </span>
          </div>

          <div className="p-6 bg-white/5 border border-white/10 ares-cut text-center">
            <span className="block text-4xl md:text-5xl font-black text-ares-bronze font-heading">
              {stats.communityHonors}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-marble mt-1 block">
              Community & Culture
            </span>
          </div>
        </div>
      </section>

      {/* Championship Banners Hall */}
      <section data-testid="championship-banners-wall" className="py-20 px-6 bg-obsidian relative z-10 border-b border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <div className="inline-flex items-center gap-2 text-ares-gold text-xs font-bold uppercase tracking-widest mb-2">
                <Flame size={14} /> Official FIRST® Banners
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase">
                Championship Banner Wall
              </h2>
            </div>
            <p className="text-marble/80 text-sm max-w-md">
              Visual replica of the championship banners hung in our Morgantown engineering workshop.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {championshipBanners.map((banner) => {
              const theme = getThemeStyles(banner.bannerTheme);
              return (
                <motion.div
                  key={banner.id}
                  whileHover={{ y: -6 }}
                  className={`relative p-8 ares-cut border ${theme.bannerBorder} ${theme.bannerBg} ${theme.glow} flex flex-col justify-between overflow-hidden group`}
                >
                  <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-ares-gold via-white to-ares-gold opacity-75" />

                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 ares-cut bg-black/60 border border-white/10 flex items-center justify-center text-white">
                        {getAwardIcon(banner.iconName, 28, theme.accentText)}
                      </div>
                      <span className={`px-3 py-1 text-xs uppercase ${theme.tagBg} ares-cut-sm`}>
                        {banner.placement}
                      </span>
                    </div>

                    <span className="block text-xs font-bold tracking-widest text-marble/60 uppercase mb-1">
                      {banner.seasonYearDisplay}
                    </span>
                    <h3 className="text-2xl font-black text-white tracking-tight mb-2 group-hover:text-ares-gold transition-colors">
                      {banner.title}
                    </h3>
                    <p className="text-xs text-marble/80 uppercase font-bold tracking-wider mb-4 flex items-center gap-1.5">
                      <MapPin size={12} className="text-ares-red" /> {banner.eventName}
                    </p>
                    <p className="text-sm text-marble/90 leading-relaxed line-clamp-3 mb-6">
                      {banner.judgeCitation}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveModalAward(banner)}
                    className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest ares-cut-sm flex items-center justify-center gap-2 border border-white/10 transition-all focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                    aria-label={`View citation and details for ${banner.title}`}
                  >
                    View Official Citation <ChevronRight size={14} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Filterable Award Matrix & Search */}
      <section data-testid="awards-matrix-section" className="py-20 px-6 bg-obsidian/50 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase mb-2">
                Award Matrix & Honors
              </h2>
              <p className="text-marble/80 text-sm">
                Filter by season or category to view specific awards, judging citations, and technical criteria.
              </p>
            </div>

            {/* Live Search Bar */}
            <div className="relative w-full md:w-80">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-marble/50 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search awards, subsystems, citations..."
                aria-label="Search awards and honors"
                className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-none ares-cut-sm text-white placeholder-marble/40 text-sm focus:outline-none focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search query"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-marble/60 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-col gap-6 mb-12 p-6 bg-white/5 border border-white/10 ares-cut">
            {/* Season Filter Chips */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-widest text-ares-gold mb-3 flex items-center gap-2">
                <Calendar size={12} /> Filter by Season
              </span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Season filter chips">
                {SEASON_OPTIONS.map((season) => (
                  <button
                    key={season}
                    type="button"
                    onClick={() => setSelectedSeason(season)}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-widest ares-cut-sm transition-all border ${
                      selectedSeason === season
                        ? "bg-ares-red text-white border-ares-red shadow-lg"
                        : "bg-black/40 text-marble/80 border-white/10 hover:border-white/30 hover:text-white"
                    }`}
                    aria-pressed={selectedSeason === season}
                  >
                    {season}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter Chips */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-widest text-ares-cyan mb-3 flex items-center gap-2">
                <Filter size={12} /> Filter by Category
              </span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Category filter chips">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-widest ares-cut-sm transition-all border ${
                      selectedCategory === cat
                        ? "bg-ares-cyan text-black border-ares-cyan font-black shadow-lg"
                        : "bg-black/40 text-marble/80 border-white/10 hover:border-white/30 hover:text-white"
                    }`}
                    aria-pressed={selectedCategory === cat}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Summary Bar */}
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-marble/70 mb-8 px-2">
            <span>
              Showing <strong className="text-white">{filteredAwards.length}</strong> of {AWARDS_DATA.length} honors
            </span>
            {(selectedSeason !== "All" || selectedCategory !== "All" || searchQuery) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-ares-red hover:underline font-bold"
              >
                Reset All Filters
              </button>
            )}
          </div>

          {/* Awards Grid */}
          <div data-testid="awards-matrix-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredAwards.length > 0 ? (
                filteredAwards.map((award, idx) => {
                  const theme = getThemeStyles(award.bannerTheme);
                  return (
                    <motion.div
                      key={award.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25, delay: idx * 0.05 }}
                      className="bg-obsidian border border-white/10 hover:border-white/30 p-7 ares-cut flex flex-col justify-between group transition-all relative overflow-hidden"
                    >
                      <div>
                        {/* Header Badge */}
                        <div className="flex justify-between items-start mb-5">
                          <div
                            className={`w-12 h-12 ares-cut flex items-center justify-center ${theme.badgeBg} border shadow-inner`}
                          >
                            {getAwardIcon(award.iconName, 24)}
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-white/5 border border-white/10 text-marble/80 ares-cut-sm">
                            {award.category}
                          </span>
                        </div>

                        <span className="block text-[11px] font-bold text-ares-gold uppercase tracking-widest mb-1">
                          {award.seasonYearDisplay}
                        </span>
                        <h3 className="text-2xl font-black text-white tracking-tight mb-1 group-hover:text-ares-gold transition-colors">
                          {award.title}
                        </h3>
                        <p className="text-xs text-marble/60 italic mb-4">{award.subtitle}</p>

                        <div className="text-xs font-bold uppercase tracking-wider text-marble/80 mb-4 flex items-center gap-2">
                          <MapPin size={12} className="text-ares-red shrink-0" />
                          <span className="truncate">{award.eventName}</span>
                        </div>

                        <p className="text-xs text-marble/90 leading-relaxed line-clamp-3 mb-6">
                          {award.judgeCitation}
                        </p>

                        {/* Subsystem preview pills */}
                        <div className="space-y-1.5 mb-6">
                          <span className="block text-[10px] font-black uppercase tracking-widest text-marble/50">
                            Key Subsystems
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {award.subsystemHighlights.slice(0, 2).map((sub, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 ares-cut-sm text-marble/80 truncate max-w-full"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Modal trigger button */}
                      <button
                        type="button"
                        onClick={() => setActiveModalAward(award)}
                        className="w-full py-2.5 px-4 bg-white/5 hover:bg-ares-red text-white font-bold text-xs uppercase tracking-widest ares-cut-sm border border-white/10 hover:border-ares-red transition-all flex items-center justify-center gap-2 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                        aria-haspopup="dialog"
                        aria-label={`Open details and citation for ${award.title}`}
                      >
                        Judge Citation & Details <ChevronRight size={14} />
                      </button>
                    </motion.div>
                  );
                })
              ) : (
                <div className="col-span-full py-24 text-center border-2 border-dashed border-white/10 ares-cut-lg">
                  <Trophy size={48} className="mx-auto mb-4 text-marble/30" />
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                    No Matching Honors Found
                  </h3>
                  <p className="text-marble/70 text-sm max-w-md mx-auto mb-6">
                    Try adjusting your season or category filters, or clear your search term.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-6 py-2.5 bg-ares-red text-white font-bold text-xs uppercase tracking-widest ares-cut-sm"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
          </div>
        </div>
      </section>

      {/* Award Details & Official Judge Citation Modal */}
      {activeModalAward && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="award-modal-title"
          aria-describedby="award-modal-description"
        >
          <div
            className="bg-obsidian border border-white/20 p-6 md:p-8 ares-cut-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative text-left"
          >
              {/* Modal Close Button */}
              <button
                ref={modalCloseButtonRef}
                type="button"
                onClick={() => setActiveModalAward(null)}
                className="absolute top-6 right-6 text-marble/70 hover:text-white p-2 rounded bg-white/5 hover:bg-white/10 transition-colors focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                aria-label="Close award details modal"
              >
                <X size={20} />
              </button>

              {/* Modal Header */}
              <div className="pr-12 mb-6">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 bg-ares-red text-white text-[10px] font-black uppercase tracking-widest ares-cut-sm">
                    {activeModalAward.seasonYearDisplay}
                  </span>
                  <span className="px-2.5 py-0.5 bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest ares-cut-sm">
                    {activeModalAward.category}
                  </span>
                  {activeModalAward.placement && (
                    <span className="px-2.5 py-0.5 bg-ares-gold/20 text-ares-gold border border-ares-gold/30 text-[10px] font-bold uppercase tracking-widest ares-cut-sm">
                      {activeModalAward.placement}
                    </span>
                  )}
                </div>

                <h2 id="award-modal-title" className="text-3xl md:text-4xl font-black text-white tracking-tight">
                  {activeModalAward.title}
                </h2>
                <p className="text-sm text-ares-gold font-medium mt-1">{activeModalAward.subtitle}</p>

                <div className="flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-wider text-marble/70 mt-3">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-ares-red" /> {activeModalAward.eventName} ({activeModalAward.eventLocation})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-ares-cyan" /> {activeModalAward.date}
                  </span>
                </div>
              </div>

              {/* Official Judge Citation Plaque */}
              <div className="mb-8 p-6 bg-gradient-to-r from-white/10 via-white/5 to-transparent border-l-4 border-ares-gold ares-cut-sm shadow-inner relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase tracking-widest text-ares-gold flex items-center gap-2">
                    <Trophy size={14} /> Official Judge Citation
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCitation(activeModalAward.judgeCitation)}
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white ares-cut-sm transition-all focus:ring-1 focus:ring-ares-cyan focus:outline-none"
                    aria-label="Copy citation text"
                  >
                    {copiedCitation ? (
                      <>
                        <Check size={12} className="text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy Citation
                      </>
                    )}
                  </button>
                </div>
                <blockquote
                  id="award-modal-description"
                  className="text-base md:text-lg text-white font-serif italic leading-relaxed"
                >
                  "{activeModalAward.judgeCitation}"
                </blockquote>
              </div>

              {/* Key Robot Subsystem Achievements */}
              <div className="mb-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-white mb-3 flex items-center gap-2">
                  <Cpu size={16} className="text-ares-cyan" /> Key Robot Subsystem Achievements
                </h3>
                <ul className="space-y-2.5">
                  {activeModalAward.subsystemHighlights.map((highlight, index) => (
                    <li
                      key={index}
                      className="p-3 bg-white/5 border border-white/5 ares-cut-sm text-xs md:text-sm text-marble leading-relaxed flex items-start gap-2.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-ares-red shrink-0 mt-2" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Engineering Portfolio Section Link & Reference */}
              <div className="mb-8 p-5 bg-white/5 border border-white/10 ares-cut-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-ares-gold flex items-center gap-2">
                    <BookOpen size={14} /> Engineering Portfolio Reference
                  </span>
                  <span className="text-[10px] font-bold text-marble/60 uppercase tracking-widest">
                    {activeModalAward.portfolioRef.sectionNumber} ({activeModalAward.portfolioRef.pageRange})
                  </span>
                </div>
                <h4 className="text-base font-bold text-white mb-1">
                  {activeModalAward.portfolioRef.title}
                </h4>
                <p className="text-xs text-marble/80 leading-relaxed mb-3">
                  {activeModalAward.portfolioRef.summary}
                </p>
                {activeModalAward.portfolioRef.cadLink && (
                  <a
                    href={activeModalAward.portfolioRef.cadLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-ares-cyan hover:underline uppercase tracking-wider"
                  >
                    Open Season CAD in Onshape <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* Approved Public Leadership Citation (if applicable) */}
              {activeModalAward.leadershipCitation && (
                <div className="mb-6 p-4 bg-purple-950/20 border border-purple-500/30 ares-cut-sm">
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 block mb-1">
                    Approved Public Leadership Citation
                  </span>
                  <p className="text-xs font-bold text-white">
                    {activeModalAward.leadershipCitation}
                  </p>
                </div>
              )}

              {/* Modal Footer / Zero PII Confirmation */}
              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[10px] text-marble/60 uppercase font-medium">
                  <ShieldCheck size={14} className="text-ares-cyan" />
                  <span>Public record verified under FIRST® Youth Protection Policy</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModalAward(null)}
                  className="px-6 py-2.5 bg-ares-red hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest ares-cut-sm self-end sm:self-auto transition-colors"
                >
                  Close
                </button>
              </div>
          </div>
        </div>
      )}

      {/* Support & Community Section */}
      <section className="py-24 px-6 bg-obsidian border-t border-white/5">
        <div className="max-w-4xl mx-auto p-10 md:p-14 ares-cut bg-obsidian border border-white/10 text-center shadow-2xl relative overflow-hidden">
          <Trophy className="text-ares-gold mx-auto mb-6 relative z-10" size={56} strokeWidth={1.5} />
          <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tighter relative z-10 uppercase">
            Fuel the Next Championship.
          </h2>
          <p className="text-marble text-base md:text-lg mb-8 max-w-xl mx-auto relative z-10 font-medium">
            Our trophies and banners are made possible through the generosity of sponsors, mentors, and community partners. Help us equip the next generation of engineers.
          </p>
          <div className="flex flex-wrap justify-center gap-4 relative z-10">
            <Link
              to="/sponsors"
              className="px-8 py-4 bg-white text-ares-red font-black ares-cut-sm hover:scale-105 transition-all shadow-lg text-xs uppercase tracking-widest"
            >
              SPONSOR ARES
            </Link>
            <Link
              to="/join"
              className="px-8 py-4 bg-obsidian text-white font-black ares-cut-sm hover:bg-white/10 transition-all border border-white/10 text-xs uppercase tracking-widest"
            >
              JOIN THE TEAM
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
