import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  Calculator,
  Cpu,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  Search,
  ShoppingBag,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

export interface CommandPaletteItem {
  id: string;
  label: string;
  category: "Team & Public" | "Engineering & Academy" | "Arcade" | "Command Center";
  to: string;
  keywords: string;
}

const PUBLIC_COMMAND_ITEMS: CommandPaletteItem[] = [
  { id: "home", label: "Home Portal", category: "Team & Public", to: "/", keywords: "home index landing portal" },
  { id: "about", label: "Who We Are (Team & Alumni)", category: "Team & Public", to: "/about", keywords: "about roster mentors coaches alumni students team" },
  { id: "seasons", label: "Seasons & Legacy Archive", category: "Team & Public", to: "/seasons", keywords: "seasons history awards trophies into the deep centerstage biobuzz" },
  { id: "tournaments", label: "Tournaments & Match Results", category: "Team & Public", to: "/tournaments", keywords: "tournaments matches results opr scouting competitions" },
  { id: "outreach", label: "Outreach & Community Impact", category: "Team & Public", to: "/outreach", keywords: "outreach stem community hours events impact" },
  { id: "sponsors", label: "Sponsors & Partners", category: "Team & Public", to: "/sponsors", keywords: "sponsors partners tiers donate support" },
  { id: "finance", label: "Public Financial Ledger", category: "Team & Public", to: "/finance", keywords: "finance budget ledger expenses grants transparency" },
  { id: "gallery", label: "Photo Gallery", category: "Team & Public", to: "/gallery", keywords: "photos gallery albums pictures media" },
  { id: "videos", label: "Video Gallery", category: "Team & Public", to: "/videos", keywords: "videos youtube matches reveal clips" },
  { id: "blog", label: "Team Blog & Updates", category: "Team & Public", to: "/blog", keywords: "blog news articles posts updates" },
  { id: "calendar", label: "Team Calendar", category: "Team & Public", to: "/calendar", keywords: "calendar schedule meetings events dates" },
  { id: "store", label: "Official Team Store", category: "Team & Public", to: "/store", keywords: "store merch apparel shirts shop" },
  { id: "join", label: "Join or Contact ARES", category: "Team & Public", to: "/join", keywords: "join apply contact recruit sponsor inquiry" },
  { id: "academy", label: "ARES Academy", category: "Engineering & Academy", to: "/academy", keywords: "academy lessons learning math science tutorials curriculum" },
  { id: "docs", label: "ARESLib Documentation", category: "Engineering & Academy", to: "/docs", keywords: "docs documentation areslib code api kotlin library" },
  { id: "robots", label: "Robots Fleet & Technical Specs", category: "Engineering & Academy", to: "/robots", keywords: "robots fleet cad specs hardware subsystems pit sheet" },
  { id: "tech-stack", label: "Engineering Tech Stack", category: "Engineering & Academy", to: "/tech-stack", keywords: "tech stack software hardware tools vision control" },
  { id: "score-calc", label: "BIOBUZZ Score Calculator", category: "Engineering & Academy", to: "/biobuzz/score-calculator", keywords: "biobuzz score calculator points match" },
  { id: "simulations", label: "Interactive Simulations", category: "Engineering & Academy", to: "/simulations", keywords: "simulations physics control pid visualizer" },
  { id: "arcade", label: "ARES Arcade Hub", category: "Arcade", to: "/arcade", keywords: "arcade games hub play" },
  { id: "biobuzz-sim", label: "BIOBUZZ Field Simulator", category: "Arcade", to: "/biobuzz/simulator", keywords: "biobuzz simulator game robot drive" },
  { id: "waggle-way", label: "Waggle Way", category: "Arcade", to: "/waggle-way", keywords: "waggle way puzzle bee game" },
  { id: "buzzhex", label: "BUZZHEX", category: "Arcade", to: "/buzzhex", keywords: "buzzhex hex strategy connection game" },
  { id: "buzzle", label: "BUZZLE Word Game", category: "Arcade", to: "/buzzle", keywords: "buzzle word hex game" },
  { id: "buzzle-tools", label: "BUZZLE Word Tools", category: "Arcade", to: "/buzzle/word-tools", keywords: "buzzle word tools dictionary solver" },
  { id: "buzzello", label: "BUZZELLO", category: "Arcade", to: "/buzzello", keywords: "buzzello othello reversi hex strategy game" },
  { id: "pollen", label: "Pollinator Pile-Up", category: "Arcade", to: "/pollen", keywords: "pollen pollinator pile up balance physics game" },
];

const DASHBOARD_COMMAND_ITEMS: CommandPaletteItem[] = [
  { id: "dash-home", label: "Command Center Overview", category: "Command Center", to: "/dashboard", keywords: "dashboard command center overview home" },
  { id: "dash-tasks", label: "Operational Tasks Board", category: "Command Center", to: "/dashboard/tasks", keywords: "dashboard tasks kanban todo board" },
  { id: "dash-blog", label: "Blog Management", category: "Command Center", to: "/dashboard/blog", keywords: "dashboard blog posts editor approvals" },
  { id: "dash-events", label: "Events & Tournaments Manager", category: "Command Center", to: "/dashboard/events", keywords: "dashboard events calendar tournaments manager" },
  { id: "dash-academy", label: "Academy Lesson Manager", category: "Command Center", to: "/dashboard/academy", keywords: "dashboard academy lessons docs editor" },
  { id: "dash-profile", label: "My Member Profile", category: "Command Center", to: "/dashboard/profile", keywords: "dashboard profile avatar bio settings" },
];

