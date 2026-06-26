"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { LogIn, Menu, X, KeyRound } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import { useFocusTrap } from "@/lib/useFocusTrap";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, loginWithGoogle, loginWithMockUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const mobileRef = useFocusTrap(mobileMenuOpen, () => setMobileMenuOpen(false));

  React.useEffect(() => {
    setIsLocal(
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
       window.location.hostname === "127.0.0.1" ||
       window.location.hostname.startsWith("192.168.") ||
       window.location.hostname.startsWith("10.") ||
       window.location.hostname.endsWith(".local") ||
       window.location.hostname.includes("aresfirst-portal--") ||
       process.env.NODE_ENV === "development")
    );
  }, []);

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center relative overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ares-red/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-ares-gold/5 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="z-10 flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            {/* Spinning Gold Gear */}
            <div className="w-16 h-16 border-4 border-ares-gold/20 border-t-ares-gold rounded-full animate-spin"></div>
            {/* Inner Red Pulsing Ring */}
            <div className="absolute w-10 h-10 border-4 border-ares-red/35 border-b-ares-red rounded-full animate-spin rotate-180" style={{ animationDuration: "1s" }}></div>
          </div>
          
          <div className="text-center">
            <p className="text-ares-gold font-bold uppercase tracking-[0.3em] text-[10px] font-heading mb-1.5">
              ARES Neural Link
            </p>
            <p className="text-marble/70 text-xs font-semibold uppercase tracking-widest animate-pulse">
              Authenticating Terminal...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Lockscreen / Sign In Required
  if (!user) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Beautiful background patterns */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20" aria-hidden="true">
          <div 
            className="absolute right-[-10%] top-[10%] w-[70%] h-[70%] opacity-[0.05] bg-contain bg-center bg-no-repeat rotate-12"
            style={{ backgroundImage: "url('/favicon.ico')" }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-obsidian via-obsidian/95 to-ares-red/10"></div>
        </div>
        
        <div className="absolute top-0 left-0 w-full z-10">
          <GreekMeander variant="thin" opacity="opacity-30" className="w-full" />
        </div>

        <div className="relative z-10 w-full max-w-md">
          {/* Lockscreen Card */}
          <div className="glass-card hero-card p-8 border border-white/10 bg-black/60 shadow-2xl flex flex-col items-center text-center">
            {/* Icon Group */}
            <div className="relative w-20 h-20 bg-ares-red/15 border border-ares-red/45 ares-cut flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(192,0,0,0.2)]">
              <KeyRound className="text-ares-red w-8 h-8 animate-bounce" />
            </div>
            
            <span className="text-ares-gold font-bold uppercase tracking-[0.4em] text-[10px] font-heading mb-3">
              <em>FIRST</em>® Tech Challenge #23247
            </span>
            
            <h2 className="text-2xl md:text-3xl font-extrabold text-white uppercase font-heading mb-3 tracking-tighter">
              Administrative Gate
            </h2>
            
            <p className="text-marble/70 text-sm leading-relaxed mb-8 max-w-sm">
              Access to telemetry commands, the Kanban task boards, and workspace analytics is restricted to authenticated ARES team engineers.
            </p>

            <button
              onClick={loginWithGoogle}
              className="w-full clipped-button bg-ares-red hover:bg-ares-red-dark transition-all text-white font-bold text-sm tracking-wider uppercase inline-flex items-center justify-center gap-3 py-3.5 shadow-xl hover:shadow-[0_0_20px_rgba(192,0,0,0.3)] active:scale-95 cursor-pointer"
            >
              <LogIn size={16} /> Sign In with Google
            </button>

            {isLocal && (
              <div className="w-full mt-4 pt-4 border-t border-white/5 space-y-2.5">
                <p className="text-[9px] font-black text-ares-gold uppercase tracking-widest text-center animate-pulse">
                  ⚡ Developer Bypass Active
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => loginWithMockUser("coach.david@gmail.com", "admin", "Coach David")}
                    className="w-full py-2 bg-ares-gold/15 hover:bg-ares-gold/25 border border-ares-gold/30 text-white font-black text-[9px] uppercase tracking-wider ares-cut-sm cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] text-center truncate"
                    title="Coach David"
                  >
                    David (Admin)
                  </button>
                  <button
                    type="button"
                    onClick={() => loginWithMockUser("ares23247wv@gmail.com", "admin", "ARES Team")}
                    className="w-full py-2 bg-ares-red/15 hover:bg-ares-red/25 border border-ares-red/30 text-white font-black text-[9px] uppercase tracking-wider ares-cut-sm cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] text-center truncate"
                    title="ARES Team Gmail"
                  >
                    ARES Team
                  </button>
                  <button
                    type="button"
                    onClick={() => loginWithMockUser("lead.programmer@gmail.com", "programmer", "Programmer Lead")}
                    className="w-full py-2 bg-ares-cyan/15 hover:bg-ares-cyan/25 border border-ares-cyan/30 text-white font-black text-[9px] uppercase tracking-wider ares-cut-sm cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] text-center truncate"
                    title="Lead Programmer"
                  >
                    Programmer
                  </button>
                </div>
              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-white/5 w-full flex items-center justify-center gap-4 text-[10px] uppercase font-bold text-marble/45 tracking-widest">
              <span>Secure Shell</span>
              <span>•</span>
              <span>YPP Compliant</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Dashboard Layout
  return (
    <div className="flex w-full min-h-screen bg-obsidian text-marble relative">
      
      {/* ─── DESKTOP SIDEBAR ─── */}
      <div className="hidden md:block shrink-0 self-stretch flex flex-col">
        <DashboardSidebar />
      </div>

      {/* ─── MOBILE DRAWER SIDEBAR ─── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Overlay backdrop */}
          <div 
            className="fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Sidebar panel */}
          <div ref={mobileRef} tabIndex={-1} className="relative z-50 flex flex-col bg-obsidian h-full border-r border-white/10 animate-slide-in focus:outline-none">
            {/* Close button overlay */}
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-[-3rem] w-9 h-9 bg-ares-red text-white flex items-center justify-center border border-white/10 ares-cut-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian cursor-pointer"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
            <DashboardSidebar onCloseMobile={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* ─── MAIN PORTAL VIEWPORT ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Mobile top-nav header */}
        <header className="md:hidden flex items-center justify-between px-6 py-4 bg-black/40 border-b border-white/5 sticky top-0 z-30 backdrop-blur-md">
          <span className="text-lg font-black tracking-tighter text-white font-heading">
            ARES <span className="bg-ares-red text-white px-1.5 py-0.5 ares-cut-sm font-bold text-xs ml-1">23247</span>
          </span>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 ares-cut-sm text-ares-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Core page canvas */}
        <main id="main-content" role="main" className="flex-grow p-6 md:p-10 max-w-7xl mx-auto w-full relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
