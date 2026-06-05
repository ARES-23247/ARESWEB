"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, User, Globe, ClipboardList, LogOut, X, ShieldAlert, Cpu, Sparkles, BookOpen, Settings, PenTool, Calendar, Video, Compass } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface NavButtonProps {
  tab: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  currentPath: string;
}

const NavButton: React.FC<NavButtonProps> = ({
  tab,
  icon: Icon,
  label,
  currentPath
}) => {
  const targetPath = tab === "" ? "/dashboard" : `/dashboard/${tab}`;
  const isActive = currentPath === targetPath;

  return (
    <Link
      href={targetPath}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 ares-cut-sm transition-all font-semibold text-left text-xs uppercase tracking-wider border ${
        isActive
          ? "bg-ares-red/15 text-white border-ares-red/45 shadow-[0_0_15px_rgba(192,0,0,0.1)]"
          : "text-marble hover:bg-white/5 hover:text-white border-transparent"
      }`}
    >
      <div className="flex items-center gap-3 truncate">
        <Icon size={16} className={isActive ? "text-white animate-pulse" : "text-marble/55"} />
        <span className="truncate">{label}</span>
      </div>
    </Link>
  );
};

export default function DashboardSidebar({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const pathname = usePathname();
  const { user, authorizedUser, logout } = useAuth();
  
  const userRole = authorizedUser?.role || "Pending Verification";
  const userEmail = user?.email || "";
  const userImage = user?.photoURL;
  const isUnverified = userRole === "unverified" || userRole === "Pending Verification";

  return (
    <aside className="w-72 h-screen bg-black/40 border-r border-white/5 flex flex-col justify-between shadow-2xl shrink-0 sticky top-0">
      
      {/* Profile Header */}
      <div className="p-6 border-b border-white/5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 ares-cut overflow-hidden border border-white/10 shadow-lg shrink-0">
            <img
              src={userImage || `https://api.dicebear.com/9.x/bottts/svg?seed=${user?.uid}`}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-white text-sm font-bold truncate tracking-tight">
              {user?.displayName || "ARES Member"}
            </span>
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
      <div className="flex-grow py-6 overflow-y-auto space-y-8 px-3">
        <div>
          <h4 className="text-[10px] uppercase font-black tracking-widest text-ares-gold mb-2.5 px-4 font-heading">
            Internal Workspace
          </h4>
          <div className="space-y-1">
            <NavButton tab="" icon={LayoutDashboard} label="Command Center" currentPath={pathname} />
            <NavButton tab="tasks" icon={ClipboardList} label="Kanban Tasks" currentPath={pathname} />
            <NavButton tab="scope" icon={Cpu} label="ARES-Scope" currentPath={pathname} />
            
            <div className="h-px bg-white/5 mx-2 my-2" />
            
            <NavButton tab="blog" icon={PenTool} label="Manage Blogs" currentPath={pathname} />
            <NavButton tab="events" icon={Calendar} label="Manage Events" currentPath={pathname} />
            <NavButton tab="documents" icon={BookOpen} label="Manage Docs" currentPath={pathname} />
            <NavButton tab="videos" icon={Video} label="Manage Videos" currentPath={pathname} />
            <NavButton tab="photos" icon={Settings} label="Google Sync" currentPath={pathname} />
            
            <div className="h-px bg-white/5 mx-2 my-2" />
            
            <Link
              href="/"
              onClick={onCloseMobile}
              className="w-full flex items-center gap-3 px-4 py-3 ares-cut-sm transition-all font-semibold text-left text-xs uppercase tracking-wider text-ares-cyan hover:bg-ares-cyan/10 hover:text-white border border-transparent hover:border-ares-cyan/20"
            >
              <Globe size={16} className="text-ares-cyan/85" />
              <span className="truncate">Public Portal</span>
            </Link>
          </div>
        </div>

        <div>
          <h4 className="text-[10px] uppercase font-black tracking-widest text-marble/45 mb-2.5 px-4 font-heading">
            Archival Indices
          </h4>
          <div className="space-y-1">
            <Link
              href="/robots"
              onClick={onCloseMobile}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-marble/80 hover:bg-white/5 hover:text-white rounded transition-all"
            >
              <Cpu size={14} className="text-marble/40" /> Fleet Archive
            </Link>
            <Link
              href="/aresplanner"
              onClick={onCloseMobile}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-marble/80 hover:bg-white/5 hover:text-white rounded transition-all"
            >
              <Compass size={14} className="text-marble/40" /> ARES Trajectory Planner
            </Link>
            <Link
              href="/simulators"
              onClick={onCloseMobile}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-marble/80 hover:bg-white/5 hover:text-white rounded transition-all"
            >
              <Sparkles size={14} className="text-marble/40" /> Arm Kinematics
            </Link>
            <Link
              href="/blog"
              onClick={onCloseMobile}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-marble/80 hover:bg-white/5 hover:text-white rounded transition-all"
            >
              <BookOpen size={14} className="text-marble/40" /> Blog Articles
            </Link>
          </div>
        </div>
      </div>

      {/* Sidebar Footer / Sign Out */}
      <div className="p-4 border-t border-white/5 bg-black/20 shrink-0">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 bg-ares-danger/10 hover:bg-ares-danger/20 text-ares-danger-soft border border-ares-danger/20 hover:border-ares-danger/40 ares-cut transition-all text-xs font-black uppercase tracking-wider"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>

    </aside>
  );
}