const ADMIN_COMMAND_ITEMS: CommandPaletteItem[] = [
  { id: "dash-announcements", label: "Site-Wide Announcements", category: "Command Center", to: "/dashboard/announcements", keywords: "dashboard announcements banner alert" },
  { id: "dash-inquiries", label: "Recruitment & Sponsor Inquiries", category: "Command Center", to: "/dashboard/inquiries", keywords: "dashboard inquiries messages recruitment contact" },
  { id: "dash-outreach", label: "Outreach Ledger Manager", category: "Command Center", to: "/dashboard/outreach", keywords: "dashboard outreach impact events hours" },
  { id: "dash-sponsors", label: "Sponsors Manager", category: "Command Center", to: "/dashboard/sponsors", keywords: "dashboard sponsors partners logos" },
  { id: "dash-users", label: "Team User Roster & Roles", category: "Command Center", to: "/dashboard/users", keywords: "dashboard users roles permissions roster" },
];

interface CommandPaletteProps {
  isSignedIn: boolean;
  userRole: string;
}

export function CommandPalette({ isSignedIn, userRole }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const closePalette = () => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
  };

  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, closePalette);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  const allItems = useMemo(() => {
    const items = [...PUBLIC_COMMAND_ITEMS];
    if (isSignedIn && userRole !== "unverified" && userRole !== "Pending Verification") {
      items.push(...DASHBOARD_COMMAND_ITEMS);
      if (userRole === "admin" || userRole === "coach") {
        items.push(...ADMIN_COMMAND_ITEMS);
      }
    }
    return items;
  }, [isSignedIn, userRole]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return allItems;
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized) ||
        item.keywords.toLowerCase().includes(normalized) ||
        item.to.toLowerCase().includes(normalized),
    );
  }, [allItems, query]);

  const handleSelect = (item: CommandPaletteItem) => {
    closePalette();
    void navigate(item.to);
  };

  const getCategoryIcon = (category: CommandPaletteItem["category"], id: string) => {
    if (category === "Command Center") return <LayoutDashboard size={14} className="text-ares-gold" aria-hidden="true" />;
    if (category === "Arcade") return <Gamepad2 size={14} className="text-ares-gold" aria-hidden="true" />;
    if (id === "academy") return <GraduationCap size={14} className="text-ares-gold" aria-hidden="true" />;
    if (id === "docs") return <BookOpen size={14} className="text-ares-red" aria-hidden="true" />;
    if (id === "score-calc") return <Calculator size={14} className="text-ares-gold" aria-hidden="true" />;
    if (category === "Engineering & Academy") return <Cpu size={14} className="text-ares-cyan" aria-hidden="true" />;
    if (id === "seasons" || id === "tournaments") return <Trophy size={14} className="text-ares-gold" aria-hidden="true" />;
    if (id === "outreach") return <Sparkles size={14} className="text-ares-red" aria-hidden="true" />;
    if (id === "calendar") return <Calendar size={14} className="text-ares-red" aria-hidden="true" />;
    if (id === "store") return <ShoppingBag size={14} className="text-ares-bronze" aria-hidden="true" />;
    return <Users size={14} className="text-ares-cyan" aria-hidden="true" />;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open quick jump search"
        aria-keyshortcuts="Control+K Meta+K"
        className="flex h-9 items-center gap-2 rounded border border-white/15 bg-white/5 px-2.5 text-xs font-bold text-marble/85 transition-colors hover:border-ares-gold/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        <Search size={14} className="text-ares-gold" aria-hidden="true" />
        <span className="hidden 2xl:inline text-[11px] uppercase tracking-wider">Quick Jump</span>
        <kbd className="hidden sm:inline-block rounded border border-white/15 bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-marble/65">
          Ctrl K
        </kbd>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="command-palette-title"
          onClick={closePalette}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/80 px-4 pt-20 pb-8 backdrop-blur-sm"
        >
          <div
            ref={dialogRef}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-obsidian shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <Search size={18} className="text-ares-gold shrink-0" aria-hidden="true" />
              <label htmlFor="command-palette-input" id="command-palette-title" className="sr-only">
                Quick jump to any portal page, tool, or game
              </label>
              <input
                ref={inputRef}
                id="command-palette-input"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSelectedIndex((prev) =>
                      filteredItems.length === 0 ? 0 : (prev + 1) % filteredItems.length,
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSelectedIndex((prev) =>
                      filteredItems.length === 0
                        ? 0
                        : (prev - 1 + filteredItems.length) % filteredItems.length,
                    );
                  } else if (event.key === "Enter" && filteredItems[selectedIndex]) {
                    event.preventDefault();
                    handleSelect(filteredItems[selectedIndex]);
                  }
                }}
                placeholder="Jump to page, robot fleet, academy, arcade..."
                className="w-full bg-transparent text-sm text-white placeholder-marble/45 focus:outline-none"
              />
              <button
                type="button"
                onClick={closePalette}
                aria-label="Close quick jump search"
                className="rounded p-1.5 text-marble/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label="Quick jump destinations">
              {filteredItems.length === 0 ? (
                <p className="py-8 text-center text-xs text-marble/55">
                  No matching destinations for &ldquo;{query}&rdquo;.
                </p>
              ) : (
                filteredItems.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => handleSelect(item)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-ares-gold/15 text-white border border-ares-gold/30"
                          : "border border-transparent text-marble/80 hover:bg-white/5"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        {getCategoryIcon(item.category, item.id)}
                        <span className="truncate text-xs font-bold">{item.label}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="rounded bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-marble/55">
                          {item.category}
                        </span>
                        <ArrowUpRight size={13} className="text-marble/45" aria-hidden="true" />
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-4 py-2 text-[10px] font-mono text-marble/55">
              <span>↑↓ Navigate · Enter Open · Esc Close</span>
              <span>{filteredItems.length} destinations</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
