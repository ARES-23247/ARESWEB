import { Link } from "react-router-dom";
import { ChevronDown, Users, Trophy, BookOpen } from "lucide-react";

interface NavDropdownProps {
  name: string;
  activeDropdown: string | null;
  onToggle: (name: string) => void;
  children: React.ReactNode;
}

export function NavDropdown({ name, activeDropdown, onToggle, children }: NavDropdownProps) {
  const isOpen = activeDropdown === name;

  return (
    <div className="relative py-2 group/dropdown">
      <button
        onClick={() => onToggle(name)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1 ${
          isOpen ? "text-ares-gold" : "text-white hover:text-ares-gold"
        }`}
      >
        {name} <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? "rotate-180" : "group-focus-within/dropdown:rotate-180"}`} />
      </button>
      <div
        className={`absolute top-[calc(100%-4px)] left-0 w-48 bg-obsidian/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-lg p-1 transition-all duration-300 z-50 opacity-0 translate-y-2 pointer-events-none group-hover/dropdown:opacity-100 group-hover/dropdown:translate-y-0 group-hover/dropdown:pointer-events-auto group-focus-within/dropdown:opacity-100 group-focus-within/dropdown:translate-y-0 group-focus-within/dropdown:pointer-events-auto ${
          isOpen ? "!opacity-100 !translate-y-0 !pointer-events-auto" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function TeamDropdown({ activeDropdown, onToggle }: { activeDropdown: string | null; onToggle: (name: string) => void }) {
  return (
    <NavDropdown name="Team" activeDropdown={activeDropdown} onToggle={onToggle}>
      <Link
        to="/about"
        onClick={() => onToggle("")}
        className="flex items-center gap-3 px-4 py-3 text-[11px] text-marble hover:text-white hover:bg-white/5 rounded-md transition-colors group/item focus-visible:outline-none focus-visible:bg-white/10"
      >
        <Users size={14} className="text-ares-cyan group-hover/item:scale-110 transition-transform" />
        Who We Are
      </Link>
      <Link
        to="/seasons"
        onClick={() => onToggle("")}
        className="flex items-center gap-3 px-4 py-3 text-[11px] text-marble hover:text-white hover:bg-white/5 rounded-md transition-colors group/item focus-visible:outline-none focus-visible:bg-white/10"
      >
        <Trophy size={14} className="text-ares-gold group-hover/item:scale-110 transition-transform" />
        Seasons
      </Link>
      <Link
        to="/outreach"
        onClick={() => onToggle("")}
        className="flex items-center gap-3 px-4 py-3 text-[11px] text-marble hover:text-white hover:bg-white/5 rounded-md transition-colors group/item focus-visible:outline-none focus-visible:bg-white/10"
      >
        <Users size={14} className="text-ares-red group-hover/item:scale-110 transition-transform" />
        Our Impact
      </Link>
      <div className="my-1 h-px bg-white/10" />
      <Link
        to="/blog"
        onClick={() => onToggle("")}
        className="flex items-center gap-3 px-4 py-3 text-[11px] text-marble hover:text-white hover:bg-white/5 rounded-md transition-colors group/item focus-visible:outline-none focus-visible:bg-white/10"
      >
        <BookOpen size={14} className="text-ares-gold group-hover/item:scale-110 transition-transform" />
        Team Blog
      </Link>
    </NavDropdown>
  );
}
