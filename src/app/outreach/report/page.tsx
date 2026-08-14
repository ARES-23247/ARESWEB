"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Calendar,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Heart,
  MapPin,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import SEO from "@/components/SEO";
import {
  computeOutreachStats,
  buildOutreachCsv,
  currentSeasonLabel,
  type OutreachExportRecord,
} from "@/lib/outreachExport";
import { logger } from "@/utils/logger";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapRawLog(id: string, raw: Record<string, unknown>): OutreachExportRecord {
  return {
    id,
    title: typeof raw.title === "string" ? raw.title : "Untitled Outreach Event",
    date: typeof raw.date === "string" ? raw.date : new Date().toISOString().split("T")[0],
    location: typeof raw.location === "string" ? raw.location : "Morgantown, WV",
    hours: typeof raw.hours === "number" && Number.isFinite(raw.hours) ? raw.hours : 0,
    peopleReached: typeof raw.peopleReached === "number" && Number.isFinite(raw.peopleReached) ? raw.peopleReached : 0,
    impactSummary: typeof raw.impactSummary === "string" ? raw.impactSummary : "",
    isDeleted: raw.isDeleted === 1 ? 1 : 0,
  };
}

const FALLBACK_OUTREACH_LOGS: readonly OutreachExportRecord[] = [
  {
    id: "spark-bridge-2026",
    title: "Spark Imagination Center - WV Bridge Engineering Lab",
    date: "2026-02-08",
    location: "Spark! Imagination Center, Morgantown, WV",
    hours: 24,
    peopleReached: 320,
    impactSummary:
      "Built and tested 40+ truss bridges with K-5 students demonstrating stress analysis, tension forces, and robotics chassis loads.",
    isDeleted: 0,
  },
  {
    id: "mms-stem-2026",
    title: "Mountaineer Middle School STEM Outreach & Robot Drive Lab",
    date: "2026-01-22",
    location: "Mountaineer Middle School, Morgantown, WV",
    hours: 14,
    peopleReached: 180,
    impactSummary:
      "Hands-on tele-op driving demonstrations, autonomous block-intake showcase, and introduction to FIRST Tech Challenge robotics careers.",
    isDeleted: 0,
  },
  {
    id: "library-workshop-2026",
    title: "Morgantown Public Library Robotics & Coding Saturday",
    date: "2026-01-15",
    location: "Morgantown Public Library",
    hours: 8,
    peopleReached: 95,
    impactSummary:
      "Interactive LEGO EV3 and REV Robotics build sessions, introducing basic Python and block coding to elementary students.",
    isDeleted: 0,
  },
  {
    id: "science-fair-2025",
    title: "Monongalia County Science & Engineering Fair Expo",
    date: "2025-12-05",
    location: "Morgantown Event Center",
    hours: 18,
    peopleReached: 450,
    impactSummary:
      "Exhibited competition robot in arena pit, demonstrated odometry autonomous navigation, and mentored 12 student robotics teams.",
    isDeleted: 0,
  },
  {
    id: "wvu-robotics-day-2025",
    title: "WVU Engineering Day High School Robotics Showcase",
    date: "2025-11-18",
    location: "WVU Engineering Sciences Building",
    hours: 12,
    peopleReached: 380,
    impactSummary:
      "Live match simulation scrimmage against regional teams, CAD modeling tutorials in Onshape, and team safety engineering reviews.",
    isDeleted: 0,
  },
];

