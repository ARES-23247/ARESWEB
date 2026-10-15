import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

export interface AcademySearchResult {
  slug: string;
  title: string;
  category: string;
  snippet: string;
}

interface AcademySearchModalProps {
  searchOpen: boolean;
  searchQuery: string;
  searchResults: AcademySearchResult[];
  onSearchQueryChange: (query: string) => void;
  onClose: () => void;
  onSelectResult: (slug: string) => void;
}

export default function AcademySearchModal({
  searchOpen,
  searchQuery,
  searchResults,
  onSearchQueryChange,
  onClose,
  onSelectResult,
}: AcademySearchModalProps) {
  const searchRef = useFocusTrap(searchOpen, onClose);

  return (
    <AnimatePresence>
      {searchOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
          onClick={onClose}
        >
          <motion.div
            ref={searchRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="documentation-search-title"
            tabIndex={-1}
            initial={{ y: -20, scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -20, scale: 0.95 }}
            className="w-full max-w-2xl bg-obsidian border border-white/10 ares-cut-sm shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="documentation-search-title" className="sr-only">
              Search documentation
            </h2>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <Search size={18} className="text-white/60" />
              <input
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Search documentation..."
                aria-label="Search documentation"
                className="flex-1 bg-transparent text-white outline-none text-lg placeholder:text-white/60"
              />
              <kbd className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded font-mono">
                ESC
              </kbd>
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-80 overflow-y-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.slug}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 transition-colors cursor-pointer"
                    onClick={() => onSelectResult(r.slug)}
                  >
                    <div className="text-sm font-bold text-white">{r.title}</div>
                    <div className="text-xs text-ares-gold/80 mb-1">
                      {r.category}
                    </div>
                    <div className="text-xs text-white/60 line-clamp-2">
                      {r.snippet}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="px-4 py-8 text-center text-white/60 text-sm">
                No results found.
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
