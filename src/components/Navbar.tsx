import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Search, LayoutDashboard, LogIn, Bell, Check, X, ChevronDown, Users, Trophy, BookOpen, ShoppingBag, Calendar as CalendarIcon, GraduationCap } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";

import { GreekMeander } from "./GreekMeander";
import { useDashboardSession } from "../hooks/useDashboardSession";
import { useMergedNotifications, MergedNotification } from "../hooks/useMergedNotifications";
import { useUIStore } from "../store/uiStore";

export default function Navbar() {
  const { setSidebarOpen } = useUIStore();
  const [open, setOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const navigate = useNavigate();
  const { session, isPending, permissions } = useDashboardSession();

  const isSignedIn = !isPending && session?.authenticated;
  const userImage = session?.user?.image;
   
  const { notifications, unreadCount } = useMergedNotifications(session, permissions);
  
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const navbarRef = useRef<HTMLElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
      if (navbarRef.current && !navbarRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle Escape key to close everything
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveDropdown(null);
        setShowNotifs(false);
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
      if (!res.ok) throw new Error("Failed to mark all read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markRead = useMutation({
    mutationFn: async (data: { params: { id: string } }) => {
      const res = await fetch(`/api/notifications/${data.params.id}/read`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to mark read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const deleteNotif = useMutation({
    mutationFn: async (data: { params: { id: string } }) => {
      const res = await fetch(`/api/notifications/${data.params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete notification");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const toggleDropdown = (name: string) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  return (
    <nav ref={navbarRef} role="navigation" aria-label="Main Navigation" className="fixed top-0 left-0 w-full z-50 bg-obsidian shadow-2xl px-6 pt-4 pb-4 transition-all duration-500 overflow-visible border-t-4 border-ares-bronze">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-24 focus:left-6 bg-ares-red text-white px-6 py-3 ares-cut-sm font-bold z-modal shadow-2xl border border-white/20 transition-all"
      >
        Skip to Main Content
      </a>
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <GreekMeander variant="thin" opacity="opacity-40" className="absolute top-0 left-0" />
      </div>
      <div className="flex items-center justify-between relative z-10">
        <button 
          onClick={() => navigate("/")} 
          className="text-2xl font-bold tracking-tighter text-white flex items-center gap-2 font-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1"
          aria-label="ARES 23247 Home"
        >
          ARES <span className="bg-ares-red text-white px-2 py-0.5 ares-cut-sm shadow-inner font-bold">23247</span>
        </button>

        <div className="hidden md:flex items-center gap-6 text-sm font-bold uppercase tracking-widest">
          {/* Team Dropdown */}
          <div className="relative py-2 group/dropdown">
            <button 
              onClick={() => toggleDropdown("team")}
              aria-haspopup="true"
              aria-expanded={activeDropdown === "team"}
              className={`flex items-center gap-1.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1 ${activeDropdown === "team" ? "text-ares-gold" : "text-white hover:text-ares-gold"}`}
            >
              Team <ChevronDown size={14} className={`transition-transform duration-300 ${activeDropdown === "team" ? "rotate-180" : "group-focus-within/dropdown:rotate-180"}`} />
            </button>
            <div 
              className={`absolute top-[calc(100%-4px)] left-0 w-48 bg-obsidian/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-lg p-1 transition-all duration-300 z-50 opacity-0 translate-y-2 pointer-events-none group-hover/dropdown:opacity-100 group-hover/dropdown:translate-y-0 group-hover/dropdown:pointer-events-auto group-focus-within/dropdown:opacity-100 group-focus-within/dropdown:translate-y-0 group-focus-within/dropdown:pointer-events-auto ${activeDropdown === "team" ? "!opacity-100 !translate-y-0 !pointer-events-auto" : ""}`}
            >
              <Link to="/about" onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 text-[11px] text-marble hover:text-white hover:bg-white/5 rounded-md transition-colors group/item focus-visible:outline-none focus-visible:bg-white/10">
                <Users size={14} className="text-ares-cyan group-hover/item:scale-110 transition-transform" />
                Who We Are
              </Link>
              <Link to="/seasons" onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 text-[11px] text-marble hover:text-white hover:bg-white/5 rounded-md transition-colors group/item focus-visible:outline-none focus-visible:bg-white/10">
                <Trophy size={14} className="text-ares-gold group-hover/item:scale-110 transition-transform" />
                Seasons
              </Link>
              <Link to="/outreach" onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 text-[11px] text-marble hover:text-white hover:bg-white/5 rounded-md transition-colors group/item focus-visible:outline-none focus-visible:bg-white/10">
                <Users size={14} className="text-ares-red group-hover/item:scale-110 transition-transform" />
                Our Impact
              </Link>
              <div className="my-1 h-px bg-white/10" />
              <Link to="/blog" onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-4 py-3 text-[11px] text-marble hover:text-white hover:bg-white/5 rounded-md transition-colors group/item focus-visible:outline-none focus-visible:bg-white/10">
                <BookOpen size={14} className="text-ares-gold group-hover/item:scale-110 transition-transform" />
                Team Blog
              </Link>
            </div>
          </div>

          <Link to="/events" className="flex items-center gap-2 text-white hover:text-ares-gold transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
            <CalendarIcon size={14} /> Calendar
          </Link>



          <Link to="/store" className="flex items-center gap-2 text-white hover:text-ares-gold transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
            <ShoppingBag size={14} /> Store
          </Link>

          <Link to="/academy" aria-label="ARES Academy" className="h-9 hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ares-cut-sm overflow-hidden flex items-center shadow-xl group/acad border border-white/5 bg-white/5">
            <span className="bg-ares-red h-full px-3 flex items-center text-[10px] font-heading font-black uppercase text-white tracking-[0.15em] border-r border-white/10 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.2)]">ARES</span>
            <span className="text-white h-full px-3 flex items-center text-[10px] font-heading font-bold uppercase tracking-[0.2em] group-hover/acad:bg-white/10 transition-colors"><GraduationCap size={12} className="mr-1" />ACADEMY</span>
          </Link>

          <Link to="/docs" aria-label="ARES Documentation Library" className="h-9 hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ares-cut-sm overflow-hidden flex items-center shadow-xl group/lib border border-white/5 bg-white/5">
            <span className="bg-ares-red h-full px-3 flex items-center text-[10px] font-heading font-black uppercase text-white tracking-[0.15em] border-r border-white/10 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.2)]">ARES</span>
            <span className="text-white h-full px-3 flex items-center text-[10px] font-heading font-bold uppercase tracking-[0.2em] group-hover/lib:bg-white/10 transition-colors">LIB</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            aria-label="Open Command Palette"
            className="flex items-center gap-2 px-3 h-9 ares-cut-sm bg-white/10 hover:bg-white/20 text-marble/90 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan border border-white/10"
          >
            <Search size={14} aria-hidden="true" />
            <span className="text-xs sm:text-xs font-mono flex items-center gap-2 whitespace-nowrap">
              Search... 
              <span className="hidden lg:flex items-center gap-1 opacity-60">
                <kbd className="bg-black/40 text-white px-1.5 py-0.5 rounded border border-white/20 leading-none">Ctrl</kbd>
                <kbd className="bg-black/40 text-white px-1.5 py-0.5 rounded border border-white/20 leading-none">K</kbd>
              </span>
            </span>
          </button>
          {isSignedIn && (
              <div className="relative" ref={notifRef}>
                <button 
                  onClick={() => setShowNotifs(!showNotifs)}
                className="relative flex items-center justify-center h-9 w-9 ares-cut-sm bg-white/5 hover:bg-white/10 border border-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                aria-label="Notifications"
              >
                <Bell size={18} className="text-white" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ares-red opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-ares-danger text-[9px] font-bold text-white items-center justify-center">
                      {unreadCount}
                    </span>
                  </span>
                )}
              </button>
              
              {showNotifs && (
                <div className="absolute top-12 right-0 w-80 bg-obsidian border border-white/10 shadow-2xl ares-cut-sm overflow-hidden flex flex-col z-[200]">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20">
                    <h3 className="text-sm font-bold text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={() => markAllRead.mutate()}
                        className="text-xs text-ares-gold hover:text-white flex items-center gap-1"
                      >
                        <Check size={12} /> Mark Read
                      </button>
                    )}
                  </div>
                  <ul className="flex-1 overflow-y-auto max-h-96 w-full list-none p-0 m-0">
                    {notifications.length === 0 ? (
                      <li className="px-4 py-6 text-center text-sm text-marble/50">
                        No notifications yet.
                      </li>
                    ) : (
                      notifications.map((n: MergedNotification) => (
                        <li key={n.id} className="relative group/notif">
                          <div 
                            role="button"
                            tabIndex={0}
                            className={`px-4 py-3 border-b border-white/5 flex flex-col gap-1 hover:bg-white/5 cursor-pointer focus:bg-white/5 focus:outline-none focus:ring-1 focus:ring-ares-cyan/50 ${n.is_read ? 'opacity-60' : 'bg-ares-red/5'}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();

                                if (!n.is_read && !n.is_inquiry) markRead.mutate({ params: { id: n.id } });
                                if (n.link) navigate(n.link);
                                setShowNotifs(false);
                              }
                            }}
                            onClick={() => {
                              
                              if (!n.is_read && !n.is_inquiry) markRead.mutate({ params: { id: n.id } });
                              if (n.link) navigate(n.link);
                              setShowNotifs(false);
                            }}
                          >
                          <div className="flex justify-between items-start gap-2">
                             <span className="text-sm font-bold text-white pr-4">{n.title}</span>
                             {!n.is_read && <span className="h-2 w-2 rounded-full bg-ares-red flex-shrink-0 mt-1"></span>}
                          </div>
                          <span className="text-xs text-marble/90 line-clamp-2 pr-4">{n.message}</span>
                          </div>
                          {!n.is_inquiry && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotif.mutate({ params: { id: n.id } });
                              }}
                              className="absolute top-2 right-2 p-1 text-marble/60 hover:text-ares-red opacity-0 group-hover/notif:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:text-ares-red"
                              aria-label="Delete notification"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
          {isSignedIn && (
            <Link to="/dashboard" className="relative flex items-center gap-2 px-3 h-9 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm transition-all group" aria-label="Dashboard">
              <img 
                src={userImage || `https://api.dicebear.com/9.x/bottts/svg?seed=${session?.user?.id}`} 
                alt="" 
                className="w-6 h-6 rounded-full bg-black/40" 
              />
              <span className="text-xs font-bold text-white group-hover:text-white uppercase tracking-wider">Dashboard</span>
            </Link>
          )}
          {!isPending && !isSignedIn && (
            <Link to="/login" className="flex items-center gap-2 px-4 h-9 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-ares-gold/30 ares-cut-sm transition-all group" aria-label="Sign In">
              <LogIn size={14} className="text-ares-gold" />
              <span className="text-xs font-bold text-white group-hover:text-ares-gold uppercase tracking-wider">Internal Portal</span>
            </Link>
          )}
        </div>


        <button 
          onClick={() => {
            if (window.innerWidth < 768) {
              setSidebarOpen(true);
            } else {
              setOpen(!open);
            }
          }} 
          className="md:hidden text-ares-gold w-10 h-10 flex flex-col justify-center items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded transition-colors group"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          {...(open ? { 'aria-expanded': true } : { 'aria-expanded': false })}
        >
          <span className={`w-7 h-1 bg-current block rounded-full transition-all duration-300 ${open ? "rotate-45 translate-y-2.5" : "group-hover:w-8"}`}></span>
          <span className={`w-7 h-1 bg-current block rounded-full transition-opacity duration-300 ${open ? "opacity-0" : "group-hover:w-5"}`}></span>
          <span className={`w-7 h-1 bg-current block rounded-full transition-all duration-300 ${open ? "-rotate-45 -translate-y-2.5" : "group-hover:w-8"}`}></span>
        </button>
      </div>

      {open && (
        <div className="md:hidden mt-4 flex flex-col gap-4 text-sm font-bold uppercase tracking-widest px-2 pb-4 border-t border-white/10 pt-4">
          <button onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('open-command-palette')); }} className="text-left text-ares-gold flex items-center gap-2 mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">
            <Search size={16} aria-hidden="true" /> Command Palette
          </button>
          <div className="flex flex-col gap-6 p-8">
          <Link to="/about" onClick={() => setOpen(false)} className="text-xl font-black text-white italic tracking-tighter">WHO WE ARE</Link>
          <Link to="/seasons" onClick={() => setOpen(false)} className="text-xl font-black text-white italic tracking-tighter">SEASONS</Link>
          <Link to="/outreach" onClick={() => setOpen(false)} className="text-xl font-black text-white italic tracking-tighter">OUTREACH</Link>
          <Link to="/events" onClick={() => setOpen(false)} className="text-xl font-black text-white italic tracking-tighter">CALENDAR</Link>
          <Link to="/blog" onClick={() => setOpen(false)} className="text-xl font-black italic tracking-tighter text-ares-gold">TEAM BLOG</Link>
          <Link to="/academy" onClick={() => setOpen(false)} className="text-xl font-black italic tracking-tighter text-ares-cyan">ARES ACADEMY</Link>
          <Link to="/store" onClick={() => setOpen(false)} className="text-xl font-black text-white italic tracking-tighter">STORE</Link>
          <Link to="/sponsors" onClick={() => setOpen(false)} className="text-xl font-black text-white italic tracking-tighter">SUPPORT US</Link>
        </div>
          {isSignedIn && (
            <Link to="/dashboard" onClick={() => setOpen(false)} className="text-ares-gold hover:text-white flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1 w-max">
              <LayoutDashboard size={16} /> Dashboard
            </Link>
          )}
          {!isPending && !isSignedIn && (
            <Link to="/login" onClick={() => setOpen(false)} className="text-ares-gold hover:text-white flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">
              <LogIn size={16} /> Internal Portal
            </Link>
          )}
          <Link to="/join" onClick={() => setOpen(false)} className="text-marble hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Join Us</Link>
          <Link to="/sponsors" onClick={() => setOpen(false)} className="text-marble hover:text-ares-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Support Us</Link>
          
        </div>

      )}

    </nav>
  );
}