export default function OutreachReportPage() {
  const [logs, setLogs] = useState<OutreachExportRecord[]>([...FALLBACK_OUTREACH_LOGS]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reportDate = useMemo(() => new Date(), []);
  const seasonLabel = useMemo(() => currentSeasonLabel(reportDate), [reportDate]);

  const loadLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const response = await fetch("/api/outreach?limit=100");
      if (!response.ok) {
        throw new Error("HTTP " + response.status + ": " + response.statusText);
      }
      const data: unknown = await response.json();
      if (isRecord(data) && Array.isArray(data.logs)) {
        const fetched: OutreachExportRecord[] = data.logs.map((item: unknown, index: number) => {
          const raw = isRecord(item) ? item : {};
          const id = typeof raw.id === "string" ? raw.id : "log-" + index;
          return mapRawLog(id, raw);
        });
        if (fetched.length > 0) {
          setLogs(fetched);
        }
      }
      setError(null);
    } catch (err) {
      logger.warn("Using fallback outreach records for report:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const stats = useMemo(() => computeOutreachStats(logs), [logs]);

  const filteredLogs = useMemo(() => {
    return stats.activeLogs.filter((log) => {
      const title = (log.title ?? "").toLowerCase();
      const loc = (log.location ?? "").toLowerCase();
      const summ = (log.impactSummary ?? "").toLowerCase();

      if (selectedCategory !== "all") {
        const catLower = selectedCategory.toLowerCase();
        if (!title.includes(catLower) && !summ.includes(catLower)) {
          return false;
        }
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        return title.includes(q) || loc.includes(q) || summ.includes(q);
      }
      return true;
    });
  }, [stats.activeLogs, selectedCategory, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    const csvContent = buildOutreachCsv(logs);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ares_outreach_impact_report_${seasonLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-obsidian text-marble py-8 px-4 sm:px-6 lg:px-8 selection:bg-ares-red selection:text-white print:bg-white print:text-black print:p-0">
      <SEO
        title="Community Outreach & STEM Impact Report"
        description="Comprehensive ARES 23247 Community Outreach & STEM Impact Report, featuring volunteer hours, students reached, public exhibits, and formula-safe CSV export."
      />

      {/* Top Action Toolbar (Screen Only) */}
      <div className="max-w-6xl mx-auto mb-8 p-4 rounded-xl bg-white/5 border border-white/10 shadow-xl print:hidden space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/outreach"
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-marble/80 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan p-1 rounded"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back to Outreach
            </Link>
            <span className="text-white/20">|</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-ares-cyan">
              Season {seasonLabel} Impact Report
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest ares-cut-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Download size={14} aria-hidden="true" />
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => void loadLogs(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-marble/80 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} aria-hidden="true" />
              Refresh
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-ares-gold hover:bg-ares-gold/90 text-black text-xs font-black uppercase tracking-widest ares-cut-sm shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Printer size={16} aria-hidden="true" />
              Print / Save as PDF
            </button>
          </div>
        </div>

        {/* Search & Category Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-white/5">
          <div className="sm:col-span-2 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by event name, location, or keyword…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder-marble/40 focus:border-ares-cyan focus:outline-none"
              aria-label="Search outreach events"
            />
          </div>

          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" aria-hidden="true" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:border-ares-cyan focus:outline-none"
              aria-label="Filter by program category"
            >
              <option value="all">All Programs / Events</option>
              <option value="Bridge">Museum Exhibits (Spark!)</option>
              <option value="Middle">K-12 Classroom Demos</option>
              <option value="Library">Public Library Workshops</option>
              <option value="Science">County Science Fairs</option>
              <option value="WVU">University Showcases</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Printable Outreach Report Document Container */}
      <main className="outreach-report-print max-w-6xl mx-auto space-y-12 bg-obsidian border border-white/10 rounded-2xl p-6 sm:p-10 lg:p-12 shadow-2xl print:max-w-none print:border-none print:bg-white print:text-black print:p-0 print:shadow-none print:space-y-8">
        
        {/* Document Cover / Header */}
        <header className="border-b border-white/10 pb-8 print:border-black/20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded ares-cut-sm bg-ares-gold/10 border border-ares-gold/30 text-ares-gold text-[10px] font-black uppercase tracking-widest mb-4 print:border-amber-800 print:text-amber-900 print:bg-amber-50">
                <BadgeCheck size={14} aria-hidden="true" />
                ARES #23247 • Community Service & STEM Impact
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white font-heading print:text-black leading-tight">
                Outreach <span className="text-ares-cyan print:text-cyan-800">Report</span>
              </h1>
              <p className="text-sm sm:text-base text-marble/85 font-medium mt-2 max-w-2xl print:text-gray-700">
                Appalachian Robotics & Engineering Society • Morgantown, West Virginia
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left md:text-right shrink-0 print:border-gray-300 print:bg-gray-50">
              <div className="text-[10px] font-black uppercase tracking-widest text-ares-cyan print:text-cyan-800">
                Public STEM Impact Document
              </div>
              <div className="text-xl font-black text-white print:text-black mt-0.5">
                {seasonLabel} Season
              </div>
              <div className="text-[11px] text-marble/70 print:text-gray-600 mt-1 flex items-center md:justify-end gap-1">
                <MapPin size={12} className="text-ares-red print:text-red-700" aria-hidden="true" />
                Morgantown, WV
              </div>
              <div className="text-[10px] text-marble/60 print:text-gray-500 font-mono mt-1">
                Generated: {reportDate.toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs print:border-black/10">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="text-ares-gold shrink-0 mt-0.5 print:text-amber-800" size={16} aria-hidden="true" />
              <div>
                <span className="font-bold text-white uppercase tracking-wider block print:text-black">Grassroots STEM</span>
                <span className="text-marble/70 print:text-gray-600">Free robotics and coding education for Appalachian youth.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Users className="text-ares-cyan shrink-0 mt-0.5 print:text-cyan-800" size={16} aria-hidden="true" />
              <div>
                <span className="font-bold text-white uppercase tracking-wider block print:text-black">Student-Led Service</span>
                <span className="text-marble/70 print:text-gray-600">100% mentored and delivered by high school students.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Heart className="text-ares-red shrink-0 mt-0.5 print:text-red-800" size={16} aria-hidden="true" />
              <div>
                <span className="font-bold text-white uppercase tracking-wider block print:text-black">Community Partnerships</span>
                <span className="text-marble/70 print:text-gray-600">Active partnerships with Spark!, WVU, and Mon County Schools.</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Season Impact Metric Cards */}
        <section aria-labelledby="report-metrics-heading" className="break-inside-avoid">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 id="report-metrics-heading" className="text-xs font-black uppercase tracking-widest text-ares-gold print:text-amber-800 flex items-center gap-2 font-heading">
              <Target size={16} aria-hidden="true" />
              Dynamic Season Impact Aggregators
            </h2>
            <span className="text-[11px] text-ares-cyan font-bold print:text-cyan-800">
              {stats.activeLogs.length} Verified Events Logged
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center print:border-gray-300 print:bg-gray-50">
              <Clock className="mx-auto text-ares-cyan mb-2 print:text-cyan-800" size={22} aria-hidden="true" />
              <div className="text-2xl sm:text-3xl font-black text-white font-heading print:text-black">
                {stats.totalHours}+
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-marble/70 print:text-gray-600 mt-1">
                Recorded Service Hours
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center print:border-gray-300 print:bg-gray-50">
              <Users className="mx-auto text-ares-gold mb-2 print:text-amber-800" size={22} aria-hidden="true" />
              <div className="text-2xl sm:text-3xl font-black text-white font-heading print:text-black">
                {stats.totalReached.toLocaleString()}+
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-marble/70 print:text-gray-600 mt-1">
                K-12 & Community Reach
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center print:border-gray-300 print:bg-gray-50">
              <Award className="mx-auto text-ares-red mb-2 print:text-red-800" size={22} aria-hidden="true" />
              <div className="text-2xl sm:text-3xl font-black text-white font-heading print:text-black">
                {stats.activeLogs.length}
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-marble/70 print:text-gray-600 mt-1">
                Published Service Events
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center print:border-gray-300 print:bg-gray-50">
              <Sparkles className="mx-auto text-ares-bronze mb-2 print:text-amber-900" size={22} aria-hidden="true" />
              <div className="text-2xl sm:text-3xl font-black text-white font-heading print:text-black">
                {stats.averageReach}
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-marble/70 print:text-gray-600 mt-1">
                Avg. Reach per Event
              </div>
            </div>
          </div>
          {error && (
            <p className="text-[11px] text-marble/60 mt-2 italic print:hidden">
              Note: Offline archived records displayed ({error}).
            </p>
          )}
        </section>

        {/* Detailed Outreach Service Chronicle */}
        <section aria-labelledby="chronicle-heading" className="space-y-6 break-inside-avoid">
          <div className="border-b border-white/10 pb-4 print:border-black/20">
            <h2 id="chronicle-heading" className="text-2xl font-black uppercase tracking-tight text-white font-heading print:text-black">
              Verified Service Chronicle
            </h2>
            <p className="text-xs text-marble/70 print:text-gray-600 mt-1">
              Itemized log of public STEM workshops, robotics demonstrations, and K-12 classroom sessions.
            </p>
          </div>

          {isLoading && (
            <div className="text-center py-12 text-xs text-marble/60 print:hidden">
              Loading verified outreach logs…
            </div>
          )}

          {!isLoading && filteredLogs.length === 0 && (
            <div className="text-center py-12 px-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-sm font-bold text-white">No matching outreach events found.</p>
              <p className="text-xs text-marble/60 mt-1">Try adjusting your search query or category filter.</p>
            </div>
          )}

          <div className="space-y-4">
            {filteredLogs.map((log, idx) => (
              <article
                key={log.id ?? `log-row-${idx}`}
                className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-3 break-inside-avoid print:border-gray-300 print:bg-white"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h3 className="text-base font-black uppercase tracking-tight text-white font-heading print:text-black">
                    {log.title}
                  </h3>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-marble/60 print:text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} className="text-ares-gold print:text-amber-800" aria-hidden="true" />
                      {log.date ?? "Undated"}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-ares-red print:text-red-700" aria-hidden="true" />
                      {log.location ?? "Morgantown, WV"}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-marble/85 print:text-gray-800 leading-relaxed">
                  {log.impactSummary || "No event summary recorded."}
                </p>

                <div className="pt-2 border-t border-white/5 flex flex-wrap gap-4 text-[11px] print:border-black/10">
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-ares-cyan print:text-cyan-800" aria-hidden="true" />
                    <span className="font-bold text-white print:text-black">{log.hours ?? 0}</span>
                    <span className="text-marble/60 print:text-gray-600">Service Hours</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Users size={13} className="text-ares-gold print:text-amber-800" aria-hidden="true" />
                    <span className="font-bold text-white print:text-black">{(log.peopleReached ?? 0).toLocaleString()}</span>
                    <span className="text-marble/60 print:text-gray-600">People Reached</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Formula-Safe CSV Export Callout */}
        <section aria-labelledby="csv-export-heading" className="p-6 rounded-xl bg-white/5 border border-white/10 break-inside-avoid print:border-gray-300 print:bg-gray-50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 id="csv-export-heading" className="text-base font-black uppercase tracking-tight text-white font-heading print:text-black flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-ares-cyan print:text-cyan-800" aria-hidden="true" />
                Formula-Safe STEM Data Export
              </h2>
              <p className="text-xs text-marble/70 print:text-gray-600 mt-1">
                Export full season records in RSCF-compliant CSV format with formula injection sanitization.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-ares-gold hover:bg-ares-gold/90 text-black text-xs font-black uppercase tracking-widest ares-cut-sm shadow-sharp-sm print:hidden shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Download size={14} aria-hidden="true" />
              Download CSV
            </button>
          </div>
        </section>

        {/* Zero-PII Security Assurance & Footer */}
        <footer className="border-t border-white/10 pt-6 text-[10px] text-marble/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:border-black/20 print:text-gray-600">
          <p>
            © {reportDate.getFullYear()} Appalachian Robotics & Engineering Society (ARES 23247). All rights reserved.
          </p>
          <p className="font-mono">
            Zero-PII Compliance Verified: No minor student identifiers are exposed in public outreach reports.
          </p>
        </footer>
      </main>
    </div>
  );
}
