"use client";

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  DollarSign,
  CalendarRange,
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
import { useDashboardNotifications } from "@/context/DashboardNotificationsContext";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

interface NavItemConfig {
  tab: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    "aria-hidden"?: React.AriaAttributes["aria-hidden"];
  }>;
  label: string;
  hasAlert?: boolean;
  alertCount?: number;
  alertLabel?: string;
}

interface SidebarSectionConfig {
  id: "workspace" | "publishing" | "competition" | "administration";
  title: string;
  items: NavItemConfig[];
}

interface NavButtonProps extends NavItemConfig {
  currentPath: string;
  onNavigate?: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({
  tab,
  icon: Icon,
  label,
  currentPath,
  hasAlert,
  alertCount,
  alertLabel,
  onNavigate,
}) => {
  const targetPath = tab === "" ? "/dashboard" : `/dashboard/${tab}`;
  const isActive = currentPath === targetPath;
  const showAlert = hasAlert || (alertCount ?? 0) > 0;

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
          className={isActive ? "text-ares-gold" : "text-marble/55"}
        />
        <span className="truncate">{label}</span>
      </div>
      {showAlert && (
        <>
          <span
            aria-hidden="true"
            className={
              alertCount
                ? "flex min-w-5 shrink-0 items-center justify-center rounded-full bg-ares-gold px-1.5 py-0.5 text-[9px] font-black text-black"
                : "mr-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-ares-red"
            }
          >
            {alertCount ? (alertCount > 99 ? "99+" : alertCount) : null}
          </span>
          {alertLabel && <span className="sr-only">{alertLabel}</span>}
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

  const [expandedSections, setExpandedSections] = useState<
    Record<SidebarSectionConfig["id"], boolean>
  >({
    workspace: true,
    publishing: true,
    competition: true,
    administration: true,
  });

  const userRole = authorizedUser?.role || "Pending Verification";
  const isMentorOrAbove =
    userRole === "admin" || userRole === "coach" || userRole === "mentor";
  const isAdminOrCoach = userRole === "admin" || userRole === "coach";

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

  const userImage = profileAvatar || user?.photoURL;
  const displayName = profileNickname || user?.displayName || "ARES Member";
  const isUnverified =
    userRole === "unverified" || userRole === "Pending Verification";

  const sections: SidebarSectionConfig[] = [
    {
      id: "workspace",
      title: "Overview & Tasks",
      items: [
        { tab: "", icon: LayoutDashboard, label: "Command Center" },
        { tab: "tasks", icon: ClipboardList, label: "Kanban Tasks" },
        { tab: "zulip", icon: MessageSquare, label: "Zulip Chat Hub" },
        { tab: "profile", icon: User, label: "My Profile" },
      ],
    },
    {
      id: "publishing",
      title: "Publishing & Media",
      items: [
        {
          tab: "blog",
          icon: PenTool,
          label: "Manage Blogs",
          hasAlert: blogApprovalsState === "error",
          alertCount: pendingBlogApprovals,
          alertLabel:
            blogApprovalsState === "error"
              ? "Approval queue status unavailable"
              : `${pendingBlogApprovals} pending blog ${pendingBlogApprovals === 1 ? "post" : "posts"} awaiting mentor approval`,
        },
        {
          tab: "events",
          icon: Calendar,
          label: "Manage Events",
          hasAlert: eventApprovalsState === "error",
          alertCount: pendingEventApprovals,
          alertLabel:
            eventApprovalsState === "error"
              ? "Event approval queue status unavailable"
              : `${pendingEventApprovals} pending ${pendingEventApprovals === 1 ? "event" : "events"} awaiting mentor approval`,
        },
        {
          tab: "academy",
          icon: GraduationCap,
          label: "Academy Manager",
          hasAlert: academyApprovalsState === "error",
          alertCount: pendingAcademyApprovals,
          alertLabel:
            academyApprovalsState === "error"
              ? "Academy approval queue status unavailable"
              : `${pendingAcademyApprovals} pending academy ${pendingAcademyApprovals === 1 ? "lesson" : "lessons"} awaiting mentor approval`,
        },
        {
          tab: "areslib",
          icon: BookOpen,
          label: "ARESLib Manager",
          hasAlert: areslibApprovalsState === "error",
          alertCount: pendingAreslibApprovals,
          alertLabel:
            areslibApprovalsState === "error"
              ? "ARESLib approval queue status unavailable"
              : `${pendingAreslibApprovals} pending ARESLib ${pendingAreslibApprovals === 1 ? "document" : "documents"} awaiting mentor approval`,
        },
        {
          tab: "simulations",
          icon: TerminalSquare,
          label: "Simulations Manager",
        },
        {
          tab: "documents",
          icon: FileText,
          label: "Cloud Resources",
          hasAlert: documentApprovalsState === "error",
          alertCount: pendingDocumentApprovals,
          alertLabel:
            documentApprovalsState === "error"
              ? "Cloud resource approval queue status unavailable"
              : `${pendingDocumentApprovals} pending cloud ${pendingDocumentApprovals === 1 ? "resource" : "resources"} awaiting mentor approval`,
        },
        { tab: "videos", icon: Video, label: "Manage Videos" },
        { tab: "photos", icon: ImageIcon, label: "Manage Photos" },
      ],
    },
    ...(isMentorOrAbove
      ? [
          {
            id: "competition" as const,
            title: "Competition & Community",
            items: [
              { tab: "tournaments", icon: Trophy, label: "Manage Tournaments" },
              { tab: "seasons", icon: CalendarRange, label: "Seasons & Awards" },
              { tab: "outreach", icon: Sparkles, label: "Outreach Manager" },
              { tab: "sponsors", icon: Heart, label: "Sponsors Manager" },
            ],
          },
        ]
      : []),
    ...(isAdminOrCoach
      ? [
          {
            id: "administration" as const,
            title: "Administration",
            items: [
              {
                tab: "inquiries",
                icon: MessageSquare,
                label: "Inquiries Hub",
                hasAlert: hasPendingInquiries || inquiriesState === "error",
                alertLabel:
                  inquiriesState === "error"
                    ? "Pending inquiry status unavailable"
                    : "Pending inquiries",
              },
              { tab: "finance", icon: DollarSign, label: "Finance Ledger" },
              { tab: "users", icon: ShieldAlert, label: "Manage Users" },
              {
                tab: "announcements",
                icon: Megaphone,
                label: "Site Announcements",
              },
            ],
          },
        ]
      : []),
  ];

  // Auto-expand the section containing the active route on navigation.
  useEffect(() => {
    const activeTab =
      pathname === "/dashboard"
        ? ""
        : pathname.startsWith("/dashboard/")
          ? pathname.slice("/dashboard/".length).split("/")[0]
          : null;
    if (activeTab === null) return;

    setExpandedSections((previous) => {
      const matchingSection = sections.find((section) =>
        section.items.some((item) => item.tab === activeTab),
      );
      if (!matchingSection || previous[matchingSection.id]) {
        return previous;
      }
      return { ...previous, [matchingSection.id]: true };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleSection = (sectionId: SidebarSectionConfig["id"]) => {
    setExpandedSections((previous) => ({
      ...previous,
      [sectionId]: !previous[sectionId],
    }));
  };

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
                <span className="w-fit px-1.5 py-0.5 bg-ares-red text-white text-[8px] font-black rounded uppercase tracking-wider flex items-center gap-1">
                  <ShieldAlert size={8} aria-hidden="true" /> Locked: View Only
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation list */}
      <nav
        aria-label="Workspace sections"
        className="flex-grow py-5 space-y-4 px-3 overflow-y-auto scrollbar-thin"
      >
        {sections.map((section) => {
          const isExpanded = expandedSections[section.id];
          const panelId = `sidebar-section-${section.id}`;
          const sectionAlertCount = section.items.reduce(
            (sum, item) => sum + (item.alertCount ?? 0),
            0,
          );
          const sectionHasErrorOrDot = section.items.some(
            (item) => Boolean(item.hasAlert),
          );

          return (
            <div key={section.id} className="space-y-1">
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={panelId}
                onClick={() => toggleSection(section.id)}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-ares-gold transition-colors hover:bg-white/5 hover:text-white font-heading cursor-pointer"
              >
                <span className="truncate">{section.title}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {!isExpanded &&
                    (sectionAlertCount > 0 || sectionHasErrorOrDot) && (
                      <span
                        aria-hidden="true"
                        className={
                          sectionAlertCount > 0
                            ? "flex min-w-5 items-center justify-center rounded-full bg-ares-gold px-1.5 py-0.5 text-[9px] font-black text-black"
                            : "inline-flex h-2 w-2 rounded-full bg-ares-red"
                        }
                      >
                        {sectionAlertCount > 0
                          ? sectionAlertCount > 99
                            ? "99+"
                            : sectionAlertCount
                          : null}
                      </span>
                    )}
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`text-marble/55 transition-transform ${
                      isExpanded ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </span>
              </button>

              {isExpanded && (
                <div id={panelId} className="space-y-1">
                  {section.items.map((item) => (
                    <NavButton
                      key={item.tab || "home"}
                      {...item}
                      currentPath={pathname}
                      onNavigate={onCloseMobile}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Archival Indices */}
        <div className="pt-2 border-t border-white/5">
          <p className="text-[10px] uppercase font-black tracking-widest text-marble/45 mb-1.5 px-4 pt-2 font-heading">
            Public Shortcuts
          </p>
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
                  aria-hidden="true"
                  className={
                    pathname === "/robots" ? "text-ares-gold" : "text-marble/55"
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
            type="button"
            onClick={logout}
            className="flex min-h-11 w-full items-center justify-center gap-2 bg-ares-red py-3 text-xs font-black uppercase tracking-wider text-white transition-all ares-cut border border-ares-red hover:bg-ares-bronze focus-visible:ring-2 focus-visible:ring-ares-cyan cursor-pointer"
          >
            <LogOut size={14} aria-hidden="true" /> Sign Out
          </button>
        </div>
      </nav>
    </aside>
  );
}
