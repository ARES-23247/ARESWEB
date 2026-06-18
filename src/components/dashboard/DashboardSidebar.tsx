import { Suspense, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  PenTool, Calendar, Book, BookOpen, Image, AppWindow, Edit3, Settings, History, FileText,
  User, Users, Utensils, BarChart3, Gem, Target, Trophy, Menu, X, Award, MapPin, MessageSquare, Radio, LayoutDashboard, LogOut, ShieldAlert, Mail, DollarSign, Package, Sparkles, Crosshair, Puzzle, Share2, Globe, Play, Database, Inbox,
  type LucideIcon
} from "lucide-react";
import { signOut, useSession } from "../../utils/auth-client";
import { DashboardSession, DashboardPermissions } from "../../hooks/useDashboardSession";
import { lazy } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useSidebarStore } from "../../store/sidebarStore";

const AvatarEditor = lazy(() => import("../AvatarEditor"));

const NavButton = ({
  tab,
  icon: Icon,
  label,
  disabled = false,
  sub = false,
  currentPath,
  pendingCount = 0
}: {
  tab: string;
  icon?: LucideIcon;
  label: string;
  disabled?: boolean;
  sub?: boolean;
  currentPath: string;
  pendingCount?: number;
}) => {
  const navigate = useNavigate();
  const isActive = currentPath === `/dashboard/${tab}` || (tab === "profile" && (currentPath === "/dashboard" || currentPath === "/dashboard/"));
  const hasPending = pendingCount > 0;

  const sharedClass = `w-full flex items-center justify-between gap-3 px-4 py-2.5 ares-cut-sm transition-all font-semibold text-left ${
    isActive
      ? "bg-ares-red/10 text-white border border-ares-red/30 shadow-[0_0_15px_rgba(192,0,0,0.1)]"
      : hasPending
      ? "text-ares-danger hover:bg-ares-danger/10 border border-ares-danger/20 shadow-[0_0_10px_rgba(239,68,68,0.05)]"
      : "text-marble hover:bg-white/5 hover:text-white border border-transparent"
  } ${sub ? "pl-11 text-sm font-bold" : "text-sm"} ${disabled ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}`;

  if (disabled) {
    return (
      <button disabled className={sharedClass}>
        <div className="flex items-center gap-3 truncate">
          {Icon && <Icon size={18} className={isActive ? "text-white" : "text-marble/50"} />}
          <span className="truncate">{label}</span>
        </div>
      </button>
    );
  }

  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={tab === "" ? "/dashboard" as any : `/dashboard/${tab}` as any}
      className={sharedClass}
    >
      <div className="flex items-center gap-3 truncate">
        {Icon && <Icon size={18} className={isActive ? "text-white" : hasPending ? "text-ares-danger" : "text-marble/50"} />}
        <span className="truncate">{label}</span>
      </div>
      {hasPending && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            navigate({ to: `/dashboard/${tab}?view=pending` as any });
          }}
          className="shrink-0 bg-ares-danger text-white text-xs font-black uppercase tracking-widest px-2 py-0.5 ares-cut-sm shadow-[0_0_10px_rgba(192,0,0,0.5)] hover:brightness-110 hover:scale-110 transition-all z-10 relative cursor-pointer"
        >
          {pendingCount}
        </button>
      )}
    </Link>
  );
};

