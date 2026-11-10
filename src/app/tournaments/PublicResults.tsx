"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, MapPin, Trophy } from "lucide-react";
import { logger } from "@/utils/logger";
import FtcGlossaryBanner from "./components/FtcGlossaryBanner";

interface PublicResult {
  id: string;
  name: string;
  seasonName: string;
  challengeName: string;
  date: string;
  location: string;
  description: string;
  status: "upcoming" | "past";
  opr: number | null;
  rank?: number | null;
  record?: { wins: number; losses: number; ties: number } | null;
}

/**
 * Public competition history for signed-out visitors. Fed by the minimal
 * /api/tournaments/public/results DTO — scouting details stay in the
 * member-gated vault.
 */
export default function PublicResults() {
  const [results, setResults] = useState<PublicResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "past">("all");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/tournaments/public/results");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as { results?: PublicResult[] };
        if (!cancelled) {
          setResults(Array.isArray(payload.results) ? payload.results : []);
          setError(null);
        }
      } catch (err) {
        logger.warn("Unable to load public competition results:", err);
        if (!cancelled) {
          setError("Competition results are unavailable right now. Please try again shortly.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const upcomingCount = results.filter((r) => r.status === "upcoming").length;
    const pastCount = results.filter((r) => r.status === "past").length;
    const distinctSeasons = new Set(
      results.map((r) => r.seasonName || r.challengeName).filter(Boolean),
    ).size;
    return {
      total: results.length,
      upcomingCount,
      pastCount,
      distinctSeasons,
    };
  }, [results]);

  const filteredResults = useMemo(() => {
    if (statusFilter === "all") return results;
    return results.filter((r) => r.status === statusFilter);
  }, [results, statusFilter]);

  return (
    <section
      aria-labelledby="public-results-heading"
      className="w-full max-w-5xl mx-auto px-6 z-10"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2
            id="public-results-heading"
            className="inline-flex items-center gap-2 font-heading text-2xl font-black uppercase text-white"
          >
            <Trophy size={20} className="text-ares-gold" aria-hidden="true" />
            Competition History
          </h2>
          <p className="mt-2 text-sm text-marble/70">
            Official events where ARES 23247 has competed or is registered to compete.
            Detailed scouting data and pit checklists remain in the team vault below.
          </p>
        </div>

        {results.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter competition status">
            {(
              [
                { id: "all", label: `All (${summary.total})` },
                { id: "upcoming", label: `Upcoming (${summary.upcomingCount})` },
                { id: "past", label: `Completed (${summary.pastCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={statusFilter === tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                  statusFilter === tab.id
                    ? "bg-ares-red text-white"
                    : "border border-white/15 bg-white/5 text-marble/80 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <FtcGlossaryBanner />

      {!isLoading && !error && results.length > 0 && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-3.5">
            <span className="block text-[10px] font-black uppercase tracking-widest text-marble/60">
              Published Events
            </span>
            <span className="mt-1 block font-heading text-2xl font-black text-white">
              {summary.total}
            </span>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3.5">
            <span className="block text-[10px] font-black uppercase tracking-widest text-marble/60">
              Upcoming
            </span>
            <span className="mt-1 block font-heading text-2xl font-black text-ares-cyan">
              {summary.upcomingCount}
            </span>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3.5">
            <span className="block text-[10px] font-black uppercase tracking-widest text-marble/60">
              Completed
            </span>
            <span className="mt-1 block font-heading text-2xl font-black text-ares-gold">
              {summary.pastCount}
            </span>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3.5">
            <span className="block text-[10px] font-black uppercase tracking-widest text-marble/60">
              FTC Seasons
            </span>
            <span className="mt-1 block font-heading text-2xl font-black text-white">
              {summary.distinctSeasons || 1}
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <p role="status" className="mt-6 text-sm text-marble/60">
          Loading results…
        </p>
      ) : error ? (
        <p
          role="alert"
          className="mt-6 border border-ares-red/40 bg-ares-red/10 p-4 text-sm text-marble"
        >
          {error}
        </p>
      ) : results.length === 0 ? (
        <p className="mt-6 text-sm text-marble/60">
          No competition results have been published yet.
        </p>
      ) : filteredResults.length === 0 ? (
        <p className="mt-6 text-sm text-marble/60">
          No events match the selected filter.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4">
          {filteredResults.map((result) => (
            <li
              key={result.id}
              className="rounded-xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-white/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-white">{result.name}</h3>
                    {result.status === "upcoming" ? (
                      <span className="rounded border border-ares-cyan/40 bg-ares-cyan/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-ares-cyan">
                        Upcoming
                      </span>
                    ) : (
                      <span className="rounded border border-white/15 bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-marble/75">
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-marble/70">
                    {result.date && (
                      <span className="inline-flex items-center gap-1 font-mono text-ares-gold">
                        <Calendar size={12} aria-hidden="true" /> {result.date}
                      </span>
                    )}
                    {result.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} aria-hidden="true" /> {result.location}
                      </span>
                    )}
                    {(result.seasonName || result.challengeName) && (
                      <span>
                        {[result.seasonName, result.challengeName]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {typeof result.rank === "number" && result.rank > 0 && (
                    <span className="rounded-lg border border-ares-gold/40 bg-ares-gold/15 px-2.5 py-1 text-xs font-black text-ares-gold">
                      Rank #{result.rank}
                    </span>
                  )}
                  {result.record && (
                    <span className="rounded-lg border border-white/15 bg-obsidian px-2.5 py-1 font-mono text-xs font-bold text-white">
                      {result.record.wins}-{result.record.losses}-{result.record.ties}
                    </span>
                  )}
                  {result.opr !== null && result.opr > 0 && (
                    <span className="rounded-lg border border-ares-cyan/35 bg-ares-cyan/10 px-2.5 py-1 text-xs font-bold text-white">
                      Team OPR: <span className="text-ares-cyan">{result.opr}</span>
                    </span>
                  )}
                </div>
              </div>

              {result.description && (
                <p className="mt-3 text-sm text-marble/85 leading-relaxed">
                  {result.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
