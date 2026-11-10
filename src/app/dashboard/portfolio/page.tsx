"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import SEO from "@/components/SEO";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";

type ArtifactKind =
  | "studio_notebook"
  | "blog_post"
  | "robot"
  | "task"
  | "outreach"
  | "finance"
  | "sponsor";

interface CandidateArtifact {
  id: string;
  kind: ArtifactKind;
  title: string;
  subtitle: string;
  date: string;
  href: string;
}

interface ControlSheetData {
  autonomousRoutines: string;
  sensorsUsed: string;
  algorithmsSummary: string;
}

interface AwardEntry {
  awardId:
    | "inspire"
    | "think"
    | "connect"
    | "innovate"
    | "control"
    | "motivate"
    | "design";
  name: string;
  criteria: string;
  claimSummary: string;
  linkedArtifactIds: string[];
  verifiedArtifactCount: number;
  needsEvidence: boolean;
  controlSheet?: ControlSheetData;
}

type PageSection =
  | "cover"
  | "team_sustainability"
  | "hardware_cad"
  | "software_control"
  | "outreach_connect";

type PageStatus = "missing" | "drafting" | "verified";

interface PortfolioPageEntry {
  pageNumber: number;
  title: string;
  section: PageSection;
  status: PageStatus;
  ownerNickname: string;
  summaryNotes: string;
  linkedArtifactIds: string[];
}

interface PortfolioWorkspaceResponse {
  seasonKey: string;
  workspace: {
    awards: AwardEntry[];
    pages: PortfolioPageEntry[];
    updatedAt: string;
    updatedByNickname: string;
  };
  candidates: CandidateArtifact[];
}

const SEASON_OPTIONS = ["2026-2027", "2025-2026", "2024-2025"] as const;

const KIND_LABELS: Record<ArtifactKind, string> = {
  studio_notebook: "Studio Notebook",
  blog_post: "Published Post",
  robot: "Robot Spec",
  task: "Completed Task",
  outreach: "Outreach Log",
  finance: "Finance Entry",
  sponsor: "Sponsor Partner",
};

