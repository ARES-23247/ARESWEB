"use client";

import { logger } from "@/utils/logger";
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Trophy,
  History,
  MapPin,
  Cpu,
  ExternalLink,
  ArrowRight,
  Camera,
  Calendar,
} from "lucide-react";

import SEO from "@/components/SEO";
import { PublicDataState } from "@/components/PublicDataState";
import {
  fetchPublicAwards,
  fetchPublicSeasons,
  type PublicAward,
  type PublicSeason,
} from "@/lib/publicContentApi";

type Season = PublicSeason;
type Award = PublicAward & { year?: number };

interface PublicCompetitionSummary {
  id: string;
  name: string;
  seasonName: string;
  challengeName: string;
  date: string;
  opr: number | null;
}

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [competitions, setCompetitions] = useState<PublicCompetitionSummary[]>([]);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(true);
  const [isLoadingAwards, setIsLoadingAwards] = useState(true);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);
  const [awardsError, setAwardsError] = useState<string | null>(null);

  const loadSeasons = useCallback(async () => {
    setIsLoadingSeasons(true);
    try {
      const list = await fetchPublicSeasons();
      list.sort((a, b) => b.startYear - a.startYear);
      setSeasons(list);
      setSeasonsError(null);
    } catch (err) {
      logger.error("Error fetching seasons:", err);
      setSeasonsError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingSeasons(false);
    }
  }, []);

  const loadAwards = useCallback(async () => {
    setIsLoadingAwards(true);
    try {
      const list = (await fetchPublicAwards()).map((data) => {
        return {
          ...data,
          year: data.date ? new Date(data.date).getFullYear() : new Date().getFullYear(),
        };
      }) as Award[];
      list.sort((a, b) => b.date.localeCompare(a.date));
      setAwards(list);
      setAwardsError(null);
    } catch (err) {
      logger.error("Error fetching awards:", err);
      setAwardsError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingAwards(false);
    }
  }, []);

  useEffect(() => {
    void loadSeasons();
  }, [loadSeasons]);

  useEffect(() => {
    void loadAwards();
  }, [loadAwards]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/tournaments/public/results")
      .then(async (res) => {
        if (!res.ok) return;
        const payload = (await res.json().catch(() => ({}))) as {
          results?: PublicCompetitionSummary[];
        };
        if (!cancelled && Array.isArray(payload.results)) {
          setCompetitions(payload.results);
        }
      })
      .catch(() => {
        // Optional cross-link enrichment; primary season/award error states remain explicit above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const awardsForSeason = (season: Season): Award[] => {
    return awards.filter((award) => {
      if (award.seasonId && award.seasonId === season.id) return true;
      if (!award.seasonId && award.year) {
        return (
          award.year === season.startYear ||
          (season.endYear !== null && award.year === season.endYear)
        );
      }
      return false;
    });
  };

  const competitionsForSeason = (season: Season): PublicCompetitionSummary[] => {
    const challengeLower = season.challengeName.trim().toLowerCase();
    const spanLabel = season.endYear
      ? `${season.startYear}-${season.endYear}`
      : String(season.startYear);
    return competitions.filter((comp) => {
      if (
        challengeLower &&
        (comp.challengeName.toLowerCase().includes(challengeLower) ||
          comp.seasonName.toLowerCase().includes(challengeLower))
      ) {
        return true;
      }
      if (comp.seasonName.includes(spanLabel) || comp.seasonName.includes(String(season.startYear))) {
        return true;
      }
      if (comp.date) {
        const year = Number(comp.date.slice(0, 4));
        if (year === season.startYear || (season.endYear !== null && year === season.endYear)) {
          return true;
        }
      }
      return false;
    });
  };

  return (
    <div className="flex flex-col w-full bg-obsidian min-h-screen text-marble relative overflow-hidden">
      <SEO
        title="Team Legacy"
        description="A chronicle of ARES 23247's journey through FIRST® Robotics. Explore our cross-linked seasonal dossiers, robots, awards, and match history."
      />

      <section className="py-16 md:py-24 px-6 relative z-10 text-center bg-obsidian">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 ares-cut-sm bg-white/5 border border-white/10 text-ares-gold text-xs font-bold uppercase tracking-widest mb-8"
        >
          <History size={14} aria-hidden="true" />
          Establishing Excellence Since 2025
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter"
        >
          Our{" "}
          <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl mt-2 inline-block text-white font-bold">
            Legacy
          </span>
          .
        </motion.h1>
        <p className="text-marble text-xl max-w-2xl mx-auto leading-relaxed font-medium">
          Every ARES 23247 season links our robot engineering dossiers, CAD repositories,
          competition results, and judged awards into one transparent chronicle.
        </p>
      </section>

      {/* Cross-Linked Season Dossiers */}
      <section className="py-24 md:py-32 px-6 bg-obsidian/50 relative z-10 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <header className="mb-20 text-center">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">
              Season Dossiers
            </h2>
            <p className="text-marble font-medium italic uppercase tracking-widest text-xs">
              Cross-linked machines, CAD archives, competition records, and honors by FTC season.
            </p>
          </header>

          <div className="space-y-28 relative">
            <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-ares-red via-ares-gold to-ares-bronze md:-translate-x-1/2 opacity-20" />

            {isLoadingSeasons ? (
              <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-2 border-white/10 border-t-ares-red rounded-full animate-spin" />
              </div>
            ) : seasonsError ? (
              <PublicDataState
                title="Unable to load team seasons"
                message="The legacy timeline could not be reached. Check your connection and try again."
                diagnostic={seasonsError}
                onRetry={() => void loadSeasons()}
              />
            ) : seasons.length > 0 ? (
              seasons.map((season: Season, idx: number) => {
                const isEven = idx % 2 === 0;
                const seasonAwards = awardsForSeason(season);
                const seasonCompetitions = competitionsForSeason(season);
                const robotHref = season.robotId
                  ? `/robots/${encodeURIComponent(season.robotId)}`
                  : "/robots";

                return (
                  <motion.div
                    key={season.id || season.startYear}
                    initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    className="relative pl-8 md:pl-0"
                  >
                    <div className="absolute left-[-5px] md:left-1/2 md:-translate-x-1/2 top-0 w-3 h-3 rounded-full bg-ares-red shadow-[0_0_15px_rgba(192,0,0,0.8)] z-20" />

                    <div
                      className={`flex flex-col md:flex-row items-start gap-8 md:gap-16 ${
                        isEven ? "md:flex-row" : "md:flex-row-reverse"
                      }`}
                    >
                      <div className={`md:w-1/2 ${isEven ? "md:text-right" : "md:text-left"}`}>
                        <div
                          className={`mb-3 flex ${isEven ? "md:justify-end" : "md:justify-start"}`}
                        >
                          <span className="bg-ares-red text-white text-xs font-black uppercase tracking-widest px-3 py-1 ares-cut-sm shadow-md">
                            {season.startYear}
                            {season.endYear ? `-${season.endYear}` : ""}
                          </span>
                        </div>
                        <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4 uppercase leading-none">
                          {season.challengeName}
                        </h3>
                        {season.summary && (
                          <p className="text-marble text-lg leading-relaxed mb-4 font-medium">
                            {season.summary}
                          </p>
                        )}
                        {season.robotDescription && (
                          <p className="text-marble/80 text-sm leading-relaxed mb-6">
                            {season.robotDescription}
                          </p>
                        )}

                        {(season.robotName || season.robotId) && (
                          <div
                            className={`flex items-center gap-3 mb-6 p-4 bg-white/5 border border-white/10 ares-cut-sm ${
                              isEven ? "md:justify-end" : "md:justify-start"
                            }`}
                          >
                            <Cpu size={20} className="text-ares-gold shrink-0" aria-hidden="true" />
                            <div className={isEven ? "md:text-right" : "md:text-left"}>
                              <span className="block text-xs font-black text-ares-gold uppercase tracking-widest">
                                Season Robot Platform
                              </span>
                              <Link
                                to={robotHref}
                                className="text-white hover:text-ares-cyan font-bold underline-offset-4 hover:underline"
                              >
                                {season.robotName || season.robotId}
                              </Link>
                            </div>
                          </div>
                        )}

                        {/* Cross-linked Awards & Tournaments earned in this season */}
                        {(seasonAwards.length > 0 || seasonCompetitions.length > 0) && (
                          <div
                            className={`mb-6 flex flex-wrap gap-2 ${
                              isEven ? "md:justify-end" : "md:justify-start"
                            }`}
                          >
                            {seasonAwards.map((aw) => (
                              <span
                                key={aw.id}
                                className="inline-flex items-center gap-1.5 rounded border border-ares-gold/35 bg-ares-gold/10 px-2.5 py-1 text-[11px] font-bold text-ares-gold"
                              >
                                <Trophy size={11} aria-hidden="true" /> {aw.title}
                              </span>
                            ))}
                            {seasonCompetitions.slice(0, 4).map((comp) => (
                              <Link
                                key={comp.id}
                                to="/tournaments"
                                className="inline-flex items-center gap-1.5 rounded border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-marble hover:border-ares-cyan/50 hover:text-white"
                              >
                                <Calendar size={11} aria-hidden="true" /> {comp.name}
                                {comp.opr !== null && comp.opr > 0 ? ` (OPR ${comp.opr})` : ""}
                              </Link>
                            ))}
                          </div>
                        )}

                        <div
                          className={`flex flex-wrap gap-2 ${
                            isEven ? "md:justify-end" : "md:justify-start"
                          }`}
                        >
                          {(season.robotId || season.robotName) && (
                            <Link
                              to={robotHref}
                              className="px-4 py-2 bg-ares-red/15 border border-ares-red/40 text-white hover:bg-ares-red ares-cut-sm text-xs font-black tracking-widest transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                            >
                              {season.robotId ? "ROBOT DOSSIER" : "ROBOT FLEET"}{" "}
                              <ArrowRight size={12} aria-hidden="true" />
                            </Link>
                          )}
                          {season.robotCadUrl && (
                            <a
                              href={season.robotCadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-white/5 border border-white/10 text-marble hover:text-white hover:bg-white/10 ares-cut-sm text-xs font-black tracking-widest transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                            >
                              CAD REPOSITORY <ExternalLink size={12} aria-hidden="true" />
                            </a>
                          )}
                          {season.albumUrl && (
                            <a
                              href={season.albumUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-white/5 border border-white/10 text-marble hover:text-white hover:bg-white/10 ares-cut-sm text-xs font-black tracking-widest transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                            >
                              SEASON ALBUM <Camera size={12} aria-hidden="true" />
                            </a>
                          )}
                          <Link
                            to="/tournaments"
                            className="px-4 py-2 bg-white/5 border border-white/10 text-marble hover:text-white hover:bg-white/10 ares-cut-sm text-xs font-black tracking-widest transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                          >
                            MATCH RESULTS <ArrowRight size={12} aria-hidden="true" />
                          </Link>
                        </div>
                      </div>

                      {season.robotImage && (
                        <div className="md:w-1/2 flex justify-center">
                          <div className="w-full max-w-md aspect-video ares-cut overflow-hidden border border-white/10 shadow-2xl group">
                            <img
                              src={season.robotImage}
                              alt={season.robotName || season.challengeName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-20">
                <p className="text-marble italic">
                  Legacy records are currently being cataloged...
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Trophy Case Section */}
      <section className="py-32 px-6 relative z-10 bg-obsidian">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-16">
            <div className="flex items-center gap-4 flex-1">
              <h2 className="text-4xl font-black text-white tracking-tighter uppercase">
                Digital Trophy Case
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-ares-gold/50 to-transparent" />
            </div>
            <Link
              to="/tournaments"
              className="text-xs font-black uppercase tracking-widest text-ares-gold hover:text-white transition-colors inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              View Competition History <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isLoadingAwards ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-64 bg-white/5 ares-cut animate-pulse" />
              ))
            ) : awardsError ? (
              <div className="col-span-full">
                <PublicDataState
                  title="Unable to load team awards"
                  message="The trophy case could not be reached. Check your connection and try again."
                  diagnostic={awardsError}
                  onRetry={() => void loadAwards()}
                />
              </div>
            ) : awards.length > 0 ? (
              awards.map((award: Award, idx: number) => (
                <motion.div
                  key={award.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-obsidian border border-white/5 p-8 ares-cut group hover:border-ares-gold/40 transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/5 blur-3xl rounded-full pointer-events-none" />
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-16 h-16 ares-cut bg-ares-red flex items-center justify-center shadow-lg shadow-ares-red/20">
                      <Trophy className="text-white" size={32} aria-hidden="true" />
                    </div>
                    <span className="text-2xl font-black text-marble/60 italic">
                      {award.year}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2 tracking-tighter group-hover:text-ares-gold transition-colors">
                    {award.title}
                  </h3>
                  <div className="text-xs font-bold uppercase tracking-widest text-marble mb-4 flex items-center gap-2">
                    <MapPin size={10} className="text-ares-red" aria-hidden="true" />{" "}
                    {award.eventName}
                  </div>
                  <p className="text-marble text-sm leading-relaxed line-clamp-3">
                    {award.description}
                  </p>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-32 text-center border-2 border-dashed border-white/5 ares-cut-lg">
                <div className="w-20 h-20 bg-ares-red ares-cut flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-ares-red/20 font-bold">
                  <Trophy size={40} aria-hidden="true" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 uppercase tracking-tighter">
                  The Case is Open.
                </h3>
                <p className="text-marble">
                  We are currently cataloging our rookie season achievements.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer Support */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto p-12 ares-cut bg-obsidian border border-white/10 text-center shadow-2xl relative overflow-hidden">
          <Trophy
            className="text-white mx-auto mb-8 relative z-10"
            size={64}
            strokeWidth={1}
            aria-hidden="true"
          />
          <h2 className="text-4xl font-black text-white mb-6 tracking-tighter relative z-10">
            SUPPORT THE LEGACY.
          </h2>
          <p className="text-white text-lg mb-10 max-w-xl mx-auto relative z-10 font-medium">
            Our history is written by the mentors, students, and sponsors who invest in our
            success. Join us in building the future.
          </p>
          <div className="flex flex-wrap justify-center gap-4 relative z-10">
            <Link
              to="/sponsors"
              className="px-8 py-4 bg-white text-ares-red font-black ares-cut-sm hover:scale-105 transition-all shadow-lg"
            >
              SPONSOR ARES
            </Link>
            <Link
              to="/join"
              className="px-8 py-4 bg-obsidian text-white font-black ares-cut-sm hover:bg-white/10 transition-all border border-white/10"
            >
              JOIN THE TEAM
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
