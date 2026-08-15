"use client";

import { logger } from "@/utils/logger";
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  User,
  Globe,
  ClipboardList,
  LogOut,
  ShieldAlert,
  Cpu,
  Sparkles,
  BookOpen,
  PenTool,
  Calendar,
  Video,
  MessageSquare,
  Image as ImageIcon,
  Heart,
  GraduationCap,
  FileText,
  TerminalSquare,
  Trophy,
  Megaphone,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebaseFirestore";
import { onSnapshot, collection, query, where } from "firebase/firestore";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

interface NavButtonProps {
  tab: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    "aria-hidden"?: React.AriaAttributes["aria-hidden"];
  }>;
  label: string;
  currentPath: string;
  hasAlert?: boolean;
  onNavigate?: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({
  tab,
  icon: Icon,
  label,
  currentPath,
  hasAlert,
  onNavigate,
}) => {
  const targetPath = tab === "" ? "/dashboard" : `/dashboard/${tab}`;
  const isActive = currentPath === targetPath;

  return (
    <Link
      to={targetPath}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={`relative flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider transition-all ares-cut-sm border ${
        isActive
          ? "bg-ares-red/15 text-white border-ares-red/45 shadow-[0_0_15px_rgba(192,0,0,0.1)]"
          : "text-marble hover:bg-white/5 hover:text-white border-transparent"
      }`}
    >
      <div className="flex items-center gap-3 truncate">
        <Icon
          aria-hidden="true"
          size={16}
          className={isActive ? "text-white animate-pulse" : "text-marble/55"}
        />
        <span className="truncate">{label}</span>
      </div>
      {hasAlert && (
        <>
          <span
            aria-hidden="true"
            className="flex h-2.5 w-2.5 shrink-0 relative mr-1"
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ares-red opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ares-red"></span>
          </span>
          <span className="sr-only">Pending inquiries</span>
        </>
      )}
    </Link>
  );
};

