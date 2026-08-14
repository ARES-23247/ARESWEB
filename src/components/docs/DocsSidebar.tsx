import { memo, useCallback, useEffect, useRef, useState } from "react";
import { siteConfig } from "@/lib/site-config";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, ChevronRight, ChevronDown, Menu, X, ExternalLink, GraduationCap } from "lucide-react";
import { useSidebarStore } from "@/store/sidebarStore";

export interface DocRecord {
  slug: string;
  title: string;
  category: string;
  sortOrder: number;
  description: string;
  content: string;
  status: string;
  isDeleted: number;
  isPortfolio: number;
  isExecutiveSummary: number;
  displayInAreslib: number;
  displayInMathCorner: number;
  displayInScienceCorner: number;
  updatedAt?: string;
  original_authorNickname?: string;
  original_authorAvatar?: string;
}

interface DocsSidebarProps {
  groupedDocs: [string, DocRecord[]][];
  currentSlug?: string;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSearchOpen: () => void;
  basePath?: string;
}

function DocsSidebar({ groupedDocs, currentSlug, onSearchOpen, basePath = "/docs" }: DocsSidebarProps) {
  const docsOpen = useSidebarStore((s) => s.docsOpen);
  const docsExpandedCategories = useSidebarStore((s) => s.docsExpandedCategories);
  const toggleDocs = useSidebarStore((s) => s.toggleDocs);
  const toggleDocsCategory = useSidebarStore((s) => s.toggleDocsCategory);
  const setDocsExpandedCategories = useSidebarStore((s) => s.setDocsExpandedCategories);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(min-width: 1024px)");
    if (!query) return;
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const expanded = new Set(docsExpandedCategories);
    if (expanded.size === 0) groupedDocs.forEach(([category]) => expanded.add(category));
    if (currentSlug) {
      groupedDocs.forEach(([category, docs]) => {
        if (docs.some((doc) => doc.slug === currentSlug)) expanded.add(category);
      });
    }
    if (expanded.size !== docsExpandedCategories.size) setDocsExpandedCategories(expanded);
  }, [currentSlug, docsExpandedCategories, groupedDocs, setDocsExpandedCategories]);

  useEffect(() => {
    if (docsOpen && !isDesktop) searchRef.current?.focus();
    if (!docsOpen && wasOpen.current && !isDesktop) triggerRef.current?.focus();
    wasOpen.current = docsOpen;
  }, [docsOpen, isDesktop]);

  useEffect(() => {
    if (!docsOpen || isDesktop) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") toggleDocs();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [docsOpen, isDesktop, toggleDocs]);

  const toggleCat = useCallback((cat: string) => {
    toggleDocsCategory(cat);
  }, [toggleDocsCategory]);

  return (
    <>
      <button
        ref={triggerRef}
        className="fixed bottom-6 right-6 z-40 lg:hidden bg-ares-red text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg font-bold"
        onClick={toggleDocs}
        aria-label={docsOpen ? "Close documentation navigation" : "Open documentation navigation"}
        aria-expanded={docsOpen}
        aria-controls="documentation-sidebar"
      >
        {docsOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <AnimatePresence>
        {docsOpen && (
          <motion.button
            type="button"
            aria-label="Close documentation navigation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleDocs}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        id="documentation-sidebar"
        aria-label="Documentation navigation"
        aria-hidden={!isDesktop && !docsOpen}
        inert={!isDesktop && !docsOpen ? true : undefined}
        role={!isDesktop ? "dialog" : undefined}
        aria-modal={!isDesktop ? true : undefined}
        className={`
        fixed lg:sticky top-0 left-0 z-30 h-screen w-72 shrink-0
        bg-obsidian border-r border-white/8
        overflow-y-auto overscroll-contain
        transition-transform duration-300
        ${docsOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        pt-24 pb-8 px-4
      `}>
        <div className="mb-6 px-2">
          <Link to={basePath} className="flex items-center shadow-lg ares-cut-sm overflow-hidden group w-fit">
            <span className="bg-ares-red px-3 py-1.5 text-xs font-heading font-bold uppercase text-white tracking-wider border-r border-white/10">ARES</span>
            <span className="bg-white/10 text-white font-heading font-medium px-3 py-1.5 text-xs uppercase tracking-widest group-hover:bg-white/20 transition-colors">
              {basePath.includes("academy") ? "Academy" : "Lib"}
            </span>
          </Link>
        </div>

        <button
          ref={searchRef}
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
                aria-expanded={docsExpandedCategories.has(category)}
                aria-controls={`docs-category-${category.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-white hover:text-ares-gold transition-colors"
              >
                {docsExpandedCategories.has(category) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {category}
              </button>
              <AnimatePresence>
                {docsExpandedCategories.has(category) && (
                  <motion.div
                    id={`docs-category-${category.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {docs.map((doc) => (
                      <Link
                        key={doc.slug}
                        to={`${basePath}/${doc.slug}`}
                        className={`block pl-6 pr-2 py-1.5 text-sm ares-cut-sm transition-colors ${
                          currentSlug === doc.slug
                            ? "bg-ares-red text-white font-bold"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        }`}
                        aria-current={currentSlug === doc.slug ? "page" : undefined}
                        onClick={() => {
                          // Close sidebar on mobile after navigation
                          if (window.innerWidth < 1024) {
                            toggleDocs();
                          }
                        }}
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

        <div className="mt-8 px-2 border-t border-white/8 pt-4 space-y-3">
          <Link
            to="/academy/workshops"
            className="flex items-center gap-2 text-sm text-ares-gold hover:text-white transition-colors"
          >
            <GraduationCap size={14} />
            STEM Workshops
          </Link>
          <a
            href={`https://${siteConfig.urls.githubOrg}.github.io/ARESLib/javadoc/index.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-white/60 hover:text-ares-gold transition-colors"
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
