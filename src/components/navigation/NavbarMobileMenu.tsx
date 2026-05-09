import { Link } from "@tanstack/react-router";
import { Search, LayoutDashboard, LogIn } from "lucide-react";
import type { DashboardSession } from "../../hooks/useDashboardSession";

interface NavbarMobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: DashboardSession | null;
  isPending: boolean;
}

export function NavbarMobileMenu({ open, onOpenChange, session, isPending }: NavbarMobileMenuProps) {
  if (!open) return null;

  const isSignedIn = !isPending && session?.authenticated;

  const handleNavClick = () => onOpenChange(false);

  return (
    <div className="md:hidden mt-4 flex flex-col gap-4 text-sm font-bold uppercase tracking-widest px-2 pb-4 border-t border-white/10 pt-4">
      <button
        onClick={() => {
          onOpenChange(false);
          window.dispatchEvent(new CustomEvent("open-command-palette"));
        }}
        className="text-left text-ares-gold flex items-center gap-2 mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1"
      >
        <Search size={16} aria-hidden="true" /> Command Palette
      </button>
      <div className="flex flex-col gap-6 p-8">
        <Link to="/about" onClick={handleNavClick} className="text-xl font-black text-white italic tracking-tighter">
          WHO WE ARE
        </Link>
        <Link to="/seasons" onClick={handleNavClick} className="text-xl font-black text-white italic tracking-tighter">
          SEASONS
        </Link>
        <Link to="/outreach" onClick={handleNavClick} className="text-xl font-black text-white italic tracking-tighter">
          OUTREACH
        </Link>
        <Link to="/events" onClick={handleNavClick} className="text-xl font-black text-white italic tracking-tighter">
          CALENDAR
        </Link>
        <Link to="/blog" onClick={handleNavClick} className="text-xl font-black italic tracking-tighter text-ares-gold">
          TEAM BLOG
        </Link>
        <Link to="/academy" onClick={handleNavClick} className="text-xl font-black italic tracking-tighter text-ares-cyan">
          ACADEMY
        </Link>
        <Link to="/store" onClick={handleNavClick} className="text-xl font-black text-white italic tracking-tighter">
          STORE
        </Link>
        <Link to="/sponsors" onClick={handleNavClick} className="text-xl font-black text-white italic tracking-tighter">
          SUPPORT US
        </Link>
      </div>
      {isSignedIn && (
        <Link
          to="/dashboard"
          onClick={handleNavClick}
          className="text-ares-gold hover:text-white flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1 w-max"
        >
          <LayoutDashboard size={16} /> Dashboard
        </Link>
      )}
      {!isPending && !isSignedIn && (
        <Link
          to="/login"
          onClick={handleNavClick}
          className="text-ares-gold hover:text-white flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1"
        >
          <LogIn size={16} /> Internal Portal
        </Link>
      )}
      <Link
        to="/join"
        onClick={handleNavClick}
        className="text-marble hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1"
      >
        Join Us
      </Link>
      <Link
        to="/sponsors"
        onClick={handleNavClick}
        className="text-marble hover:text-ares-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1"
      >
        Support Us
      </Link>
    </div>
  );
}

