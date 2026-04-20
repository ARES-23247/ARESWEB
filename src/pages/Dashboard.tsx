import BlogEditor from "@/components/BlogEditor";
import EventEditor from "@/components/EventEditor";
import ContentManager from "@/components/ContentManager";
import AssetManager from "@/components/AssetManager";
import DocsEditor from "@/components/DocsEditor";
import IntegrationsManager from "@/components/IntegrationsManager";
import AvatarEditor from "@/components/AvatarEditor";
import ProfileEditor from "@/components/ProfileEditor";
import AdminUsers from "@/components/AdminUsers";
import DietarySummary from "@/components/DietarySummary";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import SponsorEditor from "@/components/SponsorEditor";
import OutreachTracker from "@/components/OutreachTracker";
import AwardEditor from "@/components/AwardEditor";
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PenTool, Calendar, Book, Image, LayoutGrid, PlusCircle, Edit3, Settings, ShieldAlert, Lock, RefreshCw, LogOut, User, Users, Utensils, BarChart3, Gem, Target, Trophy } from "lucide-react";
/* Better Auth imports removed since we use /api/auth-check directly */

type TabState = "blog" | "event" | "docs" | "manage_blog" | "manage_event" | "manage_docs" | "assets" | "integrations" | "profile" | "users" | "logistics" | "analytics" | "sponsors" | "outreach" | "legacy";

/* Compute localhost bypass at module level so it can seed initial state
   without triggering a synchronous setState inside an effect body. */
