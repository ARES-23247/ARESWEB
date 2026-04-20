import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Search, LayoutDashboard, LogIn } from "lucide-react";
import GlobalSearchModal from "./GlobalSearchModal";
import { useSession } from "../utils/auth-client";
import { GreekMeander } from "./GreekMeander";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();

  const isSignedIn = !isPending && session?.user;
  const userImage = session?.user?.image;
  const isAdmin = session?.user?.role === "admin";
  
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/admin/inquiries")
        .then(res => res.json())
        .then((data: any) => {
          if (data.inquiries) {
            setPendingCount(data.inquiries.filter((i: any) => i.status === "pending").length);
          }
        }).catch(() => {});
    }
  }, [isAdmin]);

  return (
    <nav role="navigation" aria-label="Main Navigation" className="fixed top-0 left-0 w-full z-50 bg-obsidian/85 backdrop-blur-xl shadow-2xl px-6 pt-4 pb-4 transition-all duration-500 overflow-hidden rounded-bl-xl rounded-br-[2.5rem] border-t-4 border-ares-bronze">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-24 focus:left-6 bg-ares-red text-white px-6 py-3 rounded-xl font-bold z-[100] shadow-2xl border border-white/20 transition-all"
      >
        Skip to Main Content
      </a>
      <GreekMeander variant="thin" opacity="opacity-40" className="absolute top-0 left-0" />
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate("/")} 
          className="text-2xl font-bold tracking-tighter text-white flex items-center gap-2 font-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1"
          aria-label="ARES 23247 Home"
        >
          ARES <span className="text-ares-red font-bold">23247</span>
        </button>

        <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest">
          <Link to="/" className="text-marble hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Home</Link>
          <Link to="/about" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">About</Link>
          <Link to="/seasons" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Seasons</Link>
          <Link to="/outreach" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Outreach</Link>
          <Link to="/events" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Events</Link>
          <Link to="/tech-stack" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Tech Stack</Link>
          <Link to="/docs" className="hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1 flex items-center">
            <span className="text-ares-red normal-case tracking-normal">ARES</span><span className="text-white normal-case tracking-normal">Lib</span>
          </Link>
          <Link to="/blog" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Blog</Link>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Open Site Search"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <Search size={18} aria-hidden="true" />
          </button>
          {isSignedIn && (
            <Link to="/dashboard" className="relative flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all group" aria-label="Dashboard">
              <img 
                src={userImage || `https://api.dicebear.com/9.x/bottts/svg?seed=${session?.user?.id}`} 
                alt="" 
                className="w-6 h-6 rounded-full bg-zinc-800" 
              />
              <span className="text-xs font-bold text-zinc-300 group-hover:text-white uppercase tracking-wider">Dashboard</span>
              {pendingCount > 0 && (
                 <span className="absolute -top-1 -right-1 flex h-3 w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                 </span>
              )}
            </Link>
          )}
          {!isPending && !isSignedIn && (
            <Link to="/login" className="flex items-center gap-2 px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-ares-gold/30 rounded-full transition-all group" aria-label="Sign In">
              <LogIn size={14} className="text-ares-gold" />
              <span className="text-xs font-bold text-zinc-300 group-hover:text-ares-gold uppercase tracking-wider">Sign In</span>
            </Link>
          )}
          <Link to="/sponsors" className="clipped-button-sm bg-ares-red text-white hover:scale-105 hover:bg-ares-red transition-all shadow-[0_0_15px_rgba(192,0,0,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Support Us
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
          <button onClick={() => { setOpen(false); setSearchOpen(true); }} className="text-left text-ares-gold flex items-center gap-2 mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">
            <Search size={16} aria-hidden="true" /> Search Pipeline
          </button>
          <Link to="/" onClick={() => setOpen(false)} className="text-marble hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Home</Link>
          <Link to="/about" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">About</Link>
          <Link to="/seasons" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Seasons</Link>
          <Link to="/outreach" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Outreach</Link>
          <Link to="/events" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Events</Link>
          <Link to="/tech-stack" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Tech Stack</Link>
          <Link to="/docs" onClick={() => setOpen(false)} className="hover:text-ares-gold transition-colors flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">
            <span className="text-ares-red normal-case tracking-normal">ARES</span><span className="text-white normal-case tracking-normal">Lib</span>
          </Link>
          <Link to="/blog" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Blog</Link>
          {isSignedIn && (
            <Link to="/dashboard" onClick={() => setOpen(false)} className="text-ares-gold hover:text-white flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1 w-max">
              <LayoutDashboard size={16} /> Dashboard
              {pendingCount > 0 && (
                <span className="ml-1 flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
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

      {searchOpen && <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />}
    </nav>
  );
}
