"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  Check,
  ChevronRight,
  Heart,
  Mail,
  MapPin,
  PieChart,
  Printer,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  Clock,
  ArrowLeft,
  BadgeCheck,
} from "lucide-react";
import SEO from "@/components/SEO";
import { currentSeasonLabel } from "@/lib/outreachExport";
import {
  SPONSOR_DECK_TIERS,
  TEAM_BUDGET_ALLOCATIONS,
  TAX_EXEMPT_DETAILS,
  DEFAULT_SEASON_METRICS,
  formatCurrency,
  findTierByAmount,
  type SponsorDeckTierKey,
  type SponsorshipSeasonMetrics,
} from "@/lib/sponsorPacketData";
import { logger } from "@/utils/logger";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function SponsorPacketPage() {
  const [selectedTierKey, setSelectedTierKey] = useState<SponsorDeckTierKey>("Titanium");
  const [pledgeAmount, setPledgeAmount] = useState<number>(5000);
  const [metrics, setMetrics] = useState<SponsorshipSeasonMetrics>(DEFAULT_SEASON_METRICS);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState<boolean>(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const reportDate = useMemo(() => new Date(), []);
  const seasonLabel = useMemo(() => currentSeasonLabel(reportDate), [reportDate]);

  const loadLiveMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    try {
      const response = await fetch("/api/outreach?limit=100");
      if (!response.ok) {
        throw new Error("HTTP " + response.status + ": " + response.statusText);
      }
      const data: unknown = await response.json();
      if (isRecord(data) && Array.isArray(data.logs)) {
        const activeLogs = data.logs.filter((log: unknown) => isRecord(log) && log.isDeleted !== 1);
        const totalHours = activeLogs.reduce((sum: number, log: Record<string, unknown>) => {
          const hours = typeof log.hours === "number" && Number.isFinite(log.hours) ? log.hours : 0;
          return sum + hours;
        }, 0);
        const totalReached = activeLogs.reduce((sum: number, log: Record<string, unknown>) => {
          const reached = typeof log.peopleReached === "number" && Number.isFinite(log.peopleReached) ? log.peopleReached : 0;
          return sum + reached;
        }, 0);

        setMetrics((prev) => ({
          ...prev,
          volunteerHours: totalHours > 0 ? totalHours : prev.volunteerHours,
          studentsReached: totalReached > 0 ? totalReached : prev.studentsReached,
          stemDemosCount: activeLogs.length > 0 ? activeLogs.length : prev.stemDemosCount,
        }));
      }
      setMetricsError(null);
    } catch (err) {
      logger.warn("Using default season metrics for sponsorship packet:", err);
      setMetricsError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  useEffect(() => {
    void loadLiveMetrics();
  }, [loadLiveMetrics]);

  const calculatedTier = useMemo(() => {
    return findTierByAmount(pledgeAmount);
  }, [pledgeAmount]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-obsidian text-marble py-8 px-4 sm:px-6 lg:px-8 selection:bg-ares-red selection:text-white print:bg-white print:text-black print:p-0">
      <SEO
        title="Sponsorship Packet & Deck"
        description="Official ARES 23247 sponsorship packet, 501(c)(3) tax-exempt details, sponsorship tier matrix, dynamic season metrics, and team budget allocations."
      />

      {/* Top Action Toolbar (Hidden during Print) */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/10 shadow-xl print:hidden">
        <div className="flex items-center gap-3">
          <Link
            to="/sponsors"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-marble/80 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan p-1 rounded"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Partners
          </Link>
          <span className="text-white/20">|</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-ares-cyan">
            Season {seasonLabel} Deck
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-ares-gold hover:bg-ares-gold/90 text-black text-xs font-black uppercase tracking-widest ares-cut-sm shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <Printer size={16} aria-hidden="true" />
            Print / Save as PDF
          </button>
          <a
            href={`mailto:${TAX_EXEMPT_DETAILS.contactEmail}?subject=ARES%2023247%20Sponsorship%20Inquiry%20(${seasonLabel}%20Season)`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-ares-red hover:bg-ares-bronze text-white text-xs font-black uppercase tracking-widest ares-cut-sm shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <Mail size={16} aria-hidden="true" />
            Inquire via Email
          </a>
        </div>
      </div>

      {/* Main Printable Deck Document Container */}
      <main className="sponsor-packet-print max-w-6xl mx-auto space-y-12 bg-obsidian border border-white/10 rounded-2xl p-6 sm:p-10 lg:p-12 shadow-2xl print:max-w-none print:border-none print:bg-white print:text-black print:p-0 print:shadow-none print:space-y-8">
        
        {/* Cover / Header Section */}
        <header className="border-b border-white/10 pb-8 print:border-black/20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded ares-cut-sm bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan text-[10px] font-black uppercase tracking-widest mb-4 print:border-cyan-800 print:text-cyan-900 print:bg-cyan-50">
                <BadgeCheck size={14} aria-hidden="true" />
                FIRST® Tech Challenge Team #23247 • 501(c)(3) Non-Profit
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white font-heading print:text-black leading-tight">
                Sponsorship <span className="text-ares-gold print:text-amber-800">Deck</span>
              </h1>
              <p className="text-sm sm:text-base text-marble/85 font-medium mt-2 max-w-2xl print:text-gray-700">
                Appalachian Robotics & Engineering Society • Morgantown, West Virginia
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left md:text-right shrink-0 print:border-gray-300 print:bg-gray-50">
              <div className="text-[10px] font-black uppercase tracking-widest text-ares-gold print:text-amber-800">
                Official Season Packet
              </div>
              <div className="text-xl font-black text-white print:text-black mt-0.5">
                {seasonLabel} Season
              </div>
              <div className="text-[11px] text-marble/70 print:text-gray-600 mt-1 flex items-center md:justify-end gap-1">
                <MapPin size={12} className="text-ares-red print:text-red-700" aria-hidden="true" />
                Morgantown, WV 26501
              </div>
              <div className="text-[10px] text-marble/60 print:text-gray-500 font-mono mt-1">
                Date: {reportDate.toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs print:border-black/10">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="text-ares-cyan shrink-0 mt-0.5 print:text-cyan-800" size={16} aria-hidden="true" />
              <div>
                <span className="font-bold text-white uppercase tracking-wider block print:text-black">Tax-Deductible</span>
                <span className="text-marble/70 print:text-gray-600">Contributions qualify under IRC Section 501(c)(3).</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Users className="text-ares-gold shrink-0 mt-0.5 print:text-amber-800" size={16} aria-hidden="true" />
              <div>
                <span className="font-bold text-white uppercase tracking-wider block print:text-black">100% Student-Driven</span>
                <span className="text-marble/70 print:text-gray-600">Hands-on mechanical, software & CAD engineering.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Award className="text-ares-red shrink-0 mt-0.5 print:text-red-800" size={16} aria-hidden="true" />
              <div>
                <span className="font-bold text-white uppercase tracking-wider block print:text-black">Regional Championship</span>
                <span className="text-marble/70 print:text-gray-600">Competing across WV, PA, VA, and Nationals.</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Season Metric Aggregators */}
        <section aria-labelledby="deck-metrics-heading" className="break-inside-avoid">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 id="deck-metrics-heading" className="text-xs font-black uppercase tracking-widest text-ares-gold print:text-amber-800 flex items-center gap-2 font-heading">
              <Target size={16} aria-hidden="true" />
              Season Impact & Performance Metrics
            </h2>
            {isLoadingMetrics && (
              <span className="text-[10px] text-ares-cyan animate-pulse print:hidden">Syncing live metrics…</span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center print:border-gray-300 print:bg-gray-50">
              <Clock className="mx-auto text-ares-cyan mb-2 print:text-cyan-800" size={22} aria-hidden="true" />
              <div className="text-2xl sm:text-3xl font-black text-white font-heading print:text-black">
                {metrics.volunteerHours}+
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-marble/70 print:text-gray-600 mt-1">
                Volunteer Service Hours
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center print:border-gray-300 print:bg-gray-50">
              <Users className="mx-auto text-ares-gold mb-2 print:text-amber-800" size={22} aria-hidden="true" />
              <div className="text-2xl sm:text-3xl font-black text-white font-heading print:text-black">
                {metrics.studentsReached.toLocaleString()}+
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-marble/70 print:text-gray-600 mt-1">
                K-12 Students Reached
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center print:border-gray-300 print:bg-gray-50">
              <Trophy className="mx-auto text-ares-red mb-2 print:text-red-800" size={22} aria-hidden="true" />
              <div className="text-2xl sm:text-3xl font-black text-white font-heading print:text-black">
                {metrics.tournamentAwards}+
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-marble/70 print:text-gray-600 mt-1">
                Tournament Awards & Honors
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center print:border-gray-300 print:bg-gray-50">
              <Sparkles className="mx-auto text-ares-bronze mb-2 print:text-amber-900" size={22} aria-hidden="true" />
              <div className="text-2xl sm:text-3xl font-black text-white font-heading print:text-black">
                {metrics.stemDemosCount}+
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-marble/70 print:text-gray-600 mt-1">
                STEM Demos & Exhibits
              </div>
            </div>
          </div>
          {metricsError && (
            <p className="text-[11px] text-marble/60 mt-2 italic print:hidden">
              Note: Offline metrics displayed.
            </p>
          )}
        </section>

        {/* 501(c)(3) Non-Profit Tax-Exemption Disclosure */}
        <section aria-labelledby="tax-exempt-heading" className="p-6 rounded-xl bg-ares-gold/5 border border-ares-gold/20 print:border-amber-700 print:bg-amber-50/50 break-inside-avoid">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-ares-gold/10 border border-ares-gold/30 flex items-center justify-center shrink-0 print:bg-amber-100">
              <ShieldCheck className="text-ares-gold print:text-amber-800" size={22} aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h2 id="tax-exempt-heading" className="text-base font-black uppercase tracking-wider text-white print:text-black font-heading">
                Tax-Exempt 501(c)(3) Non-Profit Sponsorship
              </h2>
              <p className="text-xs text-marble/85 leading-relaxed print:text-gray-800">
                {TAX_EXEMPT_DETAILS.deductibilityStatement} {TAX_EXEMPT_DETAILS.einGuidance}
              </p>
              <div className="pt-2 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-marble/75 print:text-gray-700 font-mono">
                <span><strong>Legal Entity:</strong> {TAX_EXEMPT_DETAILS.organizationName}</span>
                <span><strong>Check Payable To:</strong> {TAX_EXEMPT_DETAILS.checkPayableTo}</span>
                <span><strong>Sponsor Desk:</strong> {TAX_EXEMPT_DETAILS.contactEmail}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sponsorship Tier Matrix Breakdown */}
        <section aria-labelledby="tiers-heading" className="space-y-6 break-inside-avoid">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 border-b border-white/10 pb-4 print:border-black/20">
            <div>
              <h2 id="tiers-heading" className="text-2xl font-black uppercase tracking-tight text-white font-heading print:text-black">
                Sponsorship Tier Matrix
              </h2>
              <p className="text-xs text-marble/70 print:text-gray-600 mt-1">
                Every dollar directly funds student engineering materials, travel grants, and K-12 STEM workshops.
              </p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-ares-gold print:text-amber-800">
              Custom & In-Kind Gifts Welcomed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SPONSOR_DECK_TIERS.map((tier) => {
              const isSelected = selectedTierKey === tier.key;
              return (
                <article
                  key={tier.key}
                  className={`relative rounded-xl border p-6 transition-all ${
                    isSelected
                      ? "border-ares-gold bg-ares-gold/10 shadow-2xl ring-1 ring-ares-gold print:bg-white print:border-black"
                      : "border-white/10 bg-white/5 hover:border-white/20 print:border-gray-300 print:bg-white"
                  } flex flex-col justify-between break-inside-avoid`}
                >
                  {tier.highlight && (
                    <div className="absolute -top-3 right-6 px-3 py-0.5 rounded bg-ares-red text-white text-[9px] font-black uppercase tracking-widest shadow print:border print:border-red-800 print:text-red-900 print:bg-red-50">
                      Title Partner
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className={`text-lg font-black uppercase tracking-tight font-heading ${tier.textClass} print:text-black`}>
                        {tier.name}
                      </h3>
                      <span className="text-base font-black text-white font-mono print:text-black">
                        {tier.amountLabel}
                      </span>
                    </div>

                    <p className="text-xs text-marble/80 italic mb-4 leading-snug print:text-gray-700">
                      {tier.tagline}
                    </p>

                    <div className="mb-4 p-2.5 rounded bg-black/40 border border-white/5 text-[11px] print:bg-gray-50 print:border-gray-200">
                      <span className="font-bold uppercase tracking-wider text-marble/70 print:text-gray-600 block text-[9px]">
                        Robot & Pit Badge Dimensions
                      </span>
                      <span className="font-semibold text-white print:text-black">
                        {tier.badgeSize}
                      </span>
                    </div>

                    <ul className="space-y-2 text-xs text-marble/90 print:text-gray-800 mb-6">
                      {tier.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check size={14} className="text-ares-gold shrink-0 mt-0.5 print:text-amber-800" aria-hidden="true" />
                          <span className="leading-relaxed">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4 print:hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedTierKey(tier.key)}
                      className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded transition-all cursor-pointer ${
                        isSelected
                          ? "bg-ares-gold text-black"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {isSelected ? "Selected Tier" : "Select Tier"}
                    </button>

                    <a
                      href={`mailto:${TAX_EXEMPT_DETAILS.contactEmail}?subject=Sponsorship%20Inquiry%20-${encodeURIComponent(tier.name)}`}
                      className="text-[10px] font-bold text-ares-cyan hover:underline flex items-center gap-1"
                    >
                      Inquire <ChevronRight size={12} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Interactive Pledge Tier Calculator (Screen Only) */}
        <section aria-labelledby="pledge-calc-heading" className="p-6 rounded-xl bg-white/5 border border-white/10 print:hidden space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 id="pledge-calc-heading" className="text-lg font-black uppercase tracking-tight text-white font-heading">
                Interactive Sponsorship Estimator
              </h2>
              <p className="text-xs text-marble/70">
                Enter your desired tax-deductible contribution to see unlocked partnership benefits.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-marble/60 block">Calculated Tier</span>
              <span className="text-sm font-black text-ares-gold font-heading">
                {calculatedTier.name}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                id="pledge-slider"
                type="range"
                min="500"
                max="10000"
                step="250"
                value={pledgeAmount}
                onChange={(e) => setPledgeAmount(Number(e.target.value))}
                className="w-full accent-ares-gold cursor-pointer"
                aria-label="Sponsorship pledge amount"
              />
              <span className="text-lg font-black font-mono text-white shrink-0 min-w-[90px] text-right">
                {formatCurrency(pledgeAmount)}
              </span>
            </div>

            <div className="p-4 rounded-lg bg-black/40 border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-ares-cyan block">
                  Unlocked Benefits for {formatCurrency(pledgeAmount)}
                </span>
                <p className="text-xs text-marble/85 mt-0.5">
                  {calculatedTier.tagline} • Badge: {calculatedTier.badgeSize}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTierKey(calculatedTier.key)}
                className="px-4 py-2 rounded bg-ares-red hover:bg-ares-bronze text-white text-[10px] font-black uppercase tracking-widest ares-cut-sm shrink-0"
              >
                Highlight {calculatedTier.key} Details
              </button>
            </div>
          </div>
        </section>

        {/* Team Budget Allocation Chart & Breakdown */}
        <section aria-labelledby="budget-heading" className="space-y-6 break-inside-avoid">
          <div className="border-b border-white/10 pb-4 print:border-black/20">
            <h2 id="budget-heading" className="text-2xl font-black uppercase tracking-tight text-white font-heading print:text-black flex items-center gap-2">
              <PieChart size={20} className="text-ares-gold print:text-amber-800" aria-hidden="true" />
              Team Budget Allocation Model
            </h2>
            <p className="text-xs text-marble/70 print:text-gray-600 mt-1">
              Transparent operating budget breakdown for competition robotics, tooling, logistics, and STEM outreach.
            </p>
          </div>

          {/* Visual Percentage Allocation Bar */}
          <div className="space-y-2">
            <div className="h-5 w-full rounded-md overflow-hidden flex bg-white/10 print:border print:border-gray-400">
              {TEAM_BUDGET_ALLOCATIONS.map((item) => (
                <div
                  key={item.id}
                  style={{ width: `${item.percentage}%` }}
                  className={`${item.color} h-full transition-all duration-500`}
                  title={`${item.category}: ${item.percentage}% (~${formatCurrency(item.annualEstimate)})`}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-wider text-marble/80 print:text-gray-700">
              {TEAM_BUDGET_ALLOCATIONS.map((item) => (
                <div key={item.id} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${item.color} shrink-0`} />
                  <span>{item.category.split(" ")[0]} ({item.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Itemized Budget Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-marble/60 uppercase text-[10px] font-mono print:border-black/20 print:text-gray-600">
                  <th className="py-2.5 px-3">Expense Category</th>
                  <th className="py-2.5 px-3 text-center">Allocation</th>
                  <th className="py-2.5 px-3 text-right">Annual Estimate</th>
                  <th className="py-2.5 px-3 hidden sm:table-cell">Scope & Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 print:divide-black/10">
                {TEAM_BUDGET_ALLOCATIONS.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 print:hover:bg-transparent">
                    <td className="py-3 px-3 font-bold text-white print:text-black">
                      {item.category}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-ares-gold print:text-amber-800">
                      {item.percentage}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white print:text-black">
                      {formatCurrency(item.annualEstimate)}
                    </td>
                    <td className="py-3 px-3 text-marble/75 print:text-gray-700 hidden sm:table-cell leading-relaxed">
                      {item.description}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-white/10 font-bold text-white print:border-black/20 print:text-black">
                  <td className="py-3 px-3 uppercase">Total Annual Operating Budget</td>
                  <td className="py-3 px-3 text-center font-mono text-ares-cyan print:text-cyan-800">100%</td>
                  <td className="py-3 px-3 text-right font-mono text-ares-gold print:text-amber-800">
                    {formatCurrency(TEAM_BUDGET_ALLOCATIONS.reduce((sum, i) => sum + i.annualEstimate, 0))}
                  </td>
                  <td className="py-3 px-3 text-[10px] text-marble/60 hidden sm:table-cell print:text-gray-600">
                    Funds 15 student competitors, 2 robots, 6 qualifiers, and K-12 outreach.
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* How to Partner / Next Steps */}
        <section aria-labelledby="partner-steps-heading" className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4 break-inside-avoid print:border-gray-300 print:bg-gray-50">
          <h2 id="partner-steps-heading" className="text-lg font-black uppercase tracking-tight text-white font-heading print:text-black flex items-center gap-2">
            <Heart size={18} className="text-ares-red print:text-red-800" aria-hidden="true" />
            How to Finalize Your Sponsorship
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded bg-black/30 border border-white/5 print:border-gray-200 print:bg-white">
              <div className="text-ares-gold font-mono font-black text-sm mb-1 print:text-amber-800">01. SELECT TIER</div>
              <p className="text-marble/80 print:text-gray-700 leading-snug">
                Choose your sponsorship tier or specify an in-kind donation amount.
              </p>
            </div>

            <div className="p-3.5 rounded bg-black/30 border border-white/5 print:border-gray-200 print:bg-white">
              <div className="text-ares-cyan font-mono font-black text-sm mb-1 print:text-cyan-800">02. CONTACT BOARD</div>
              <p className="text-marble/80 print:text-gray-700 leading-snug">
                Email <strong className="text-white print:text-black">{TAX_EXEMPT_DETAILS.contactEmail}</strong> with organization details.
              </p>
            </div>

            <div className="p-3.5 rounded bg-black/30 border border-white/5 print:border-gray-200 print:bg-white">
              <div className="text-ares-red font-mono font-black text-sm mb-1 print:text-red-800">03. SEND VECTOR LOGO</div>
              <p className="text-marble/80 print:text-gray-700 leading-snug">
                Provide vector (SVG/EPS/PNG) logos for robot shield and banner laser-cutting.
              </p>
            </div>

            <div className="p-3.5 rounded bg-black/30 border border-white/5 print:border-gray-200 print:bg-white">
              <div className="text-ares-gold font-mono font-black text-sm mb-1 print:text-amber-800">04. RECEIVE RECEIPT</div>
              <p className="text-marble/80 print:text-gray-700 leading-snug">
                Receive tax acknowledgment receipt, W-9, and season match schedules.
              </p>
            </div>
          </div>
        </section>

        {/* Zero-PII Security Assurance & Footer */}
        <footer className="border-t border-white/10 pt-6 text-[10px] text-marble/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:border-black/20 print:text-gray-600">
          <p>
            © {reportDate.getFullYear()} Appalachian Robotics & Engineering Society (ARES 23247). All rights reserved.
          </p>
          <p className="font-mono">
            Zero-PII Compliance Verified: All metrics reflect public aggregated team performance.
          </p>
        </footer>
      </main>
    </div>
  );
}
