"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Image as ImageIcon,
  ListChecks,
  MapPin,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { db } from "@/lib/firebaseFirestore";
import type { ManagedPhoto } from "@/lib/media";
import { logger } from "@/utils/logger";
import { fetchPublicEvents } from "@/app/calendar/api";
import { eventDetailHref } from "@/app/calendar/calendarView";
import type { TeamEvent } from "@/types/event";
import type { TaskItem } from "@/types/task";
import {
  isPublicAnnouncement,
  type PublicAnnouncement,
} from "@/components/SiteAnnouncementBanner";
import {
  describeTaskDueDate,
  normalizeTaskRecord,
} from "../tasks/taskRecord";
import { selectNextEvent, selectTodayTasks } from "./todayData";

interface PhotoPage {
  photos?: unknown;
}

interface AnnouncementPage {
  announcement?: unknown;
}

function formatEventDate(event: TeamEvent): string {
  const start = new Date(event.dateStart);
  if (!Number.isFinite(start.getTime())) return "Schedule unavailable";
  return start.toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isManagedPhoto(value: unknown): value is ManagedPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Partial<ManagedPhoto>;
  return (
    typeof photo.id === "string" &&
    typeof photo.publicUrl === "string" &&
    typeof photo.caption === "string" &&
    typeof photo.altText === "string" &&
    photo.isArchived === false
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div role="status" className="glass-card min-h-40 animate-pulse border border-white/10 p-5">
      <span className="sr-only">{label}</span>
    </div>
  );
}

function SectionError({ message }: { message: string }) {
  return (
    <div role="alert" className="border border-ares-red/50 bg-ares-red/10 p-4 text-sm text-white ares-cut-sm">
      <p className="font-bold">This section could not load.</p>
      <p className="mt-1 text-xs text-marble/75">{message}</p>
    </div>
  );
}

