import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Search, LayoutDashboard, LogIn, Bell, Check, Heart } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";



import { GreekMeander } from "./GreekMeander";
import { adminApi } from "../api/adminApi";
import { useDashboardSession } from "../hooks/useDashboardSession";


export default function Navbar() {
  const [open, setOpen] = useState(false);

  const navigate = useNavigate();
  const { session, isPending, permissions } = useDashboardSession();

  const isSignedIn = !isPending && session?.authenticated;
  const userImage = session?.user?.image;
   
  const { role, canSeeInquiries, isAuthorized } = permissions;
  
  const [pendingInquiries, setPendingInquiries] = useState<{ id: string, name: string, type: string }[]>([]);
  const [pendingPosts, setPendingPosts] = useState<{ slug: string, status: string, title: string, author_nickname?: string }[]>([]);
  const [pendingEvents, setPendingEvents] = useState<{ id: string, status: string, title: string }[]>([]);
  const [pendingDocs, setPendingDocs] = useState<{ slug: string, status: string, title: string }[]>([]);
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

  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      try {
        const res = await adminApi.get<{ notifications: { id: string; title: string; message: string; is_read: boolean; link?: string }[] }>("/api/notifications");
        return res || { notifications: [] };
      } catch {
        return { notifications: [] };
      }
    },
    enabled: !!isSignedIn,
    refetchInterval: 30000 // Poll every 30s
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await adminApi.request("/api/notifications/read-all", { method: "PUT" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await adminApi.request(`/api/notifications/${id}/read`, { method: "PUT" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const rawNotifications = notifData?.notifications || [];
  
  // Combine db notifications with pending inquiries and pending posts
  const notifications = [
    ...rawNotifications,
    ...pendingInquiries.map(i => ({
      id: `inquiry-${i.id}`,
      title: `New ${i.type === 'support' ? 'Support' : i.type === 'outreach' ? 'Outreach' : i.type === 'sponsor' ? 'Sponsor' : 'Inquiry'} Request`,
      message: `From ${i.name}`,
      is_read: false,
      link: '/dashboard/inquiries',
      is_inquiry: true
    })),
    ...pendingPosts.map(p => ({
      id: `post-${p.slug}`,
      title: `New Pending Post`,
      message: `"${p.title}" by ${p.author_nickname || 'Student'}`,
      is_read: false,
      link: '/dashboard/manage_blog',
      is_inquiry: true // Treat as action item (cannot be marked read)
    })),
    ...pendingEvents.map(e => ({
      id: `event-${e.id}`,
      title: `New Pending Event`,
      message: `"${e.title}"`,
      is_read: false,
      link: '/dashboard/manage_event',
      is_inquiry: true
    })),
    ...pendingDocs.map(d => ({
      id: `doc-${d.slug}`,
      title: `New Pending Doc`,
      message: `"${d.title}"`,
      is_read: false,
      link: '/dashboard/manage_docs',
      is_inquiry: true
    }))
  ];
  
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (isAuthorized) {
      adminApi.get<{ inquiries?: { id: string, status: string, name: string, type: string }[] }>("/api/inquiries")
        .then((data) => {
          if (data && data.inquiries) {
            const pending = data.inquiries.filter((i) => i.status === "pending");
            setPendingInquiries(pending);
          }
        }).catch(() => {});
        
      adminApi.get<{ posts?: { slug: string, status: string, title: string, author_nickname?: string }[] }>("/api/admin/posts/list")
        .then((data) => {
          if (data && data.posts) {
            const pending = data.posts.filter((p) => p.status === "pending");
            setPendingPosts(pending);
          }
        }).catch(() => {});

      adminApi.get<{ events?: { id: string, status: string, title: string }[] }>("/api/admin/events")
        .then((data) => {
          if (data && data.events) {
            const pending = data.events.filter((e) => e.status === "pending");
            setPendingEvents(pending);
          }
        }).catch(() => {});

      adminApi.get<{ docs?: { slug: string, status: string, title: string }[] }>("/api/admin/docs/list")
        .then((data) => {
          if (data && data.docs) {
            const pending = data.docs.filter((d) => d.status === "pending");
            setPendingDocs(pending);
          }
        }).catch(() => {});
    }
  }, [canSeeInquiries]);

  return (
    <nav role="navigation" aria-label="Main Navigation" className="fixed top-0 left-0 w-full z-50 bg-obsidian/85 backdrop-blur-xl shadow-2xl px-6 pt-4 pb-4 transition-all duration-500 overflow-visible rounded-bl-xl rounded-br-[2.5rem] border-t-4 border-ares-bronze">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-24 focus:left-6 bg-ares-red text-white px-6 py-3 ares-cut-sm font-bold z-[100] shadow-2xl border border-white/20 transition-all"
      >
        Skip to Main Content
      </a>
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden rounded-bl-xl rounded-br-[2.5rem]">
        <GreekMeander variant="thin" opacity="opacity-40" className="absolute top-0 left-0" />
      </div>
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate("/")} 
          className="text-2xl font-bold tracking-tighter text-white flex items-center gap-2 font-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1"
          aria-label="ARES 23247 Home"
        >
          ARES <span className="bg-ares-red text-white px-2 py-0.5 ares-cut-sm shadow-inner font-bold">23247</span>
        </button>

        <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest">
          <Link to="/about" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">About</Link>
          <Link to="/seasons" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Seasons</Link>
          <Link to="/outreach" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Outreach</Link>
          <Link to="/events" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Events</Link>
          <Link to="/blog" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Blog</Link>
          <Link to="/docs" className="hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ares-cut-sm overflow-hidden flex items-center shadow-xl group border border-white/5 bg-white/5">
            <span className="bg-ares-red px-3 py-1.5 text-[10px] font-heading font-black uppercase text-white tracking-[0.15em] border-r border-white/10 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.2)]">ARES</span>
            <span className="text-white px-3 py-1.5 text-[10px] font-heading font-bold uppercase tracking-[0.2em] group-hover:bg-white/10 transition-colors">LIB</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            aria-label="Open Command Palette"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-marble/90 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan border border-white/10"
          >
            <Search size={14} aria-hidden="true" />
            <span className="text-[10px] sm:text-xs font-mono flex items-center gap-2 whitespace-nowrap">
              Search... 
              <span className="hidden lg:flex items-center gap-1 opacity-60">
                <kbd className="bg-black/40 text-marble/80 px-1.5 py-0.5 rounded border border-white/20 leading-none">Ctrl</kbd>
                <kbd className="bg-black/40 text-marble/80 px-1.5 py-0.5 rounded border border-white/20 leading-none">K</kbd>
              </span>
            </span>
          </button>
          {isSignedIn && (
              <div className="relative" ref={notifRef}>
                <button 
                  onClick={() => setShowNotifs(!showNotifs)}
                className="relative flex items-center justify-center p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                aria-label="Notifications"
              >
                <Bell size={18} className="text-marble/80" />
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
                <div className="absolute top-12 right-0 w-80 bg-obsidian border border-white/10 shadow-2xl rounded-lg overflow-hidden flex flex-col z-[200]">
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
                  <div className="flex-1 overflow-y-auto max-h-96 w-full">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-marble/50">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id} 
                          role="button"
                          tabIndex={0}
                          className={`px-4 py-3 border-b border-white/5 flex flex-col gap-1 hover:bg-white/5 cursor-pointer ${n.is_read ? 'opacity-60' : 'bg-ares-red/5'}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              // @ts-expect-error custom flag
                              if (!n.is_read && !n.is_inquiry) markRead.mutate(n.id);
                              if (n.link) navigate(n.link);
                              setShowNotifs(false);
                            }
                          }}
                          onClick={() => {
                            // @ts-expect-error custom flag
                            if (!n.is_read && !n.is_inquiry) markRead.mutate(n.id);
                            if (n.link) navigate(n.link);
                            setShowNotifs(false);
                          }}
                        >
                          <div className="flex justify-between items-start gap-2">
                             <span className="text-sm font-bold text-white">{n.title}</span>
                             {!n.is_read && <span className="h-2 w-2 rounded-full bg-ares-red flex-shrink-0 mt-1"></span>}
                          </div>
                          <span className="text-xs text-marble/40 line-clamp-2">{n.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {isSignedIn && (
            <Link to="/dashboard" className="relative flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all group" aria-label="Dashboard">
              <img 
                src={userImage || `https://api.dicebear.com/9.x/bottts/svg?seed=${session?.user?.id}`} 
                alt="" 
                className="w-6 h-6 rounded-full bg-black/40" 
              />
              <span className="text-xs font-bold text-marble/80 group-hover:text-white uppercase tracking-wider">Dashboard</span>
            </Link>
          )}
          {!isPending && !isSignedIn && (
            <Link to="/login" className="flex items-center gap-2 px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-ares-gold/30 rounded-full transition-all group" aria-label="Sign In">
              <LogIn size={14} className="text-ares-gold" />
              <span className="text-xs font-bold text-marble/80 group-hover:text-ares-gold uppercase tracking-wider">Sign In</span>
            </Link>
          )}


          <Link to="/sponsors" className="hidden md:flex bg-ares-red text-white px-6 py-2 rounded-tl-[1.2rem] rounded-br-[1.2rem] rounded-tr-md rounded-bl-md font-bold uppercase tracking-widest text-xs hover:bg-ares-bronze hover:text-white transition-all shadow-lg items-center gap-2">
            <Heart size={14} className="fill-white" />
            <span>Support Us</span>
          </Link>
        </div>


        <button 
          onClick={() => setOpen(!open)} 
          className="md:hidden text-ares-gold w-10 h-10 flex flex-col justify-center items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded transition-colors group"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
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
          <Link to="/blog" onClick={() => setOpen(false)} className="text-xl font-black text-white italic tracking-tighter text-ares-gold">TEAM BLOG</Link>
          <Link to="/sponsors" onClick={() => setOpen(false)} className="text-xl font-black text-white italic tracking-tighter">SUPPORT US</Link>
        </div>
          {isSignedIn && (
            <Link to="/dashboard" onClick={() => setOpen(false)} className="text-ares-gold hover:text-white flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1 w-max">
              <LayoutDashboard size={16} /> Dashboard
            </Link>
          )}
          {!isPending && !isSignedIn && (
            <Link to="/login" onClick={() => setOpen(false)} className="text-ares-gold hover:text-white flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">
              <LogIn size={16} /> Sign In
            </Link>
          )}
          <Link to="/join" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Join Us</Link>
          <Link to="/sponsors" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Support Us</Link>
          
        </div>

      )}

    </nav>
  );
}
