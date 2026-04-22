import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, FileText, Calendar, ShieldCheck, HelpCircle, Terminal, Home, ArrowRight } from "lucide-react";
import { authClient } from "../utils/auth-client";
import { sanitizeHtml } from "../utils/security";
import { publicApi } from "../api/publicApi";

interface SearchResult {
  slug?: string;
  url?: string;
  title: string;
  category: string;
  snippet?: string;
  icon?: React.ReactNode;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle Command Palette with Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    
    const handleCustomOpen = () => setIsOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleCustomOpen);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleCustomOpen);
    };
  }, []);

   
  // @ts-expect-error - BetterAuth session typing
  const userRole = session?.user?.role;

  // Static Quick Links routes
  const staticLinks = useMemo(() => {
    const links: SearchResult[] = [
      { title: "Home Base", category: "Navigation", url: "/", icon: <Home size={16} /> },
      { title: "Team Dashboard", category: "Navigation", url: "/dashboard", icon: <Terminal size={16} /> },
      { title: "Technical Documentation", category: "Navigation", url: "/docs", icon: <FileText size={16} /> },
      { title: "Team Activity & Events", category: "Navigation", url: "/events", icon: <Calendar size={16} /> },
      { title: "Sponsorships & ROI", category: "Navigation", url: "/sponsors", icon: <ShieldCheck size={16} /> },
      { title: "Join The Team", category: "Navigation", url: "/join", icon: <HelpCircle size={16} /> },
    ];
    if (userRole === "admin") {
      links.push({ title: "Judges Hub Console", category: "Admin", url: "/judges", icon: <ShieldCheck size={16} /> });
    }
    return links;
  }, [userRole]);

  // Handle Search Input & D1 API Call
  useEffect(() => {
    if (query.trim().length < 2) {
      const timer = setTimeout(() => {
        setResults(
          staticLinks.filter((link) => 
            link.title.toLowerCase().includes(query.toLowerCase()) || 
            link.category.toLowerCase().includes(query.toLowerCase())
          )
        );
      }, 0);
      return () => clearTimeout(timer);
    }

    const fetchSearch = async () => {
      setIsSearching(true);
      try {
        const data = await publicApi.get<{ results: Array<{ type: string; id: string; title: string; matched_text?: string }> }>(`/api/search?q=${encodeURIComponent(query)}`);
        
        const searchResults: SearchResult[] = (data.results || []).map(r => {
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
            title: r.title,
            category: r.type.charAt(0).toUpperCase() + r.type.slice(1),
            url,
            snippet: r.matched_text,
            icon
          };
        });

        // Combine matched static links with dynamic D1 search
        const matchedStaticLinks = staticLinks.filter((link) => 
          link.title.toLowerCase().includes(query.toLowerCase()) || 
          link.category.toLowerCase().includes(query.toLowerCase())
        );

        setResults([...matchedStaticLinks, ...searchResults]);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchSearch, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [query, userRole, staticLinks]);

  // Handle Keyboard Navigation (Up/Down/Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const handleSelect = (item: SearchResult) => {
    setIsOpen(false);
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

  // Handle focus when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-2xl bg-obsidian border border-white/5 rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col ring-1 ring-white/10"
          >
            {/* Input Header */}
            <div className="flex items-center px-6 py-5 border-b border-white/5 bg-white/[0.02]">
              <Search className="text-marble/40 mr-3 shrink-0" size={20} />
              <input
                ref={inputRef}
                className="w-full bg-transparent border-none outline-none text-white placeholder-marble/30 font-mono text-lg"
                placeholder="Search documentation, routes, workflows..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
              />
              <div className="flex shrink-0 items-center gap-1 ml-3 hidden sm:flex">
                <kbd className="bg-white/10 text-marble/40 text-xs px-2 py-1 rounded font-mono border border-white/10">ESC</kbd>
                <span className="text-xs text-marble/40 ml-1">to close</span>
              </div>
            </div>

            {/* Results Body */}
            <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {isSearching && query.length >= 2 && results.length === 0 ? (
                 <div className="p-8 text-center text-marble/40 animate-pulse font-mono flex items-center justify-center gap-2">
                   <Terminal className="text-ares-cyan" size={16} /> Scanning D1 nodes...
                 </div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center text-marble/40 font-bold uppercase tracking-widest text-sm">
                  No vectors matched telemetry.
                </div>
              ) : (
                results.map((res, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(res)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left flex items-center px-4 py-3 rounded-lg mb-1 transition-colors ares-cut-sm group ${
                      selectedIndex === idx
                        ? "bg-ares-red/20 border-l-2 border-ares-red text-white"
                        : "text-marble/40 hover:bg-white/5 border-l-2 border-transparent"
                    }`}
                  >
                    <div className={`mr-4 shrink-0 transition-colors ${selectedIndex === idx ? "text-ares-red" : "text-marble/30"}`}>
                      {res.icon}
                    </div>
                    
                    <div className="flex-1 overflow-hidden">
                       <div className="flex items-center gap-2">
                          <h4 className={`font-bold transition-colors ${selectedIndex === idx ? "text-white" : "text-marble/80"}`}>
                            {res.title}
                          </h4>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-marble/30 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 shrink-0">
                            {res.category}
                          </span>
                       </div>
                       
                       {res.snippet && (
                         <p className="text-xs text-marble/40 line-clamp-1 mt-1 font-mono leading-relaxed" 
                           dangerouslySetInnerHTML={{__html: sanitizeHtml(res.snippet)}} 
                         />
                       )}
                    </div>

                    <ArrowRight className={`shrink-0 ml-4 transition-all ${selectedIndex === idx ? "text-ares-red opacity-100 transform translate-x-1" : "text-marble/20 opacity-0 transform -translate-x-2"}`} size={16} />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
