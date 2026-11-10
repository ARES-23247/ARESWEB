"use client";

import { logger } from "@/utils/logger";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  and,
  collection,
  getCountFromServer,
  limit,
  onSnapshot,
  or,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import { authenticatedFetch } from "@/lib/api";
import { maskEmail } from "@/lib/utils";
import { canUseMemberAi } from "@/lib/authorization";
import {
  canReviewDashboardContent,
  type DashboardNotificationState,
  useDashboardNotifications,
} from "@/context/DashboardNotificationsContext";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  PenTool,
  Shield,
  TerminalSquare,
  User,
  Zap,
} from "lucide-react";

import { fetchPublicEvents } from "@/app/calendar/api";
import { eventDetailHref } from "@/app/calendar/calendarView";
import AuthenticatedImage from "@/components/media/AuthenticatedImage";
import {
  ANNOUNCEMENT_SEVERITY_STYLES,
  isPublicAnnouncement,
  type PublicAnnouncement,
} from "@/components/SiteAnnouncementBanner";
import type { ManagedPhoto } from "@/lib/media";
import type { TeamEvent } from "@/types/event";
import type { TaskItem } from "@/types/task";
import {
  describeTaskDueDate,
  getTaskDueState,
  normalizeTaskRecord,
  summarizeTaskDescription,
} from "./tasks/taskRecord";
import {
  getPriorityStyle,
  getStatusLabel,
  getSubteamStyle,
} from "./tasks/utils/taskStyles";
import { selectNextEvent, selectTodayTasks } from "./today/todayData";
import DashboardOnboardingGuide from "./components/DashboardOnboardingGuide";
import DashboardServiceStatusCard from "./components/DashboardServiceStatusCard";

interface PhotoPage {
  photos?: unknown;
}

interface AnnouncementPage {
  announcement?: unknown;
}

interface ApprovalQueueDescriptor {
  id: string;
  label: string;
  pendingCount: number;
  hasBooleanPending?: boolean;
  state: DashboardNotificationState;
  to: string;
  linkLabel: string;
  activeHeading: string;
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
    <div
      role="status"
      className="glass-card min-h-28 animate-pulse border border-white/10 p-5"
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

function SectionError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border border-ares-red/50 bg-ares-red/10 p-4 text-sm text-white ares-cut-sm"
    >
      <p className="font-bold">This section could not load.</p>
      <p className="mt-1 break-words text-xs text-marble/75">{message}</p>
    </div>
  );
}

