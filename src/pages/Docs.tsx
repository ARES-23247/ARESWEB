import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import SwerveSimulator from "../components/SwerveSimulator";
import SOTMSimulator from "../components/SOTMSimulator";
import { motion, AnimatePresence } from "framer-motion";
import { Search, BookOpen, Link as LinkIcon, Edit2, ChevronRight, ChevronDown, Menu, X, ExternalLink, ArrowLeft, ArrowRight } from "lucide-react";
import SEO from "../components/SEO";
import ConfigVisualizer from "../components/docs/ConfigVisualizer";
import CodePlayground from "../components/docs/CodePlayground";
import ScreenshotGallery from "../components/docs/ScreenshotGallery";
import FaultSim from "../components/FaultSim";
import PhysicsSim from "../components/PhysicsSim";
import SysIdSim from "../components/SysIdSim";
import VisionSim from "../components/VisionSim";
import ZeroAllocationSim from "../components/ZeroAllocationSim";
import FieldVisualizer from "../components/FieldVisualizer";
import TroubleshootingWizard from "../components/TroubleshootingWizard";
import PerformanceDashboard from "../components/PerformanceDashboard";
import ArmKgSim from "../components/ArmKgSim";
import AutoSim from "../components/AutoSim";
import ElevatorPidSim from "../components/ElevatorPidSim";
import FlywheelKvSim from "../components/FlywheelKvSim";
import InteractiveTutorial from "../components/InteractiveTutorial";
import PowerSheddingSim from "../components/PowerSheddingSim";
import StateMachineSim from "../components/StateMachineSim";
import TiptapRenderer from "../components/TiptapRenderer";
import { CodeBlock } from "../components/docs/CodeBlock";

interface DocRecord {
  slug: string;
  title: string;
  category: string;
  sort_order: number;
  description: string;
  content?: string;
  updated_at?: string;
  snippet?: string;
}

interface SearchResult {
  slug: string;
  title: string;
  category: string;
  snippet: string;
}

// ── Sidebar structure matching Starlight layout ──────────────────────
const SIDEBAR_ORDER = [
  "Getting Started",
  "Migration Guides",
  "Support",
  "Community",
  "Reference",
  "The ARESLib Standard",
  "Foundation Track",
  "Precision Track",
  "Reliability Track",
  "HMI & Control",
];

