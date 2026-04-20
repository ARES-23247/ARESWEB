import { useState, useEffect, Suspense, lazy } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  PenTool, Calendar, Book, Image, AppWindow, PlusCircle, Edit3, Settings, 
  ShieldAlert, Lock, RefreshCw, LogOut, User, Users, Utensils, BarChart3, 
  Gem, Target, Trophy, Menu, X, Folders, Award, MapPin, MessageSquare
} from "lucide-react";

// ── Lazy-loaded Tab Components ───────────────────────────────────────
const BlogEditor = lazy(() => import("@/components/BlogEditor"));
const EventEditor = lazy(() => import("@/components/EventEditor"));
const ContentManager = lazy(() => import("@/components/ContentManager"));
const AssetManager = lazy(() => import("@/components/AssetManager"));
const DocsEditor = lazy(() => import("@/components/DocsEditor"));
const IntegrationsManager = lazy(() => import("@/components/IntegrationsManager"));
const AvatarEditor = lazy(() => import("@/components/AvatarEditor"));
const ProfileEditor = lazy(() => import("@/components/ProfileEditor"));
const AdminUsers = lazy(() => import("@/components/AdminUsers"));
const DietarySummary = lazy(() => import("@/components/DietarySummary"));
const AnalyticsDashboard = lazy(() => import("@/components/AnalyticsDashboard"));
const SponsorEditor = lazy(() => import("@/components/SponsorEditor"));
const OutreachTracker = lazy(() => import("@/components/OutreachTracker"));
const AwardEditor = lazy(() => import("@/components/AwardEditor"));
const MemberImpactOverview = lazy(() => import("@/components/MemberImpactOverview"));
const BadgeManager = lazy(() => import("@/components/BadgeManager"));
const LocationsManager = lazy(() => import("@/components/LocationsManager"));
const AdminInquiries = lazy(() => import("@/components/AdminInquiries"));

type TabState = "blog" | "event" | "docs" | "manage_blog" | "manage_event" | "manage_docs" | "locations" | "assets" | "integrations" | "profile" | "users" | "logistics" | "analytics" | "sponsors" | "outreach" | "legacy" | "impact_roster" | "badges" | "inquiries";

// ── NavButton Component ────────────────────────────────────────────
const NavButton = ({ tab, icon: Icon, label, disabled = false, sub = false, activeTab, onNavigate }: { tab: TabState, icon?: React.ElementType, label: string, disabled?: boolean, sub?: boolean, activeTab: TabState, onNavigate: (tab: TabState) => void }) => {
  const isActive = activeTab === tab;
  return (
    <button
      onClick={() => onNavigate(tab)}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-semibold ${
        isActive 
          ? "bg-ares-red/10 text-white border border-ares-red/30 shadow-[0_0_15px_rgba(192,0,0,0.1)]" 
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent"
      } ${sub ? "pl-11 text-sm font-bold" : "text-sm"} ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
    >
      {Icon && <Icon size={18} className={isActive ? "text-ares-red" : "text-zinc-500"} />}
      <span className="truncate">{label}</span>
    </button>
  );
};

/* Compute localhost bypass at module level so it can seed initial state
   without triggering a synchronous setState inside an effect body. */
const isLocalDev =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

