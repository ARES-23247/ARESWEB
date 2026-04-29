 
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Search, LayoutDashboard, LogIn, Bell, Check, Heart, X } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";



import { GreekMeander } from "./GreekMeander";
import { api } from "../api/client";
import { useDashboardSession } from "../hooks/useDashboardSession";
import { useMergedNotifications, MergedNotification } from "../hooks/useMergedNotifications";
import { useUIStore } from "../store/uiStore";

export default function Navbar() {
  const { setSidebarOpen } = useUIStore();
  const [open, setOpen] = useState(false);

  const navigate = useNavigate();
  const { session, isPending, permissions } = useDashboardSession();

  const isSignedIn = !isPending && session?.authenticated;
  const userImage = session?.user?.image;
   
  // Unused permissions omitted to satisfy ESLint
  
  const { notifications, unreadCount } = useMergedNotifications(session, permissions);
  
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllRead = api.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markRead = api.notifications.markAsRead.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const deleteNotif = api.notifications.deleteNotification.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  return (
    <nav role="navigation" aria-label="Main Navigation" className="fixed top-0 left-0 w-full z-navbar bg-obsidian/85 backdrop-blur-xl shadow-2xl px-6 pt-4 pb-4 transition-all duration-500 overflow-visible border-t-4 border-ares-bronze">
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

        <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest">
          <Link to="/about" className="text-marble hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">About</Link>
          <Link to="/seasons" className="text-marble hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Seasons</Link>
          <Link to="/outreach" className="text-marble hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Outreach</Link>
          <Link to="/events" className="text-marble hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Events</Link>
          <Link to="/blog" className="text-marble hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Blog</Link>
          <Link to="/store" className="text-marble hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Store</Link>
          <Link to="/docs" aria-label="ARES Documentation Library" className="h-9 hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ares-cut-sm overflow-hidden flex items-center shadow-xl group border border-white/5 bg-white/5">
            <span className="bg-ares-red h-full px-3 flex items-center text-xs font-heading font-black uppercase text-white tracking-[0.15em] border-r border-white/10 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.2)]">ARES</span>
            <span className="text-white h-full px-3 flex items-center text-xs font-heading font-bold uppercase tracking-[0.2em] group-hover:bg-white/10 transition-colors">LIB</span>
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
                        onClick={() => markAllRead.mutate({ body: {} })}
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

                                if (!n.is_read && !n.is_inquiry) markRead.mutate({ params: { id: n.id }, body: null });
                                if (n.link) navigate(n.link);
                                setShowNotifs(false);
                              }
                            }}
                            onClick={() => {
                              
                              if (!n.is_read && !n.is_inquiry) markRead.mutate({ params: { id: n.id }, body: null });
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
                                deleteNotif.mutate({ params: { id: n.id }, body: {} });
                              }}
                              className="absolute top-2 right-2 p-1 text-marble/40 hover:text-ares-red opacity-0 group-hover/notif:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:text-ares-red"
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
              </Link>          )}


          <Link id="nav-support-us" to="/sponsors" className="hidden md:flex bg-ares-red-dark text-white px-6 h-9 ares-cut-sm font-bold uppercase tracking-widest text-xs hover:bg-ares-red hover:text-white transition-all shadow-lg border border-ares-red-dark items-center gap-2">
            <Heart size={14} className="fill-white" />
            Support Us
          </Link>
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
          <Link to="/events" onClick={() => setOpen(false)} className="text-xl font-black text-white italic tracking-tighter">EVENTS</Link>
          <Link to="/blog" onClick={() => setOpen(false)} className="text-xl font-black italic tracking-tighter text-ares-gold">TEAM BLOG</Link>
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
