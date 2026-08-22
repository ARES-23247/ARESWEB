"use client";

import { logger } from "@/utils/logger";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { and, collection, onSnapshot, getCountFromServer, or, query, where, limit, } from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import { maskEmail } from "@/lib/utils";
import { canUseMemberAi } from "@/lib/authorization";
import { Link } from "react-router-dom";
import {
  User,
  Shield,
  ClipboardList,
  Terminal,
  Activity,
  Zap,
  PenTool,
  Calendar,
  CalendarClock,
  GraduationCap,
  TerminalSquare,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Database,
  UploadCloud,
} from "lucide-react";

import { TaskItem } from "@/types/task";
import {
  describeTaskDueDate,
  getTaskDueState,
  normalizeTaskRecord,
  selectPriorityTasks,
  summarizeTaskDescription,
} from "./tasks/taskRecord";

export default function DashboardHome() {
  const { user, authorizedUser } = useAuth();
  
  // Real-time Database Counts
  const [taskCount, setTaskCount] = useState(0);
  const [activeTasks, setActiveTasks] = useState(0);
  const [blogCount, setBlogCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [recentTasks, setRecentTasks] = useState<TaskItem[]>([]);
  const [databaseState, setDatabaseState] = useState<"connecting" | "connected" | "error">("connecting");

  const userRole = authorizedUser?.role || "Pending Verification";
  const isUnverified = userRole === "unverified" || userRole === "Pending Verification";
  const canUseAi = canUseMemberAi( userRole);

  // Fetch content counts once and keep the bounded task summary synchronized.
  useEffect(() => {
    if (import.meta.env.MODE === "e2e") return;

    const fetchCounts = async () => {
      try {
        const [blogsSnap, docsSnap] = await Promise.all([
          getCountFromServer(query(
            collection(db, "posts"),
            where("status", "==", "published"),
            where("isDeleted", "==", 0)
          )),
          getCountFromServer(query(
            collection(db, "docs"),
            and(
              where("status", "==", "published"),
              where("isDeleted", "==", 0),
              or(where("displayInMathCorner", "==", 1), where("displayInScienceCorner", "==", 1))
            )
          )),
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
      const unsubTasks = onSnapshot(qTasks, (snapshot) => {
        setDatabaseState("connected");
        const visibleTasks = snapshot.docs
          .map((d) => normalizeTaskRecord(d.id, d.data()))
          .filter((task) => task.isDeleted !== 1);
        setTaskCount(visibleTasks.length);
        setActiveTasks(visibleTasks.filter(
              (task) => !task.archived && task.status !== "completed").length);
        setRecentTasks(selectPriorityTasks(visibleTasks));
      }, (err) => {
        logger.error("Tasks listener error:", err);
        setDatabaseState("error");
      });

      return () => {
        unsubTasks();
      };
    } catch (e) {
      logger.error("Error setting up tasks list listener:", e);
    }
  }, []);

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-ares-red/15 text-ares-red border-ares-red/30";
      case "medium":
        return "bg-ares-gold/10 text-ares-gold border-ares-gold/20";
      default:
        return "bg-white/5 text-marble/60 border-white/5";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "todo":
        return "To Do";
      case "in_progress":
        return "In Progress";
      case "review":
        return "In Review";
      default:
        return status;
    }
  };

  const getSubteamStyle = (subteam: string) => {
    switch (subteam) {
      case "software":
        return "text-ares-cyan border-ares-cyan/20 bg-ares-cyan/5";
      case "hardware":
        return "text-ares-red border-ares-red/20 bg-ares-red/5";
      case "business":
        return "text-ares-gold border-ares-gold/20 bg-ares-gold/5";
      default:
        return "text-ares-bronze border-ares-bronze/20 bg-ares-bronze/5";
    }
  };

  const appCheckActive = !!import.meta.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;

  return (
    <div className="space-y-10 text-left">
      
      {/* ─── PAGE HEADER ─── */}
      <header className="border-b border-white/5 pb-8">
        <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
          <Activity size={12} className="animate-pulse" /> Team Internal Operations
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">
          Command Center
        </h1>
        <p className="text-marble/70 text-sm md:text-base mt-2 font-medium">
          Manage system states, track active operations, publish content, and monitor portal infrastructure.
        </p>
      </header>

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
                Your account is currently registered as{" "} <strong className="text-white">Unverified Guest</strong>. You have read-only permissions across task managers and system controls. Please contact a team administrator to request access.
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
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">Security Clear</p>
            <p className="text-2xl font-black text-white mt-1.5 uppercase font-heading tracking-tight">{userRole}</p>
          </div>
          <div className="w-12 h-12 bg-ares-gold/15 rounded-xl flex items-center justify-center border border-ares-gold/30">
            <Shield size={20} className="text-ares-gold" />
          </div>
        </div>

        {/* Card 2: Active Tasks */}
        <div className="glass-card p-6 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">Active Tasks</p>
            <p className="text-2xl font-black text-white mt-1.5 font-heading tracking-tight">{databaseState === "error" ? "—" : `${activeTasks} / ${taskCount}`}
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
              <p className="text-marble/60 text-xs mt-1 select-all">{maskEmail(user?.email)}</p>
            </div>
          </div>

          <div className="bg-black/45 border border-white/5 p-4.5 rounded-xl space-y-3">
            <h5 className="text-[10px] uppercase font-bold text-ares-gold tracking-widest">Active Clearances</h5>
            <ul className="text-xs text-marble/85 space-y-2 font-medium">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-ares-red rounded-full shrink-0"></span>
                <span>Access internal workspace:{" "} <strong className="text-white">Granted</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-ares-red rounded-full shrink-0"></span>
                <span>Read tasks & documents:{" "} <strong className="text-white">Granted</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-ares-red rounded-full shrink-0"></span>
                <span>Write task changes:{" "} <strong className="text-white">{isUnverified ? "Restricted" : "Granted"}</strong></span>
              </li>
            </ul>
          </div>
        </div>

        {/* Live System Diagnostics & Shortcuts */}
        <div className="lg:col-span-2 space-y-6 flex flex-col h-full">
          
          {/* Active Tasks Feed */}
          <div className="glass-card p-6 border border-white/10 flex-grow flex flex-col">
            <h3 className="text-base font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight mb-4">
              <ClipboardList size={16} /> Priority Operational Tasks
            </h3>
            
            <div className="space-y-3.5 flex-1">
              {recentTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-marble/40 font-mono text-xs border border-dashed border-white/10 rounded-xl">
                  <span>No active tasks in progress.</span>
                  <Link to="/dashboard/tasks" className="text-ares-cyan hover:underline mt-1 font-bold">Go to Tasks board &rarr;</Link>
                </div>
              ) : (
                recentTasks.map((task) => {
                  const dueLabel = describeTaskDueDate(task);
                  const dueState = getTaskDueState(task);
                  const descriptionSummary = summarizeTaskDescription(task.description);
                  return ( <Link
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
                          <p className={`mt-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${
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
          <div className="glass-card p-6 border border-white/10">
            <h3 className="text-base font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight mb-4">
              <Terminal size={16} /> Portal Service Configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-black/25 border border-white/5 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Database size={14} className="text-ares-cyan" />
                  <span className="font-semibold text-marble">
                    Firestore Synchronization
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-bold uppercase text-[10px]">
                  {databaseState === "connected" ? (
                    <>
                      <CheckCircle2 size={12} className="text-ares-success" />
                      <span className="text-ares-success">Connected</span>
                    </>
                  ) : databaseState === "error" ? (
                    <>
                      <XCircle size={12} className="text-ares-danger" />
                      <span className="text-ares-danger">Unavailable</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle
                        size={12}
                        className="text-ares-gold animate-pulse"
                      />
                      <span className="text-ares-gold">Syncing...</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-black/25 border border-white/5 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Zap size={14} className="text-ares-gold" />
                  <span className="font-semibold text-marble">
                    Gemini AI Copilot
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-bold uppercase text-[10px]">
                  {canUseAi ? (
                    <>
                      <CheckCircle2 size={12} className="text-ares-success" />
                      <span className="text-ares-success">Role eligible</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={12} className="text-marble/40" />
                      <span className="text-marble/40">Role restricted</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-black/25 border border-white/5 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Shield size={14} className="text-ares-red" />
                  <span className="font-semibold text-marble">
                    App Check Protection
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-bold uppercase text-[10px]">
                  {appCheckActive ? (
                    <>
                      <CheckCircle2 size={12} className="text-ares-success" />
                      <span className="text-ares-success">Configured</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle
                        size={12}
                        className="text-ares-gold animate-pulse"
                      />
                      <span className="text-ares-gold">Not configured</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-black/25 border border-white/5 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <UploadCloud size={14} className="text-ares-success" />
                  <span className="font-semibold text-marble">
                    Authenticated Session
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-bold uppercase text-[10px]">
                  {user ? (
                    <>
                      <CheckCircle2 size={12} className="text-ares-success" />
                      <span className="text-ares-success">Signed in</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={12} className="text-ares-danger" />
                      <span className="text-ares-danger">Signed out</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
