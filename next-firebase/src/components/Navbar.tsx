"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, LogIn, ShoppingBag, Calendar as CalendarIcon, GraduationCap, Sparkles, LogOut, Check } from "lucide-react";
import { GreekMeander } from "./GreekMeander";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const navbarRef = useRef<HTMLDivElement>(null);
  const { user, authorizedUser, loading, loginWithGoogle, logout } = useAuth();

  const isSignedIn = !!user;
  const userImage = user?.photoURL;
  const userRole = authorizedUser?.role || "Pending Verification";

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
        <Link
          href="/"
          className="text-2xl font-bold tracking-tighter text-white flex items-center gap-2 font-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1"
          aria-label="ARES 23247 Home"
        >
          ARES <span className="bg-ares-red text-white px-2 py-0.5 ares-cut-sm shadow-inner font-bold">23247</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm font-bold uppercase tracking-widest">
          {/* Main Links */}
          <Link href="/blog" className="flex items-center gap-2 text-white hover:text-ares-gold transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
            Blog
          </Link>

          <Link href="/calendar" className="flex items-center gap-2 text-white hover:text-ares-gold transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
            <CalendarIcon size={14} /> Calendar
          </Link>

          <Link href="/tasks" className="flex items-center gap-2 text-white hover:text-ares-gold transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
            Tasks
          </Link>

          <Link href="/store" className="flex items-center gap-2 text-white hover:text-ares-gold transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
            <ShoppingBag size={14} /> Store
          </Link>

          <Link href="/academy" aria-label="Academy" className="flex items-center gap-2 text-white hover:text-ares-gold transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
            <GraduationCap size={14} /> Academy
          </Link>

          <Link href="/docs" aria-label="ARES Documentation Library" className="h-9 hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ares-cut-sm overflow-hidden flex items-center shadow-xl group/lib border border-white/5 bg-white/5">
            <span className="bg-ares-red h-full px-3 flex items-center text-[10px] font-heading font-black uppercase text-white tracking-[0.15em] border-r border-white/10 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.2)]">ARES</span>
            <span className="text-marble h-full px-3 flex items-center text-[10px] font-heading font-bold uppercase tracking-[0.2em] group-hover/lib:bg-white/10 transition-colors">LIB</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-4">
          {loading ? (
            <span className="text-xs text-marble/60">Verifying session...</span>
          ) : isSignedIn ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden lg:block">
                <p className="text-xs font-bold text-white leading-none">
                  {user.displayName || "ARES Member"}
                </p>
                <p className="text-[10px] text-ares-gold uppercase tracking-wider font-semibold mt-1">
                  {userRole}
                </p>
              </div>
              
              <div className="relative group">
                <button className="relative flex items-center gap-2 px-3 h-9 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm transition-all">
                  <img
                    src={userImage || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`}
                    alt=""
                    className="w-6 h-6 rounded-full bg-black/40 border border-ares-bronze/40"
                  />
                  <span className="text-xs font-bold text-white uppercase tracking-wider hidden sm:inline">Portal</span>
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-obsidian border border-ares-bronze/20 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 p-2">
                  <div className="px-3 py-2 border-b border-white/5">
                    <p className="text-xs text-marble/60">Logged in as</p>
                    <p className="text-xs font-bold text-white truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full text-left mt-1 px-3 py-2 text-xs text-ares-danger hover:bg-ares-red/10 rounded transition-colors flex items-center gap-2 font-bold uppercase tracking-wider"
                  >
                    <LogOut size={12} /> Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="flex items-center gap-2 px-4 h-9 bg-ares-red hover:bg-ares-red-dark text-white border border-white/10 ares-cut-sm transition-all font-bold uppercase tracking-widest text-xs"
            >
              <LogIn size={14} /> Sign In
            </button>
          )}
        </div>

        {/* Mobile menu trigger */}
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

      {/* Mobile Drawer */}
      {open && (
        <div className="absolute top-full left-0 w-full bg-obsidian border-b border-ares-bronze/20 shadow-2xl p-6 flex flex-col gap-4 md:hidden z-50">
          <Link href="/blog" onClick={() => setOpen(false)} className="text-marble hover:text-ares-gold transition-colors font-bold uppercase tracking-wider text-sm">
            Blog
          </Link>
          <Link href="/calendar" onClick={() => setOpen(false)} className="text-marble hover:text-ares-gold transition-colors font-bold uppercase tracking-wider text-sm">
            Calendar
          </Link>
          <Link href="/tasks" onClick={() => setOpen(false)} className="text-marble hover:text-ares-gold transition-colors font-bold uppercase tracking-wider text-sm">
            Tasks
          </Link>
          <Link href="/store" onClick={() => setOpen(false)} className="text-marble hover:text-ares-gold transition-colors font-bold uppercase tracking-wider text-sm">
            Store
          </Link>
          <Link href="/academy" onClick={() => setOpen(false)} className="text-marble hover:text-ares-gold transition-colors font-bold uppercase tracking-wider text-sm">
            Academy
          </Link>
          <Link href="/docs" onClick={() => setOpen(false)} className="text-marble hover:text-ares-gold transition-colors font-bold uppercase tracking-wider text-sm flex items-center gap-2">
            ARES Lib
          </Link>
          
          <div className="h-px bg-white/10 my-2"></div>
          
          {loading ? (
            <span className="text-xs text-marble/60">Verifying session...</span>
          ) : isSignedIn ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <img
                  src={userImage || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`}
                  alt=""
                  className="w-8 h-8 rounded-full bg-black/40 border border-ares-bronze/40"
                />
                <div>
                  <p className="text-sm font-bold text-white">{user.displayName}</p>
                  <p className="text-xs text-ares-gold font-semibold uppercase tracking-wider">{userRole}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
                className="w-full mt-2 text-center py-2 text-xs text-white bg-ares-red/20 hover:bg-ares-red text-ares-danger hover:text-white rounded transition-colors font-bold uppercase tracking-wider border border-ares-red/30"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                loginWithGoogle();
                setOpen(false);
              }}
              className="w-full text-center py-3 bg-ares-red hover:bg-ares-red-dark text-white rounded transition-all font-bold uppercase tracking-widest text-xs border border-ares-bronze/20"
            >
              Sign In with Google
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
