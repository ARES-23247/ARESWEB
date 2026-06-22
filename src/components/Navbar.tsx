"use client";

import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Calendar as CalendarIcon, 
  ShoppingBag, 
  GraduationCap
} from "lucide-react";
import { GreekMeander } from "./GreekMeander";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

// Shared data configs and subcomponents
import { TEAM_LINKS, RESOURCE_LINKS } from "./navigation/navItems";
import { NavDropdown } from "./navigation/NavDropdown";
import { DesktopUserMenu } from "./navigation/DesktopUserMenu";
import { MobileNavDrawer } from "./navigation/MobileNavDrawer";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [hasPendingInquiries, setHasPendingInquiries] = useState<boolean>(false);
  const navbarRef = useRef<HTMLDivElement>(null);
  const { user, authorizedUser, loading, loginWithGoogle, logout } = useAuth();

  const isSignedIn = !!user;
  const userImage = user?.photoURL;
  const userRole = authorizedUser?.role || "Pending Verification";

  useEffect(() => {
    if (!user?.uid || (userRole !== "admin" && userRole !== "coach" && userRole !== "mentor")) {
      setHasPendingInquiries(false);
      return;
    }

    const q = query(
      collection(db, "inquiries"),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasPendingInquiries(!snapshot.empty);
    }, (error) => {
      console.error("Error subscribing to pending inquiries in navbar:", error);
    });

    return () => unsubscribe();
  }, [user?.uid, userRole]);

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
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <GreekMeander variant="thin" opacity="opacity-40" className="absolute top-0 left-0" />
      </div>
      <div className="flex items-center justify-between relative z-10">
        <Link
          to="/"
          className="text-2xl font-bold tracking-tighter text-white flex items-center gap-2 font-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1"
          aria-label="ARES 23247 Home"
        >
          ARES <span className="bg-ares-red text-white px-2 py-0.5 ares-cut-sm shadow-inner font-bold">23247</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm font-bold uppercase tracking-widest animate-fade-in">
          
          {/* 1. Team Dropdown */}
          <NavDropdown
            label="Team"
            isOpen={activeDropdown === "team"}
            onToggle={() => toggleDropdown("team")}
            items={TEAM_LINKS}
            onItemClick={() => setActiveDropdown(null)}
          />

          {/* 2. Resources Dropdown */}
          <NavDropdown
            label="Resources"
            isOpen={activeDropdown === "resources"}
            onToggle={() => toggleDropdown("resources")}
            items={RESOURCE_LINKS}
            onItemClick={() => setActiveDropdown(null)}
          />

          {/* 3. High-Priority Links */}
          <Link to="/calendar" className="flex items-center gap-2 text-white hover:text-ares-gold transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
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
            <span className="text-marble h-full px-3 flex items-center text-[10px] font-heading font-bold uppercase tracking-[0.2em] group-hover/lib:bg-white/10 transition-colors">LIB</span>
          </Link>
        </div>

        {/* Desktop User Menu */}
        <DesktopUserMenu
          loading={loading}
          isSignedIn={isSignedIn}
          user={user}
          userRole={userRole}
          userImage={userImage}
          hasPendingInquiries={hasPendingInquiries}
          logout={logout}
          loginWithGoogle={loginWithGoogle}
        />

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
      <MobileNavDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        loading={loading}
        isSignedIn={isSignedIn}
        user={user}
        userRole={userRole}
        userImage={userImage}
        hasPendingInquiries={hasPendingInquiries}
        logout={logout}
        loginWithGoogle={loginWithGoogle}
      />
    </nav>
  );
}