export default function DashboardSidebar({
  session,
  permissions,
  notifications,
}: {
  session: DashboardSession | null;
  permissions: DashboardPermissions;
  notifications: {
    pendingInquiriesCount: number;
    pendingPostsCount: number;
    pendingEventsCount: number;
    pendingDocsCount: number;
  };
}) {
  const location = useLocation();
  const { dashboardOpen, toggleDashboard } = useSidebarStore();
  const queryClient = useQueryClient();

  // Use the auth session hook for refetching
  const { refetch } = useSession();

  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);

  const handleAvatarSave = () => {
    // Refetch session data to update the avatar image without page reload
    refetch();
  };

  const { isAuthorized, canSeeInquiries, isAdmin, canSeeLogistics, canSeeTasks, canSeeSimulations, role, memberType } = permissions;
  const { pendingInquiriesCount, pendingPostsCount, pendingEventsCount, pendingDocsCount } = notifications;

  return (
    <>
      {isAvatarEditorOpen && (
        <Suspense fallback={null}>
          <AvatarEditor
            currentImage={session?.user?.image as string | null}
            onClose={() => setIsAvatarEditorOpen(false)}
            onSave={handleAvatarSave}
          />
        </Suspense>
      )}

      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 w-full h-16 bg-black/80 backdrop-blur-xl border-b border-white/10 z-40 flex items-center justify-between px-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 ares-cut-sm bg-gradient-to-br from-ares-red to-red-900 border border-ares-danger/30 flex items-center justify-center">
            <AppWindow size={16} className="text-white" />
          </div>
          <h1 className="text-lg font-black tracking-tighter text-white">
            ARES<span className="text-marble/60 font-bold">Workspace</span>
          </h1>
        </div>
        <button
          onClick={toggleDashboard}
          className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm text-marble transition-colors"
          aria-label="Open sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Overlay for mobile sidebar */}
      {dashboardOpen && (
        <div
          role="presentation"
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={toggleDashboard}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:relative top-0 md:top-auto left-0 z-40 md:z-auto w-72 h-screen md:h-auto md:min-h-0 bg-obsidian border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none ${
          dashboardOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Profile Header */}
        <div className="p-6 border-b border-white/5 shrink-0 flex flex-col gap-4">
          <div className="flex items-center justify-between md:hidden pb-2 mb-2 border-b border-white/5">
            <span className="text-xs font-black text-marble/60 uppercase tracking-widest">Navigation Menu</span>
            <button className="text-marble/50 p-1 bg-white/5 ares-cut-sm hover:text-white" onClick={toggleDashboard} aria-label="Close sidebar">
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center gap-3 relative">
            <button
              onClick={() => setIsAvatarEditorOpen(true)}
              className="relative group block w-12 h-12 ares-cut overflow-hidden border border-white/10 shadow-lg hover:border-ares-red transition-all focus:outline-none shrink-0"
              title="Customize Identity"
            >
              <img
                src={(session?.user?.image as string) || `https://api.dicebear.com/9.x/bottts/svg?seed=${session?.user?.id}`}
                alt={session?.user?.name || "User"}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Edit3 size={14} className="text-white" />
              </div>
            </button>
            <div className="flex flex-col min-w-0">
              <span className="text-white text-sm font-bold truncate tracking-tight">
                {session?.user?.nickname || session?.user?.firstName 
                  ? (session?.user?.nickname || `${session.user.firstName} ${session.user.lastName || ''}`.trim())
                  : ((session?.user?.name as string) || "ARES Member")}
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-ares-gold text-xs font-black uppercase tracking-widest truncate">
                  {role} • {memberType}
                </span>
                {permissions.isUnverified && (
                  <span className="w-fit px-1.5 py-0.5 bg-ares-red text-white text-[8px] font-black rounded uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-[0_0_10px_rgba(192,0,0,0.3)]">
                    <ShieldAlert size={8} /> Locked: View Only
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 py-6 space-y-8">
          <div>
            <h4 className="text-xs uppercase font-black tracking-widest text-ares-gold mb-2 px-6">Navigation</h4>
            <div className="space-y-1 px-3">
              <NavButton tab="" icon={LayoutDashboard} label="Dashboard Home" currentPath={location.pathname} />
              <NavButton tab="profile" icon={User} label="My Profile" currentPath={location.pathname} />
              <div className="h-px bg-white/5 mx-2 my-2" />
              <Link
                to="/"
                className="w-full flex items-center gap-3 px-4 py-2.5 ares-cut-sm transition-all font-semibold text-left text-sm text-ares-cyan hover:bg-ares-cyan/10 hover:text-white border border-transparent hover:border-ares-cyan/20"
              >
                <Globe size={18} className="text-ares-cyan/80 group-hover:text-white" />
                <span className="truncate">Public Site</span>
              </Link>
            </div>
          </div>

          {canSeeTasks && (
            <div>
              <h4 className="text-xs uppercase font-black tracking-widest text-ares-cyan mb-2 px-6">Team Workspace</h4>
              <div className="space-y-1 px-3">
                <NavButton tab="tasks" icon={LayoutDashboard} label="Kanban Tasks" currentPath={location.pathname} />
                <NavButton tab="drive-docs" icon={FileText} label="Google Drive Docs" currentPath={location.pathname} />
                <NavButton tab="outreach" icon={Target} label="Outreach Tracker" currentPath={location.pathname} />
                <NavButton tab="locations" icon={MapPin} label="Meeting Locations" currentPath={location.pathname} />
                {canSeeSimulations && <NavButton tab="simulations" icon={Sparkles} label="Sim Playground" currentPath={location.pathname} />}
                {isAdmin && <NavButton tab="sims" icon={Puzzle} label="Sim Registry" currentPath={location.pathname} />}
                <NavButton tab="scouting" icon={Crosshair} label="FTC Scout" currentPath={location.pathname} />
              </div>
            </div>
          )}

          {isAuthorized && (
            <div>
              <h4 className="text-xs uppercase font-black tracking-widest text-marble/60 mb-2 px-6">Content Hub</h4>
              <div className="space-y-1 px-3">
                <NavButton tab="manage_blog" icon={PenTool} label="Blogs & News" currentPath={location.pathname} pendingCount={pendingPostsCount} />
                <NavButton tab="manage_event" icon={Calendar} label="Calendar Events" currentPath={location.pathname} pendingCount={pendingEventsCount} />
                <NavButton tab="manage_docs" icon={Book} label="ARESLib Docs" currentPath={location.pathname} pendingCount={pendingDocsCount} />
                <NavButton tab="manage_seasons" icon={History} label="Seasonal Legacies" currentPath={location.pathname} />
                <NavButton tab="robots" icon={AppWindow} label="Robots Archive" currentPath={location.pathname} />
                <NavButton tab="tournaments" icon={Trophy} label="Tournaments & Events" currentPath={location.pathname} />
                <div className="h-px bg-white/5 my-3 mx-4" />
                <NavButton tab="assets" icon={Image} label="Media Gallery" currentPath={location.pathname} />
                <NavButton tab="photos" icon={Image} label="Google Photos" sub={true} currentPath={location.pathname} />
                <NavButton tab="manage_albums" icon={Image} label="Photo Albums" sub={true} currentPath={location.pathname} />
                <NavButton tab="youtube" icon={Play} label="Video Hub" sub={true} currentPath={location.pathname} />
                <NavButton tab="legacy" icon={Trophy} label="Trophy Case Archive" currentPath={location.pathname} />
              </div>
            </div>
          )}

          {isAuthorized && (
            <div>
              <h4 className="text-xs uppercase font-black tracking-widest text-marble/60 mb-2 px-6">Operations</h4>
              <div className="space-y-1 px-3">
                {canSeeInquiries && <NavButton tab="inquiries" icon={MessageSquare} label="Inquiries Hub" currentPath={location.pathname} pendingCount={pendingInquiriesCount} />}
                {isAuthorized && <NavButton tab="gmail" icon={Inbox} label="Team Inbox" currentPath={location.pathname} />}
                {isAdmin && <NavButton tab="mass_email" icon={Mail} label="Mass Email Blast" currentPath={location.pathname} />}
                {isAdmin && <NavButton tab="social" icon={Share2} label="Social Media Manager" currentPath={location.pathname} />}
                {isAdmin && <NavButton tab="store_orders" icon={Package} label="Store Fulfillment" currentPath={location.pathname} />}
                {isAdmin && <NavButton tab="finance" icon={DollarSign} label="Finance & Budget" currentPath={location.pathname} />}
                <NavButton tab="sponsors" icon={Gem} label="Sponsors & Funding" currentPath={location.pathname} />
                {isAdmin && <NavButton tab="sponsor_tokens" icon={Gem} label="Sponsor ROI Tokens" currentPath={location.pathname} />}
                <NavButton tab="analytics" icon={BarChart3} label="Analytics & Performance" currentPath={location.pathname} />
              </div>
            </div>
          )}

          {(isAdmin || canSeeLogistics) && (
            <div>
              <h4 className="text-xs uppercase font-black tracking-widest text-ares-gold mb-2 px-6">Administration</h4>
              <div className="space-y-1 px-3">
                {isAdmin && <NavButton tab="command_center" icon={Radio} label="Command Center" currentPath={location.pathname} />}
                {isAdmin && <NavButton tab="db_studio" icon={Database} label="Database Studio" currentPath={location.pathname} />}
                {isAdmin && <NavButton tab="users" icon={Users} label="User Roles & Sync" currentPath={location.pathname} />}
                {isAdmin && <NavButton tab="impact_roster" icon={Trophy} label="Impact & Roster" currentPath={location.pathname} />}
                {isAdmin && <NavButton tab="badges" icon={Award} label="Badges & Awards" currentPath={location.pathname} />}
                {isAdmin && <NavButton tab="integrations" icon={Settings} label="System Integrations" currentPath={location.pathname} />}
                {canSeeLogistics && <NavButton tab="logistics" icon={Utensils} label="Dietary / Logistics" currentPath={location.pathname} />}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs uppercase font-black tracking-widest text-marble/60 mb-2 px-6">Resources</h4>
            <div className="space-y-1 px-3">
              <Link
                to="/developers/api"
                className="w-full flex items-center gap-3 px-4 py-2.5 ares-cut-sm transition-all font-semibold text-left text-sm text-ares-gold hover:bg-ares-gold/10 hover:text-white border border-transparent hover:border-ares-gold/20"
              >
                <BookOpen size={18} className="text-ares-gold/80 group-hover:text-white" />
                <span className="truncate">Developer API</span>
              </Link>
            </div>
          </div>

          <div className="pt-4 px-3 border-t border-white/5">
            <button
              onClick={async () => {
                try {
                  await signOut();
                  // Clear React Query cache for profile data to prevent showing wrong user
                  queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
                  queryClient.clear();
                  window.location.href = '/';
                } catch (err) {
                  console.error("Authentication Fault: Sign out sequence failed.", err);
                  // Fallback: If CSRF or session mismatch occurs (e.g. from prior cache poisoning),
                  // forcefully clear the cookies via the emergency endpoint.
                  queryClient.clear();
                  window.location.href = '/api/auth/emergency-clear';
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-ares-danger/10 hover:bg-ares-danger/20 text-ares-danger-soft border border-ares-danger/20 hover:border-ares-danger/40 ares-cut transition-all text-xs font-black uppercase tracking-wider"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>

      </aside>
    </>
  );
}


