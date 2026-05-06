
import { useState, useEffect, useRef, useMemo, useTransition } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, FileText, Calendar, ShieldCheck, HelpCircle, Terminal, Home, ArrowRight, Bot } from "lucide-react";
import { authClient } from "../utils/auth-client";
import { sanitizeHtml } from "../utils/security";
import { useSearch } from "../api/analytics";
import { Command } from "cmdk";
import { useUIStore } from "../store/uiStore";

interface SearchResult {
  id: string; // Add id for cmdk value tracking
  slug?: string;
  url?: string;
  title: string;
  category: string;
  snippet?: string;
  icon?: React.ReactNode;
}

export default function CommandPalette() {
  const { isCommandPaletteOpen: isOpen, setCommandPaletteOpen: setIsOpen, setChatbotOpen } = useUIStore();
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<SearchResult[]>([]);

  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const lastActiveElement = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Search query using React Query
  const { data: searchData, isLoading: isSearching } = useSearch(query);

  // Toggle Command Palette with Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (!isOpen) {
          lastActiveElement.current = document.activeElement as HTMLElement;
        }
        setIsOpen(!isOpen);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    
    const handleCustomOpen = () => {
      lastActiveElement.current = document.activeElement as HTMLElement;
      setIsOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleCustomOpen);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleCustomOpen);
    };
  }, [isOpen, setIsOpen]);

  // Focus Trap Logic
  useEffect(() => {
    if (!isOpen) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (!modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else { // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  // Restore focus when palette closes
  useEffect(() => {
    if (!isOpen && lastActiveElement.current) {
      lastActiveElement.current.focus();
    }
  }, [isOpen]);

  // Handle Input Change with Transition
  const handleValueChange = (v: string) => {
    setInputValue(v);
    startTransition(() => {
      setQuery(v);
    });
  };

  const userRole = (session?.user as Record<string, unknown> | undefined)?.role;

  // Static Quick Links routes
  const staticLinks = useMemo(() => {
    const links: SearchResult[] = [
      { id: "static-home", title: "Home Base", category: "Navigation", url: "/", icon: <Home size={16} /> },
      { id: "static-dash", title: "Team Dashboard", category: "Navigation", url: "/dashboard", icon: <Terminal size={16} /> },
      { id: "static-docs", title: "Technical Documentation", category: "Navigation", url: "/docs", icon: <FileText size={16} /> },
      { id: "static-events", title: "Team Activity & Events", category: "Navigation", url: "/events", icon: <Calendar size={16} /> },
      { id: "static-sponsors", title: "Sponsorships & ROI", category: "Navigation", url: "/sponsors", icon: <ShieldCheck size={16} /> },
      { id: "static-join", title: "Join The Team", category: "Navigation", url: "/join", icon: <HelpCircle size={16} /> },
    ];
    if (userRole === "admin") {
      links.push({ id: "static-admin", title: "Judges Hub Console", category: "Admin", url: "/judges", icon: <ShieldCheck size={16} /> });
    }
    return links;
  }, [userRole]);

  // Handle Search Input & D1 API Call
  useEffect(() => {
    const filtered = staticLinks.filter((link) =>
      link.title.toLowerCase().includes(query.toLowerCase()) ||
      link.category.toLowerCase().includes(query.toLowerCase())
    );

    startTransition(() => {
      if (searchData?.results) {
        const searchResults: SearchResult[] = searchData.results.map((r: { id: string; type: string; title: string; matched_text?: string }) => {
          let icon = <FileText size={16} />;
          let url = "";
          if (r.type === "blog") {
             icon = <Terminal size={16} />;
             url = `/blog/${r.id}`;
          } else if (r.type === "event") {
             icon = <Calendar size={16} />;
             url = `/events/${r.id}`;
          } else if (r.type === "doc") {
             icon = <FileText size={16} />;
             url = `/docs/${r.id}`;
          } else if (r.type === "user") {
             icon = <ShieldCheck size={16} />;
             url = `/profile/${r.id}`;
          }

          return {
            id: `d1-${r.type}-${r.id}`,
            title: r.title,
            category: r.type.charAt(0).toUpperCase() + r.type.slice(1),
            url,
            snippet: r.matched_text,
            icon
          };
        });

        setResults([...filtered, ...searchResults]);
      } else {
        setResults(filtered);
      }
    });
  }, [query, staticLinks, searchData]);

  const handleSelect = (item: SearchResult) => {
    setIsOpen(false);
    setInputValue("");
    setQuery("");
    if (item.url) {
      navigate(item.url);
    } else if (item.slug) {
      navigate(`/docs/${item.slug}`);
    }
  };

  // Close when clicking outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-modal bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-2xl bg-obsidian border border-white/5 ares-cut-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col ring-1 ring-white/10"
          >
            <Command 
              shouldFilter={false} 
              loop
              className="flex flex-col w-full h-full"
            >
              {/* Tabs Header */}
              <div className="flex border-b border-white/5 bg-white/[0.02]">
                <button
                  className="flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-colors text-white border-b-2 border-ares-cyan flex justify-center items-center gap-2"
                >
                  <Search size={14} />
                  Search
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setChatbotOpen(true);
                  }}
                  className="flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-colors text-marble/60 hover:text-white border-b-2 border-transparent hover:border-white/20 flex justify-center items-center gap-2"
                >
                  <Bot size={14} />
                  Ask AI
                </button>
              </div>

              {/* Input Header */}
              <div className="flex items-center px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                <Search className={`transition-colors ${isPending ? 'text-ares-cyan animate-pulse' : 'text-marble/60'} mr-3 shrink-0`} size={20} />
                <Command.Input
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  className="w-full bg-transparent border-none outline-none text-white placeholder-marble/30 font-mono text-lg"
                  placeholder="Search documentation, routes, workflows..."
                  value={inputValue}
                  onValueChange={handleValueChange}
                />
                <div className="shrink-0 items-center gap-1 ml-3 hidden sm:flex">
                  <kbd className="bg-white/10 text-marble/60 text-xs px-2 py-1 rounded font-mono border border-white/10">ESC</kbd>
                  <span className="text-xs text-marble/60 ml-1">to close</span>
                </div>
              </div>

              {/* Results Body */}
              <Command.List 
                className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                aria-live="polite"
              >
                {(isSearching || isPending) && query.length >= 2 && results.length === 0 ? (
                  <Command.Loading>
                    <div className="p-8 text-center text-marble/60 animate-pulse font-mono flex items-center justify-center gap-2">
                      <Terminal className="text-ares-cyan" size={16} /> Scanning D1 nodes...
                    </div>
                  </Command.Loading>
                ) : (
                  <Command.Empty>
                    <div className="p-8 text-center text-marble/60 font-bold uppercase tracking-widest text-sm">
                      No vectors matched telemetry.
                    </div>
                  </Command.Empty>
                )}

                {results.map((res) => (
                  <Command.Item
                    key={res.id}
                    value={res.id}
                    onSelect={() => handleSelect(res)}
                    className="w-full text-left flex items-center px-4 py-3 mb-1 transition-colors ares-cut-sm cursor-pointer data-[selected=true]:bg-ares-red/20 data-[selected=true]:border-l-2 data-[selected=true]:border-ares-red data-[selected=true]:text-white border-l-2 border-transparent text-marble/60 hover:bg-white/5 font-bold"
                  >
                    <div className="mr-4 shrink-0 transition-colors group-data-[selected=true]:text-ares-red text-marble/30">
                      {res.icon}
                    </div>
                    
                    <div className="flex-1 overflow-hidden">
                       <div className="flex items-center gap-2">
                          <h4 className="font-bold transition-colors group-data-[selected=true]:text-white text-marble">
                            {res.title}
                          </h4>
                          <span className="text-xs font-bold uppercase tracking-widest text-marble/30 bg-white/5 px-2 py-0.5 ares-cut-sm border border-white/10 shrink-0">
                            {res.category}
                          </span>
                       </div>
                       
                       {res.snippet && (
                         <p className="text-xs text-marble/60 line-clamp-1 mt-1 font-mono leading-relaxed" 
                           dangerouslySetInnerHTML={{__html: sanitizeHtml(res.snippet)}} 
                         />
                       )}
                    </div>

                    <ArrowRight className="shrink-0 ml-4 transition-all group-data-[selected=true]:text-ares-red group-data-[selected=true]:opacity-100 group-data-[selected=true]:translate-x-1 text-marble/20 opacity-0 -translate-x-2" size={16} />
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