// ── Suspense Spinner ─────────────────────────────────────────────────
function TabLoader() {
  return (
    <div className="flex justify-center flex-col gap-4 items-center py-32">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <RefreshCw size={32} className="text-ares-red/50" />
      </motion.div>
      <p className="text-sm font-bold text-zinc-500 animate-pulse uppercase tracking-widest">Loading Module...</p>
    </div>
  );
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialDoc = searchParams.get("editDoc");

  // ── State ──────────────────────────────────────────────────────────
  const [enrichedSession, setEnrichedSession] = useState<{user: Record<string, unknown>, authenticated: boolean} | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [activeTab, setActiveTab] = useState<TabState>(initialDoc ? "docs" : "profile");
  const [editPostSlug, setEditPostSlug] = useState<string | null>(null);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editDocSlug, setEditDocSlug] = useState<string | null>(initialDoc);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth-check")
      .then(async (res) => {
        if (!res.ok) throw new Error("Not Authenticated");
        return res.json();
      })
      .then((data: {user: Record<string, unknown>, authenticated: boolean}) => {
        setEnrichedSession(data);
        setIsPending(false);
      })
      .catch(() => {
        setEnrichedSession(null);
        setIsPending(false);
      });
  }, []);

  const session = enrichedSession;

  useEffect(() => {
    if (initialDoc) {
      const timer = setTimeout(() => {
        setSearchParams(new URLSearchParams());
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialDoc, setSearchParams]);

  // ── Loading State ──────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-ares-red/10 blur-[120px] rounded-full pointer-events-none opacity-50" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 z-10"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw size={48} className="text-ares-red" />
          </motion.div>
          <p className="text-zinc-400 text-sm font-bold tracking-widest uppercase">Verifying ARES Session...</p>
        </motion.div>
      </div>
    );
  }

  // ── Unauthorized Gate ──────────────────────────────────────────────
  const role = (session?.user?.role as string) || "unverified";
  const memberType = (session?.user?.member_type as string) || "student";
  const isAdmin = role === "admin" || isLocalDev;
  const isAuthorized = isAdmin || role === "author";
  const isUnverified = role === "unverified" && !isLocalDev;
  const canSeeLogistics = isAdmin || ["parent", "coach", "mentor"].includes(memberType);

  if (!session || !session.user) {
    return (
      <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center relative overflow-hidden font-sans">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-ares-red/10 blur-[120px] rounded-full pointer-events-none opacity-50" />
        
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10 max-w-lg w-full mx-4">
          <div className="bg-black/60 backdrop-blur-2xl rounded-3xl border border-red-500/20 p-10 shadow-2xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-ares-red/30 to-red-900/20 border border-red-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.3)]">
                <ShieldAlert size={40} className="text-red-400" />
              </div>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-3">Restricted Access</h1>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8">
              {!session ? "The ARES Dashboard is protected by Internal Authentication. Please log in with an authorized identity." : "Your account does not have administrator privileges."}
            </p>
            <div className="space-y-3">
              <button onClick={() => navigate("/login")} className="w-full px-6 py-4 bg-gradient-to-r from-ares-red to-red-800 text-white font-bold text-sm rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_30px_rgba(220,38,38,0.4)]">
                <Lock size={16} className="inline mr-2 -mt-1" /> Sign In with ARES ID
              </button>
              <button onClick={() => navigate("/")} className="w-full px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white font-bold text-sm rounded-xl transition-all">
                Return to Home
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Active Tab Content Renderer ────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case "blog":
        return <BlogEditor editSlug={editPostSlug} onClearEdit={() => setEditPostSlug(null)} userRole={session?.user?.role} />;
      case "event":
        return <EventEditor editId={editEventId} onClearEdit={() => setEditEventId(null)} userRole={session?.user?.role} />;
      case "docs":
        return <DocsEditor editSlug={editDocSlug} onClearEdit={() => setEditDocSlug(null)} userRole={session?.user?.role} />;
      case "manage_blog":
      case "manage_event":
      case "manage_docs":
        return (
          <ContentManager 
            mode={activeTab === "manage_blog" ? "blog" : activeTab === "manage_event" ? "event" : "docs"}
            onEditPost={(slug) => { setEditPostSlug(slug); setActiveTab("blog"); }}
            onEditEvent={(id) => { setEditEventId(id); setActiveTab("event"); }}
            onEditDoc={(slug) => { setEditDocSlug(slug); setActiveTab("docs"); }}
          />
        );
      case "assets":
        return <AssetManager />;
      case "integrations":
        return <IntegrationsManager />;
      case "profile":
        return <ProfileEditor />;
      case "users":
        return isAdmin ? <AdminUsers /> : null;
      case "inquiries":
        return isAdmin ? (
          <>
            <div className="mb-6 pb-6 border-b border-white/5">
              <h2 className="text-2xl font-black text-white flex items-center gap-3"><MessageSquare className="text-ares-red" /> Team Inquiries</h2>
              <p className="text-zinc-500 text-sm mt-1">Review student, mentor, and sponsor applications.</p>
            </div>
            <AdminInquiries />
          </>
        ) : null;
      case "impact_roster":
        return isAdmin ? <MemberImpactOverview /> : null;
      case "badges":
        return isAdmin ? (
          <>
            <div className="mb-6 pb-6 border-b border-white/5">
              <h2 className="text-2xl font-black text-white flex items-center gap-3">Badge Management</h2>
              <p className="text-zinc-500 text-sm mt-1">Define platform-wide awards and distribute them to members.</p>
            </div>
            <BadgeManager />
          </>
        ) : null;
      case "inquiries":
        return isAdmin ? (
          <>
            <div className="mb-6 pb-6 border-b border-white/5">
              <h2 className="text-2xl font-black text-white flex items-center gap-3"><MessageSquare className="text-ares-cyan" /> Inquiries & Applications</h2>
              <p className="text-zinc-500 text-sm mt-1">Review student applications, mentor requests, and sponsor inquiries.</p>
            </div>
            <AdminInquiries />
          </>
        ) : null;
      case "logistics":
        return (
          <>
            <div className="mb-6 pb-6 border-b border-white/5">
              <h2 className="text-2xl font-black text-white flex items-center gap-3"><Utensils className="text-ares-red" /> Team Logistics Summary</h2>
              <p className="text-zinc-500 text-sm mt-1">Aggregated dietary data for event planning and team management.</p>
            </div>
            <DietarySummary />
          </>
        );
      case "analytics":
        return (
          <>
            <div className="mb-6 pb-6 border-b border-white/5">
              <h2 className="text-2xl font-black text-white flex items-center gap-3"><BarChart3 className="text-ares-cyan" /> Community Engagement</h2>
              <p className="text-zinc-500 text-sm mt-1">Real-time data on documentation and blog utility.</p>
            </div>
            <AnalyticsDashboard />
          </>
        );
      case "sponsors":
        return (
          <>
            <div className="mb-6 pb-6 border-b border-white/5">
              <h2 className="text-2xl font-black text-white flex items-center gap-3"><Gem className="text-ares-cyan" /> Sponsor Recognition</h2>
              <p className="text-zinc-500 text-sm mt-1">Manage and showcase our funding partners.</p>
            </div>
            <SponsorEditor />
          </>
        );
      case "outreach":
        return (
          <>
            <div className="mb-6 pb-6 border-b border-white/5">
              <h2 className="text-2xl font-black text-white flex items-center gap-3"><Target className="text-ares-cyan" /> Community Impact Tracker</h2>
              <p className="text-zinc-500 text-sm mt-1">Log outreach events and student service hours.</p>
            </div>
            <OutreachTracker />
          </>
        );
      case "legacy":
        return (
          <>
            <div className="mb-6 pb-6 border-b border-white/5">
              <h2 className="text-2xl font-black text-white flex items-center gap-3"><Trophy className="text-ares-gold" /> Team Legacy Archive</h2>
              <p className="text-zinc-500 text-sm mt-1">Manage seasonal achievements and awards.</p>
            </div>
            <AwardEditor />
          </>
        );
      case "locations":
        return (
          <>
            <div className="mb-6 pb-6 border-b border-white/5">
              <h2 className="text-2xl font-black text-white flex items-center gap-3"><MapPin className="text-ares-red" /> Team Locations</h2>
              <p className="text-zinc-500 text-sm mt-1">Manage physical meeting points, shops, and outreach sites.</p>
            </div>
            <LocationsManager />
          </>
        );
      default:
        return null;
    }
  };

  const handleNavigate = (tab: TabState) => {
    setActiveTab(tab); 
    setIsSidebarOpen(false); 
    if (tab === "blog") setEditPostSlug(null);
    if (tab === "event") setEditEventId(null);
    if (tab === "docs") setEditDocSlug(null);
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {isAvatarEditorOpen && (
        <Suspense fallback={null}>
          <AvatarEditor currentImage={session?.user?.image as string | null} onClose={() => setIsAvatarEditorOpen(false)} />
        </Suspense>
      )}

      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 w-full h-16 bg-black/80 backdrop-blur-xl border-b border-white/10 z-40 flex items-center justify-between px-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ares-red to-red-900 border border-red-500/30 flex items-center justify-center">
            <AppWindow size={16} className="text-white" />
          </div>
          <h1 className="text-lg font-black tracking-tighter text-white">ARES<span className="text-zinc-500 font-bold">Workspace</span></h1>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 transition-colors">
          <Menu size={20} />
        </button>
      </div>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div role="presentation" className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed md:relative top-0 left-0 z-50 w-72 h-full bg-obsidian border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        {/* Profile Header */}
        <div className="p-6 border-b border-white/5 shrink-0 flex flex-col gap-4">
          <div className="flex items-center justify-between md:hidden pb-2 mb-2 border-b border-white/5">
             <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Navigation Menu</span>
             <button className="text-zinc-400 p-1 bg-white/5 rounded-md hover:text-white" onClick={() => setIsSidebarOpen(false)}><X size={16}/></button>
          </div>
          
          <div className="flex items-center gap-3 relative">
            <button 
              onClick={() => setIsAvatarEditorOpen(true)}
              className="relative group block w-12 h-12 rounded-2xl overflow-hidden border border-white/10 shadow-lg hover:border-ares-red transition-all focus:outline-none shrink-0"
              title="Customize Identity"
            >
              <img src={(session?.user?.image as string) || `https://api.dicebear.com/9.x/bottts/svg?seed=${session?.user?.id}`} alt="Profile" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Edit3 size={14} className="text-white" />
              </div>
            </button>
            <div className="flex flex-col min-w-0">
              <span className="text-white text-sm font-bold truncate tracking-tight">{(session?.user?.name as string) || "ARES Member"}</span>
              <span className="text-ares-gold text-[10px] font-black uppercase tracking-widest truncate">{role} • {memberType}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto py-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          
          {/* PERSONAL */}
          <div>
            <h4 className="text-[10px] uppercase font-black tracking-widest text-zinc-600 mb-2 px-6">Personal</h4>
            <div className="space-y-1 px-3">
              <NavButton tab="profile" icon={User} label="My Profile" activeTab={activeTab} onNavigate={handleNavigate} />
            </div>
          </div>

          {/* AUTHORING */}
          {isAuthorized && (
            <div>
              <h4 className="text-[10px] uppercase font-black tracking-widest text-zinc-600 mb-2 px-6 flex items-center gap-2"><PlusCircle size={12} className="text-ares-red" /> Quick Create</h4>
              <div className="space-y-1 px-3">
                <NavButton tab="blog" icon={PenTool} label={editPostSlug ? "Edit Post (Active)" : "New Blog Post"} activeTab={activeTab} onNavigate={handleNavigate} />
                <NavButton tab="event" icon={Calendar} label={editEventId ? "Edit Event (Active)" : "New Event"} activeTab={activeTab} onNavigate={handleNavigate} />
                <NavButton tab="docs" icon={Book} label={editDocSlug ? "Edit Doc (Active)" : "New Document"} activeTab={activeTab} onNavigate={handleNavigate} />
              </div>
            </div>
          )}

          {/* CONTENT HUB */}
          {isAuthorized && (
            <div>
              <h4 className="text-[10px] uppercase font-black tracking-widest text-zinc-600 mb-2 px-6">Content Hub</h4>
              <div className="space-y-1 px-3">
                <div className="flex items-center gap-3 px-4 py-2 mt-1 mb-1 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                  <Folders size={14} className="text-zinc-600" /> Database Manager
                </div>
                <NavButton tab="manage_blog" label="1. Blogs / News" sub={true} activeTab={activeTab} onNavigate={handleNavigate} />
                <NavButton tab="manage_event" label="2. Calendar Events" sub={true} activeTab={activeTab} onNavigate={handleNavigate} />
                <NavButton tab="manage_docs" label="3. ARESLib Docs" sub={true} activeTab={activeTab} onNavigate={handleNavigate} />
                
                <div className="h-px bg-white/5 my-3 mx-4" />
                <NavButton tab="assets" icon={Image} label="Media Gallery" activeTab={activeTab} onNavigate={handleNavigate} />
                <NavButton tab="locations" icon={MapPin} label="Location Manager" activeTab={activeTab} onNavigate={handleNavigate} />
                <NavButton tab="legacy" icon={Trophy} label="Trophy Case Archive" activeTab={activeTab} onNavigate={handleNavigate} />
              </div>
            </div>
          )}

          {/* OPERATIONS */}
          {isAuthorized && (
            <div>
              <h4 className="text-[10px] uppercase font-black tracking-widest text-zinc-600 mb-2 px-6">Operations</h4>
              <div className="space-y-1 px-3">
                <NavButton tab="outreach" icon={Target} label="Outreach Tracker" activeTab={activeTab} onNavigate={handleNavigate} />
                <NavButton tab="locations" icon={MapPin} label="Meeting Locations" activeTab={activeTab} onNavigate={handleNavigate} />
                <NavButton tab="sponsors" icon={Gem} label="Sponsors & Funding" activeTab={activeTab} onNavigate={handleNavigate} />
                <NavButton tab="analytics" icon={BarChart3} label="Analytics" activeTab={activeTab} onNavigate={handleNavigate} />
              </div>
            </div>
          )}

          {/* ADMINISTRATION */}
          {(isAdmin || canSeeLogistics) && (
            <div>
              <h4 className="text-[10px] uppercase font-black tracking-widest text-ares-red/80 mb-2 px-6">Administration</h4>
              <div className="space-y-1 px-3">
                {isAdmin && <NavButton tab="inquiries" icon={MessageSquare} label="Inquiries Hub" activeTab={activeTab} onNavigate={handleNavigate} />}
                {isAdmin && <NavButton tab="users" icon={Users} label="User Roles & Sync" activeTab={activeTab} onNavigate={handleNavigate} />}
                {isAdmin && <NavButton tab="impact_roster" icon={Trophy} label="Impact & Roster" activeTab={activeTab} onNavigate={handleNavigate} />}
                {isAdmin && <NavButton tab="badges" icon={Award} label="Badges & Awards" activeTab={activeTab} onNavigate={handleNavigate} />}
                {isAdmin && <NavButton tab="integrations" icon={Settings} label="System Integrations" activeTab={activeTab} onNavigate={handleNavigate} />}
                {canSeeLogistics && <NavButton tab="logistics" icon={Utensils} label="Dietary / Logistics" activeTab={activeTab} onNavigate={handleNavigate} />}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 shrink-0 bg-black/20">
          <button 
              onClick={() => { fetch('/api/auth/sign-out', { method: 'POST' }).then(() => { window.location.href = '/'; }); }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all text-xs font-black uppercase tracking-wider"
            >
              <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto relative bg-zinc-950">
        {/* Ambient Desktop Background effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-ares-red/5 blur-[150px] rounded-full pointer-events-none opacity-60 mix-blend-screen" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-ares-gold/5 blur-[150px] rounded-full pointer-events-none opacity-40 mix-blend-screen" />
        
        <div className="max-w-[1500px] mx-auto w-full min-h-full flex flex-col p-4 pt-24 md:p-8 relative z-10">
          
          {/* Main Desktop Header */}
          <div className="hidden md:flex items-center justify-between mb-8">
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-gradient-to-br from-ares-red to-red-900 rounded-2xl flex items-center justify-center shadow-lg shadow-ares-red/20 border border-red-500/30">
                 <AppWindow className="text-white" size={24} />
               </div>
               <div>
                  <h1 className="text-3xl font-black tracking-tight text-white mb-1 leading-none">
                    ARES Workspace
                  </h1>
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Internal Systems Portal</p>
               </div>
             </div>
             
             {isUnverified && (
               <span className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold rounded-full uppercase tracking-wider animate-pulse flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                 <ShieldAlert size={14} /> Locked: View Only
               </span>
             )}
          </div>

          <div className="flex-1 w-full bg-obsidian border border-white/5 rounded-3xl md:rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="w-full h-full p-4 sm:p-6 md:p-10 overflow-y-auto"
              >
                <Suspense fallback={<TabLoader />}>
                  {renderTabContent()}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer inside content area */}
          <div className="mt-6 flex items-center justify-between text-zinc-600 text-[10px] font-bold uppercase tracking-widest px-4 pb-4">
             <span>ARES Robotics 23247</span>
             <span>D1 Edge Server</span>
          </div>
        </div>
      </main>
    </div>
  );
}
