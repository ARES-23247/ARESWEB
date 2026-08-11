"use client";

import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, User, Globe, ClipboardList, LogOut, ShieldAlert, Cpu, Sparkles, BookOpen, PenTool, Calendar, Video, MessageSquare, Image as ImageIcon, Heart, GraduationCap, FileText, TerminalSquare, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebaseFirestore";
import { onSnapshot, collection, query, where } from "firebase/firestore";
import { authenticatedFetch } from "@/lib/api";

interface NavButtonProps {
  tab: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  currentPath: string;
  hasAlert?: boolean;
}

const NavButton: React.FC<NavButtonProps> = ({
  tab,
  icon: Icon,
  label,
  currentPath,
  hasAlert
}) => {
  const targetPath = tab === "" ? "/dashboard" : `/dashboard/${tab}`;
  const isActive = currentPath === targetPath;

  return (
    <Link
      to={targetPath}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 ares-cut-sm transition-all font-semibold text-left text-xs uppercase tracking-wider border relative ${
        isActive
          ? "bg-ares-red/15 text-white border-ares-red/45 shadow-[0_0_15px_rgba(192,0,0,0.1)]"
          : "text-marble hover:bg-white/5 hover:text-white border-transparent"
      }`}
    >
      <div className="flex items-center gap-3 truncate">
        <Icon size={16} className={isActive ? "text-white animate-pulse" : "text-marble/55"} />
        <span className="truncate">{label}</span>
      </div>
      {hasAlert && (
        <span className="flex h-2.5 w-2.5 shrink-0 relative mr-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ares-red opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ares-red"></span>
        </span>
      )}
    </Link>
  );
};

export default function DashboardSidebar({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const { pathname } = useLocation();
  const { user, authorizedUser, logout } = useAuth();
  const [profileAvatar, setProfileAvatar] = useState<string>("");
  const [profileNickname, setProfileNickname] = useState<string>("");
  const [profileError, setProfileError] = useState<string>("");
  const [hasPendingInquiries, setHasPendingInquiries] = useState<boolean>(false);

  const userRole = authorizedUser?.role || "Pending Verification";

  useEffect(() => {
    if (import.meta.env.MODE === "e2e") return;
    if (!user?.uid) return;

    const controller = new AbortController();
    async function loadSafeProfile() {
      try {
        const response = await authenticatedFetch("/api/profiles/me", { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText || "Request failed"}`);
        }
        const result = await response.json() as {
          profile?: { avatar?: string; nickname?: string };
        };
        setProfileAvatar(result.profile?.avatar || "");
        setProfileNickname(result.profile?.nickname || "");
        setProfileError("");
      } catch (error) {
        if (controller.signal.aborted) return;
        const diagnostic = error instanceof Error ? error.message : "Profile request failed";
        console.error("Error loading the safe sidebar profile DTO:", error);
        setProfileError(diagnostic);
      }
    }
    void loadSafeProfile();
    return () => controller.abort();
  }, [user?.uid]);

  useEffect(() => {
    if (import.meta.env.MODE === "e2e") return;
    if (!user?.uid || (userRole !== "admin" && userRole !== "coach" && userRole !== "mentor")) {
      setHasPendingInquiries(false);
      return;
    }

    const q = query(
      collection(db, "inquiries"),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasPendingInquiries(!snapshot.empty);
    }, (error) => {
      console.error("Error subscribing to pending inquiries in sidebar:", error);
    });

    return () => unsubscribe();
  }, [user?.uid, userRole]);

  const userImage = profileAvatar || user?.photoURL;
  const displayName = profileNickname || user?.displayName || "ARES Member";
  const isUnverified = userRole === "unverified" || userRole === "Pending Verification";

  return (
    <aside className="w-72 h-full bg-black/40 border-r border-white/5 flex flex-col justify-between shadow-2xl shrink-0">
      
      {/* Profile Header */}
      <div className="p-6 border-b border-white/5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 ares-cut overflow-hidden border border-white/10 shadow-lg shrink-0">
            {userImage ? (
              <img src={userImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center bg-white/5" aria-hidden="true">
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
              <span role="status" className="text-[9px] font-mono text-white bg-ares-red px-1.5 py-0.5 rounded" title={profileError}>
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
            <NavButton tab="" icon={LayoutDashboard} label="Command Center" currentPath={pathname} />
            <NavButton tab="profile" icon={User} label="My Profile" currentPath={pathname} />
            <NavButton tab="zulip" icon={MessageSquare} label="Zulip Chat Hub" currentPath={pathname} />
            <NavButton tab="tasks" icon={ClipboardList} label="Kanban Tasks" currentPath={pathname} />
          </div>
        </div>

        {/* Media Management */}
        <div>
          <h4 className="text-[10px] uppercase font-black tracking-widest text-ares-gold mb-2.5 px-4 font-heading">
            Media Management
          </h4>
          <div className="space-y-1">
            <NavButton tab="blog" icon={PenTool} label="Manage Blogs" currentPath={pathname} />
            <NavButton tab="events" icon={Calendar} label="Manage Events" currentPath={pathname} />
            <NavButton tab="academy" icon={GraduationCap} label="Academy Manager" currentPath={pathname} />
            <NavButton tab="areslib" icon={BookOpen} label="ARESLib Manager" currentPath={pathname} />
            <NavButton tab="simulations" icon={TerminalSquare} label="Simulations Manager" currentPath={pathname} />
            <NavButton tab="documents" icon={FileText} label="Cloud Resources" currentPath={pathname} />
            <NavButton tab="videos" icon={Video} label="Manage Videos" currentPath={pathname} />
            <NavButton tab="photos" icon={ImageIcon} label="Manage Photos" currentPath={pathname} />
          </div>
        </div>

        {/* Administrative */}
        {(userRole === "admin" || userRole === "coach" || userRole === "mentor") && (
          <div>
            <h4 className="text-[10px] uppercase font-black tracking-widest text-ares-gold mb-2.5 px-4 font-heading">
              Administrative
            </h4>
            <div className="space-y-1">
              {(userRole === "admin" || userRole === "coach" || userRole === "mentor") && (
                <NavButton tab="inquiries" icon={MessageSquare} label="Inquiries Hub" currentPath={pathname} hasAlert={hasPendingInquiries} />
              )}
              {(userRole === "admin" || userRole === "coach" || userRole === "mentor") && (
                <NavButton tab="tournaments" icon={Trophy} label="Manage Tournaments" currentPath={pathname} />
              )}
              {(userRole === "admin" || userRole === "coach" || userRole === "mentor") && (
                <NavButton tab="sponsors" icon={Heart} label="Sponsors Manager" currentPath={pathname} />
              )}
              {(userRole === "admin" || userRole === "coach" || userRole === "mentor") && (
                <NavButton tab="outreach" icon={Sparkles} label="Outreach Manager" currentPath={pathname} />
              )}
              {(userRole === "admin" || userRole === "coach") && (
                <NavButton tab="users" icon={ShieldAlert} label="Manage Users" currentPath={pathname} />
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
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 ares-cut-sm transition-all font-semibold text-left text-xs uppercase tracking-wider border ${
                pathname === "/robots"
                  ? "bg-ares-red/15 text-white border-ares-red/45 shadow-[0_0_15px_rgba(192,0,0,0.1)]"
                  : "text-marble hover:bg-white/5 hover:text-white border-transparent"
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Cpu size={16} className={pathname === "/robots" ? "text-white animate-pulse" : "text-marble/55"} />
                <span className="truncate">Fleet Archive</span>
              </div>
            </Link>

            <Link
              to="/"
              onClick={onCloseMobile}
              className="w-full flex items-center gap-3 px-4 py-3 ares-cut-sm transition-all font-semibold text-left text-xs uppercase tracking-wider text-ares-gold hover:bg-ares-gold/10 hover:text-white border border-transparent hover:border-ares-gold/20 focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Globe size={16} className="text-ares-gold" aria-hidden="true" />
              <span className="truncate">Public Portal</span>
            </Link>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3 bg-ares-red hover:bg-ares-bronze text-white border border-ares-red ares-cut transition-all text-xs font-black uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

    </aside>
  );
}