export default function DashboardHome() {
  const { user, authorizedUser } = useAuth();

  // Real-time Database & Daily Pulse State
  const [tasks, setTasks] = useState<TaskItem[] | null>(() =>
    import.meta.env.MODE === "e2e" ? [] : null,
  );
  const [taskError, setTaskError] = useState("");
  const [blogCount, setBlogCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [databaseState, setDatabaseState] = useState<
    "connecting" | "connected" | "error"
  >(() => (import.meta.env.MODE === "e2e" ? "connected" : "connecting"));

  const [events, setEvents] = useState<TeamEvent[] | null>(null);
  const [eventError, setEventError] = useState("");
  const [photos, setPhotos] = useState<ManagedPhoto[] | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [announcement, setAnnouncement] = useState<
    PublicAnnouncement | null | undefined
  >(undefined);
  const [announcementError, setAnnouncementError] = useState("");

  const userRole = authorizedUser?.role || "Pending Verification";
  const isUnverified =
    userRole === "unverified" || userRole === "Pending Verification";
  const canUseAi = canUseMemberAi(userRole);
  const canReviewContent = canReviewDashboardContent(userRole);
  const canReviewInquiries = userRole === "admin" || userRole === "coach";
  const {
    pendingBlogApprovals,
    blogApprovalsState,
    pendingEventApprovals = 0,
    eventApprovalsState = "idle",
    pendingAcademyApprovals = 0,
    academyApprovalsState = "idle",
    pendingAreslibApprovals = 0,
    areslibApprovalsState = "idle",
    pendingDocumentApprovals = 0,
    documentApprovalsState = "idle",
    hasPendingInquiries,
    inquiriesState,
  } = useDashboardNotifications();

  // Daily team pulse HTTP sources (announcements, upcoming calendar, recent photos).
  useEffect(() => {
    const controller = new AbortController();

    const loadEvents = async () => {
      try {
        const page = await fetchPublicEvents(30, undefined, 45);
        if (!page || !Array.isArray(page.events)) {
          throw new Error("Calendar returned an invalid response.");
        }
        setEvents(page.events);
      } catch (error: unknown) {
        logger.warn("Command Center could not load events.");
        setEventError(
          error instanceof Error ? error.message : "Calendar request failed.",
        );
      }
    };

    const loadPhotos = async () => {
      try {
        const response = await authenticatedFetch(
          "/api/photos?limit=4&includeArchived=false",
          { signal: controller.signal },
        );
        if (!response?.ok) {
          throw new Error(
            `Photo library returned HTTP ${response?.status ?? "error"}.`,
          );
        }
        const payload = (await response.json()) as PhotoPage;
        if (!Array.isArray(payload.photos)) {
          throw new Error("Photo library returned an invalid response.");
        }
        setPhotos(payload.photos.filter(isManagedPhoto).slice(0, 4));
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        logger.warn("Command Center could not load recent photos.");
        setPhotoError(
          error instanceof Error ? error.message : "Photo request failed.",
        );
      }
    };

    const loadAnnouncement = async () => {
      try {
        const response = await fetch("/api/announcements", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response?.ok) {
          throw new Error(
            `Announcements returned HTTP ${response?.status ?? "error"}.`,
          );
        }
        const payload = (await response.json()) as AnnouncementPage;
        if (
          payload.announcement === null ||
          payload.announcement === undefined
        ) {
          setAnnouncement(null);
          return;
        }
        if (!isPublicAnnouncement(payload.announcement)) {
          throw new Error("Announcements returned an invalid response.");
        }
        setAnnouncement(payload.announcement);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        logger.warn("Command Center could not load the active announcement.");
        setAnnouncementError(
          error instanceof Error
            ? error.message
            : "Announcement request failed.",
        );
      }
    };

    void loadEvents();
    void loadPhotos();
    void loadAnnouncement();

    return () => {
      controller.abort();
    };
  }, []);

  // Fetch content counts once and keep a single bounded tasks listener synchronized.
  useEffect(() => {
    if (import.meta.env.MODE === "e2e") return;

    const fetchCounts = async () => {
      try {
        const [blogsSnap, docsSnap] = await Promise.all([
          getCountFromServer(
            query(
              collection(db, "posts"),
              where("status", "==", "published"),
              where("isDeleted", "==", 0),
            ),
          ),
          getCountFromServer(
            query(
              collection(db, "docs"),
              and(
                where("status", "==", "published"),
                where("isDeleted", "==", 0),
                or(
                  where("displayInMathCorner", "==", 1),
                  where("displayInScienceCorner", "==", 1),
                ),
              ),
            ),
          ),
        ]);

        setBlogCount(blogsSnap.data().count);
        setDocCount(docsSnap.data().count);
        setDatabaseState((prev) => (prev === "error" ? prev : "connected"));
      } catch (err) {
        logger.error("Error fetching dashboard counts:", err);
        setDatabaseState("error");
      }
    };

    void fetchCounts();

    try {
      const qTasks = query(collection(db, "tasks"), limit(500));
      const unsubTasks = onSnapshot(
        qTasks,
        (snapshot) => {
          setTaskError("");
          setDatabaseState("connected");
          setTasks(
            snapshot.docs.map((d) => normalizeTaskRecord(d.id, d.data())),
          );
        },
        (err) => {
          logger.error("Tasks listener error:", err);
          setTaskError(err.message || "Tasks listener failed.");
          setDatabaseState("error");
        },
      );

      return () => {
        unsubTasks();
      };
    } catch (e) {
      logger.error("Error setting up tasks list listener:", e);
      setTaskError(
        e instanceof Error ? e.message : "Tasks listener setup failed.",
      );
      setDatabaseState("error");
    }
  }, []);

  const visibleTasks = useMemo(
    () => (tasks ?? []).filter((task) => task.isDeleted !== 1),
    [tasks],
  );
  const openTasks = useMemo(
    () =>
      visibleTasks.filter(
        (task) => !task.archived && task.status !== "completed",
      ),
    [visibleTasks],
  );
  const taskCount = visibleTasks.length;
  const activeTasks = openTasks.length;
  const overdueTasks = useMemo(
    () => openTasks.filter((task) => getTaskDueState(task) === "overdue").length,
    [openTasks],
  );
  const dueTodayTasks = useMemo(
    () => openTasks.filter((task) => getTaskDueState(task) === "today").length,
    [openTasks],
  );
  const taskSelection = useMemo(
    () => selectTodayTasks(visibleTasks, [user?.uid, user?.email], 5),
    [visibleTasks, user?.email, user?.uid],
  );
  const nextEvent = useMemo(
    () => (events ? selectNextEvent(events) : null),
    [events],
  );

  const approvalQueues = useMemo<ApprovalQueueDescriptor[]>(() => {
    if (!canReviewContent) return [];
    const queues: ApprovalQueueDescriptor[] = [
      {
        id: "blog",
        label: "Blog Posts",
        pendingCount: pendingBlogApprovals,
        state: blogApprovalsState,
        to: "/dashboard/blog?tab=pending",
        linkLabel:
          pendingBlogApprovals > 0
            ? "Review approval queue"
            : "Open Blog Management",
        activeHeading: `${pendingBlogApprovals} blog ${pendingBlogApprovals === 1 ? "post needs" : "posts need"} mentor approval`,
      },
      {
        id: "events",
        label: "Events & Venues",
        pendingCount: pendingEventApprovals,
        state: eventApprovalsState,
        to: "/dashboard/events",
        linkLabel:
          pendingEventApprovals > 0 ? "Review events" : "Open Events Manager",
        activeHeading: `${pendingEventApprovals} ${pendingEventApprovals === 1 ? "event needs" : "events need"} mentor approval`,
      },
      {
        id: "academy",
        label: "Academy Lessons",
        pendingCount: pendingAcademyApprovals,
        state: academyApprovalsState,
        to: "/dashboard/academy",
        linkLabel:
          pendingAcademyApprovals > 0
            ? "Review lessons"
            : "Open Academy Manager",
        activeHeading: `${pendingAcademyApprovals} academy ${pendingAcademyApprovals === 1 ? "lesson needs" : "lessons need"} mentor approval`,
      },
      {
        id: "areslib",
        label: "ARESLib Docs",
        pendingCount: pendingAreslibApprovals,
        state: areslibApprovalsState,
        to: "/dashboard/areslib",
        linkLabel:
          pendingAreslibApprovals > 0
            ? "Review ARESLib"
            : "Open ARESLib Manager",
        activeHeading: `${pendingAreslibApprovals} ARESLib ${pendingAreslibApprovals === 1 ? "document needs" : "documents need"} mentor approval`,
      },
      {
        id: "documents",
        label: "Cloud Resources",
        pendingCount: pendingDocumentApprovals,
        state: documentApprovalsState,
        to: "/dashboard/documents",
        linkLabel:
          pendingDocumentApprovals > 0
            ? "Review resources"
            : "Open Cloud Resources",
        activeHeading: `${pendingDocumentApprovals} cloud ${pendingDocumentApprovals === 1 ? "resource needs" : "resources need"} mentor approval`,
      },
    ];

    if (canReviewInquiries) {
      queues.push({
        id: "inquiries",
        label: "Encrypted Inquiries",
        pendingCount: hasPendingInquiries ? 1 : 0,
        hasBooleanPending: hasPendingInquiries,
        state: inquiriesState,
        to: "/dashboard/inquiries",
        linkLabel: hasPendingInquiries ? "Review inquiries" : "Open Inquiries",
        activeHeading: "Pending recruitment or sponsor inquiries require review",
      });
    }

    return queues;
  }, [
    academyApprovalsState,
    areslibApprovalsState,
    blogApprovalsState,
    canReviewContent,
    canReviewInquiries,
    documentApprovalsState,
    eventApprovalsState,
    hasPendingInquiries,
    inquiriesState,
    pendingAcademyApprovals,
    pendingAreslibApprovals,
    pendingBlogApprovals,
    pendingDocumentApprovals,
    pendingEventApprovals,
  ]);

  const totalPendingApprovals = useMemo(
    () =>
      approvalQueues.reduce(
        (sum, queue) =>
          queue.state === "error" ? sum : sum + queue.pendingCount,
        0,
      ),
    [approvalQueues],
  );
  const anyApprovalQueueError = useMemo(
    () => approvalQueues.some((queue) => queue.state === "error"),
    [approvalQueues],
  );

  const appCheckActive =
    !!import.meta.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  const firstName =
    user?.displayName?.trim().split(/\s+/, 1)[0] || "team member";

  return (
    <div className="space-y-8 text-left min-w-0">
      {/* ─── PAGE HEADER ─── */}
      <header className="border-b border-white/10 pb-6">
        <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-2.5 font-heading flex items-center gap-2">
          <Activity size={13} aria-hidden="true" /> Team Internal Operations
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">
          Command Center
        </h1>
        <p className="text-marble/75 text-sm md:text-base mt-2 font-medium max-w-2xl">
          Welcome, {firstName}. Track today&apos;s team schedule, priority
          operations, mentor approvals, and recent shop progress in one view.
        </p>
      </header>

      {/* ─── GETTING STARTED GUIDE (Novice Orientation) ─── */}
      <DashboardOnboardingGuide isUnverified={isUnverified} />

      {/* ─── ACTIVE TEAM ALERT BANNER ─── */}
      <section aria-labelledby="today-alert-heading">
        <h2 id="today-alert-heading" className="sr-only">
          Current team alert
        </h2>
        {announcementError ? (
          <SectionError message={announcementError} />
        ) : announcement === undefined ? (
          <LoadingCard label="Loading current team alert" />
        ) : announcement ? (
          <div
            className={`border p-5 ares-cut ${ANNOUNCEMENT_SEVERITY_STYLES[announcement.severity]}`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                size={22}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-widest">
                  Active team alert
                </p>
                <p className="mt-1 break-words text-base font-bold">
                  {announcement.message}
                </p>
                {announcement.link && announcement.linkLabel && (
                  <Link
                    to={announcement.link}
                    className="mt-3 inline-flex min-h-11 items-center gap-2 border border-current px-4 py-2 text-xs font-black uppercase tracking-wide focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    {announcement.linkLabel}{" "}
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 border border-ares-success/30 bg-ares-success/10 p-4 text-sm text-white ares-cut-sm">
            <CheckCircle2
              aria-hidden="true"
              className="shrink-0 text-ares-success"
              size={20}
            />
            <span>No urgent team alert is active.</span>
          </div>
        )}
      </section>

      {/* ─── UNIFIED MENTOR & COACH APPROVAL QUEUES ─── */}
      {canReviewContent && (
        <section
          aria-labelledby="mentor-approval-queues-heading"
          className="ares-surface rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <Shield
                size={18}
                aria-hidden="true"
                className="text-ares-gold shrink-0"
              />
              <h2
                id="mentor-approval-queues-heading"
                className="font-heading text-base sm:text-lg font-black uppercase tracking-tight text-white"
              >
                Mentor &amp; Coach Approval Queues
              </h2>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                anyApprovalQueueError
                  ? "border-ares-red/45 bg-ares-red/15 text-white"
                  : totalPendingApprovals > 0
                    ? "border-ares-gold/45 bg-ares-gold/15 text-ares-gold"
                    : "border-ares-success/35 bg-ares-success/10 text-ares-success"
              }`}
            >
              {anyApprovalQueueError
                ? "Check queue status"
                : totalPendingApprovals > 0
                  ? `${totalPendingApprovals} awaiting review`
                  : "All queues clear"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {approvalQueues.map((queue) => {
              const isError = queue.state === "error";
              const isPending = !isError && queue.pendingCount > 0;

              return (
                <div
                  key={queue.id}
                  role={isError ? "alert" : undefined}
                  className={`flex flex-col justify-between gap-3 rounded-xl border p-4 min-w-0 ${
                    isError
                      ? "border-ares-red/45 bg-ares-red/10"
                      : isPending
                        ? "border-ares-gold/40 bg-ares-gold/10"
                        : "border-white/10 bg-black/25"
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-marble/65 truncate">
                        {queue.label}
                      </span>
                      {isError ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-ares-red-light shrink-0">
                          <AlertCircle size={12} aria-hidden="true" />{" "}
                          Unavailable
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-ares-gold px-2 py-0.5 text-[10px] font-black text-obsidian shrink-0">
                          {queue.hasBooleanPending ? "Active" : queue.pendingCount}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ares-success shrink-0">
                          Clear
                        </span>
                      )}
                    </div>

                    {isError ? (
                      <p className="text-xs leading-relaxed text-white">
                        {queue.label} queue status is unavailable. Open directly
                        to verify.
                      </p>
                    ) : isPending ? (
                      <h3 className="font-heading text-sm font-black uppercase tracking-tight text-white">
                        {queue.activeHeading}
                      </h3>
                    ) : (
                      <p className="text-xs text-marble/60">
                        No items awaiting review.
                      </p>
                    )}
                  </div>

                  <Link
                    to={queue.to}
                    className={`inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                      isPending
                        ? "bg-ares-gold text-obsidian hover:bg-ares-bronze"
                        : "border border-white/15 text-white hover:bg-white/5"
                    }`}
                  >
                    <span className="truncate">{queue.linkLabel}</span>
                    <ArrowUpRight size={14} aria-hidden="true" className="shrink-0" />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── SECURITY NOTICE ─── */}
      {isUnverified && (
        <div className="glass-card border border-ares-danger/30 bg-ares-danger/5 p-5 sm:p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-ares-danger/10 border border-ares-danger/30 flex items-center justify-center text-ares-danger-soft shrink-0">
              <Shield size={24} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-white text-base tracking-tight uppercase font-heading">
                Pending Developer Verification
              </h2>
              <p className="text-marble/75 text-xs mt-1 max-w-xl leading-relaxed">
                Your account is currently registered as{" "}
                <strong className="text-white">Unverified Guest</strong>. To
                protect student privacy, a team coach or administrator verifies
                new accounts before enabling task creation or publishing. While
                waiting, you can customize your{" "}
                <Link
                  to="/dashboard/profile"
                  className="text-ares-gold underline hover:text-white"
                >
                  Member Profile
                </Link>{" "}
                and study in the{" "}
                <Link
                  to="/academy"
                  className="text-ares-gold underline hover:text-white"
                >
                  ARES Academy
                </Link>
                .
              </p>
            </div>
          </div>
          <span className="px-4 py-2 bg-ares-red/10 text-white border border-ares-red/30 ares-cut-sm text-[10px] uppercase font-black tracking-widest shrink-0">
            Locked: View-Only
          </span>
        </div>
      )}

      {/* ─── STATS GRID ─── */}
      <section
        aria-label="Workspace summary metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
      >
        <div className="glass-card p-5 sm:p-6 border border-white/10 flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">
              Security Clear
            </p>
            <p className="text-xl sm:text-2xl font-black text-white mt-1.5 uppercase font-heading tracking-tight truncate">
              {userRole}
            </p>
          </div>
          <div className="w-11 h-11 bg-ares-gold/15 rounded-xl flex items-center justify-center border border-ares-gold/30 shrink-0">
            <Shield size={20} className="text-ares-gold" aria-hidden="true" />
          </div>
        </div>

        <div className="glass-card p-5 sm:p-6 border border-white/10 flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">
              Active Tasks
            </p>
            <p className="text-xl sm:text-2xl font-black text-white mt-1.5 font-heading tracking-tight">
              {databaseState === "error" ? "—" : `${activeTasks} / ${taskCount}`}
            </p>
          </div>
          <div className="w-11 h-11 bg-ares-cyan/15 rounded-xl flex items-center justify-center border border-ares-cyan/30 shrink-0">
            <ClipboardList
              size={20}
              className="text-ares-cyan"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="glass-card p-5 sm:p-6 border border-white/10 flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">
              Published Blogs
            </p>
            <p className="text-xl sm:text-2xl font-black text-white mt-1.5 font-heading tracking-tight">
              {databaseState === "error" ? "—" : blogCount}
            </p>
          </div>
          <div className="w-11 h-11 bg-ares-red/15 rounded-xl flex items-center justify-center border border-ares-red/30 shrink-0">
            <PenTool size={20} className="text-ares-red" aria-hidden="true" />
          </div>
        </div>

        <div className="glass-card p-5 sm:p-6 border border-white/10 flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">
              Academy Lessons
            </p>
            <p className="text-xl sm:text-2xl font-black text-white mt-1.5 font-heading tracking-tight">
              {databaseState === "error" ? "—" : docCount}
            </p>
          </div>
          <div className="w-11 h-11 bg-ares-success/15 rounded-xl flex items-center justify-center border border-ares-success/30 shrink-0">
            <GraduationCap
              size={20}
              className="text-ares-success"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      {/* ─── NEXT EVENT & PRIORITY OPERATIONAL TASKS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Scheduled Event */}
        <section
          aria-labelledby="next-event-heading"
          className="glass-card border border-white/10 p-5 sm:p-6 flex flex-col justify-between gap-4 min-w-0 lg:col-span-1"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-3">
              <h2
                id="next-event-heading"
                className="flex items-center gap-2 font-heading text-base font-bold uppercase tracking-tight text-ares-gold"
              >
                <CalendarDays aria-hidden="true" size={16} /> Next Event
              </h2>
              <Link
                to="/calendar"
                className="text-xs font-bold text-ares-cyan underline-offset-4 hover:underline"
              >
                Full calendar
              </Link>
            </div>

            {eventError ? (
              <SectionError message={eventError} />
            ) : events === null ? (
              <LoadingCard label="Loading next event" />
            ) : nextEvent ? (
              <div className="space-y-3">
                <p className="text-lg font-black text-white break-words">
                  {nextEvent.title}
                </p>
                <p className="flex items-start gap-2 text-xs text-marble/80">
                  <Clock3
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-ares-gold"
                    size={15}
                  />
                  <span>{formatEventDate(nextEvent)}</span>
                </p>
                {nextEvent.location && (
                  <p className="flex items-start gap-2 text-xs text-marble/80">
                    <MapPin
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-ares-cyan"
                      size={15}
                    />
                    <span className="break-words">{nextEvent.location}</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-marble/70 py-4">
                No upcoming event is currently published.
              </p>
            )}
          </div>

          {nextEvent && !eventError && (
            <div className="space-y-2.5">
              {!isUnverified && (
                <NextEventPinCheckin
                  eventId={nextEvent.recurrenceOf || nextEvent.id}
                />
              )}
              <Link
                to={eventDetailHref(nextEvent)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 bg-ares-red hover:bg-ares-bronze px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white ares-cut-sm transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                View details and RSVP <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </div>
          )}
        </section>

        {/* Priority / Personalized Operational Tasks */}
        <section
          aria-labelledby="priority-tasks-heading"
          className="glass-card p-5 sm:p-6 border border-white/10 flex flex-col justify-between min-w-0 lg:col-span-2"
        >
          <div>
            <div className="border-b border-white/5 pb-3 mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2
                id="priority-tasks-heading"
                className="text-base font-bold text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight"
              >
                <ClipboardList size={16} aria-hidden="true" />{" "}
                {taskSelection.personalized
                  ? "My Priority Operational Tasks"
                  : "Priority Operational Tasks"}
              </h2>
              {(overdueTasks > 0 || dueTodayTasks > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {overdueTasks > 0 && (
                    <span className="px-2 py-0.5 rounded border border-ares-red/40 bg-ares-red/15 text-[10px] font-black uppercase tracking-wider text-ares-red-light">
                      {overdueTasks} Overdue
                    </span>
                  )}
                  {dueTodayTasks > 0 && (
                    <span className="px-2 py-0.5 rounded border border-ares-gold/40 bg-ares-gold/15 text-[10px] font-black uppercase tracking-wider text-ares-gold">
                      {dueTodayTasks} Due Today
                    </span>
                  )}
                </div>
              )}
            </div>

            {taskError ? (
              <SectionError message={taskError} />
            ) : tasks === null ? (
              <LoadingCard label="Loading tasks" />
            ) : taskSelection.tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-marble/60 text-xs border border-dashed border-white/10 rounded-xl text-center px-4">
                <span>There are no active tasks right now.</span>
                <Link
                  to="/dashboard/tasks"
                  className="text-ares-cyan hover:underline mt-1.5 font-bold"
                >
                  Go to Tasks board &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {taskSelection.tasks.map((task) => {
                  const dueLabel = describeTaskDueDate(task);
                  const dueState = getTaskDueState(task);
                  const descriptionSummary = summarizeTaskDescription(
                    task.description,
                  );
                  return (
                    <Link
                      key={task.id}
                      to={`/dashboard/tasks?task=${encodeURIComponent(task.id)}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/25 border border-white/5 hover:border-white/15 rounded-xl gap-3 transition-all cursor-pointer group min-w-0"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-1.5 h-1.5 bg-ares-red rounded-full shrink-0 mt-2"></div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-white text-xs tracking-tight group-hover:text-ares-gold transition-colors truncate">
                            {task.title}
                          </p>
                          <p className="text-[10px] text-marble/55 mt-0.5 truncate leading-relaxed">
                            {descriptionSummary || "No description provided."}
                          </p>
                          {dueLabel && (
                            <p
                              className={`mt-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${
                                dueState === "overdue"
                                  ? "text-ares-red-light"
                                  : dueState === "today"
                                    ? "text-ares-gold"
                                    : "text-marble/60"
                              }`}
                            >
                              <CalendarClock aria-hidden="true" size={10} />{" "}
                              {dueLabel}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[8px] font-black uppercase px-2 py-0.5 border rounded-md tracking-wider ${getSubteamStyle(task.subteam)}`}
                        >
                          {task.subteam}
                        </span>
                        <span
                          className={`text-[8px] font-black uppercase px-2 py-0.5 border rounded-md tracking-wider ${getPriorityStyle(task.priority)}`}
                        >
                          {task.priority}
                        </span>
                        <span className="text-[9px] font-bold text-marble/70 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                          {getStatusLabel(task.status)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-white/5 pt-4 mt-4 flex flex-wrap justify-between items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-marble/50">
            <span>Real-Time Firestore Sync</span>
            <Link
              to="/dashboard/tasks"
              className="text-ares-cyan hover:text-white transition-all inline-flex items-center gap-1"
            >
              View Kanban Board <ArrowUpRight size={12} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      {/* ─── RECENT PROGRESS PHOTOS ─── */}
      <section
        aria-labelledby="progress-photos-heading"
        className="glass-card border border-white/10 p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/5 pb-3">
          <h2
            id="progress-photos-heading"
            className="flex items-center gap-2 font-heading text-base font-bold uppercase tracking-tight text-ares-gold"
          >
            <ImageIcon
              aria-hidden="true"
              className="text-ares-cyan"
              size={16}
            />{" "}
            Recent Progress
          </h2>
          <Link
            to="/dashboard/photos"
            className="text-xs font-bold text-ares-cyan underline-offset-4 hover:underline"
          >
            Photo library
          </Link>
        </div>
        {photoError ? (
          <SectionError message={photoError} />
        ) : photos === null ? (
          <LoadingCard label="Loading recent progress photos" />
        ) : photos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((photo) => (
              <li
                key={photo.id}
                className="min-w-0 overflow-hidden border border-white/10 bg-black/30 ares-cut-sm"
              >
                <AuthenticatedImage
                  src={photo.thumbnailUrl || photo.publicUrl}
                  alt={
                    photo.altText || photo.caption || "Team progress photo"
                  }
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-cover"
                />
                {(photo.caption || photo.altText) && (
                  <p className="line-clamp-2 p-2 text-xs text-marble/75">
                    {photo.caption || photo.altText}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-marble/70">
            No recent progress photos are available.
          </p>
        )}
      </section>

      {/* ─── WORKSPACE PROFILE, QUICK OPERATIONS & SERVICE HEALTH ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card & Clearances */}
        <div className="glass-card p-6 border border-white/10 flex flex-col gap-5 lg:col-span-1 min-w-0">
          <h2 className="text-base font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
            <User size={16} aria-hidden="true" /> User Terminal Session
          </h2>

          <div className="flex flex-col items-center text-center py-2 gap-3">
            <div className="w-20 h-20 rounded-full border-2 border-ares-bronze overflow-hidden shrink-0 shadow-lg relative">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profile Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  className="w-full h-full flex items-center justify-center bg-white/5"
                  aria-hidden="true"
                >
                  <User size={32} className="text-ares-gold/80" />
                </span>
              )}
            </div>
            <div className="min-w-0 max-w-full">
              <p className="font-extrabold text-white text-base tracking-tight leading-tight truncate">
                {user?.displayName || "ARES Member"}
              </p>
              <p className="text-marble/60 text-xs mt-1 truncate">
                {maskEmail(user?.email)}
              </p>
            </div>
          </div>

          <div className="bg-black/45 border border-white/5 p-4 rounded-xl space-y-2.5">
            <h3 className="text-[10px] uppercase font-bold text-ares-gold tracking-widest">
              Active Clearances
            </h3>
            <ul className="text-xs text-marble/85 space-y-2 font-medium">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-ares-red rounded-full shrink-0"></span>
                <span>
                  Access internal workspace:{" "}
                  <strong className="text-white">Granted</strong>
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-ares-red rounded-full shrink-0"></span>
                <span>
                  Read tasks &amp; documents:{" "}
                  <strong className="text-white">Granted</strong>
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-ares-red rounded-full shrink-0"></span>
                <span>
                  Write task changes:{" "}
                  <strong className="text-white">
                    {isUnverified ? "Restricted" : "Granted"}
                  </strong>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Operational Quick Actions & Service Status */}
        <div className="lg:col-span-2 space-y-6 flex flex-col min-w-0">
          <div className="glass-card p-5 sm:p-6 border border-white/10">
            <h2 className="text-base font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight mb-4">
              <Zap size={16} aria-hidden="true" /> Quick Operations &amp;
              Resources
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                {
                  to: "/dashboard/blog",
                  label: "New Blog",
                  icon: PenTool,
                  color: "text-ares-red",
                },
                {
                  to: "/dashboard/events",
                  label: "Add Event",
                  icon: Calendar,
                  color: "text-ares-gold",
                },
                {
                  to: "/dashboard/academy",
                  label: "Academy Lesson",
                  icon: GraduationCap,
                  color: "text-ares-success",
                },
                {
                  to: "/dashboard/simulations",
                  label: "Sim IDE",
                  icon: TerminalSquare,
                  color: "text-ares-cyan",
                },
                {
                  to: "/dashboard/documents",
                  label: "Cloud Resources",
                  icon: FileText,
                  color: "text-ares-gold",
                },
                {
                  to: "/dashboard/zulip",
                  label: "Zulip Chat Hub",
                  icon: MessageSquare,
                  color: "text-ares-cyan",
                },
                {
                  to: "/academy",
                  label: "ARES Academy",
                  icon: BookOpen,
                  color: "text-ares-gold",
                },
                {
                  to: "/dashboard/tasks",
                  label: "All Team Tasks",
                  icon: ClipboardList,
                  color: "text-ares-red",
                },
              ].map(({ to, label, icon: Icon, color }) => (
                <Link
                  key={to}
                  to={to}
                  className="min-h-12 p-3 bg-white/3 border border-white/5 hover:border-white/20 hover:bg-white/5 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
                >
                  <Icon
                    size={16}
                    aria-hidden="true"
                    className={`${color} group-hover:scale-110 transition-transform`}
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider text-marble/90 group-hover:text-white">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <DashboardServiceStatusCard
            databaseState={databaseState}
            canUseAi={canUseAi}
            appCheckActive={appCheckActive}
            isSignedIn={!!user}
          />
        </div>
      </div>
    </div>
  );
}

function NextEventPinCheckin({ eventId }: { eventId: string }) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleaned = code.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length !== 4) {
      setFeedback({ tone: "err", text: "Enter the 4-digit Lab PIN." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await authenticatedFetch(
        `/api/calendar/manage/${encodeURIComponent(eventId)}/self-checkin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: cleaned }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setCode("");
      setFeedback({ tone: "ok", text: "Checked in present!" });
    } catch (error) {
      setFeedback({
        tone: "err",
        text: error instanceof Error ? error.message : "Check-in failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="rounded-lg border border-white/10 bg-black/30 p-2.5 space-y-2"
    >
      <div className="flex items-center gap-2">
        <label htmlFor={`next-event-pin-${eventId}`} className="sr-only">
          4-Digit Lab Check-In PIN
        </label>
        <input
          id={`next-event-pin-${eventId}`}
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="4-digit Lab PIN"
          className="min-h-9 w-full flex-1 rounded border border-white/15 bg-obsidian px-2.5 py-1.5 font-mono text-xs tracking-widest text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-marble/50 focus:border-ares-cyan focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="min-h-9 shrink-0 rounded border border-ares-gold/40 bg-ares-gold/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-ares-gold hover:bg-ares-gold/25 focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
        >
          {submitting ? "Checking…" : "Lab Check-In"}
        </button>
      </div>
      {feedback && (
        <p
          role="status"
          className={`text-[11px] font-bold ${
            feedback.tone === "ok" ? "text-ares-success" : "text-ares-red-light"
          }`}
        >
          {feedback.text}
        </p>
      )}
    </form>
  );
}
