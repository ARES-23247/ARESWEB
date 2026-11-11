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
  LayoutDashboard,
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
  const { user, loading } = useAuth();

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
      <section className="relative w-full overflow-hidden bg-obsidian py-12 sm:py-16 lg:py-20">
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

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start px-4 text-left sm:px-6">
          <div className="mb-6 flex min-w-0 flex-col gap-5 sm:gap-8 md:flex-row md:items-center md:gap-12">
            <img
              src="/favicon.svg"
              alt="ARES 23247 Logo"
              className="h-20 w-20 shrink-0 object-contain drop-shadow-[0_0_25px_rgba(192,0,0,0.6)] sm:h-28 sm:w-28 md:h-40 md:w-40 lg:h-44 lg:w-44"
            />
            <div className="min-w-0 max-w-full">
              <p className="mb-3 max-w-full text-xs font-bold uppercase tracking-[0.22em] text-ares-gold sm:tracking-[0.38em] md:text-sm font-heading">
                Appalachian Robotics &amp; Engineering Society
              </p>
              <h1 className="relative z-10 w-full max-w-full text-[clamp(2.25rem,12vw,3.5rem)] font-bold uppercase leading-[0.9] text-white font-heading md:text-[5.5rem] md:leading-[0.86] lg:text-[6.5rem]">
                <span className="sr-only">ARES 23247 — </span>
                <span className="block mb-2 text-white">Engineered</span>
                <span className="mt-2 inline-block max-w-full whitespace-nowrap bg-ares-red px-3 py-2 pb-3 text-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.4)] ares-cut-sm sm:px-6">
                  To Inspire
                </span>
              </h1>
            </div>
          </div>

          <p
            id="hero-mountaineer-mindset"
            className="mb-8 max-w-2xl border-l-4 border-ares-bronze pl-4 text-base font-medium leading-relaxed text-marble/90 sm:pl-5 sm:text-lg"
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
          </p>

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
            ) : (
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                {user ? (
                  <Link
                    to="/dashboard"
                    className="clipped-button inline-flex min-h-11 items-center justify-center gap-2 bg-ares-red font-bold text-white shadow-xl transition-colors hover:bg-ares-gold hover:text-obsidian"
                  >
                    <LayoutDashboard aria-hidden="true" size={16} />
                    Go to Portal
                  </Link>
                ) : (
                  <Link
                    to="/join"
                    className="clipped-button inline-flex min-h-11 items-center justify-center gap-2 bg-ares-red font-bold text-white shadow-xl transition-colors hover:bg-ares-gold hover:text-obsidian"
                  >
                    <Users aria-hidden="true" size={16} />
                    Join the Team
                  </Link>
                )}
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
        className="border-y border-white/10 bg-white/[0.03] py-14"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.25em] text-ares-gold font-heading">
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
              Upcoming schedule dates, build dispatches, and active season status.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Pulse Card 1: Next Scheduled Event */}
            <article className="flex flex-col justify-between rounded-2xl border border-white/10 bg-obsidian p-5 sm:p-6">
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
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
                    <h3 className="mb-1.5 text-xl font-bold text-white font-heading">
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
                    No upcoming public events are currently published. Check the
                    calendar for seasonal dates.
                  </p>
                )}
              </div>

              <div className="mt-5 border-t border-white/10 pt-3">
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
            <article className="flex flex-col justify-between rounded-2xl border border-white/10 bg-obsidian p-5 sm:p-6">
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
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
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-marble/60">
                        {formatPulsePostDate(latestPost.date)}
                        {latestPost.author ? ` · ${latestPost.author}` : ""}
                      </p>
                    )}
                    <h3 className="mb-1.5 text-xl font-bold text-white font-heading">
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
                    blog for build notes and tournament recaps.
                  </p>
                )}
              </div>

              <div className="mt-5 border-t border-white/10 pt-3">
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
            <article className="flex flex-col justify-between rounded-2xl border border-white/10 bg-obsidian p-5 sm:p-6">
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
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
                  <div className="space-y-2.5">
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
                            Machine:{" "}
                            <strong className="text-white">
                              {seasonSummary.activeSeason.robotName}
                            </strong>
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-marble/75">
                        Season records update as campaigns publish.
                      </p>
                    )}

                    <p className="text-xs leading-relaxed text-marble/70">
                      {seasonSummary.sponsors.length > 0
                        ? `Backed by ${seasonSummary.sponsors.length} verified ${
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
                    Season and sponsor records update as verified entries publish.
                  </p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/10 pt-3">
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
        className="relative z-10 bg-obsidian py-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-ares-gold font-heading">
                Inside Team 23247
              </p>
              <h2
                id="engineering-legacy-heading"
                className="mb-3 text-3xl font-bold text-white font-heading sm:text-4xl"
              >
                Engineering, Legacy &amp; Community
              </h2>
              <p className="text-base leading-relaxed text-marble/75">
                Custom competition hardware paired with public CAD, transparent
                finances, and hands-on STEM outreach across West Virginia.
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

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/robots"
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-ares-red/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-ares-red/30 bg-ares-red/10 text-ares-red">
                <Cpu aria-hidden="true" className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white font-heading group-hover:text-ares-gold transition-colors">
                Robots Fleet
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-marble/75">
                Competition machines, mechanism specs, 3D printable parts, and
                public Onshape CAD.
              </p>
              <span className="mt-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white group-hover:text-ares-gold">
                Inspect fleet <ArrowRight aria-hidden="true" size={15} className="text-ares-red" />
              </span>
            </Link>

            <Link
              to="/seasons"
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-ares-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-ares-gold/30 bg-ares-gold/10 text-ares-gold">
                <Trophy aria-hidden="true" className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white font-heading group-hover:text-ares-gold transition-colors">
                Seasons &amp; Legacy
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-marble/75">
                Year-by-year FIRST® Tech Challenge campaigns, judged awards, and
                season dossiers.
              </p>
              <span className="mt-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white group-hover:text-ares-gold">
                Explore seasons <ArrowRight aria-hidden="true" size={15} className="text-ares-gold" />
              </span>
            </Link>

            <Link
              to="/tournaments"
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-ares-cyan/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-ares-cyan/30 bg-ares-cyan/10 text-ares-cyan">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white font-heading group-hover:text-ares-gold transition-colors">
                Tournaments
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-marble/75">
                Regional qualifiers, state championship appearances, and
                verified match results.
              </p>
              <span className="mt-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white group-hover:text-ares-gold">
                View results <ArrowRight aria-hidden="true" size={15} className="text-ares-cyan" />
              </span>
            </Link>

            <Link
              to="/outreach"
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-ares-bronze/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-ares-bronze/40 bg-ares-bronze/15 text-ares-gold">
                <Sparkles aria-hidden="true" className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white font-heading group-hover:text-ares-gold transition-colors">
                Outreach &amp; Impact
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-marble/75">
                Live robot demos, workshops, and new-team mentoring at schools
                and libraries statewide.
              </p>
              <span className="mt-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white group-hover:text-ares-gold">
                Community impact <ArrowRight aria-hidden="true" size={15} className="text-ares-gold" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 4. UNIFIED OPEN-SOURCE SOFTWARE & LEARNING (+ STUDIO OAUTH COMPLIANCE) ─── */}
      <section
        aria-labelledby="open-source-learning-heading"
        className="border-t border-white/10 bg-white/[0.03] py-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-ares-cyan font-heading">
              Learn &amp; build with ARES
            </p>
            <h2
              id="open-source-learning-heading"
              className="mb-3 text-3xl font-bold text-white font-heading sm:text-4xl"
            >
              Open-Source Software &amp; Learning
            </h2>
            <p className="text-base leading-relaxed text-marble/80">
              Free control-theory lessons, Kotlin robotics libraries, browser
              sandboxes, and desktop tooling shared with fellow teams.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Link
              to="/academy"
              className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-obsidian p-6 transition-colors hover:border-ares-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-ares-gold/30 bg-ares-gold/10 text-ares-gold">
                  <GraduationCap aria-hidden="true" size={20} />
                </div>
                <h3 className="mb-2 text-xl font-bold text-white font-heading group-hover:text-ares-gold">
                  ARES Academy
                </h3>
                <p className="text-sm leading-relaxed text-marble/75">
                  Guided kinematics, control, electronics, and math modules
                  paired with interactive labs.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-gold">
                Start learning <ArrowRight aria-hidden="true" size={14} />
              </span>
            </Link>

            <Link
              to="/docs"
              className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-obsidian p-6 transition-colors hover:border-ares-red/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-ares-red/30 bg-ares-red/10 text-ares-red">
                  <BookOpen aria-hidden="true" size={20} />
                </div>
                <h3 className="mb-2 text-xl font-bold text-white font-heading group-hover:text-ares-gold">
                  ARESLib Docs
                </h3>
                <p className="text-sm leading-relaxed text-marble/75">
                  Kotlin architecture guides, PID and feedforward controllers,
                  and sensor-fusion references.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white group-hover:text-ares-gold">
                Read documentation <ArrowRight aria-hidden="true" size={14} className="text-ares-red" />
              </span>
            </Link>

            <Link
              to="/academy/playground"
              className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-obsidian p-6 transition-colors hover:border-ares-cyan/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-ares-cyan/30 bg-ares-cyan/10 text-ares-cyan">
                  <Play aria-hidden="true" size={20} />
                </div>
                <h3 className="mb-2 text-xl font-bold text-white font-heading group-hover:text-ares-gold">
                  Simulation Playground
                </h3>
                <p className="text-sm leading-relaxed text-marble/75">
                  Test live control loops and physics models in an isolated
                  browser sandbox.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-cyan group-hover:text-white">
                Launch sandbox <ArrowRight aria-hidden="true" size={14} />
              </span>
            </Link>
          </div>

          {/* Compact ARES Robotics Studio OAuth product identity panel */}
          <section
            aria-labelledby="ares-robotics-studio-heading"
            aria-label="ARES Robotics Studio"
            className="mt-6 flex flex-col justify-between gap-5 rounded-2xl border border-white/10 bg-obsidian p-5 sm:p-6 lg:flex-row lg:items-center"
          >
            <div className="min-w-0 max-w-3xl">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-ares-gold font-heading">
                Desktop mission-control app
              </p>
              <h3
                id="ares-robotics-studio-heading"
                className="mb-2 text-xl font-bold text-white font-heading sm:text-2xl"
              >
                ARES Robotics Studio
              </h3>
              <p className="text-sm leading-relaxed text-marble/80">
                <strong className="text-white">Local-first:</strong> robot
                projects, simulation, telemetry, and log tuning work offline
                without an account. Optional Google Drive sync uses PKCE sign-in
                (no desktop secret) scoped strictly to the personal or Shared
                Drive folder you select, with no access to unrelated files.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0">
              <a
                href="https://github.com/ARES-23247/ARES-Robotics/tree/main/ARES-Analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="clipped-button inline-flex min-h-11 items-center justify-center bg-ares-red text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-ares-gold hover:text-obsidian"
              >
                View source
              </a>
              <Link
                to="/privacy"
                className="clipped-button inline-flex min-h-11 items-center justify-center border-2 border-ares-bronze bg-transparent text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-ares-gold hover:text-obsidian"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="clipped-button inline-flex min-h-11 items-center justify-center border-2 border-white/40 bg-transparent text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-obsidian"
              >
                Terms
              </Link>
            </div>
          </section>
        </div>
      </section>

      {/* ─── 5. SPONSORS & RECRUITMENT CALL TO ACTION ─── */}
      <GreekMeander
        variant="thin"
        opacity="opacity-60"
        className="relative -bottom-[1px] z-10"
      />
      <section className="relative overflow-hidden border-t border-white/5 bg-white/5 py-16">
        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="mb-4 text-3xl font-bold text-white font-heading sm:text-5xl">
            Join{" "}
            <span className="bg-ares-red px-3 py-1 pb-2 ares-cut-sm text-white font-bold">
              ARES
            </span>
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-marble/90 sm:text-lg">
            Morgantown-area students in grades 6–12 can join with no prior
            experience, and community sponsors fund every part, tool, and
            tournament trip.
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-5">
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