export default function DashboardSidebar({
  onCloseMobile,
}: {
  onCloseMobile?: () => void;
}) {
  const { pathname } = useLocation();
  const { user, authorizedUser, logout } = useAuth();
  const [hasPendingInquiries, setHasPendingInquiries] =
    useState<boolean>(false);

  const userRole = authorizedUser?.role || "Pending Verification";
  const profileQuery = useCurrentProfile(
    user?.uid,
    import.meta.env.MODE !== "e2e",
  );
  const profileAvatar = profileQuery.data?.profile.avatar || "";
  const profileNickname = profileQuery.data?.profile.nickname || "";
  const profileError =
    profileQuery.error instanceof Error
      ? profileQuery.error.message
      : profileQuery.error
        ? "Profile request failed"
        : "";

  useEffect(() => {
    if (import.meta.env.MODE === "e2e") return;
    if (
      !user?.uid ||
      (userRole !== "admin" && userRole !== "coach" && userRole !== "mentor")
    ) {
      setHasPendingInquiries(false);
      return;
    }

    const q = query(
      collection(db, "inquiries"),
      where("status", "==", "pending"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setHasPendingInquiries(!snapshot.empty);
      },
      (error) => {
        logger.error(
          "Error subscribing to pending inquiries in sidebar:",
          error,
        );
      },
    );

    return () => unsubscribe();
  }, [user?.uid, userRole]);

  const userImage = profileAvatar || user?.photoURL;
  const displayName = profileNickname || user?.displayName || "ARES Member";
  const isUnverified =
    userRole === "unverified" || userRole === "Pending Verification";

  return (
    <aside className="flex h-full w-72 max-w-full shrink-0 flex-col justify-between border-r border-white/5 bg-black/40 shadow-2xl">
      {/* Profile Header */}
      <div className="p-6 border-b border-white/5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 ares-cut overflow-hidden border border-white/10 shadow-lg shrink-0">
            {userImage ? (
              <img
                src={userImage}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span
                className="w-full h-full flex items-center justify-center bg-white/5"
                aria-hidden="true"
              >
                <User size={22} className="text-marble/60" />
              </span>
            )}
            {hasPendingInquiries && (
              <span className="absolute top-0 right-0 flex h-2.5 w-2.5 z-10">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ares-red opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ares-red"></span>
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-white text-sm font-bold truncate tracking-tight">
              {displayName}
            </span>
            {profileError && (
              <span
                role="status"
                className="text-[9px] font-mono text-white bg-ares-red px-1.5 py-0.5 rounded"
                title={profileError}
              >
                Profile unavailable
              </span>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-ares-gold text-[10px] font-black uppercase tracking-widest truncate">
                Role: {userRole}
              </span>
              {isUnverified && (
                <span className="w-fit px-1.5 py-0.5 bg-ares-red text-white text-[8px] font-black rounded uppercase tracking-wider animate-pulse flex items-center gap-1">
                  <ShieldAlert size={8} /> Locked: View Only
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation list */}
      <div className="flex-grow py-6 space-y-8 px-3 overflow-y-auto scrollbar-thin">
        {/* Internal Workspace */}
        <div>
          <h4 className="text-[10px] uppercase font-black tracking-widest text-ares-gold mb-2.5 px-4 font-heading">
            Internal Workspace
          </h4>
          <div className="space-y-1">
            <NavButton
              tab=""
              icon={LayoutDashboard}
              label="Command Center"
              currentPath={pathname}
              onNavigate={onCloseMobile}
            />
            <NavButton
              tab="profile"
              icon={User}
              label="My Profile"
              currentPath={pathname}
              onNavigate={onCloseMobile}
            />
            <NavButton
              tab="zulip"
              icon={MessageSquare}
              label="Zulip Chat Hub"
              currentPath={pathname}
              onNavigate={onCloseMobile}
            />
            <NavButton
              tab="tasks"
              icon={ClipboardList}
              label="Kanban Tasks"
              currentPath={pathname}
              onNavigate={onCloseMobile}
            />
          </div>
        </div>

        {/* Media Management */}
        <div>
          <h4 className="text-[10px] uppercase font-black tracking-widest text-ares-gold mb-2.5 px-4 font-heading">
            Media Management
          </h4>
          <div className="space-y-1">
            <NavButton
              tab="blog"
              icon={PenTool}
              label="Manage Blogs"
              currentPath={pathname}
              onNavigate={onCloseMobile}
            />
            <NavButton
              tab="events"
              icon={Calendar}
              label="Manage Events"
              currentPath={pathname}
              onNavigate={onCloseMobile}
            />
            <NavButton
              tab="academy"
              icon={GraduationCap}
              label="Academy Manager"
              currentPath={pathname}
              onNavigate={onCloseMobile}
            />
            <NavButton
              tab="areslib"
              icon={BookOpen}
              label="ARESLib Manager"
              currentPath={pathname}
              onNavigate={onCloseMobile}
            />
            <NavButton
              tab="simulations"
              icon={TerminalSquare}
              label="Simulations Manager"
              currentPath={pathname}
              onNavigate={onCloseMobile}
            />
            <NavButton
              tab="documents"
              icon={FileText}
              label="Cloud Resources"
              currentPath={pathname}
              onNavigate={onCloseMobile}
            />
            <NavButton
              tab="videos"
              icon={Video}
              label="Manage Videos"
              currentPath={pathname}
              onNavigate={onCloseMobile}
            />
            <NavButton
              tab="photos"
              icon={ImageIcon}
              label="Manage Photos"
              currentPath={pathname}
              onNavigate={onCloseMobile}
            />
          </div>
        </div>

        {/* Administrative */}
        {(userRole === "admin" ||
          userRole === "coach" ||
          userRole === "mentor") && (
          <div>
            <h4 className="text-[10px] uppercase font-black tracking-widest text-ares-gold mb-2.5 px-4 font-heading">
              Administrative
            </h4>
            <div className="space-y-1">
              {(userRole === "admin" ||
                userRole === "coach" ||
                userRole === "mentor") && (
                <NavButton
                  tab="inquiries"
                  icon={MessageSquare}
                  label="Inquiries Hub"
                  currentPath={pathname}
                  hasAlert={hasPendingInquiries}
                  onNavigate={onCloseMobile}
                />
              )}
              {(userRole === "admin" ||
                userRole === "coach" ||
                userRole === "mentor") && (
                <NavButton
                  tab="tournaments"
                  icon={Trophy}
                  label="Manage Tournaments"
                  currentPath={pathname}
                  onNavigate={onCloseMobile}
                />
              )}
              {(userRole === "admin" ||
                userRole === "coach" ||
                userRole === "mentor") && (
                <NavButton
                  tab="sponsors"
                  icon={Heart}
                  label="Sponsors Manager"
                  currentPath={pathname}
                  onNavigate={onCloseMobile}
                />
              )}
              {(userRole === "admin" ||
                userRole === "coach" ||
                userRole === "mentor") && (
                <NavButton
                  tab="outreach"
                  icon={Sparkles}
                  label="Outreach Manager"
                  currentPath={pathname}
                  onNavigate={onCloseMobile}
                />
              )}
              {(userRole === "admin" || userRole === "coach") && (
                <NavButton
                  tab="users"
                  icon={ShieldAlert}
                  label="Manage Users"
                  currentPath={pathname}
                  onNavigate={onCloseMobile}
                />
              )}
              {(userRole === "admin" || userRole === "coach") && (
                <NavButton
                  tab="announcements"
                  icon={Megaphone}
                  label="Site Announcements"
                  currentPath={pathname}
                  onNavigate={onCloseMobile}
                />
              )}
            </div>
          </div>
        )}

        {/* Archival Indices */}
        <div>
          <h4 className="text-[10px] uppercase font-black tracking-widest text-marble/45 mb-2.5 px-4 font-heading">
            Archival Indices
          </h4>
          <div className="space-y-1">
            <Link
              to="/robots"
              onClick={onCloseMobile}
              className={`flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider transition-all ares-cut-sm border ${
                pathname === "/robots"
                  ? "bg-ares-red/15 text-white border-ares-red/45 shadow-[0_0_15px_rgba(192,0,0,0.1)]"
                  : "text-marble hover:bg-white/5 hover:text-white border-transparent"
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Cpu
                  size={16}
                  className={
                    pathname === "/robots"
                      ? "text-white animate-pulse"
                      : "text-marble/55"
                  }
                />
                <span className="truncate">Fleet Archive</span>
              </div>
            </Link>

            <Link
              to="/"
              onClick={onCloseMobile}
              className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ares-gold transition-all ares-cut-sm border border-transparent hover:border-ares-gold/20 hover:bg-ares-gold/10 hover:text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Globe size={16} className="text-ares-gold" aria-hidden="true" />
              <span className="truncate">Public Portal</span>
            </Link>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <button
            onClick={logout}
            className="flex min-h-11 w-full items-center justify-center gap-2 bg-ares-red py-3 text-xs font-black uppercase tracking-wider text-white transition-all ares-cut border border-ares-red hover:bg-ares-bronze focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
