import { useState, useEffect } from "react";
import { X, Search, FileText, Calendar as CalendarIcon, ArrowRight, Book, User } from "lucide-react";
import { Link } from "react-router-dom";

type SearchResult = {
  type: "blog" | "event" | "doc" | "user";
  id: string; // slug for blog, id for event
  title: string;
  matched_text: string;
};

export default function GlobalSearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        // @ts-expect-error -- D1 untyped response
        setResults(json.results || []);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-start justify-center p-4 pt-20">
      <div className="bg-zinc-950 border border-zinc-800 shadow-2xl ares-cut w-full max-w-2xl flex flex-col overflow-hidden relative">
        
        {/* Search Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-800 bg-black/40">
          <Search className="text-ares-gold" size={24} aria-hidden="true" />
          <label htmlFor="globalSearch" className="sr-only">Search ARES Portal</label>
          <input
            id="globalSearch"
            type="text"
            placeholder="Search blogs, events, and documentation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent border-none text-white text-lg placeholder-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan font-heading"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="px-6 py-12 text-center text-zinc-500">
              <Search size={40} className="mx-auto mb-4 opacity-50" aria-hidden="true" />
              <p className="font-mono text-sm">Type at least 2 characters to search the ARES Vault.</p>
            </div>
          ) : isSearching ? (
            <div className="px-6 py-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-zinc-800 border-t-ares-gold rounded-full animate-spin"></div>
            </div>
          ) : results.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-500">
              <p className="font-mono text-sm">No match found for &ldquo;{query}&rdquo;.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {results.map((r, i) => (
                <Link
                  key={`${r.type}-${r.id}-${i}`}
                  to={r.type === "blog" ? `/blog/${r.id}` : r.type === "event" ? `/events/${r.id}` : r.type === "doc" ? `/docs/${r.id}` : `/roster/${r.id}`}
                  onClick={onClose}
                  className="group flex flex-col sm:flex-row sm:items-center gap-4 p-4 px-6 border-b border-zinc-800/50 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:bg-white/5 focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <div className="shrink-0 w-10 h-10 ares-cut-sm bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-ares-gold group-hover:border-ares-gold/50 transition-colors">
                    {r.type === "blog" ? <FileText size={20} aria-hidden="true" /> : r.type === "event" ? <CalendarIcon size={20} aria-hidden="true" /> : r.type === "doc" ? <Book size={20} aria-hidden="true" /> : <User size={20} aria-hidden="true" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${r.type === "blog" ? "bg-ares-gold/20 text-ares-gold" : r.type === "event" ? "bg-ares-cyan/20 text-ares-cyan" : r.type === "doc" ? "bg-white/10 text-white" : "bg-ares-red/20 text-ares-red"}`}>
                        {r.type}
                      </span>
                      <h3 className="text-white font-bold truncate group-hover:text-ares-gold transition-colors">{r.title}</h3>
                    </div>
                    {r.matched_text && (
                      <p className="text-xs text-zinc-500 font-mono truncate">{r.matched_text}</p>
                    )}
                  </div>
                  <ArrowRight size={16} className="text-zinc-600 group-hover:text-ares-gold -translate-x-2 group-hover:translate-x-0 transition-all hidden sm:block" aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
