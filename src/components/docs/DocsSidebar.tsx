import { memo, useCallback, useState } from "react";
import { siteConfig } from "../../site.config";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, ChevronRight, ChevronDown, Menu, X, ExternalLink } from "lucide-react";

interface DocRecord {
  slug: string;
  title: string;
  category: string;
  sort_order: number;
  description: string;
}

interface DocsSidebarProps {
  groupedDocs: [string, DocRecord[]][];
  currentSlug?: string;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSearchOpen: () => void;
}

function DocsSidebar({ groupedDocs, currentSlug, onSearchOpen }: DocsSidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [prevSlugs, setPrevSlugs] = useState(groupedDocs.map(([cat]) => cat).join(","));
  const currSlugs = groupedDocs.map(([cat]) => cat).join(",");
  if (currSlugs !== prevSlugs && groupedDocs.length > 0) {
    setPrevSlugs(currSlugs);
    setExpandedCats(new Set(groupedDocs.map(([cat]) => cat)));
  }

  const [prevCurrentSlug, setPrevCurrentSlug] = useState(currentSlug);
  if (currentSlug !== prevCurrentSlug) {
    setPrevCurrentSlug(currentSlug);
    setSidebarOpen(false);
    if (currentSlug) {
      const newCats = new Set(expandedCats);
      let changed = false;
      for (const [cat, docs] of groupedDocs) {
        if (docs.some(d => d.slug === currentSlug) && !newCats.has(cat)) {
          newCats.add(cat);
          changed = true;
        }
      }
      if (changed) setExpandedCats(newCats);
    }
  }

  const toggleCat = useCallback((cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  return (
    <>
      <button
        className="fixed bottom-6 right-6 z-40 lg:hidden bg-ares-red text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`
        fixed lg:sticky top-0 left-0 z-30 h-screen w-72 shrink-0
        bg-ares-gray-deep border-r border-white/8
        overflow-y-auto overscroll-contain
        transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        pt-24 pb-8 px-4
      `}>
        <div className="mb-6 px-2">
          <Link to="/docs" className="flex items-center shadow-lg ares-cut-sm overflow-hidden group w-fit">
            <span className="bg-ares-red px-3 py-1.5 text-xs font-heading font-bold uppercase text-white tracking-wider border-r border-white/10">ARES</span>
            <span className="bg-white/10 text-white font-heading font-medium px-3 py-1.5 text-xs uppercase tracking-widest group-hover:bg-white/20 transition-colors">Lib</span>
          </Link>
        </div>

        <button
          onClick={onSearchOpen}
          className="w-full flex items-center gap-2 px-3 py-2 mb-6 ares-cut-sm bg-white/5 border border-white/10 text-white text-sm hover:border-ares-red/40 transition-colors"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Search docs...</span>
          <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>

        <nav className="space-y-1">
          {groupedDocs.map(([category, docs]) => (
            <div key={category}>
              <button
                onClick={() => toggleCat(category)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-white hover:text-ares-gold transition-colors"
              >
                {expandedCats.has(category) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {category}
              </button>
              <AnimatePresence>
                {expandedCats.has(category) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {docs.map((doc) => (
                      <Link
                        key={doc.slug}
                        to={`/docs/${doc.slug}`}
                        className={`block pl-6 pr-2 py-1.5 text-sm ares-cut-sm transition-colors ${
                          currentSlug === doc.slug
                            ? "bg-ares-red/15 text-ares-red font-bold border-l-2 border-ares-red"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {doc.title}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>

        <div className="mt-8 px-2 border-t border-white/8 pt-4">
          <a
            href={`https://${siteConfig.urls.githubOrg}.github.io/ARESLib/javadoc/index.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-white hover:text-ares-gold transition-colors"
          >
            <ExternalLink size={14} />
            API Javadoc
          </a>
        </div>
      </aside>
    </>
  );
}

export default memo(DocsSidebar);
