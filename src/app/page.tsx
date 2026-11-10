"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Calendar as CalendarIcon,
  Cpu,
  GraduationCap,
  Heart,
  MapPin,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { GreekMeander } from "@/components/GreekMeander";
import { ARCADE_GAMES } from "@/components/navigation/navItems";
import { getPublicDiagnosticCode } from "@/components/PublicDataState";
import SEO from "@/components/SEO";
import { fetchPublicEvents } from "@/app/calendar/api";
import { eventDetailHref } from "@/app/calendar/calendarView";
import { selectNextEvent } from "@/app/dashboard/today/todayData";
import {
  fetchPublicBlogPosts,
  fetchPublicSeasons,
  fetchPublicSponsors,
  type PublicBlogPost,
  type PublicSeason,
  type PublicSponsor,
} from "@/lib/publicContentApi";
import { maskEmail } from "@/lib/utils";
import type { TeamEvent } from "@/types/event";
import { logger } from "@/utils/logger";

function formatPulseEventDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (!Number.isFinite(parsed.getTime())) return "Date TBA";
  return parsed.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPulsePostDate(rawDate?: string): string | null {
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (!Number.isFinite(parsed.getTime())) return rawDate;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCategoryBadge(category: TeamEvent["category"]): string {
  if (category === "competition") return "Competition";
  if (category === "outreach") return "Outreach";
  return "Team Practice";
}

interface PulseErrorNoticeProps {
  title: string;
  diagnostic: string;
  onRetry: () => void;
}

function PulseErrorNotice({ title, diagnostic, onRetry }: PulseErrorNoticeProps) {
  const code = getPublicDiagnosticCode(diagnostic);
  return (
    <div
      role="alert"
      className="flex flex-col justify-between gap-3 rounded-xl border border-ares-red/40 bg-ares-red/10 p-4 text-sm text-white"
    >
      <div>
        <p className="font-bold text-white">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-marble/80">
          Live team data could not be loaded right now.
          {code ? ` (${code})` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        <RefreshCw aria-hidden="true" size={14} />
        Retry
      </button>
    </div>
  );
}

export default function Home() {
  const { user, authorizedUser, loading, logout } = useAuth();

  // Independent progressive states for "Live from ARES"
  const [nextEvent, setNextEvent] = useState<TeamEvent | null | undefined>(undefined);
  const [eventError, setEventError] = useState<string | null>(null);

  const [latestPost, setLatestPost] = useState<PublicBlogPost | null | undefined>(undefined);
  const [postError, setPostError] = useState<string | null>(null);

  const [seasonSummary, setSeasonSummary] = useState<
    { activeSeason: PublicSeason | null; sponsors: PublicSponsor[] } | undefined
  >(undefined);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  const loadNextEvent = useCallback(async () => {
    setNextEvent(undefined);
    setEventError(null);
    try {
      const page = await fetchPublicEvents(12, undefined, 60);
      setNextEvent(selectNextEvent(page.events));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Homepage could not load upcoming calendar events:", message);
      setEventError(message);
    }
  }, []);

  const loadLatestPost = useCallback(async () => {
    setLatestPost(undefined);
    setPostError(null);
    try {
      const posts = await fetchPublicBlogPosts();
      setLatestPost(posts[0] ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Homepage could not load public blog posts:", message);
      setPostError(message);
    }
  }, []);

  const loadSeasonAndSponsors = useCallback(async () => {
    setSeasonSummary(undefined);
    setSeasonError(null);
    try {
      const [seasons, sponsors] = await Promise.all([
        fetchPublicSeasons(),
        fetchPublicSponsors(),
      ]);
      const sortedSeasons = [...seasons].sort((a, b) => b.startYear - a.startYear);
      setSeasonSummary({
        activeSeason: sortedSeasons[0] ?? null,
        sponsors,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Homepage could not load public season or sponsor summary:", message);
      setSeasonError(message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void fetchPublicEvents(12, undefined, 60)
      .then((page) => {
        if (!cancelled) setNextEvent(selectNextEvent(page.events));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        logger.warn("Homepage could not load upcoming calendar events:", message);
        setEventError(message);
      });

    void fetchPublicBlogPosts()
      .then((posts) => {
        if (!cancelled) setLatestPost(posts[0] ?? null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        logger.warn("Homepage could not load public blog posts:", message);
        setPostError(message);
      });

    void Promise.all([fetchPublicSeasons(), fetchPublicSponsors()])
      .then(([seasons, sponsors]) => {
        if (cancelled) return;
        const sortedSeasons = [...seasons].sort((a, b) => b.startYear - a.startYear);
        setSeasonSummary({
          activeSeason: sortedSeasons[0] ?? null,
          sponsors,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        logger.warn("Homepage could not load public season or sponsor summary:", message);
        setSeasonError(message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      <SEO
        exactTitle
        title="ARES 23247 | West Virginia Robotics Team (Morgantown, WV)"
        description="ARES 23247 is a West Virginia robotics team in Morgantown — the Appalachian Robotics & Engineering Society, a FIRST® Tech Challenge team building robots, technical leaders, and STEM opportunities across West Virginia."
      />

      {/* ─── 1. HERO ─── */}
      <section className="relative w-full min-h-[82vh] flex items-center overflow-hidden bg-obsidian">
        <div
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none isolate"
          aria-hidden="true"
        >
          <div
            data-testid="hero-watermark"
            className="absolute -right-[12%] top-[4%] h-[92%] w-[88%] rotate-12 bg-contain bg-center bg-no-repeat opacity-[0.05]"
            style={{
              backgroundImage: "url('/favicon.svg')",
              WebkitMaskImage:
                "radial-gradient(ellipse 72% 68% at 58% 50%, black 0%, rgba(0, 0, 0, 0.85) 48%, transparent 82%)",
              maskImage:
                "radial-gradient(ellipse 72% 68% at 58% 50%, black 0%, rgba(0, 0, 0, 0.85) 48%, transparent 82%)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/95 to-obsidian/35" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start px-4 pb-12 pt-8 text-left sm:px-6 sm:pb-16 sm:pt-12">
          <div className="mb-6 flex min-w-0 flex-col gap-5 sm:gap-8 md:flex-row md:items-center md:gap-12 lg:gap-16">
            <img
              src="/favicon.svg"
              alt="ARES 23247 Logo"
              className="h-24 w-24 shrink-0 object-contain drop-shadow-[0_0_25px_rgba(192,0,0,0.6)] sm:h-32 sm:w-32 md:h-48 md:w-48 lg:h-56 lg:w-56"
            />
            <div className="min-w-0 max-w-full">
              <p className="mb-4 max-w-full text-xs font-bold uppercase tracking-[0.22em] text-ares-gold sm:tracking-[0.4em] md:text-sm font-heading">
                Appalachian Robotics &amp; Engineering Society
              </p>
              <h1 className="relative z-10 w-full max-w-full text-[clamp(2.25rem,12vw,3.5rem)] font-bold uppercase leading-[0.9] text-white font-heading md:text-[6rem] md:leading-[0.85] lg:text-[7.5rem]">
                <span className="sr-only">ARES 23247 — </span>
                <span className="block mb-2 text-white">Engineered</span>
                <span className="mt-2 inline-block max-w-full whitespace-nowrap bg-ares-red px-3 py-2 pb-3 text-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.4)] ares-cut-sm sm:px-6">
                  To Inspire
                </span>
              </h1>
            </div>
          </div>

          <div className="mb-8 max-w-2xl border-l-4 border-ares-bronze pl-3 sm:mb-10 sm:pl-6">
            <div
              id="hero-mountaineer-mindset"
              className="border border-white/10 bg-white/5 px-3 py-3 text-base font-medium leading-relaxed text-marble/90 ares-cut sm:px-5 sm:py-4 sm:text-lg md:text-xl"
            >
              Student-led in Morgantown, West Virginia — building competition
              robots, open-source engineering tools, and statewide STEM access
              with the <strong className="text-white">Mountaineer Mindset</strong>{" "}
              as{" "}
              <a
                href="https://www.firstinspires.org/robotics/ftc"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-ares-gold transition-colors underline decoration-ares-red decoration-2 underline-offset-8 font-black tracking-tight"
              >
                <em className="italic">FIRST</em>® Tech Challenge
              </a>{" "}
              Team #23247.
            </div>
          </div>

          {/* Public-first CTAs + Signed-in Quick Jump */}
          <div className="flex flex-wrap gap-4 items-center w-full max-w-4xl">
            {loading ? (
              <div className="flex flex-wrap items-center gap-4">
                <span role="status" className="text-sm text-marble/70">
                  Verifying session...
                </span>
                <Link
                  to="/calendar"
                  className="inline-flex min-h-11 items-center gap-2 rounded px-3 py-2 text-xs font-bold uppercase tracking-widest text-ares-gold underline decoration-ares-gold/40 underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <CalendarIcon aria-hidden="true" size={15} />
                  View Schedule
                </Link>
              </div>
            ) : user ? (
              <div className="flex w-full flex-col items-stretch gap-4 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <div className="bg-white/5 border border-ares-bronze/30 ares-cut px-5 py-3 flex items-center gap-4">
                  <img
                    src={
                      user.photoURL ||
                      `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`
                    }
                    alt=""
                    className="w-10 h-10 rounded-full border border-ares-bronze/40"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-marble/60">Active Session</p>
                    <p className="text-sm font-bold text-white truncate max-w-[180px]">
                      {user.displayName || maskEmail(user.email)}
                    </p>
                    <span className="text-[10px] text-ares-gold uppercase tracking-wider font-semibold">
                      Role: {authorizedUser?.role || "Pending Verification"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to="/dashboard"
                    className="clipped-button inline-flex min-h-11 items-center justify-center bg-ares-red text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-ares-gold hover:text-obsidian"
                  >
                    Go to Portal
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="clipped-button min-h-11 bg-transparent border-2 border-ares-danger-soft text-ares-danger-soft hover:bg-ares-danger hover:text-white transition-colors text-xs"
                  >
                    Logout
                  </button>
                  <Link
                    to="/calendar"
                    className="inline-flex min-h-11 items-center gap-2 rounded px-3 py-2 text-xs font-bold uppercase tracking-widest text-ares-gold underline decoration-ares-gold/40 underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    <CalendarIcon aria-hidden="true" size={15} />
                    View Schedule
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                <Link
                  to="/join"
                  className="clipped-button inline-flex min-h-11 items-center justify-center gap-2 bg-ares-red font-bold text-white shadow-xl transition-colors hover:bg-ares-gold hover:text-obsidian"
                >
                  <Users aria-hidden="true" size={16} />
                  Join the Team
                </Link>
                <Link
                  to="/robots"
                  className="clipped-button inline-flex min-h-11 items-center justify-center gap-2 border-2 border-ares-gold/60 bg-transparent font-bold text-white transition-colors hover:bg-ares-gold hover:text-obsidian"
                >
                  <Cpu aria-hidden="true" size={16} />
                  Explore Robots &amp; Legacy
                </Link>
                <Link
                  to="/calendar"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded px-3 py-2 text-xs font-bold uppercase tracking-widest text-ares-gold underline decoration-ares-gold/40 underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <CalendarIcon aria-hidden="true" size={15} />
                  View Schedule
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── 2. LIVE FROM ARES (PROGRESSIVE PUBLIC PULSE) ─── */}
      <section
        aria-labelledby="live-from-ares-heading"
        className="border-y border-white/10 bg-white/[0.03] py-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-ares-gold font-heading">
                Verified team feed
              </p>
              <h2
                id="live-from-ares-heading"
                className="text-3xl font-bold text-white font-heading sm:text-4xl"
              >
                Live from ARES
              </h2>
            </div>
            <p className="max-w-md text-sm text-marble/70">
              Published schedule updates, student engineering dispatches, and
              current season milestones.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Pulse Card 1: Next Scheduled Event */}
            <article className="flex flex-col justify-between rounded-2xl border border-white/10 bg-obsidian p-6">
              <div>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-gold">
                    <CalendarIcon aria-hidden="true" size={14} />
                    Next on the Schedule
                  </span>
                </div>

                {eventError ? (
                  <PulseErrorNotice
                    title="Upcoming schedule unavailable"
                    diagnostic={eventError}
                    onRetry={() => void loadNextEvent()}
                  />
                ) : nextEvent === undefined ? (
                  <div role="status" className="space-y-3 py-2">
                    <div className="h-4 w-28 rounded bg-white/10" />
                    <div className="h-6 w-3/4 rounded bg-white/10" />
                    <div className="h-4 w-1/2 rounded bg-white/10" />
                    <span className="sr-only">Loading upcoming schedule...</span>
                  </div>
                ) : nextEvent ? (
                  <div>
                    <span className="mb-2 inline-block rounded bg-ares-gold/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ares-gold">
                      {formatCategoryBadge(nextEvent.category)}
                    </span>
                    <h3 className="mb-2 text-xl font-bold text-white font-heading">
                      {nextEvent.title}
                    </h3>
                    <p className="text-sm font-semibold text-marble/85">
                      {formatPulseEventDate(nextEvent.dateStart)}
                    </p>
                    {nextEvent.publicVenue?.name && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-marble/70">
                        <MapPin aria-hidden="true" size={13} className="shrink-0 text-ares-cyan" />
                        <span>{nextEvent.publicVenue.name}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-marble/75">
                    No upcoming public events are currently published on the
                    schedule. Check the calendar for recurring division meetings
                    and seasonal dates.
                  </p>
                )}
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <Link
                  to={nextEvent ? eventDetailHref(nextEvent) : "/calendar"}
                  className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  {nextEvent ? "Open event details" : "Browse full calendar"}
                  <ArrowRight aria-hidden="true" size={14} className="text-ares-gold" />
                </Link>
              </div>
            </article>

            {/* Pulse Card 2: Latest Blog Dispatch */}
            <article className="flex flex-col justify-between rounded-2xl border border-white/10 bg-obsidian p-6">
              <div>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-cyan">
                    <BookOpen aria-hidden="true" size={14} />
                    Latest Team Dispatch
                  </span>
                </div>

                {postError ? (
                  <PulseErrorNotice
                    title="Team blog feed unavailable"
                    diagnostic={postError}
                    onRetry={() => void loadLatestPost()}
                  />
                ) : latestPost === undefined ? (
                  <div role="status" className="space-y-3 py-2">
                    <div className="h-4 w-24 rounded bg-white/10" />
                    <div className="h-6 w-4/5 rounded bg-white/10" />
                    <div className="h-4 w-full rounded bg-white/10" />
                    <span className="sr-only">Loading latest blog post...</span>
                  </div>
                ) : latestPost ? (
                  <div>
                    {formatPulsePostDate(latestPost.date) && (
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-marble/60">
                        {formatPulsePostDate(latestPost.date)}
                        {latestPost.author ? ` · ${latestPost.author}` : ""}
                      </p>
                    )}
                    <h3 className="mb-2 text-xl font-bold text-white font-heading">
                      {latestPost.title}
                    </h3>
                    {latestPost.snippet && (
                      <p className="line-clamp-3 text-sm leading-relaxed text-marble/75">
                        {latestPost.snippet}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-marble/75">
                    No engineering dispatches are currently published. Visit the
                    team blog for upcoming build notes, CAD breakdowns, and
                    tournament recaps.
                  </p>
                )}
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <Link
                  to={
                    latestPost
                      ? `/blog/${encodeURIComponent(latestPost.slug)}`
                      : "/blog"
                  }
                  className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  {latestPost ? "Read dispatch" : "Browse team blog"}
                  <ArrowRight aria-hidden="true" size={14} className="text-ares-cyan" />
                </Link>
              </div>
            </article>

            {/* Pulse Card 3: Current Season & Partners */}
            <article className="flex flex-col justify-between rounded-2xl border border-white/10 bg-obsidian p-6">
              <div>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-gold">
                    <Trophy aria-hidden="true" size={14} />
                    Season &amp; Community Backing
                  </span>
                </div>

                {seasonError ? (
                  <PulseErrorNotice
                    title="Season & sponsor summary unavailable"
                    diagnostic={seasonError}
                    onRetry={() => void loadSeasonAndSponsors()}
                  />
                ) : seasonSummary === undefined ? (
                  <div role="status" className="space-y-3 py-2">
                    <div className="h-4 w-32 rounded bg-white/10" />
                    <div className="h-6 w-2/3 rounded bg-white/10" />
                    <div className="h-4 w-3/4 rounded bg-white/10" />
                    <span className="sr-only">Loading season and sponsor summary...</span>
                  </div>
                ) : seasonSummary.activeSeason || seasonSummary.sponsors.length > 0 ? (
                  <div className="space-y-3">
                    {seasonSummary.activeSeason ? (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-ares-gold">
                          {seasonSummary.activeSeason.startYear}
                          {seasonSummary.activeSeason.endYear
                            ? `–${seasonSummary.activeSeason.endYear}`
                            : ""}{" "}
                          Season
                        </p>
                        <h3 className="mt-1 text-xl font-bold text-white font-heading">
                          {seasonSummary.activeSeason.challengeName}
                        </h3>
                        {seasonSummary.activeSeason.robotName && (
                          <p className="mt-1 text-sm text-marble/80">
                            Competition machine:{" "}
                            <strong className="text-white">
                              {seasonSummary.activeSeason.robotName}
                            </strong>
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-marble/75">
                        Season records update as competition campaigns publish.
                      </p>
                    )}

                    <p className="text-xs leading-relaxed text-marble/70">
                      {seasonSummary.sponsors.length > 0
                        ? `Backed by ${seasonSummary.sponsors.length} verified community & industry ${
                            seasonSummary.sponsors.length === 1 ? "partner" : "partners"
                          }: ${seasonSummary.sponsors
                            .slice(0, 3)
                            .map((s) => s.name)
                            .join(", ")}${seasonSummary.sponsors.length > 3 ? ", and more." : "."}`
                        : "Partner roster updates as sponsorships are verified."}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-marble/75">
                    Season archive and sponsor roster update as verified records
                    are published. Explore how ARES documents every season and
                    dollar publicly.
                  </p>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-white/10 pt-4">
                <Link
                  to="/seasons"
                  className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  Season archive
                  <ArrowRight aria-hidden="true" size={14} className="text-ares-gold" />
                </Link>
                <Link
                  to="/sponsors"
                  className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-ares-gold transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  Sponsors
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ─── 3. ENGINEERING, LEGACY & COMMUNITY SHOWCASE ─── */}
      <section
        aria-labelledby="engineering-legacy-heading"
        className="relative z-10 bg-obsidian py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-ares-gold font-heading">
                Inside Team 23247
              </p>
              <h2
                id="engineering-legacy-heading"
                className="mb-4 text-4xl font-bold text-white font-heading md:text-5xl"
              >
                Engineering, Legacy &amp; Community
              </h2>
              <p className="text-lg leading-relaxed text-marble/75">
                Every season pairs custom competition hardware with public CAD,
                transparent finances, and hands-on STEM outreach across North
                Central West Virginia.
              </p>
            </div>
            <Link
              to="/about"
              className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-gold underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Meet our students &amp; mentors
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/robots"
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-7 transition-colors hover:border-ares-red/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-ares-red/30 bg-ares-red/10 text-ares-red">
                <Cpu aria-hidden="true" className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-white font-heading group-hover:text-ares-gold transition-colors">
                Robots Fleet
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-marble/75">
                Inspect competition machines, drivetrain and mechanism specs, 3D
                printable parts, and public Onshape CAD workspaces.
              </p>
              <span className="mt-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white group-hover:text-ares-gold">
                Inspect fleet <ArrowRight aria-hidden="true" size={15} className="text-ares-red" />
              </span>
            </Link>

            <Link
              to="/seasons"
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-7 transition-colors hover:border-ares-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-ares-gold/30 bg-ares-gold/10 text-ares-gold">
                <Trophy aria-hidden="true" className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-white font-heading group-hover:text-ares-gold transition-colors">
                Seasons &amp; Legacy
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-marble/75">
                Follow our year-by-year FIRST® Tech Challenge campaigns, judged
                awards, robot reveals, and student leadership milestones.
              </p>
              <span className="mt-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white group-hover:text-ares-gold">
                Explore seasons <ArrowRight aria-hidden="true" size={15} className="text-ares-gold" />
              </span>
            </Link>

            <Link
              to="/tournaments"
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-7 transition-colors hover:border-ares-cyan/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-ares-cyan/30 bg-ares-cyan/10 text-ares-cyan">
                <ShieldCheck aria-hidden="true" className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-white font-heading group-hover:text-ares-gold transition-colors">
                Tournaments
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-marble/75">
                Track regional qualifiers, state championship appearances, match
                outcomes, and event records gathered across the season.
              </p>
              <span className="mt-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white group-hover:text-ares-gold">
                View results <ArrowRight aria-hidden="true" size={15} className="text-ares-cyan" />
              </span>
            </Link>

            <Link
              to="/outreach"
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-7 transition-colors hover:border-ares-bronze/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-ares-bronze/40 bg-ares-bronze/15 text-ares-gold">
                <Sparkles aria-hidden="true" className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-white font-heading group-hover:text-ares-gold transition-colors">
                Outreach &amp; Impact
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-marble/75">
                See how ARES brings live robot demos, workshops, and new-team
                mentoring to schools and libraries across West Virginia.
              </p>
              <span className="mt-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white group-hover:text-ares-gold">
                Community impact <ArrowRight aria-hidden="true" size={15} className="text-ares-gold" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 4A. ACADEMY & OPEN-SOURCE LEARNING ─── */}
      <section
        aria-labelledby="academy-opensource-heading"
        className="border-t border-white/10 bg-white/[0.03] py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-12 max-w-3xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-ares-cyan font-heading">
              Learn &amp; build with ARES
            </p>
            <h2
              id="academy-opensource-heading"
              className="mb-4 text-4xl font-bold text-white font-heading md:text-5xl"
            >
              ARES Academy &amp; Open-Source Curriculum
            </h2>
            <p className="text-lg leading-relaxed text-marble/80">
              Free interactive lessons, control-theory references, and browser
              simulations written for students, mentors, and fellow robotics
              teams.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Link
              to="/academy"
              className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-obsidian p-7 transition-colors hover:border-ares-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-ares-gold/30 bg-ares-gold/10 text-ares-gold">
                  <GraduationCap aria-hidden="true" size={22} />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-white font-heading group-hover:text-ares-gold">
                  ARES Academy
                </h3>
                <p className="text-sm leading-relaxed text-marble/75">
                  Guided robotics, kinematics, electronics, math, and physics
                  modules paired with runnable visual labs.
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-gold">
                Start learning <ArrowRight aria-hidden="true" size={14} />
              </span>
            </Link>

            <Link
              to="/docs"
              className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-obsidian p-7 transition-colors hover:border-ares-red/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-ares-red/30 bg-ares-red/10 text-ares-red">
                  <BookOpen aria-hidden="true" size={22} />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-white font-heading group-hover:text-ares-gold">
                  ARESLib Docs
                </h3>
                <p className="text-sm leading-relaxed text-marble/75">
                  Kotlin architecture guides, PID and feedforward controllers,
                  sensor fusion, and competition-proven API references.
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white group-hover:text-ares-gold">
                Read documentation <ArrowRight aria-hidden="true" size={14} className="text-ares-red" />
              </span>
            </Link>

            <Link
              to="/academy/playground"
              className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-obsidian p-7 transition-colors hover:border-ares-cyan/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-ares-cyan/30 bg-ares-cyan/10 text-ares-cyan">
                  <Play aria-hidden="true" size={22} />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-white font-heading group-hover:text-ares-gold">
                  Simulation Playground
                </h3>
                <p className="text-sm leading-relaxed text-marble/75">
                  Experiment with live control loops and interactive physics
                  models directly in an isolated browser sandbox.
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-cyan group-hover:text-white">
                Launch sandbox <ArrowRight aria-hidden="true" size={14} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 4B. ARES ROBOTICS STUDIO PUBLIC PRODUCT IDENTITY (OAUTH COMPLIANCE) ─── */}
      <section
        aria-labelledby="ares-robotics-studio-heading"
        aria-label="ARES Robotics Studio"
        className="py-20 bg-white/5 border-y border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 items-start">
          <div>
            <p className="text-ares-gold font-bold uppercase tracking-[0.25em] text-xs font-heading mb-3">
              Open-source robotics software
            </p>
            <h2
              id="ares-robotics-studio-heading"
              className="text-4xl md:text-5xl font-bold font-heading text-white mb-6"
            >
              ARES Robotics Studio
            </h2>
            <p className="text-marble/90 text-lg leading-relaxed mb-5">
              ARES Robotics Studio is our local-first desktop mission-control
              application for robot projects, simulation, telemetry, match-log
              analysis, and evidence-based tuning. FTC and FRC teams can use its
              local tools without a Google account or internet access.
            </p>
            <p className="text-marble/75 leading-relaxed">
              Optional Google Drive sync uses one-click Google sign-in. The
              public ARES OAuth client identifies the application; each user
              keeps ownership of files in the personal, team, or Shared Drive
              folder they choose. ARES does not receive access to unrelated
              Drive files.
            </p>
          </div>
          <div className="bg-obsidian border border-white/10 hero-card p-6 sm:p-8">
            <h3 className="text-xl font-bold font-heading text-white mb-4">
              Product information
            </h3>
            <ul className="space-y-3 text-marble/85">
              <li>
                <strong className="text-white">Local-first:</strong> authoring,
                simulation, imports, and analysis remain available offline.
              </li>
              <li>
                <strong className="text-white">Optional cloud:</strong> Google
                permissions and the selected workspace folder remain
                authoritative.
              </li>
              <li>
                <strong className="text-white">No desktop secret:</strong>{" "}
                sign-in uses Authorization Code with PKCE and a loopback
                callback.
              </li>
            </ul>
            <div className="flex flex-wrap gap-3 mt-7">
              <a
                href="https://github.com/ARES-23247/ARES-Robotics/tree/main/ARES-Analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="clipped-button bg-ares-red text-white text-xs uppercase tracking-wider hover:bg-ares-gold hover:text-obsidian"
              >
                View source
              </a>
              <Link
                to="/privacy"
                className="clipped-button bg-transparent border-2 border-ares-bronze text-white text-xs uppercase tracking-wider hover:bg-ares-gold hover:text-obsidian"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="clipped-button bg-transparent border-2 border-white/40 text-white text-xs uppercase tracking-wider hover:bg-white hover:text-obsidian"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. ARES GAMES (COMPLETE 6-GAME ARCADE SHOWCASE) ─── */}
      <section
        aria-labelledby="ares-games-heading"
        className="relative overflow-hidden border-b border-white/10 bg-obsidian py-20"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rotate-12 rounded-[4rem] border border-ares-gold/10"
        />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-ares-gold font-heading">
              Play, learn, and compete
            </p>
            <h2
              id="ares-games-heading"
              className="mb-4 text-4xl font-bold text-white font-heading md:text-5xl"
            >
              ARES Games
            </h2>
            <p className="text-lg leading-relaxed text-marble/80">
              Six original browser games built by ARES 23247 — from robot field
              simulation and swarm puzzles to hexagonal word and strategy boards.
            </p>
            <p className="mt-3 text-sm text-marble/65">
              Online rooms use private codes or bounded matchmaking — No chat,
              public lobby, player profile, or spectator mode.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <Link
                to="/arcade"
                className="inline-flex min-h-11 items-center gap-2 font-bold text-ares-gold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Explore the arcade
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
              <Link
                to="/buzzle/word-tools"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-marble/85 underline decoration-white/30 underline-offset-4 hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                BUZZLE Word Tools
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {ARCADE_GAMES.map((game) => {
              const Icon = game.icon;
              return (
                <Link
                  key={game.to}
                  to={game.to}
                  aria-label={`Play ${game.label}`}
                  className="group flex min-w-0 flex-col justify-between rounded-2xl border border-ares-gold/25 bg-white/5 p-5 transition-colors hover:border-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian sm:p-6"
                >
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-ares-gold/40 bg-ares-gold/10 text-ares-gold transition-transform group-hover:scale-105">
                        <Icon aria-hidden="true" size={24} className={game.iconColor} />
                      </span>
                      <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider text-ares-gold">
                        {game.modes}
                      </span>
                    </div>
                    <h3 className="mb-2 text-2xl font-bold text-white font-heading">
                      {game.label}
                    </h3>
                    <p className="text-sm leading-relaxed text-marble/75">
                      {game.description}
                    </p>
                  </div>
                  <span className="mt-5 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-widest text-white transition-colors group-hover:text-ares-gold">
                    Play now <ArrowRight aria-hidden="true" size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 6. SPONSORS & RECRUITMENT CALL TO ACTION ─── */}
      <GreekMeander
        variant="thin"
        opacity="opacity-60"
        className="relative -bottom-[1px] z-10"
      />
      <section className="py-24 bg-white/5 border-t border-white/5 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 font-heading text-white">
            Join{" "}
            <span className="bg-ares-red px-3 py-1 pb-2 ares-cut-sm text-white font-bold">
              ARES
            </span>
          </h2>
          <p className="text-marble/90 text-lg sm:text-xl mb-10 leading-relaxed">
            Students in grades 6–12 across the Morgantown area can join with no
            prior robotics experience, and community sponsors power every part,
            tool, and tournament trip we take.
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6">
            <Link
              to="/sponsors"
              className="clipped-button inline-flex min-h-11 items-center justify-center gap-2 bg-ares-gold text-obsidian font-bold hover:bg-white hover:text-obsidian transition-colors"
            >
              <Heart aria-hidden="true" size={16} />
              Become a Sponsor
            </Link>
            <Link
              to="/join"
              className="clipped-button inline-flex min-h-11 items-center justify-center border-2 border-white bg-transparent font-bold text-white hover:bg-white hover:text-obsidian transition-colors"
            >
              Team Application
            </Link>
            <Link
              to="/finance"
              className="inline-flex min-h-11 items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-widest text-marble/85 underline decoration-ares-gold/40 underline-offset-4 transition-colors hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Public Financial Ledger
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