const SECTION_LABELS: Record<PageSection, string> = {
  cover: "Cover & Executive Summary",
  team_sustainability: "Team & Sustainability",
  hardware_cad: "Hardware & CAD Engineering",
  software_control: "Software, Sensors & Control",
  outreach_connect: "Outreach & STEM Connect",
};

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function DashboardPortfolioPage() {
  const { authorizedUser } = useAuth();
  const [seasonKey, setSeasonKey] = useState<string>(SEASON_OPTIONS[0]);
  const [activeTab, setActiveTab] = useState<"awards" | "pages">("awards");
  const [awards, setAwards] = useState<AwardEntry[]>([]);
  const [pages, setPages] = useState<PortfolioPageEntry[]>([]);
  const [candidates, setCandidates] = useState<CandidateArtifact[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [updatedByNickname, setUpdatedByNickname] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveBanner, setSaveBanner] = useState<{
    tone: "ok" | "err";
    message: string;
  } | null>(null);

  const [artifactKindFilter, setArtifactKindFilter] = useState<"all" | ArtifactKind>("all");
  const [selectedCandidateByAward, setSelectedCandidateByAward] = useState<
    Record<string, string>
  >({});
  const [selectedCandidateByPage, setSelectedCandidateByPage] = useState<
    Record<number, string>
  >({});
  const [printMode, setPrintMode] = useState<"pit_summary" | "control_sheet">(
    "pit_summary",
  );

  const isUnverified =
    !authorizedUser ||
    authorizedUser.role === "unverified" ||
    authorizedUser.role === "Pending Verification";

  const loadWorkspace = useCallback(async () => {
    if (isUnverified) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setSaveBanner(null);
    try {
      const response = await authenticatedFetch(
        `/api/content-admin/portfolio/${encodeURIComponent(seasonKey)}`,
      );
      const payload = (await response.json().catch(() => ({}))) as Partial<
        PortfolioWorkspaceResponse
      > & { error?: string };
      if (!response.ok || !payload.workspace) {
        throw new Error(
          payload.error || `HTTP ${response.status}: Unable to load portfolio workspace.`,
        );
      }
      setAwards(payload.workspace.awards);
      setPages(payload.workspace.pages);
      setCandidates(payload.candidates ?? []);
      setUpdatedAt(payload.workspace.updatedAt || "");
      setUpdatedByNickname(payload.workspace.updatedByNickname || "");
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load portfolio workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [isUnverified, seasonKey]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const candidateById = useMemo(() => {
    const map = new Map<string, CandidateArtifact>();
    for (const item of candidates) {
      map.set(item.id, item);
    }
    return map;
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    if (artifactKindFilter === "all") return candidates;
    return candidates.filter((c) => c.kind === artifactKindFilter);
  }, [artifactKindFilter, candidates]);

  const awardsBackedCount = useMemo(
    () =>
      awards.filter((award) =>
        award.linkedArtifactIds.some((id) => candidateById.has(id)),
      ).length,
    [awards, candidateById],
  );

  const verifiedPagesCount = useMemo(
    () => pages.filter((page) => page.status === "verified").length,
    [pages],
  );

  const handleSaveWorkspace = async () => {
    setSaving(true);
    setSaveBanner(null);
    try {
      const response = await authenticatedFetch(
        `/api/content-admin/portfolio/${encodeURIComponent(seasonKey)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            awards: awards.map((award) => ({
              awardId: award.awardId,
              claimSummary: award.claimSummary,
              linkedArtifactIds: award.linkedArtifactIds,
              ...(award.awardId === "control"
                ? {
                    controlSheet: award.controlSheet ?? {
                      autonomousRoutines: "",
                      sensorsUsed: "",
                      algorithmsSummary: "",
                    },
                  }
                : {}),
            })),
            pages,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        workspace?: PortfolioWorkspaceResponse["workspace"];
        error?: string;
      };
      if (!response.ok || !payload.workspace) {
        throw new Error(payload.error || `HTTP ${response.status}: Save failed.`);
      }
      setAwards(payload.workspace.awards);
      setPages(payload.workspace.pages);
      setUpdatedAt(payload.workspace.updatedAt || "");
      setUpdatedByNickname(payload.workspace.updatedByNickname || "");
      setSaveBanner({
        tone: "ok",
        message: "Portfolio workspace saved and verified against live artifacts.",
      });
    } catch (error) {
      setSaveBanner({
        tone: "err",
        message: error instanceof Error ? error.message : "Failed to save workspace.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddArtifactToAward = (awardId: AwardEntry["awardId"]) => {
    const picked = selectedCandidateByAward[awardId] || filteredCandidates[0]?.id;
    if (!picked) return;
    setAwards((prev) =>
      prev.map((award) => {
        if (award.awardId !== awardId) return award;
        if (award.linkedArtifactIds.includes(picked)) return award;
        const nextIds = [...award.linkedArtifactIds, picked].slice(0, 25);
        const verifiedCount = nextIds.filter((id) => candidateById.has(id)).length;
        return {
          ...award,
          linkedArtifactIds: nextIds,
          verifiedArtifactCount: verifiedCount,
          needsEvidence: verifiedCount === 0,
        };
      }),
    );
  };

  const handleRemoveArtifactFromAward = (
    awardId: AwardEntry["awardId"],
    artifactId: string,
  ) => {
    setAwards((prev) =>
      prev.map((award) => {
        if (award.awardId !== awardId) return award;
        const nextIds = award.linkedArtifactIds.filter((id) => id !== artifactId);
        const verifiedCount = nextIds.filter((id) => candidateById.has(id)).length;
        return {
          ...award,
          linkedArtifactIds: nextIds,
          verifiedArtifactCount: verifiedCount,
          needsEvidence: verifiedCount === 0,
        };
      }),
    );
  };

  const handleAddArtifactToPage = (pageNumber: number) => {
    const picked = selectedCandidateByPage[pageNumber] || filteredCandidates[0]?.id;
    if (!picked) return;
    setPages((prev) =>
      prev.map((page) => {
        if (page.pageNumber !== pageNumber) return page;
        if (page.linkedArtifactIds.includes(picked)) return page;
        return {
          ...page,
          linkedArtifactIds: [...page.linkedArtifactIds, picked].slice(0, 25),
        };
      }),
    );
  };

  const handleExportMarkdown = () => {
    const lines: string[] = [
      `# ARES FTC 23247 — Engineering Portfolio & Judged Award Packet (${seasonKey})`,
      "",
      `Generated from verified portal artifacts (${awardsBackedCount}/7 awards backed, ${verifiedPagesCount}/15 pages verified).`,
      "",
      "## 1. FTC Judged Award Rubric Readiness",
      "",
    ];

    for (const award of awards) {
      const resolvedArtifacts = award.linkedArtifactIds
        .map((id) => candidateById.get(id))
        .filter((item): item is CandidateArtifact => Boolean(item));
      lines.push(
        `### ${award.name} — ${
          resolvedArtifacts.length > 0
            ? `Backed (${resolvedArtifacts.length} artifacts)`
            : "Unverified — Needs Evidence"
        }`,
      );
      lines.push(
        `- **Claim Summary:** ${award.claimSummary || "Pending verified claim summary."}`,
      );
      if (resolvedArtifacts.length > 0) {
        for (const art of resolvedArtifacts) {
          lines.push(`  - [${KIND_LABELS[art.kind]}] ${art.title} (${art.subtitle})`);
        }
      }
      if (award.awardId === "control" && award.controlSheet) {
        lines.push(
          `- **Autonomous Routines:** ${award.controlSheet.autonomousRoutines || "Pending"}`,
        );
        lines.push(
          `- **Sensors Used:** ${award.controlSheet.sensorsUsed || "Pending"}`,
        );
        lines.push(
          `- **Control Algorithms:** ${award.controlSheet.algorithmsSummary || "Pending"}`,
        );
      }
      lines.push("");
    }

    lines.push("## 2. 15-Page Engineering Portfolio Storyboard", "");
    for (const page of pages) {
      lines.push(
        `- **Page ${page.pageNumber} [${page.status.toUpperCase()}] — ${page.title}** (${SECTION_LABELS[page.section]}${
          page.ownerNickname ? ` • Owner: ${page.ownerNickname}` : ""
        })`,
      );
      if (page.summaryNotes) {
        lines.push(`  - Notes: ${page.summaryNotes}`);
      }
    }

    downloadTextFile(
      `ares-23247-portfolio-${seasonKey}.md`,
      lines.join("\n"),
      "text/markdown;charset=utf-8",
    );
  };

  const handleExportCsv = () => {
    const header = [
      "PageNumber",
      "Section",
      "Status",
      "OwnerNickname",
      "Title",
      "LinkedArtifactCount",
      "SummaryNotes",
    ].join(",");
    const rows = pages.map((page) =>
      [
        String(page.pageNumber),
        escapeCsvCell(SECTION_LABELS[page.section]),
        escapeCsvCell(page.status),
        escapeCsvCell(page.ownerNickname),
        escapeCsvCell(page.title),
        String(page.linkedArtifactIds.length),
        escapeCsvCell(page.summaryNotes),
      ].join(","),
    );
    downloadTextFile(
      `ares-23247-portfolio-pages-${seasonKey}.csv`,
      [header, ...rows].join("\n"),
      "text/csv;charset=utf-8",
    );
  };

  const handleTriggerPrint = (mode: "pit_summary" | "control_sheet") => {
    setPrintMode(mode);
    window.setTimeout(() => {
      window.print();
    }, 50);
  };

  const controlAwardEntry = useMemo(
    () => awards.find((a) => a.awardId === "control"),
    [awards],
  );

  if (isUnverified) {
    return (
      <div className="glass-card border border-white/10 p-8 rounded-2xl text-center space-y-3">
        <h1 className="text-xl font-black uppercase font-heading text-white">
          Engineering Portfolio &amp; Awards Hub
        </h1>
        <p className="text-sm text-marble/75">
          Verified team membership is required to curate Engineering Portfolio evidence.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEO
        title="Portfolio & Awards Hub | ARES Command Center"
        description="Curate FTC 15-page Engineering Portfolio evidence and 7 Judged Award rubrics from live ARES 23247 portal records."
        noindex
      />

      {/* Screen Workspace */}
      <div className="space-y-6 print:hidden">
        {/* Header */}
        <header className="glass-card border border-white/10 p-6 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-ares-gold">
              <Award size={14} aria-hidden="true" /> FTC Judging &amp; Documentation Command
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase font-heading text-white tracking-tight">
              Engineering Portfolio &amp; Award Evidence Hub
            </h1>
            <p className="text-xs sm:text-sm text-marble/75 max-w-3xl">
              Map live ARES Studio notebooks, CAD robot specs, completed tasks, outreach logs,
              financial grants, and sponsors directly to FTC&apos;s 7 judged awards and 15-page
              portfolio budget. Zero fabricated claims — unbacked sections are flagged explicitly.
            </p>
            {updatedAt && (
              <p className="text-[11px] text-marble/60 font-mono">
                Last saved {new Date(updatedAt).toLocaleString()}
                {updatedByNickname ? ` by ${updatedByNickname}` : ""}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div>
              <label htmlFor="portfolio-season-select" className="sr-only">
                Select FTC Season
              </label>
              <select
                id="portfolio-season-select"
                value={seasonKey}
                onChange={(e) => setSeasonKey(e.target.value)}
                className="min-h-10 rounded-lg border border-white/15 bg-obsidian px-3 py-2 text-xs font-bold uppercase tracking-wider text-white focus:border-ares-cyan focus:outline-none"
              >
                {SEASON_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    Season {opt}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void handleSaveWorkspace()}
              disabled={saving || loading}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ares-red px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-ares-bronze focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
            >
              <Save size={14} aria-hidden="true" />
              {saving ? "Saving…" : "Save Workspace"}
            </button>

            <button
              type="button"
              onClick={handleExportMarkdown}
              disabled={loading || awards.length === 0}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-marble hover:border-ares-gold/50 hover:text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
            >
              <Download size={14} aria-hidden="true" /> Markdown
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading || pages.length === 0}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-marble hover:border-ares-gold/50 hover:text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
            >
              <FileSpreadsheet size={14} aria-hidden="true" /> CSV Outline
            </button>

            <button
              type="button"
              onClick={() => handleTriggerPrint("pit_summary")}
              disabled={loading || awards.length === 0}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-ares-gold/40 bg-ares-gold/15 px-3 py-2 text-xs font-black uppercase tracking-wider text-ares-gold hover:bg-ares-gold/25 focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
            >
              <Printer size={14} aria-hidden="true" /> Print Judges&apos; Handout
            </button>

            <button
              type="button"
              onClick={() => handleTriggerPrint("control_sheet")}
              disabled={loading || awards.length === 0}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-ares-cyan/40 bg-ares-cyan/10 px-3 py-2 text-xs font-black uppercase tracking-wider text-ares-cyan hover:bg-ares-cyan/20 focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
            >
              <Printer size={14} aria-hidden="true" /> Print Control Sheet
            </button>
          </div>
        </header>

        {saveBanner && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-xs font-bold flex items-center gap-2 ${
              saveBanner.tone === "ok"
                ? "border-ares-success/40 bg-ares-success/10 text-ares-success"
                : "border-ares-red/40 bg-ares-red/10 text-ares-red-light"
            }`}
          >
            {saveBanner.tone === "ok" ? (
              <CheckCircle2 size={15} aria-hidden="true" />
            ) : (
              <AlertCircle size={15} aria-hidden="true" />
            )}
            <span>{saveBanner.message}</span>
          </div>
        )}

        {loadError ? (
          <div
            role="alert"
            className="glass-card border border-ares-red/40 bg-ares-red/10 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                size={20}
                className="text-ares-red-light shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-sm font-black uppercase text-white">
                  Unable to load portfolio workspace
                </h2>
                <p className="text-xs text-marble/80 mt-1">{loadError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadWorkspace()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-obsidian px-3.5 py-2 text-xs font-bold text-white hover:border-ares-cyan focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <RefreshCw size={13} aria-hidden="true" /> Retry
            </button>
          </div>
        ) : loading ? (
          <div
            role="status"
            className="glass-card border border-white/10 p-10 rounded-2xl text-center text-sm text-marble/75"
          >
            Indexing live Studio notebooks, CAD robots, completed tasks, outreach, and budget
            evidence…
          </div>
        ) : (
          <>
            {/* KPI Readiness Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-card border border-white/10 p-4 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-marble/60 block">
                  Awards Backed by Live Evidence
                </span>
                <p className="text-2xl font-black text-white mt-1">
                  {awardsBackedCount}{" "}
                  <span className="text-xs font-bold text-marble/60">/ 7 FTC Awards</span>
                </p>
              </div>
              <div className="glass-card border border-white/10 p-4 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-marble/60 block">
                  15-Page Budget Verified
                </span>
                <p className="text-2xl font-black text-ares-gold mt-1">
                  {verifiedPagesCount}{" "}
                  <span className="text-xs font-bold text-marble/60">/ 15 Pages Ready</span>
                </p>
              </div>
              <div className="glass-card border border-white/10 p-4 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-marble/60 block">
                  Live Portal Artifacts Available
                </span>
                <p className="text-2xl font-black text-ares-cyan mt-1">
                  {candidates.length}{" "}
                  <span className="text-xs font-bold text-marble/60">indexed records</span>
                </p>
              </div>
            </div>

            {/* Tabs + Artifact Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div role="tablist" aria-label="Portfolio workspace views" className="flex gap-2">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "awards"}
                  onClick={() => setActiveTab("awards")}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                    activeTab === "awards"
                      ? "bg-ares-red text-white"
                      : "border border-white/10 bg-white/5 text-marble hover:text-white"
                  }`}
                >
                  <Award size={14} aria-hidden="true" /> 7-Award Rubric Matrix
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "pages"}
                  onClick={() => setActiveTab("pages")}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                    activeTab === "pages"
                      ? "bg-ares-red text-white"
                      : "border border-white/10 bg-white/5 text-marble hover:text-white"
                  }`}
                >
                  <Layers size={14} aria-hidden="true" /> 15-Page Portfolio Storyboard
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="artifact-kind-filter"
                  className="text-[10px] font-black uppercase tracking-wider text-marble/65"
                >
                  Evidence Filter:
                </label>
                <select
                  id="artifact-kind-filter"
                  value={artifactKindFilter}
                  onChange={(e) =>
                    setArtifactKindFilter(e.target.value as "all" | ArtifactKind)
                  }
                  className="rounded border border-white/15 bg-obsidian px-2.5 py-1.5 text-xs text-white focus:border-ares-cyan focus:outline-none"
                >
                  <option value="all">All Artifact Types ({candidates.length})</option>
                  {(Object.keys(KIND_LABELS) as ArtifactKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeTab === "awards" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {awards.map((award) => {
                  const resolved = award.linkedArtifactIds
                    .map((id) => candidateById.get(id))
                    .filter((item): item is CandidateArtifact => Boolean(item));
                  const needsEvidence = resolved.length === 0;

                  return (
                    <section
                      key={award.awardId}
                      aria-labelledby={`award-heading-${award.awardId}`}
                      className="glass-card border border-white/10 p-5 rounded-2xl space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h2
                              id={`award-heading-${award.awardId}`}
                              className="text-base font-black uppercase font-heading text-white"
                            >
                              {award.name}
                            </h2>
                            <p className="text-xs text-marble/70 mt-0.5">{award.criteria}</p>
                          </div>
                          {needsEvidence ? (
                            <span className="rounded-full border border-ares-gold/40 bg-ares-gold/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-ares-gold">
                              Unverified — Needs Evidence
                            </span>
                          ) : (
                            <span className="rounded-full border border-ares-success/40 bg-ares-success/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-ares-success">
                              Evidence Linked ({resolved.length})
                            </span>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor={`claim-${award.awardId}`}
                            className="block text-[10px] font-black uppercase tracking-wider text-marble/65 mb-1.5"
                          >
                            Judge Pitch &amp; Verified Claim Summary
                          </label>
                          <textarea
                            id={`claim-${award.awardId}`}
                            rows={2}
                            value={award.claimSummary}
                            onChange={(e) =>
                              setAwards((prev) =>
                                prev.map((item) =>
                                  item.awardId === award.awardId
                                    ? { ...item, claimSummary: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            placeholder="Summarize specific design trade-offs, test metrics, or community outcomes backed by linked artifacts…"
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-marble/45 focus:border-ares-cyan focus:outline-none"
                          />
                        </div>

                        {award.awardId === "control" && (
                          <div className="rounded-xl border border-ares-cyan/25 bg-ares-cyan/5 p-3.5 space-y-2.5">
                            <h3 className="text-[11px] font-black uppercase tracking-wider text-ares-cyan flex items-center gap-1.5">
                              <FileText size={13} aria-hidden="true" /> Control Award Content
                              Sheet Fields
                            </h3>
                            <div>
                              <label
                                htmlFor="control-auto-routines"
                                className="block text-[10px] font-bold uppercase tracking-wider text-marble/70 mb-1"
                              >
                                Autonomous Routines &amp; Scoring Objectives
                              </label>
                              <input
                                id="control-auto-routines"
                                type="text"
                                value={award.controlSheet?.autonomousRoutines ?? ""}
                                onChange={(e) =>
                                  setAwards((prev) =>
                                    prev.map((item) =>
                                      item.awardId === "control"
                                        ? {
                                            ...item,
                                            controlSheet: {
                                              autonomousRoutines: e.target.value,
                                              sensorsUsed:
                                                item.controlSheet?.sensorsUsed ?? "",
                                              algorithmsSummary:
                                                item.controlSheet?.algorithmsSummary ?? "",
                                            },
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="e.g. Basket side 4-sample autonomous + park"
                                className="w-full rounded border border-white/15 bg-obsidian px-2.5 py-1.5 text-xs text-white focus:border-ares-cyan focus:outline-none"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="control-sensors"
                                className="block text-[10px] font-bold uppercase tracking-wider text-marble/70 mb-1"
                              >
                                Sensors &amp; Localization Hardware
                              </label>
                              <input
                                id="control-sensors"
                                type="text"
                                value={award.controlSheet?.sensorsUsed ?? ""}
                                onChange={(e) =>
                                  setAwards((prev) =>
                                    prev.map((item) =>
                                      item.awardId === "control"
                                        ? {
                                            ...item,
                                            controlSheet: {
                                              autonomousRoutines:
                                                item.controlSheet?.autonomousRoutines ?? "",
                                              sensorsUsed: e.target.value,
                                              algorithmsSummary:
                                                item.controlSheet?.algorithmsSummary ?? "",
                                            },
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="e.g. Pinpoint Odometry, Limelight 3A, REV IMU"
                                className="w-full rounded border border-white/15 bg-obsidian px-2.5 py-1.5 text-xs text-white focus:border-ares-cyan focus:outline-none"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="control-algorithms"
                                className="block text-[10px] font-bold uppercase tracking-wider text-marble/70 mb-1"
                              >
                                Control Algorithms, Kinematics &amp; State Machines
                              </label>
                              <textarea
                                id="control-algorithms"
                                rows={2}
                                value={award.controlSheet?.algorithmsSummary ?? ""}
                                onChange={(e) =>
                                  setAwards((prev) =>
                                    prev.map((item) =>
                                      item.awardId === "control"
                                        ? {
                                            ...item,
                                            controlSheet: {
                                              autonomousRoutines:
                                                item.controlSheet?.autonomousRoutines ?? "",
                                              sensorsUsed:
                                                item.controlSheet?.sensorsUsed ?? "",
                                              algorithmsSummary: e.target.value,
                                            },
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="Describe PID/feedforward loops, trajectory following, vision fusion, and driver-assist automation…"
                                className="w-full rounded border border-white/15 bg-obsidian px-2.5 py-1.5 text-xs text-white focus:border-ares-cyan focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {/* Linked Evidence List */}
                        <div className="space-y-1.5">
                          <span className="block text-[10px] font-black uppercase tracking-wider text-marble/60">
                            Linked Portal Evidence ({resolved.length})
                          </span>
                          {resolved.length === 0 ? (
                            <p className="text-xs text-marble/55 italic">
                              No live portal records linked yet. Link Studio notebooks, robot CAD,
                              outreach, or tasks below.
                            </p>
                          ) : (
                            <ul className="space-y-1.5">
                              {resolved.map((art) => (
                                <li
                                  key={art.id}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/35 px-3 py-1.5 text-xs"
                                >
                                  <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-ares-gold mr-2">
                                      {KIND_LABELS[art.kind]}
                                    </span>
                                    <Link
                                      to={art.href}
                                      className="font-bold text-white hover:text-ares-cyan underline-offset-2 hover:underline inline-flex items-center gap-1"
                                    >
                                      {art.title}{" "}
                                      <ExternalLink size={11} aria-hidden="true" />
                                    </Link>
                                    <span className="block text-[10px] text-marble/60 truncate">
                                      {art.subtitle}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    aria-label={`Remove ${art.title} from ${award.name}`}
                                    onClick={() =>
                                      handleRemoveArtifactFromAward(award.awardId, art.id)
                                    }
                                    className="shrink-0 rounded p-1 text-marble/60 hover:text-ares-red-light focus-visible:ring-2 focus-visible:ring-ares-cyan"
                                  >
                                    <Trash2 size={13} aria-hidden="true" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      {/* Link Artifact Picker */}
                      {filteredCandidates.length > 0 && (
                        <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                          <label
                            htmlFor={`picker-award-${award.awardId}`}
                            className="sr-only"
                          >
                            Select portal artifact for {award.name}
                          </label>
                          <select
                            id={`picker-award-${award.awardId}`}
                            value={
                              selectedCandidateByAward[award.awardId] ||
                              filteredCandidates[0]?.id ||
                              ""
                            }
                            onChange={(e) =>
                              setSelectedCandidateByAward((prev) => ({
                                ...prev,
                                [award.awardId]: e.target.value,
                              }))
                            }
                            className="min-w-0 flex-1 rounded border border-white/15 bg-obsidian px-2.5 py-1.5 text-xs text-white focus:border-ares-cyan focus:outline-none"
                          >
                            {filteredCandidates.map((cand) => (
                              <option key={cand.id} value={cand.id}>
                                [{KIND_LABELS[cand.kind]}] {cand.title}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAddArtifactToAward(award.awardId)}
                            className="inline-flex shrink-0 items-center gap-1 rounded border border-ares-gold/40 bg-ares-gold/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-ares-gold hover:bg-ares-gold/25 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                          >
                            <Plus size={12} aria-hidden="true" /> Link Evidence
                          </button>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              /* 15-Page Portfolio Storyboard */
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-marble/75">
                  <BookOpen size={14} className="text-ares-gold" aria-hidden="true" />
                  <span>
                    FTC Engineering Portfolios are strictly capped at 15 total pages (Cover + 14
                    content pages). Assign owners and verify evidence per page.
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {pages.map((page) => {
                    const pageArtifacts = page.linkedArtifactIds
                      .map((id) => candidateById.get(id))
                      .filter((item): item is CandidateArtifact => Boolean(item));

                    return (
                      <div
                        key={page.pageNumber}
                        className="glass-card border border-white/10 p-4 rounded-xl space-y-3"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          <div className="md:col-span-2 flex items-center gap-2">
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ares-red/20 border border-ares-red/40 font-mono text-xs font-black text-white">
                              P{page.pageNumber}
                            </span>
                            <label
                              htmlFor={`page-status-${page.pageNumber}`}
                              className="sr-only"
                            >
                              Page {page.pageNumber} status
                            </label>
                            <select
                              id={`page-status-${page.pageNumber}`}
                              value={page.status}
                              onChange={(e) =>
                                setPages((prev) =>
                                  prev.map((p) =>
                                    p.pageNumber === page.pageNumber
                                      ? { ...p, status: e.target.value as PageStatus }
                                      : p,
                                  ),
                                )
                              }
                              className={`rounded border px-2 py-1 text-[10px] font-black uppercase tracking-wider bg-obsidian focus:outline-none ${
                                page.status === "verified"
                                  ? "border-ares-success/50 text-ares-success"
                                  : page.status === "drafting"
                                    ? "border-ares-gold/50 text-ares-gold"
                                    : "border-white/20 text-marble/70"
                              }`}
                            >
                              <option value="missing">Missing</option>
                              <option value="drafting">Drafting</option>
                              <option value="verified">Verified</option>
                            </select>
                          </div>

                          <div className="md:col-span-5">
                            <label
                              htmlFor={`page-title-${page.pageNumber}`}
                              className="sr-only"
                            >
                              Page {page.pageNumber} title
                            </label>
                            <input
                              id={`page-title-${page.pageNumber}`}
                              type="text"
                              value={page.title}
                              onChange={(e) =>
                                setPages((prev) =>
                                  prev.map((p) =>
                                    p.pageNumber === page.pageNumber
                                      ? { ...p, title: e.target.value }
                                      : p,
                                  ),
                                )
                              }
                              className="w-full rounded border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-bold text-white focus:border-ares-cyan focus:outline-none"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label
                              htmlFor={`page-section-${page.pageNumber}`}
                              className="sr-only"
                            >
                              Page {page.pageNumber} section
                            </label>
                            <select
                              id={`page-section-${page.pageNumber}`}
                              value={page.section}
                              onChange={(e) =>
                                setPages((prev) =>
                                  prev.map((p) =>
                                    p.pageNumber === page.pageNumber
                                      ? { ...p, section: e.target.value as PageSection }
                                      : p,
                                  ),
                                )
                              }
                              className="w-full rounded border border-white/15 bg-obsidian px-2.5 py-1.5 text-xs text-marble focus:border-ares-cyan focus:outline-none"
                            >
                              {(Object.keys(SECTION_LABELS) as PageSection[]).map((sec) => (
                                <option key={sec} value={sec}>
                                  {SECTION_LABELS[sec]}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label
                              htmlFor={`page-owner-${page.pageNumber}`}
                              className="sr-only"
                            >
                              Page {page.pageNumber} owner nickname
                            </label>
                            <input
                              id={`page-owner-${page.pageNumber}`}
                              type="text"
                              value={page.ownerNickname}
                              onChange={(e) =>
                                setPages((prev) =>
                                  prev.map((p) =>
                                    p.pageNumber === page.pageNumber
                                      ? { ...p, ownerNickname: e.target.value }
                                      : p,
                                  ),
                                )
                              }
                              placeholder="Owner nickname"
                              className="w-full rounded border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white placeholder:text-marble/45 focus:border-ares-cyan focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                          <div className="md:col-span-7">
                            <label
                              htmlFor={`page-notes-${page.pageNumber}`}
                              className="sr-only"
                            >
                              Page {page.pageNumber} summary notes
                            </label>
                            <input
                              id={`page-notes-${page.pageNumber}`}
                              type="text"
                              value={page.summaryNotes}
                              onChange={(e) =>
                                setPages((prev) =>
                                  prev.map((p) =>
                                    p.pageNumber === page.pageNumber
                                      ? { ...p, summaryNotes: e.target.value }
                                      : p,
                                  ),
                                )
                              }
                              placeholder="Key CAD callouts, plots, equations, or photos planned for this page…"
                              className="w-full rounded border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-marble placeholder:text-marble/45 focus:border-ares-cyan focus:outline-none"
                            />
                          </div>

                          <div className="md:col-span-5 flex items-center gap-2">
                            {filteredCandidates.length > 0 && (
                              <>
                                <label
                                  htmlFor={`picker-page-${page.pageNumber}`}
                                  className="sr-only"
                                >
                                  Select artifact for page {page.pageNumber}
                                </label>
                                <select
                                  id={`picker-page-${page.pageNumber}`}
                                  value={
                                    selectedCandidateByPage[page.pageNumber] ||
                                    filteredCandidates[0]?.id ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    setSelectedCandidateByPage((prev) => ({
                                      ...prev,
                                      [page.pageNumber]: e.target.value,
                                    }))
                                  }
                                  className="min-w-0 flex-1 rounded border border-white/15 bg-obsidian px-2 py-1 text-xs text-white focus:border-ares-cyan focus:outline-none"
                                >
                                  {filteredCandidates.map((cand) => (
                                    <option key={cand.id} value={cand.id}>
                                      [{KIND_LABELS[cand.kind]}] {cand.title}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleAddArtifactToPage(page.pageNumber)}
                                  className="shrink-0 rounded border border-ares-gold/40 bg-ares-gold/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-ares-gold hover:bg-ares-gold/25"
                                >
                                  + Link
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {pageArtifacts.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {pageArtifacts.map((art) => (
                              <span
                                key={art.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-0.5 text-[10px] text-white"
                              >
                                <span className="font-bold text-ares-gold">
                                  {KIND_LABELS[art.kind]}:
                                </span>
                                <span>{art.title}</span>
                                <button
                                  type="button"
                                  aria-label={`Unlink ${art.title} from page ${page.pageNumber}`}
                                  onClick={() =>
                                    setPages((prev) =>
                                      prev.map((p) =>
                                        p.pageNumber === page.pageNumber
                                          ? {
                                              ...p,
                                              linkedArtifactIds:
                                                p.linkedArtifactIds.filter(
                                                  (id) => id !== art.id,
                                                ),
                                            }
                                          : p,
                                      ),
                                    )
                                  }
                                  className="text-marble/60 hover:text-ares-red-light"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Printable Judge Handout / Control Award Sheet (@media print) */}
      <div className="hidden print:block bg-white text-black p-6 space-y-5">
        {printMode === "control_sheet" ? (
          <div className="space-y-4">
            <div className="border-b-2 border-black pb-3 flex items-baseline justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest">
                  FIRST Tech Challenge • Team 23247 ARES ({seasonKey})
                </p>
                <h2 className="text-2xl font-black uppercase">
                  Control Award Content Sheet Draft
                </h2>
              </div>
              <span className="text-xs font-mono">aresfirst.org</span>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <h3 className="font-black uppercase text-xs tracking-wider">
                  Summary Claim
                </h3>
                <p>
                  {controlAwardEntry?.claimSummary ||
                    "Pending verified team control summary."}
                </p>
              </div>
              <div>
                <h3 className="font-black uppercase text-xs tracking-wider">
                  Autonomous Routines &amp; Field Objectives
                </h3>
                <p>
                  {controlAwardEntry?.controlSheet?.autonomousRoutines ||
                    "Pending autonomous routine verification."}
                </p>
              </div>
              <div>
                <h3 className="font-black uppercase text-xs tracking-wider">
                  Sensors &amp; Localization Hardware
                </h3>
                <p>
                  {controlAwardEntry?.controlSheet?.sensorsUsed ||
                    "Pending sensor list verification."}
                </p>
              </div>
              <div>
                <h3 className="font-black uppercase text-xs tracking-wider">
                  Control Algorithms, Kinematics &amp; Vision
                </h3>
                <p>
                  {controlAwardEntry?.controlSheet?.algorithmsSummary ||
                    "Pending control algorithm summary."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-b-2 border-black pb-3 flex items-baseline justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest">
                  FIRST Tech Challenge • Team 23247 ARES ({seasonKey})
                </p>
                <h2 className="text-2xl font-black uppercase">
                  Judges&apos; Pit Summary &amp; Portfolio Index
                </h2>
              </div>
              <span className="text-xs font-mono">
                {awardsBackedCount}/7 Awards Backed • {verifiedPagesCount}/15 Pages Verified
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {awards
                .filter((award) =>
                  award.linkedArtifactIds.some((id) => candidateById.has(id)),
                )
                .map((award) => (
                  <div key={award.awardId} className="border border-black p-2.5 rounded">
                    <h3 className="font-black uppercase">{award.name}</h3>
                    <p className="mt-1">
                      {award.claimSummary || "Backed by verified ARES portal artifacts."}
                    </p>
                  </div>
                ))}
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-wider mb-1.5">
                15-Page Engineering Portfolio Index
              </h3>
              <ol className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                {pages.map((p) => (
                  <li key={p.pageNumber}>
                    <strong>P{p.pageNumber}:</strong> {p.title} [{p.status.toUpperCase()}]
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
