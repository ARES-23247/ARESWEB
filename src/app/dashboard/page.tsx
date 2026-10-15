"use client";

import { logger } from "@/utils/logger";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  and,
  collection,
  onSnapshot,
  getCountFromServer,
  or,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import { maskEmail } from "@/lib/utils";
import { canUseMemberAi } from "@/lib/authorization";
import {
  canReviewDashboardContent,
  useDashboardNotifications,
} from "@/context/DashboardNotificationsContext";
import { Link } from "react-router-dom";
import {
  User,
  Shield,
  ClipboardList,
  Activity,
  Zap,
  PenTool,
  Calendar,
  CalendarClock,
  GraduationCap,
  TerminalSquare,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";

import { TaskItem } from "@/types/task";
import {
  describeTaskDueDate,
  getTaskDueState,
  normalizeTaskRecord,
  selectPriorityTasks,
  summarizeTaskDescription,
} from "./tasks/taskRecord";
import {
  getPriorityStyle,
  getStatusLabel,
  getSubteamStyle,
} from "./tasks/utils/taskStyles";
import DashboardOnboardingGuide from "./components/DashboardOnboardingGuide";
import DashboardServiceStatusCard from "./components/DashboardServiceStatusCard";

export default function DashboardHome() {
  const { user, authorizedUser } = useAuth();

  // Real-time Database Counts
  const [taskCount, setTaskCount] = useState(0);
  const [activeTasks, setActiveTasks] = useState(0);
  const [blogCount, setBlogCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [recentTasks, setRecentTasks] = useState<TaskItem[]>([]);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [dueTodayTasks, setDueTodayTasks] = useState(0);
  const [databaseState, setDatabaseState] = useState<
    "connecting" | "connected" | "error"
  >("connecting");

  const userRole = authorizedUser?.role || "Pending Verification";
  const isUnverified =
    userRole === "unverified" || userRole === "Pending Verification";
  const canUseAi = canUseMemberAi(userRole);
  const canReviewContent = canReviewDashboardContent(userRole);
  const canReviewInquiries = userRole === "admin" || userRole === "coach";
  const {
    pendingBlogApprovals,
    blogApprovalsState,
    hasPendingInquiries,
    inquiriesState,
  } = useDashboardNotifications();

  // Fetch content counts once and keep the bounded task summary synchronized.
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
        setDatabaseState("connected");
      } catch (err) {
        logger.error("Error fetching dashboard counts:", err);
        setDatabaseState("error");
      }
    };

    fetchCounts();

    try {
      const qTasks = query(collection(db, "tasks"), limit(500));
      const unsubTasks = onSnapshot(
        qTasks,
        (snapshot) => {
          setDatabaseState("connected");
          const visibleTasks = snapshot.docs
            .map((d) => normalizeTaskRecord(d.id, d.data()))
            .filter((task) => task.isDeleted !== 1);
          const openTasks = visibleTasks.filter(
            (task) => !task.archived && task.status !== "completed",
          );
          setTaskCount(visibleTasks.length);
          setActiveTasks(openTasks.length);
          setOverdueTasks(
            openTasks.filter((task) => getTaskDueState(task) === "overdue")
              .length,
          );
          setDueTodayTasks(
            openTasks.filter((task) => getTaskDueState(task) === "today")
              .length,
          );
          setRecentTasks(selectPriorityTasks(visibleTasks));
        },
        (err) => {
          logger.error("Tasks listener error:", err);
          setDatabaseState("error");
        },
      );

      return () => {
        unsubTasks();
      };
    } catch (e) {
      logger.error("Error setting up tasks list listener:", e);
    }
  }, []);

  const appCheckActive =
    !!import.meta.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;

  return (
    <div className="space-y-10 text-left">
      {/* ─── PAGE HEADER ─── */}
      <header className="border-b border-white/5 pb-8">
        <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
          <Activity size={12} className="animate-pulse" /> Team Internal
          Operations
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">
          Command Center
        </h1>
        <p className="text-marble/70 text-sm md:text-base mt-2 font-medium">
          Manage system states, track active operations, publish content, and
          monitor portal infrastructure.
        </p>
      </header>

      {/* ─── GETTING STARTED GUIDE (Novice Orientation) ─── */}
      <DashboardOnboardingGuide isUnverified={isUnverified} />

      {canReviewContent &&
        pendingBlogApprovals > 0 &&
        blogApprovalsState !== "error" && (
          <section
            aria-labelledby="pending-blog-approval-heading"
            className="glass-card flex flex-col gap-5 border border-ares-gold/40 bg-ares-gold/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ares-gold/40 bg-ares-gold/15 text-ares-gold">
                <AlertCircle aria-hidden="true" size={22} />
              </div>
              <div>
                <h2
                  id="pending-blog-approval-heading"
                  className="font-heading text-base font-black uppercase tracking-tight text-white sm:text-lg"
                >
                  {pendingBlogApprovals} blog{" "}
                  {pendingBlogApprovals === 1 ? "post needs" : "posts need"}{" "}
                  mentor approval
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-marble/75">
                  Student-authored content is waiting for review before it can
                  be published.
                </p>
              </div>
            </div>
            <Link
              to="/dashboard/blog?tab=pending"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-ares-gold px-5 py-3 text-xs font-black uppercase tracking-wider text-black transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Review approval queue <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          </section>
        )}

      {canReviewContent && blogApprovalsState === "error" && (
        <div
          role="alert"
          className="flex flex-col gap-3 border border-ares-red/40 bg-ares-red/10 p-5 text-sm text-white sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            Blog approval queue status is unavailable. Open Blog Management to
            check it directly.
          </span>
          <Link
            to="/dashboard/blog?tab=pending"
            className="inline-flex min-h-11 shrink-0 items-center justify-center border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            Open Blog Management
          </Link>
        </div>
      )}

      {canReviewInquiries &&
        hasPendingInquiries &&
        inquiriesState !== "error" && (
          <section
            aria-labelledby="pending-inquiries-heading"
            className="glass-card flex flex-col gap-5 border border-ares-cyan/40 bg-ares-cyan/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ares-cyan/40 bg-ares-cyan/15 text-ares-cyan">
                <AlertCircle aria-hidden="true" size={22} />
              </div>
              <div>
                <h2
                  id="pending-inquiries-heading"
                  className="font-heading text-base font-black uppercase tracking-tight text-white sm:text-lg"
                >
                  Pending recruitment or sponsor inquiries require review
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-marble/75">
                  Unread community, sponsor, or prospective student messages are
                  waiting in the encrypted inquiry queue.
                </p>
              </div>
            </div>
            <Link
              to="/dashboard/inquiries"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-ares-cyan px-5 py-3 text-xs font-black uppercase tracking-wider text-black transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-ares-gold"
            >
              Review inquiries <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          </section>
        )}

      {canReviewInquiries && inquiriesState === "error" && (
        <div
          role="alert"
          className="flex flex-col gap-3 border border-ares-red/40 bg-ares-red/10 p-5 text-sm text-white sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            Inquiry queue status is unavailable. Open Inquiries to check
            directly.
          </span>
          <Link
            to="/dashboard/inquiries"
            className="inline-flex min-h-11 shrink-0 items-center justify-center border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            Open Inquiries
          </Link>
        </div>
      )}

      {/* ─── SECURITY NOTICE ─── */}
      {isUnverified && (
        <div className="glass-card border border-ares-danger/30 bg-ares-danger/5 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-ares-danger/10 border border-ares-danger/30 flex items-center justify-center text-ares-danger-soft shrink-0">
              <Shield size={24} className="animate-bounce" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base tracking-tight uppercase font-heading">
                Pending Developer Verification
              </h3>
              <p className="text-marble/75 text-xs mt-1 max-w-xl">
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
          <span className="px-4 py-2 bg-ares-red/10 text-white border border-ares-red/30 ares-cut-sm text-[10px] uppercase font-black tracking-widest shrink-0 animate-pulse">
            Locked: View-Only
          </span>
        </div>
      )}

      {/* ─── STATS GRID ─── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Role Clear */}
        <div className="glass-card p-6 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">
              Security Clear
            </p>
            <p className="text-2xl font-black text-white mt-1.5 uppercase font-heading tracking-tight">
              {userRole}
            </p>
          </div>
          <div className="w-12 h-12 bg-ares-gold/15 rounded-xl flex items-center justify-center border border-ares-gold/30">
            <Shield size={20} className="text-ares-gold" />
          </div>
        </div>

        {/* Card 2: Active Tasks */}
        <div className="glass-card p-6 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">
              Active Tasks
            </p>
            <p className="text-2xl font-black text-white mt-1.5 font-heading tracking-tight">
              {databaseState === "error" ? "—" : `${activeTasks} / ${taskCount}`}
            </p>
          </div>
          <div className="w-12 h-12 bg-ares-cyan/15 rounded-xl flex items-center justify-center border border-ares-cyan/30">
            <ClipboardList size={20} className="text-ares-cyan" />
          </div>
        </div>

        {/* Card 3: Published Blogs */}
        <div className="glass-card p-6 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">
              Published Blogs
            </p>
            <p className="text-2xl font-black text-white mt-1.5 font-heading tracking-tight">
              {databaseState === "error" ? "—" : blogCount}
            </p>
          </div>
          <div className="w-12 h-12 bg-ares-red/15 rounded-xl flex items-center justify-center border border-ares-red/30">
            <PenTool size={20} className="text-ares-red" />
          </div>
        </div>

        {/* Card 4: Academy Articles */}
        <div className="glass-card p-6 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">
              Academy Lessons
            </p>
            <p className="text-2xl font-black text-white mt-1.5 font-heading tracking-tight">
              {databaseState === "error" ? "—" : docCount}
            </p>
          </div>
          <div className="w-12 h-12 bg-ares-success/15 rounded-xl flex items-center justify-center border border-ares-success/30">
            <GraduationCap size={20} className="text-ares-success" />
          </div>
        </div>
      </section>

      {/* ─── MAIN WORKSPACE GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card & Info */}
        <div className="glass-card p-8 border border-white/10 flex flex-col gap-6 lg:col-span-1">
          <h3 className="text-base font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
            <User size={16} /> User Terminal Session
          </h3>

          <div className="flex flex-col items-center text-center py-4 gap-4">
            <div className="w-24 h-24 rounded-full border-2 border-ares-bronze overflow-hidden shrink-0 shadow-lg relative">
              <img
                src={
                  user?.photoURL ||
                  `https://api.dicebear.com/9.x/bottts/svg?seed=${user?.uid}`
                }
                alt="Profile Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-lg tracking-tight leading-tight">
                {user?.displayName || "ARES Member"}
              </h4>
              <p className="text-marble/60 text-xs mt-1 select-all">
                {maskEmail(user?.email)}
              </p>
            </div>
          </div>

          <div className="bg-black/45 border border-white/5 p-4.5 rounded-xl space-y-3">
            <h5 className="text-[10px] uppercase font-bold text-ares-gold tracking-widest">
              Active Clearances
            </h5>
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
                  Read tasks & documents:{" "}
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

        {/* Live System Diagnostics & Shortcuts */}
        <div className="lg:col-span-2 space-y-6 flex flex-col h-full">
          {/* Active Tasks Feed */}
          <div className="glass-card p-6 border border-white/10 flex-grow flex flex-col">
            <div className="border-b border-white/5 pb-3 mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
                <ClipboardList size={16} /> Priority Operational Tasks
              </h3>
              {(overdueTasks > 0 || dueTodayTasks > 0) && (
                <div className="flex items-center gap-2">
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

            <div className="space-y-3.5 flex-1">
              {recentTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-marble/40 font-mono text-xs border border-dashed border-white/10 rounded-xl">
                  <span>No active tasks in progress.</span>
                  <Link
                    to="/dashboard/tasks"
                    className="text-ares-cyan hover:underline mt-1 font-bold"
                  >
                    Go to Tasks board &rarr;
                  </Link>
                </div>
              ) : (
                recentTasks.map((task) => {
                  const dueLabel = describeTaskDueDate(task);
                  const dueState = getTaskDueState(task);
                  const descriptionSummary = summarizeTaskDescription(
                    task.description,
                  );
                  return (
                    <Link
                      key={task.id}
                      to="/dashboard/tasks"
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/25 border border-white/5 hover:border-white/15 rounded-xl gap-3 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start gap-3 truncate">
                        <div className="w-1.5 h-1.5 bg-ares-red rounded-full shrink-0 mt-2"></div>
                        <div className="truncate">
                          <p className="font-extrabold text-white text-xs tracking-tight group-hover:text-ares-gold transition-colors truncate">
                            {task.title}
                          </p>
                          <p className="text-[10px] text-marble/50 mt-0.5 truncate leading-relaxed">
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

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
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
                })
              )}
            </div>

            <div className="border-t border-white/5 pt-4 mt-4 flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-marble/50">
              <span>Real-Time Firestore Sync</span>
              <Link
                to="/dashboard/tasks"
                className="text-ares-cyan hover:text-white transition-all inline-flex items-center gap-1"
              >
                View Kanban Board <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>

          {/* Operational Quick Actions */}
          <div className="glass-card p-6 border border-white/10">
            <h3 className="text-base font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight mb-4">
              <Zap size={16} /> Quick Operations
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link
                to="/dashboard/blog"
                className="p-3 bg-white/3 border border-white/5 hover:border-ares-red/30 hover:bg-white/5 rounded-xl text-center flex flex-col items-center gap-1.5 transition-all cursor-pointer group"
              >
                <PenTool
                  size={16}
                  className="text-ares-red group-hover:scale-110 transition-transform"
                />
                <span className="text-[9px] font-black uppercase tracking-wider text-marble/90 group-hover:text-white">
                  New Blog
                </span>
              </Link>

              <Link
                to="/dashboard/events"
                className="p-3 bg-white/3 border border-white/5 hover:border-ares-gold/30 hover:bg-white/5 rounded-xl text-center flex flex-col items-center gap-1.5 transition-all cursor-pointer group"
              >
                <Calendar
                  size={16}
                  className="text-ares-gold group-hover:scale-110 transition-transform"
                />
                <span className="text-[9px] font-black uppercase tracking-wider text-marble/90 group-hover:text-white">
                  Add Event
                </span>
              </Link>

              <Link
                to="/dashboard/academy"
                className="p-3 bg-white/3 border border-white/5 hover:border-ares-success/30 hover:bg-white/5 rounded-xl text-center flex flex-col items-center gap-1.5 transition-all cursor-pointer group"
              >
                <GraduationCap
                  size={16}
                  className="text-ares-success group-hover:scale-110 transition-transform"
                />
                <span className="text-[9px] font-black uppercase tracking-wider text-marble/90 group-hover:text-white">
                  Academy Lesson
                </span>
              </Link>

              <Link
                to="/dashboard/simulations"
                className="p-3 bg-white/3 border border-white/5 hover:border-ares-cyan/30 hover:bg-white/5 rounded-xl text-center flex flex-col items-center gap-1.5 transition-all cursor-pointer group"
              >
                <TerminalSquare
                  size={16}
                  className="text-ares-cyan group-hover:scale-110 transition-transform"
                />
                <span className="text-[9px] font-black uppercase tracking-wider text-marble/90 group-hover:text-white">
                  Sim IDE
                </span>
              </Link>
            </div>
          </div>

          {/* Connected Services Status */}
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
