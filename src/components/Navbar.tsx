import { Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Search, LogIn, ShoppingBag, Calendar as CalendarIcon, GraduationCap } from "lucide-react";

import { GreekMeander } from "./GreekMeander";
import { useDashboardSession } from "../hooks/useDashboardSession";
import { NavbarNotifications } from "./navigation/NavbarNotifications";
import { NavbarMobileMenu } from "./navigation/NavbarMobileMenu";
import { TeamDropdown } from "./navigation/NavDropdown";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const navbarRef = useRef<HTMLElement>(null);

  const navigate = useNavigate();
  const { session, isPending, permissions } = useDashboardSession();

  const isSignedIn = !isPending && session?.authenticated;
  const userImage = session?.user?.image;

  // Close dropdowns when clicking outside navbar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
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
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleDropdown = (name: string) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  const isDashboard = location.pathname.startsWith("/dashboard");

  if (isDashboard) return null;

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
          onClick={() => navigate({ to: "/" })}
          className="text-2xl font-bold tracking-tighter text-white flex items-center gap-2 font-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1"
          aria-label="ARES 23247 Home"
        >
          ARES <span className="bg-ares-red text-white px-2 py-0.5 ares-cut-sm shadow-inner font-bold">23247</span>
        </button>

        <div className="hidden md:flex items-center gap-6 text-sm font-bold uppercase tracking-widest">
          <TeamDropdown activeDropdown={activeDropdown} onToggle={toggleDropdown} />

          <Link to="/events" className="flex items-center gap-2 text-white hover:text-ares-gold transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
            <CalendarIcon size={14} /> Calendar
          </Link>

          <Link to="/store" className="flex items-center gap-2 text-white hover:text-ares-gold transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
            <ShoppingBag size={14} /> Store
          </Link>

          <Link to="/academy" aria-label="Academy" className="flex items-center gap-2 text-white hover:text-ares-gold transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
            <GraduationCap size={14} /> Academy
          </Link>

          <Link to="/docs" aria-label="ARES Documentation Library" className="h-9 hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ares-cut-sm overflow-hidden flex items-center shadow-xl group/lib border border-white/5 bg-white/5">
            <span className="bg-ares-red h-full px-3 flex items-center text-[10px] font-heading font-black uppercase text-white tracking-[0.15em] border-r border-white/10 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.2)]">ARES</span>
            <span className="text-white h-full px-3 flex items-center text-[10px] font-heading font-bold uppercase tracking-[0.2em] group-hover/lib:bg-white/10 transition-colors">LIB</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
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

          {isSignedIn && <NavbarNotifications session={session} permissions={permissions} />}

          {isSignedIn && (
            <Link to="/dashboard" className="relative flex items-center gap-2 px-3 h-9 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm transition-all group" aria-label="Dashboard">
              <img
                src={userImage || `https://api.dicebear.com/9.x/bottts/svg?seed=${session?.user?.id}`}
                alt=""
                className="w-6 h-6 rounded-full bg-black/40"
                decoding="async"
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
          onClick={() => setOpen(!open)}
          className="md:hidden text-ares-gold w-10 h-10 flex flex-col justify-center items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded transition-colors group"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          {...(open ? { "aria-expanded": true } : { "aria-expanded": false })}
        >
          <span className={`w-7 h-1 bg-current block rounded-full transition-all duration-300 ${open ? "rotate-45 translate-y-2.5" : "group-hover:w-8"}`}></span>
          <span className={`w-7 h-1 bg-current block rounded-full transition-opacity duration-300 ${open ? "opacity-0" : "group-hover:w-5"}`}></span>
          <span className={`w-7 h-1 bg-current block rounded-full transition-all duration-300 ${open ? "-rotate-45 -translate-y-2.5" : "group-hover:w-8"}`}></span>
        </button>
      </div>

      <NavbarMobileMenu open={open} onOpenChange={setOpen} session={session} isPending={isPending} />
    </nav>
  );
}

