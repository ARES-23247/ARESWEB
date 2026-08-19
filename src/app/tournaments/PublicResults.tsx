"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { logger } from "@/utils/logger";

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

  return (
    <section aria-labelledby="public-results-heading" className="w-full max-w-5xl mx-auto px-6 z-10">
      <h2
        id="public-results-heading"
        className="inline-flex items-center gap-2 font-heading text-2xl font-black uppercase text-white"
      >
        <Trophy size={20} className="text-ares-gold" aria-hidden="true" />
        Competition History
      </h2>
      <p className="mt-2 text-sm text-marble/70">
        Where ARES 23247 has competed. Detailed scouting data and match
        checklists remain in the members-only vault below.
      </p>

      {isLoading ? (
        <p role="status" className="mt-6 text-sm text-marble/60">Loading results…</p>
      ) : error ? (
        <p role="alert" className="mt-6 border border-ares-red/40 bg-ares-red/10 p-4 text-sm text-marble">
          {error}
        </p>
      ) : results.length === 0 ? (
        <p className="mt-6 text-sm text-marble/60">
          No competition results have been published yet.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-white/10 border border-white/10 bg-white/5">
          {results.map((result) => (
            <li key={result.id} className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-bold text-white">{result.name}</h3>
                <p className="font-mono text-xs text-ares-gold">
                  {result.date}
                  {result.status === "upcoming" && (
                    <span className="ml-2 border border-ares-cyan/40 px-2 py-0.5 text-[10px] uppercase text-ares-cyan">
                      Upcoming
                    </span>
                  )}
                </p>
              </div>
              <p className="mt-1 text-xs text-marble/60">
                {[result.seasonName, result.challengeName, result.location]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {result.description && (
                <p className="mt-2 text-sm text-marble/80">{result.description}</p>
              )}
              {result.opr !== null && result.opr > 0 && (
                <p className="mt-2 text-xs font-bold text-white">
                  Team OPR: <span className="text-ares-cyan">{result.opr}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