export default function TeamTodayPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<TeamEvent[] | null>(null);
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [photos, setPhotos] = useState<ManagedPhoto[] | null>(null);
  const [announcement, setAnnouncement] = useState<PublicAnnouncement | null | undefined>(undefined);
  const [eventError, setEventError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [announcementError, setAnnouncementError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    void fetchPublicEvents(30, undefined, 45)
      .then((page) => setEvents(page.events))
      .catch((error: unknown) => {
        logger.warn("Team Today could not load events.");
        setEventError(error instanceof Error ? error.message : "Calendar request failed.");
      });

    void authenticatedFetch("/api/photos?limit=4&includeArchived=false", {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Photo library returned HTTP ${response.status}.`);
        const payload = (await response.json()) as PhotoPage;
        if (!Array.isArray(payload.photos)) throw new Error("Photo library returned an invalid response.");
        setPhotos(payload.photos.filter(isManagedPhoto).slice(0, 4));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        logger.warn("Team Today could not load recent photos.");
        setPhotoError(error instanceof Error ? error.message : "Photo request failed.");
      });

    void fetch("/api/announcements", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Announcements returned HTTP ${response.status}.`);
        const payload = (await response.json()) as AnnouncementPage;
        if (payload.announcement === null || payload.announcement === undefined) {
          setAnnouncement(null);
          return;
        }
        if (!isPublicAnnouncement(payload.announcement)) {
          throw new Error("Announcements returned an invalid response.");
        }
        setAnnouncement(payload.announcement);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        logger.warn("Team Today could not load the active announcement.");
        setAnnouncementError(error instanceof Error ? error.message : "Announcement request failed.");
      });

    const taskQuery = query(collection(db, "tasks"), limit(200));
    const unsubscribe = onSnapshot(
      taskQuery,
      (snapshot) => {
        setTasks(snapshot.docs.map((document) => normalizeTaskRecord(document.id, document.data())));
      },
      (error) => {
        logger.warn("Team Today could not load tasks.");
        setTaskError(error.message);
      },
    );

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, []);

  const nextEvent = useMemo(() => (events ? selectNextEvent(events) : null), [events]);
  const taskSelection = useMemo(
    () => selectTodayTasks(tasks ?? [], [user?.uid, user?.email]),
    [tasks, user?.email, user?.uid],
  );
  const firstName = user?.displayName?.trim().split(/\s+/, 1)[0] || "team member";

  return (
    <div className="space-y-8 text-left">
      <header className="border-b border-white/10 pb-6">
        <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-ares-gold">
          <Sparkles aria-hidden="true" size={15} /> Daily workspace
        </p>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
          Team Today
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-marble/75">
          Welcome, {firstName}. Here is the current schedule, work, and team activity in one mobile-friendly view.
        </p>
      </header>

      <section aria-labelledby="today-alert-heading">
        <h2 id="today-alert-heading" className="sr-only">Current team alert</h2>
        {announcementError ? (
          <SectionError message={announcementError} />
        ) : announcement === undefined ? (
          <LoadingCard label="Loading current team alert" />
        ) : announcement ? (
          <div className={`border p-5 ares-cut ${announcement.severity === "urgent" ? "border-white/30 bg-ares-red" : "border-ares-gold/40 bg-ares-gold/10"}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={22} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-widest">Active team alert</p>
                <p className="mt-1 break-words text-base font-bold text-white">{announcement.message}</p>
                {announcement.link && announcement.linkLabel && (
                  <Link to={announcement.link} className="mt-3 inline-flex min-h-11 items-center gap-2 border border-current px-4 py-2 text-xs font-black uppercase tracking-wide focus-visible:ring-2 focus-visible:ring-white">
                    {announcement.linkLabel} <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 border border-ares-success/30 bg-ares-success/10 p-4 text-sm text-white ares-cut-sm">
            <CheckCircle2 aria-hidden="true" className="shrink-0 text-ares-success" size={20} />
            No urgent team alert is active.
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="next-event-heading" className="glass-card border border-white/10 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="next-event-heading" className="flex items-center gap-2 font-heading text-lg font-black uppercase text-white">
              <CalendarDays aria-hidden="true" className="text-ares-red" size={20} /> Next event
            </h2>
            <Link to="/calendar" className="text-xs font-bold text-ares-cyan underline-offset-4 hover:underline">Full calendar</Link>
          </div>
          {eventError ? <SectionError message={eventError} /> : events === null ? <LoadingCard label="Loading next event" /> : nextEvent ? (
            <div className="space-y-4">
              <div>
                <p className="text-xl font-black text-white">{nextEvent.title}</p>
                <p className="mt-2 flex items-start gap-2 text-sm text-marble/80"><Clock3 aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> {formatEventDate(nextEvent)}</p>
                {nextEvent.location && <p className="mt-2 flex items-start gap-2 text-sm text-marble/80"><MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> {nextEvent.location}</p>}
              </div>
              <Link to={eventDetailHref(nextEvent)} className="inline-flex min-h-11 items-center gap-2 bg-ares-red px-4 py-2 text-xs font-black uppercase tracking-wide text-white ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan">
                View details and RSVP <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </div>
          ) : <p className="text-sm text-marble/70">No upcoming event is currently published.</p>}
        </section>

        <section aria-labelledby="today-tasks-heading" className="glass-card border border-white/10 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="today-tasks-heading" className="flex items-center gap-2 font-heading text-lg font-black uppercase text-white">
              <ListChecks aria-hidden="true" className="text-ares-gold" size={20} /> {taskSelection.personalized ? "My tasks" : "Priority tasks"}
            </h2>
            <Link to="/dashboard/tasks" className="text-xs font-bold text-ares-cyan underline-offset-4 hover:underline">Task board</Link>
          </div>
          {taskError ? <SectionError message={taskError} /> : tasks === null ? <LoadingCard label="Loading tasks" /> : taskSelection.tasks.length ? (
            <ul className="space-y-3">
              {taskSelection.tasks.map((task) => (
                <li key={task.id} className="border border-white/10 bg-black/25 p-3 ares-cut-sm">
                  <Link to={`/dashboard/tasks?task=${encodeURIComponent(task.id)}`} className="block min-h-11 focus-visible:ring-2 focus-visible:ring-ares-cyan">
                    <span className="font-bold text-white">{task.title}</span>
                    <span className="mt-1 block text-xs uppercase tracking-wide text-marble/60">{task.priority} priority{describeTaskDueDate(task) ? ` · ${describeTaskDueDate(task)}` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-marble/70">There are no active tasks right now.</p>}
        </section>
      </div>

      <section aria-labelledby="progress-photos-heading" className="glass-card border border-white/10 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="progress-photos-heading" className="flex items-center gap-2 font-heading text-lg font-black uppercase text-white">
            <ImageIcon aria-hidden="true" className="text-ares-cyan" size={20} /> Recent progress
          </h2>
          <Link to="/dashboard/photos" className="text-xs font-bold text-ares-cyan underline-offset-4 hover:underline">Photo library</Link>
        </div>
        {photoError ? <SectionError message={photoError} /> : photos === null ? <LoadingCard label="Loading recent progress photos" /> : photos.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((photo) => (
              <li key={photo.id} className="min-w-0 overflow-hidden border border-white/10 bg-black/30 ares-cut-sm">
                <img src={photo.thumbnailUrl || photo.publicUrl} alt={photo.altText || photo.caption || "Team progress photo"} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                {(photo.caption || photo.altText) && <p className="line-clamp-2 p-2 text-xs text-marble/75">{photo.caption || photo.altText}</p>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-marble/70">No recent progress photos are available.</p>}
      </section>

      <section aria-labelledby="quick-links-heading">
        <h2 id="quick-links-heading" className="mb-4 font-heading text-lg font-black uppercase text-white">Team resources</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { to: "/dashboard/documents", label: "Cloud resources", icon: FileText },
            { to: "/academy", label: "ARES Academy", icon: BookOpen },
            { to: "/dashboard/zulip", label: "Zulip chat hub", icon: MessageSquare },
            { to: "/dashboard/tasks", label: "All team tasks", icon: ListChecks },
          ].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex min-h-14 items-center justify-between gap-3 border border-white/10 bg-white/5 px-4 py-3 font-bold text-white ares-cut-sm hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <span className="flex items-center gap-3"><Icon aria-hidden="true" className="text-ares-gold" size={19} /> {label}</span>
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
