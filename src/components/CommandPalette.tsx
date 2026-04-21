import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, FileText, Calendar, ShieldCheck, HelpCircle, Terminal, Home, ArrowRight } from "lucide-react";
import { authClient } from "../utils/auth-client";

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
    if (session?.user?.role === "admin") {
      links.push({ title: "Judges Hub Console", category: "Admin", url: "/judges", icon: <ShieldCheck size={16} /> });
    }
    return links;
  }, [session?.user?.role]);

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
        const res = await fetch(`/api/docs/search?q=${encodeURIComponent(query)}`);
        const data = await res.json() as { results: Array<{ title: string; category: string; slug: string; snippet?: string }> };
        
        const docResults: SearchResult[] = (data.results || []).map(r => ({
          title: r.title,
          category: r.category,
          slug: r.slug,
          snippet: r.snippet,
          icon: <FileText size={16} />
        }));

        // Combine matched static links with dynamic D1 search
        const matchedStaticLinks = staticLinks.filter((link) => 
          link.title.toLowerCase().includes(query.toLowerCase()) || 
          link.category.toLowerCase().includes(query.toLowerCase())
        );

        setResults([...matchedStaticLinks, ...docResults]);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchSearch, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [query, session?.user?.role, staticLinks]);

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
            className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl shadow-ares-red/10 overflow-hidden flex flex-col"
          >
            {/* Input Header */}
            <div className="flex items-center px-4 py-4 border-b border-zinc-800 bg-zinc-900/50">
              <Search className="text-zinc-400 mr-3 shrink-0" size={20} />
              <input
                ref={inputRef}
                className="w-full bg-transparent border-none outline-none text-white placeholder-zinc-500 font-mono text-lg"
                placeholder="Search documentation, routes, workflows..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
              />
              <div className="flex shrink-0 items-center gap-1 ml-3 hidden sm:flex">
                <kbd className="bg-zinc-800 text-zinc-400 text-xs px-2 py-1 rounded font-mono border border-zinc-700">ESC</kbd>
                <span className="text-xs text-zinc-500 ml-1">to close</span>
              </div>
            </div>

            {/* Results Body */}
            <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              {isSearching && query.length >= 2 && results.length === 0 ? (
                 <div className="p-8 text-center text-zinc-500 animate-pulse font-mono flex items-center justify-center gap-2">
                   <Terminal className="text-ares-cyan" size={16} /> Scanning D1 nodes...
                 </div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 font-bold uppercase tracking-widest text-sm">
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
                        : "text-zinc-400 hover:bg-zinc-900 border-l-2 border-transparent"
                    }`}
                  >
                    <div className={`mr-4 shrink-0 transition-colors ${selectedIndex === idx ? "text-ares-red" : "text-zinc-600"}`}>
                      {res.icon}
                    </div>
                    
                    <div className="flex-1 overflow-hidden">
                       <div className="flex items-center gap-2">
                          <h4 className={`font-bold transition-colors ${selectedIndex === idx ? "text-white" : "text-zinc-200"}`}>
                            {res.title}
                          </h4>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800 shrink-0">
                            {res.category}
                          </span>
                       </div>
                       
                       {res.snippet && (
                         <p className="text-xs text-zinc-500 line-clamp-1 mt-1 font-mono leading-relaxed" 
                           dangerouslySetInnerHTML={{__html: res.snippet}} 
                         />
                       )}
                    </div>

                    <ArrowRight className={`shrink-0 ml-4 transition-all ${selectedIndex === idx ? "text-ares-red opacity-100 transform translate-x-1" : "text-zinc-700 opacity-0 transform -translate-x-2"}`} size={16} />
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