const isLocalDev =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialDoc = searchParams.get("editDoc");

  // ── Custom Enriched Authentication ─────────────────────────────────
  const [enrichedSession, setEnrichedSession] = useState<{user: Record<string, unknown>, authenticated: boolean} | null>(null);
  const [isPending, setIsPending] = useState(true);

  const [activeTab, setActiveTab] = useState<TabState>(initialDoc ? "docs" : "profile");
  const [editPostSlug, setEditPostSlug] = useState<string | null>(null);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editDocSlug, setEditDocSlug] = useState<string | null>(initialDoc);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth-check")
      .then(async (res) => {
        if (!res.ok) throw new Error("Not Authenticated");
        return res.json();
      })
      .then((data) => {
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
      <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-ares-red/10 blur-[120px] rounded-full pointer-events-none opacity-50" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 z-10"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw size={48} className="text-ares-gold" />
          </motion.div>
          <p className="text-zinc-400 text-lg font-medium">Verifying ARES Session...</p>
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
      <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-ares-red/10 blur-[120px] rounded-full pointer-events-none opacity-50" />
        <div className="absolute top-40 -left-64 w-96 h-96 bg-ares-gold/10 blur-[120px] rounded-full pointer-events-none opacity-40" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-lg w-full mx-4"
        >
          <div className="bg-black/60 backdrop-blur-2xl rounded-3xl border border-red-500/20 p-10 md:p-14 shadow-2xl text-center">
            <div className="mb-8 flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-ares-red/30 to-red-900/20 border border-red-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.3)]">
                <ShieldAlert size={40} className="text-red-400" />
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
              Restricted Access
            </h1>
            <p className="text-zinc-400 text-base leading-relaxed mb-8">
              {!session ? "The ARES Dashboard is protected by Internal Authentication. Please log in with an authorized identity to continue." : "Your account does not have administrator privileges. Please contact the lead engineer if this is an error."}
            </p>

            <div className="space-y-4">
              <button
                onClick={() => navigate("/login")}
                className="group flex items-center justify-center gap-3 w-full px-6 py-4 bg-gradient-to-r from-ares-red to-red-700 hover:from-red-600 hover:to-red-800 text-white font-bold text-base rounded-2xl transition-all duration-300 shadow-lg hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
              >
                <Lock size={18} />
                Sign In with ARES ID
              </button>

              <button
                onClick={() => navigate("/")}
                className="w-full px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
              >
                Return to Home
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5">
              <p className="text-zinc-600 text-xs text-balance">
                Protected by Better Auth &middot; ARES 23247 Internal Systems
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 py-8 relative overflow-hidden">
      {isAvatarEditorOpen && <AvatarEditor currentImage={session?.user?.image as string | null} onClose={() => setIsAvatarEditorOpen(false)} />}
      
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-ares-red/10 blur-[120px] rounded-full pointer-events-none opacity-50" />
      <div className="absolute top-40 -left-64 w-96 h-96 bg-ares-gold/10 blur-[120px] rounded-full pointer-events-none opacity-40" />

      <div className="w-full max-w-5xl mx-auto px-6 py-12 md:py-24 relative z-10">
        <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h3 className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-2 flex items-center gap-2">
              <LayoutGrid size={16} className="text-ares-gold" />
              Internal Systems
            </h3>
            <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500 tracking-tighter mb-4 pb-1">
              ARES <span className="text-transparent bg-clip-text bg-gradient-to-br from-ares-red to-red-900">Dashboard</span>
            </h1>
            <p className="text-zinc-400 max-w-2xl text-balance leading-relaxed">
              Manage D1 Database content natively at the Cloudflare Edge. Draft engineering blogs, schedule events, and maintain team documentation.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 pr-3 pl-1 py-1 rounded-full shadow-lg backdrop-blur-sm">
              <button 
                onClick={() => setIsAvatarEditorOpen(true)}
                className="relative group block w-8 h-8 rounded-full overflow-hidden border border-white/20 hover:border-ares-gold transition-colors focus:outline-none"
                title="Customize Identity"
              >
                <img 
                  src={session?.user?.image || `https://api.dicebear.com/9.x/bottts/svg?seed=${session?.user?.id}`} 
                  alt="Profile" 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Edit3 size={12} className="text-white" />
                </div>
              </button>
              <div className="flex flex-col">
                <span className="text-zinc-300 text-xs font-bold leading-tight">{session?.user?.name || "ARES User"}</span>
                <span className="text-zinc-500 text-[10px] font-medium leading-tight">{session?.user?.email}</span>
              </div>
            </div>
            <button 
              onClick={() => {
                fetch('/api/auth/sign-out', { method: 'POST' }).then(() => {
                  window.location.href = '/';
                });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-zinc-400 hover:text-red-400 text-xs font-bold rounded-xl transition-all"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>

        {isUnverified && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 p-6 bg-ares-red/10 border border-ares-red/30 rounded-[2rem] relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-ares-red/5 blur-3xl rounded-full -mr-20 -mt-20 group-hover:bg-ares-red/10 transition-colors duration-500" />
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-ares-red/20 to-red-900/40 border border-ares-red/30 flex items-center justify-center shadow-xl flex-shrink-0">
                <ShieldAlert size={32} className="text-ares-red" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-white tracking-tight mb-1">Account Verification Pending</h3>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
                  Your identity has been registered, but you are currently in a <span className="text-ares-red font-bold">view-only</span> state. 
                  A team administrator must verify your membership before you can post comments, sign up for events, or appear on the public roster.
                </p>
              </div>
              <div className="flex flex-col items-center md:items-end gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ares-red/60 px-3 py-1 border border-ares-red/20 rounded-full bg-ares-red/5">Status: Locked</span>
                <p className="text-[10px] text-zinc-600 font-medium">Auto-refreshing session...</p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {/* Create New Panel (CMS authors/admins only) */}
          {isAuthorized && (
          <div className="bg-black/40 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/20 blur-3xl rounded-full" />
            <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 z-10">
              <PlusCircle size={14} /> Create Content
            </h4>
            <div className="flex flex-wrap gap-3 z-10">
              <button
                onClick={() => setActiveTab("blog")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold ${activeTab === "blog" ? "bg-gradient-to-b from-ares-gold/20 to-ares-gold/5 border border-ares-gold/50 text-ares-gold shadow-[0_0_20px_rgba(255,191,0,0.15)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <PenTool size={16} />
                {editPostSlug ? "Edit Blog" : "Blog Post"}
              </button>
              <button
                onClick={() => setActiveTab("event")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red ${activeTab === "event" ? "bg-gradient-to-b from-ares-red/20 to-ares-red/5 border border-ares-red/50 text-ares-red shadow-[0_0_20px_rgba(192,0,0,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Calendar size={16} />
                {editEventId ? "Edit Event" : "Event"}
              </button>
              <button
                onClick={() => setActiveTab("docs")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "docs" ? "bg-gradient-to-b from-ares-cyan/20 to-ares-cyan/5 border border-ares-cyan/50 text-ares-cyan shadow-[0_0_20px_rgba(0,183,235,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Book size={16} />
                {editDocSlug ? "Edit Doc" : "Document"}
              </button>
            </div>
          </div>
          )}

          {/* Manage Current Panel (CMS authors/admins only) */}
          {isAuthorized && (
          <div className="bg-black/40 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-bronze/20 blur-3xl rounded-full" />
            <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 z-10">
              <Edit3 size={14} /> Manage Assets
            </h4>
            <div className="flex flex-wrap gap-3 z-10">
              <button
                onClick={() => setActiveTab("manage_blog")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${activeTab === "manage_blog" ? "bg-white/10 border border-white/20 text-white shadow-lg" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <PenTool size={16} />
                Blogs
              </button>
              <button
                onClick={() => setActiveTab("manage_event")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${activeTab === "manage_event" ? "bg-white/10 border border-white/20 text-white shadow-lg" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Calendar size={16} />
                Events
              </button>
              <button
                onClick={() => setActiveTab("manage_docs")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${activeTab === "manage_docs" ? "bg-white/10 border border-white/20 text-white shadow-lg" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Book size={16} />
                <span className="flex items-center"><span className="text-ares-red normal-case">ARES</span><span className="text-white normal-case">Lib</span></span>
              </button>
              <button
                onClick={() => setActiveTab("assets")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-bronze ${activeTab === "assets" ? "bg-gradient-to-b from-ares-bronze/20 to-ares-bronze/5 border border-ares-bronze/50 text-ares-bronze shadow-[0_0_20px_rgba(205,127,50,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Image size={16} />
                Gallery
              </button>
              <button
                onClick={() => setActiveTab("integrations")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${activeTab === "integrations" ? "bg-gradient-to-b from-purple-500/20 to-purple-500/5 border border-purple-500/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Settings size={16} />
                Integrations
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "analytics" ? "bg-gradient-to-b from-ares-cyan/20 to-ares-cyan/5 border border-ares-cyan/50 text-ares-cyan shadow-[0_0_20px_rgba(0,183,235,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <BarChart3 size={16} />
                Analytics
              </button>
              <button
                onClick={() => setActiveTab("sponsors")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "sponsors" ? "bg-gradient-to-b from-ares-cyan/20 to-ares-cyan/5 border border-ares-cyan/50 text-ares-cyan shadow-[0_0_20px_rgba(0,183,235,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Gem size={16} />
                Sponsors
              </button>
              <button
                onClick={() => setActiveTab("outreach")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "outreach" ? "bg-gradient-to-b from-ares-cyan/20 to-ares-cyan/5 border border-ares-cyan/50 text-ares-cyan shadow-[0_0_20px_rgba(0,183,235,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Target size={16} />
                Outreach (Impact)
              </button>
              <button
                onClick={() => setActiveTab("legacy")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "legacy" ? "bg-gradient-to-b from-ares-cyan/20 to-ares-cyan/5 border border-ares-cyan/50 text-ares-cyan shadow-[0_0_20px_rgba(0,183,235,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Trophy size={16} />
                Trophy Case
              </button>
            </div>
          </div>
          )}

          {/* Community Panel (all authenticated users) */}
          <div className={`bg-black/40 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden flex flex-col ${!isAuthorized ? "md:col-span-2" : ""}`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
            <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 z-10">
              <User size={14} /> Community
            </h4>
            <div className="flex flex-wrap gap-3 z-10">
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${activeTab === "profile" ? "bg-gradient-to-b from-emerald-500/20 to-emerald-500/5 border border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <User size={16} />
                My Profile
              </button>
              {isAdmin && (
                <button
                  onClick={() => setActiveTab("users")}
                  className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${activeTab === "users" ? "bg-gradient-to-b from-orange-500/20 to-orange-500/5 border border-orange-500/50 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
                >
                  <Users size={16} />
                  Users
                </button>
              )}
              {canSeeLogistics && (
                <button
                  onClick={() => setActiveTab("logistics")}
                  className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red ${activeTab === "logistics" ? "bg-gradient-to-b from-ares-red/20 to-ares-red/5 border border-ares-red/50 text-ares-red shadow-[0_0_20px_rgba(220,38,38,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
                >
                  <Utensils size={16} />
                  Logistics
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="w-full">
          <AnimatePresence mode="wait">
            {activeTab === "blog" && (
              <motion.div 
                key="blog"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-zinc-800 flex flex-col bg-zinc-900 shadow-2xl"
              >
                <BlogEditor editSlug={editPostSlug} onClearEdit={() => setEditPostSlug(null)} />
              </motion.div>
            )}

            {activeTab === "event" && (
              <motion.div 
                key="event"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-ares-red/30 flex flex-col bg-zinc-900 relative shadow-2xl"
              >
                <div className="absolute inset-0 bg-ares-red/5 rounded-3xl pointer-events-none mix-blend-screen" />
                <div className="relative z-10 w-full h-full">
                  <EventEditor editId={editEventId} onClearEdit={() => setEditEventId(null)} />
                </div>
              </motion.div>
            )}

            {activeTab === "docs" && (
              <motion.div 
                key="docs"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-ares-cyan/30 flex flex-col bg-zinc-900 shadow-2xl relative"
              >
                <div className="absolute inset-0 bg-ares-cyan/5 rounded-3xl pointer-events-none mix-blend-screen" />
                <div className="relative z-10 w-full h-full">
                  <DocsEditor editSlug={editDocSlug} onClearEdit={() => setEditDocSlug(null)} />
                </div>
              </motion.div>
            )}

            {(activeTab === "manage_blog" || activeTab === "manage_event" || activeTab === "manage_docs") && (
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className={`w-full glass-card rounded-3xl p-6 md:p-10 border flex flex-col bg-zinc-900 shadow-2xl ${
                  activeTab === "manage_blog" ? "border-ares-gold/30" : 
                  activeTab === "manage_event" ? "border-ares-red/30" : 
                  "border-ares-cyan/30"
                }`}
              >
                <ContentManager 
                  mode={activeTab === "manage_blog" ? "blog" : activeTab === "manage_event" ? "event" : "docs"}
                  onEditPost={(slug) => { setEditPostSlug(slug); setActiveTab("blog"); }}
                  onEditEvent={(id) => { setEditEventId(id); setActiveTab("event"); }}
                  onEditDoc={(slug) => { setEditDocSlug(slug); setActiveTab("docs"); }}
                />
              </motion.div>
            )}

            {activeTab === "assets" && (
              <motion.div 
                key="assets"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-ares-bronze/30 flex flex-col bg-zinc-900 shadow-2xl"
              >
                <AssetManager />
              </motion.div>
            )}

            {activeTab === "integrations" && (
              <motion.div 
                key="integrations"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-purple-500/30 flex flex-col bg-zinc-900 shadow-2xl"
              >
                <IntegrationsManager />
              </motion.div>
            )}

            {activeTab === "profile" && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-emerald-500/30 flex flex-col bg-zinc-900 shadow-2xl"
              >
                <ProfileEditor />
              </motion.div>
            )}

            {activeTab === "users" && isAdmin && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-orange-500/30 flex flex-col bg-zinc-900 shadow-2xl"
              >
                <AdminUsers />
              </motion.div>
            )}

            {activeTab === "logistics" && (
              <motion.div 
                key="logistics"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-ares-red/30 flex flex-col bg-zinc-900 shadow-2xl"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-white flex items-center gap-3">
                    <Utensils className="text-ares-red" />
                    Team Logistics Summary
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1">Aggregated data for event planning and team management.</p>
                </div>
                <DietarySummary />
              </motion.div>
            )}

            {activeTab === "analytics" && (
              <motion.div 
                key="analytics"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-ares-cyan/30 flex flex-col bg-zinc-900 shadow-2xl"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-white flex items-center gap-3">
                    <BarChart3 className="text-ares-cyan" />
                    Community Engagement
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1">Real-time data on documentation and blog utility.</p>
                </div>
                <AnalyticsDashboard />
              </motion.div>
            )}

            {activeTab === "sponsors" && (
              <motion.div 
                key="sponsors"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-ares-cyan/30 flex flex-col bg-zinc-900 shadow-2xl"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-white flex items-center gap-3">
                    <Gem className="text-ares-cyan" />
                    Sponsor Recognition
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1">Manage and showcase our funding partners.</p>
                </div>
                <SponsorEditor />
              </motion.div>
            )}

            {activeTab === "outreach" && (
              <motion.div 
                key="outreach"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-ares-cyan/30 flex flex-col bg-zinc-900 shadow-2xl"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-white flex items-center gap-3">
                    <Target className="text-ares-cyan" />
                    Community Impact Tracker
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1">Log outreach events and student service hours.</p>
                </div>
                <OutreachTracker />
              </motion.div>
            )}

            {activeTab === "legacy" && (
              <motion.div 
                key="legacy"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-ares-cyan/30 flex flex-col bg-zinc-900 shadow-2xl"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-white flex items-center gap-3">
                    <Trophy className="text-ares-gold" />
                    Team Legacy Archive
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1">Manage seasonal achievements and awards.</p>
                </div>
                <AwardEditor />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