export default function Docs() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  // ── 1. State ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Sync state variables for render-phase updates
  const [hasInitializedDocs, setHasInitializedDocs] = useState(false);
  const [prevDocCategory, setPrevDocCategory] = useState<string | undefined>(undefined);
  const [prevSlug, setPrevSlug] = useState<string | undefined>(slug);

  // ── 2. Data Fetching (useQuery) ──────────────────────────────────────
  const { data: allDocs = [] } = useQuery<DocRecord[]>({
    queryKey: ["docs-list"],
    queryFn: async () => {
      const r = await fetch("/api/docs");
      const data = await r.json();
      return data.docs ?? [];
    },
  });

  const { data: currentDoc, isLoading: docLoading } = useQuery<DocRecord>({
    queryKey: ["doc", slug],
    queryFn: async () => {
      const r = await fetch(`/api/docs/${slug}`);
      if (!r.ok) throw new Error("Not found");
      const data = await r.json();
      return data.doc;
    },
    enabled: !!slug,
  });

  const { data: searchResults = [] } = useQuery<SearchResult[]>({
    queryKey: ["docs-search", searchQuery],
    queryFn: async () => {
      const r = await fetch(`/api/docs/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await r.json();
      return data.results ?? [];
    },
    enabled: searchQuery.length >= 2,
  });

  // ── 3. Computed Values (useMemo) ────────────────────────────────────
  const groupedDocsList = useMemo(() => {
    const groups: Record<string, DocRecord[]> = {};
    for (const doc of allDocs) {
      if (!groups[doc.category]) groups[doc.category] = [];
      groups[doc.category].push(doc);
    }
    const ordered: [string, DocRecord[]][] = [];
    for (const cat of SIDEBAR_ORDER) {
      if (groups[cat]) ordered.push([cat, groups[cat]]);
    }
    for (const [cat, docs] of Object.entries(groups)) {
      if (!SIDEBAR_ORDER.includes(cat)) ordered.push([cat, docs]);
    }
    return ordered;
  }, [allDocs]);

  // Helper to remove HTML tags from strings
  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const tableOfContents = useMemo(() => {
    if (!currentDoc?.content) return [];
    
    // Check if it's Tiptap JSON
    try {
      // Robust JSON check: must start with { and contain type: doc
      const trimmed = currentDoc.content.trim();
      if (trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed);
        if (parsed.type === "doc" && parsed.content) {
          const headings: { level: number; text: string; id: string }[] = [];
          const findHeadings = (node: { type?: string; attrs?: { level?: number }; content?: { text?: string }[] }) => {
            if (node.type === "heading" && (node.attrs?.level === 2 || node.attrs?.level === 3)) {
              const text = node.content?.map((c) => c.text || "").join("") || "";
              const cleanText = stripHtml(text);
              const id = cleanText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              headings.push({ level: node.attrs.level, text: cleanText, id });
            }
            if (node.content && Array.isArray(node.content)) {
              node.content.forEach(c => findHeadings(c));
            }
          };
          findHeadings(parsed);
          return headings;
        }
      }
    } catch (_) { // eslint-disable-line @typescript-eslint/no-unused-vars
      // Not JSON, treat as Markdown
    }

    const headings = Array.from(currentDoc.content.matchAll(/^(#{2,3})\s+(.+)$/gm));
    return headings.map((match) => {
      const level = match[1].length;
      const text = stripHtml(match[2].trim());
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return { level, text, id };
    });
  }, [currentDoc]);

  // ── 4. Callbacks (useCallback) ──────────────────────────────────────
  const toggleCat = useCallback((cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // ── 5. Effects (useEffect) ──────────────────────────────────────────
  // Keyboard Search Shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── 6. Render-Phase State Syncs ─────────────────────────────────────
  // Initial expansion of all categories (User requested start open)
  if (allDocs.length > 0 && !hasInitializedDocs) {
    setHasInitializedDocs(true);
    const next = new Set(expandedCats);
    allDocs.forEach(d => next.add(d.category));
    setExpandedCats(next);
  }

  // Auto-expand category for active document
  if (currentDoc?.category !== prevDocCategory) {
    setPrevDocCategory(currentDoc?.category);
    if (currentDoc?.category && !expandedCats.has(currentDoc.category)) {
      const next = new Set(expandedCats);
      next.add(currentDoc.category);
      setExpandedCats(next);
    }
  }

  // Sync Mobile Sidebar Toggle when navigating
  if (slug !== prevSlug) {
    setPrevSlug(slug);
    setSidebarOpen(false);
  }

  // Auto-navigate to first doc if homepage requested
  useEffect(() => {
    if (!slug && allDocs.length > 0) {
      navigate(`/docs/${allDocs[0].slug}`, { replace: true });
    }
  }, [slug, allDocs, navigate]);

  const groupedDocs = groupedDocsList;

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] flex flex-col">
      <SEO title={currentDoc?.title ? `${currentDoc.title} — ARESLib` : "ARESLib Documentation"} description={currentDoc?.description || "ARESLib documentation for the ARES 23247 FTC framework."} />

      {/* ── Search Overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
            onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
          >
            <motion.div
              initial={{ y: -20, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: -20, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#161b22] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                <Search size={18} className="text-white/40" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documentation..."
                  className="flex-1 bg-transparent text-white outline-none text-lg placeholder:text-white/30"
                />
                <kbd className="text-[10px] bg-white/10 text-white/40 px-2 py-0.5 rounded font-mono">ESC</kbd>
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-80 overflow-y-auto">
                  {searchResults.map((r) => (
                    <button
                      key={r.slug}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 transition-colors"
                      onClick={() => {
                        navigate(`/docs/${r.slug}`);
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <div className="text-sm font-bold text-white">{r.title}</div>
                      <div className="text-xs text-ares-gold/80 mb-1">{r.category}</div>
                      <div className="text-xs text-white/40 line-clamp-2">{r.snippet}</div>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="px-4 py-8 text-center text-white/30 text-sm">No results found.</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1">
        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <button
          className="fixed bottom-6 right-6 z-40 lg:hidden bg-ares-red text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <aside className={`
          fixed lg:sticky top-0 left-0 z-30 h-screen w-72 shrink-0
          bg-[#0d1117] border-r border-white/8
          overflow-y-auto overscroll-contain
          transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          pt-24 pb-8 px-4
        `}>
          <div className="mb-6 px-2">
            <Link to="/docs" className="flex items-center gap-2 group">
              <BookOpen size={20} className="text-ares-red" />
              <span className="font-heading font-bold text-lg group-hover:text-ares-gold transition-colors flex items-center">
                <span className="text-ares-red normal-case">ARES</span><span className="text-white normal-case">Lib</span>
              </span>
            </Link>
          </div>

          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 mb-6 rounded-lg bg-white/5 border border-white/10 text-white/40 text-sm hover:border-ares-red/40 transition-colors"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Search docs...</span>
            <kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </button>

          <nav className="space-y-1">
            {groupedDocs.map(([category, docs]) => (
              <div key={category}>
                <button
                  onClick={() => toggleCat(category)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-ares-gold transition-colors"
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
                          className={`block pl-6 pr-2 py-1.5 text-sm rounded-md transition-colors ${
                            slug === doc.slug
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
              href="https://ARES-23247.github.io/ARESLib/javadoc/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-white/40 hover:text-ares-gold transition-colors"
            >
              <ExternalLink size={14} />
              API Javadoc
            </a>
          </div>
        </aside>

        <div className="flex-1 flex w-full">
          <main className="flex-1 min-w-0 pt-24 pb-16 px-6 lg:px-12 max-w-4xl mx-auto xl:mx-0 xl:max-w-3xl">
          {docLoading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 border-4 border-ares-red/30 border-t-ares-red rounded-full animate-spin"></div>
            </div>
          )}

          {!slug && !docLoading && allDocs.length === 0 && (
            <div className="text-center py-20">
              <BookOpen size={48} className="text-white/20 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">No Documentation Yet</h2>
              <p className="text-white/40">Documentation pages will appear here once they are seeded into the database.</p>
            </div>
          )}

          {currentDoc && (
            <motion.article
              key={currentDoc.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-xs text-white/30">
                  <Link to="/docs" className="hover:text-ares-gold transition-colors flex items-center">
                    <span className="text-ares-red normal-case">ARES</span><span className="text-white normal-case">Lib</span>
                  </Link>
                  <ChevronRight size={12} />
                  <span className="text-ares-gold/60">{currentDoc.category}</span>
                  <ChevronRight size={12} />
                  <span className="text-white/60">{currentDoc.title}</span>
                </div>
                
                <Link 
                  to={`/dashboard?editDoc=${currentDoc.slug}`}
                  className="flex items-center gap-2 text-xs font-bold text-ares-cyan/70 hover:text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1.5 rounded-md transition-colors"
                >
                  <Edit2 size={12} />
                  EDIT PAGE
                </Link>
              </div>

              <h1 className="text-3xl lg:text-4xl font-bold font-heading mb-4 text-white">{currentDoc.title}</h1>
              {currentDoc.description && (
                <p className="text-lg text-white/50 mb-8 border-b border-white/8 pb-8">{currentDoc.description}</p>
              )}

              <div className="ares-docs-content">
                {(() => {
                  try {
                    const parsed = JSON.parse(currentDoc.content || "");
                    if (parsed.type === "doc") {
                      return <TiptapRenderer node={parsed} />;
                    }
                  } catch (_) { // eslint-disable-line @typescript-eslint/no-unused-vars
                    // ignore parse failure
                  }

                  return (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        swervesimulator: () => <SwerveSimulator />,
                        sotmsimulator: () => <SOTMSimulator />,
                        configvisualizer: () => <ConfigVisualizer />,
                        codeplayground: () => <CodePlayground />,
                        screenshotgallery: () => <ScreenshotGallery />,
                        faultsim: () => <FaultSim />,
                        physicssim: () => <PhysicsSim />,
                        sysidsim: () => <SysIdSim />,
                        visionsim: () => <VisionSim />,
                        zeroallocationsim: () => <ZeroAllocationSim />,
                        fieldvisualizer: () => <FieldVisualizer />,
                        troubleshootingwizard: () => <TroubleshootingWizard />,
                        performancedashboard: () => <PerformanceDashboard />,
                        armkgsim: () => <ArmKgSim />,
                        autosim: () => <AutoSim />,
                        elevatorpidsim: () => <ElevatorPidSim />,
                        flywheelkvsim: () => <FlywheelKvSim />,
                        interactivetutorial: () => <InteractiveTutorial />,
                        powersheddingsim: () => <PowerSheddingSim />,
                        statemachinesim: () => <StateMachineSim />,
                        h1: ({ children }) => <h1 className="text-3xl font-bold font-heading mt-10 mb-4 text-white border-b border-white/10 pb-2">{children}</h1>,
                        h2: ({ children }) => {
                          const text = String(children);
                          const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                          return (
                            <h2 id={id} className="text-2xl font-bold font-heading mt-8 mb-3 text-ares-gold scroll-m-24 group relative">
                              <a href={`#${id}`} className="absolute -left-6 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-ares-cyan" aria-label="Link to section">
                                <LinkIcon size={18} />
                              </a>
                              {children}
                            </h2>
                          );
                        },
                        h3: ({ children }) => {
                          const text = String(children);
                          const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                          return (
                            <h3 id={id} className="text-xl font-bold font-heading mt-6 mb-2 text-ares-red scroll-m-24 group relative">
                              <a href={`#${id}`} className="absolute -left-6 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-ares-cyan" aria-label="Link to section">
                                <LinkIcon size={16} />
                              </a>
                              {children}
                            </h3>
                          );
                        },
                        h4: ({ children }) => <h4 className="text-lg font-bold mt-4 mb-2 text-white/80">{children}</h4>,
                        p: ({ children }) => <p className="text-[#e6edf3]/80 leading-relaxed mb-4">{children}</p>,
                        a: ({ href, children }) => (
                          <a href={href} className="text-ares-gold hover:text-white underline underline-offset-2 transition-colors" target={href?.startsWith("http") ? "_blank" : undefined} rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}>
                            {children}
                          </a>
                        ),
                        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4 text-[#e6edf3]/70 ml-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4 text-[#e6edf3]/70 ml-2">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-ares-red/60 bg-ares-red/5 px-4 py-3 my-4 text-white/70 italic rounded-r-lg">{children}</blockquote>
                        ),
                        code: ({ className, children, ...props }) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match;
                          if (isInline) {
                            return <code className="bg-ares-red/10 text-ares-gold px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
                          }
                          return (
                            <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} {...props} />
                          );
                        },
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-4">
                            <table className="w-full border-collapse border border-white/10 text-sm">{children}</table>
                          </div>
                        ),
                        th: ({ children }) => <th className="border border-white/10 bg-ares-red/10 px-4 py-2 text-left font-bold text-ares-gold">{children}</th>,
                        td: ({ children }) => <td className="border border-white/10 px-4 py-2 text-[#e6edf3]/70">{children}</td>,
                        hr: () => <hr className="border-white/10 my-8" />,
                        img: ({ src, alt }) => (
                          <img src={src} alt={alt || "ARESLib documentation image"} className="rounded-lg border border-white/10 my-4 max-w-full" />
                        ),
                        strong: ({ children }) => <strong className="text-white font-bold">{children}</strong>,
                        em: ({ children }) => <em className="text-ares-gold/80">{children}</em>,
                      }}
                    >
                      {currentDoc.content || ""}
                    </ReactMarkdown>
                  );
                })()}

                <div className="mt-16 pt-8 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    const currentIndex = allDocs.findIndex(d => d.slug === (slug || (allDocs.length > 0 ? allDocs[0].slug : "")));
                    const prevDoc = currentIndex > 0 ? allDocs[currentIndex - 1] : null;
                    const nextDoc = currentIndex !== -1 && currentIndex < allDocs.length - 1 ? allDocs[currentIndex + 1] : null;
                    
                    return (
                      <>
                        {prevDoc ? (
                          <Link to={`/docs/${prevDoc.slug}`} className="flex flex-col p-4 rounded-xl border border-white/10 hover:border-ares-red/50 bg-black/20 hover:bg-black/40 transition-colors group">
                            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" /> Previous</span>
                            <span className="text-white font-bold group-hover:text-ares-red transition-colors">{prevDoc.title}</span>
                          </Link>
                        ) : <div />}
                        {nextDoc ? (
                          <Link to={`/docs/${nextDoc.slug}`} className="flex flex-col p-4 rounded-xl border border-white/10 hover:border-ares-cyan/50 bg-black/20 hover:bg-black/40 transition-colors group text-right items-end">
                            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1">Next <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" /></span>
                            <span className="text-white font-bold group-hover:text-ares-cyan transition-colors">{nextDoc.title}</span>
                          </Link>
                        ) : <div />}
                      </>
                    );
                  })()}
                </div>
              </div>

              {currentDoc.updated_at && (
                <div className="mt-12 pt-6 border-t border-white/8 text-xs text-white/20">
                  Last updated: {new Date(currentDoc.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              )}
            </motion.article>
          )}
        </main>
        
        {currentDoc && tableOfContents.length > 0 && (
          <aside className="hidden xl:block w-64 shrink-0 pt-24 px-6 pb-8 sticky right-0 top-0 h-screen overflow-y-auto">
            <h3 className="text-white/60 font-bold mb-4 font-heading tracking-wide uppercase text-xs">On this page</h3>
            <nav className="flex flex-col gap-3 border-l border-white/10 pl-4">
              {tableOfContents.map((heading, i) => (
                <a 
                  key={i} 
                  href={`#${heading.id}`}
                  className={`text-sm transition-colors hover:text-ares-gold focus-visible:outline-none focus:text-ares-gold ${heading.level === 3 ? "pl-4 text-white/40" : "text-white/70"}`}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>
      </div>
    </div>
  );
}
