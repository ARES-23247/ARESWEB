/* eslint-disable @typescript-eslint/no-explicit-any */
import { motion, AnimatePresence } from "framer-motion";
import { Search, BookOpen, Edit2, ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import SEO from "../components/SEO";
import { useSession } from "../utils/auth-client";
import Turnstile from "../components/Turnstile";
import DocsMarkdownRenderer from "../components/docs/DocsMarkdownRenderer";
import DocsSidebar from "../components/docs/DocsSidebar";
import DocsTableOfContents from "../components/docs/DocsTableOfContents";
import AutonomousLogicDiagram from "../components/docs/AutonomousLogicDiagram";
import { api } from "../api/client";
import { useModal } from "../contexts/ModalContext";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDocs } from "../hooks/useDocs";

export default function Docs() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const modal = useModal();

  const userRole = (session?.user as Record<string, unknown>)?.role || "user";
  const isEditor = userRole === "admin" || userRole === "author";

  const {
    allDocs,
    currentDoc,
    contributors,
    docLoading,
    searchResults,
    groupedDocs,
    searchQuery,
    setSearchQuery,
    searchOpen,
    setSearchOpen,
    feedbackToken,
    setFeedbackToken,
  } = useDocs(slug);

  return (
    <div className="min-h-screen bg-ares-gray-deep text-white flex flex-col">
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
              className="w-full max-w-2xl bg-ares-gray-dark border border-white/10 ares-cut-sm shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                <Search size={18} className="text-white/60" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documentation..."
                  className="flex-1 bg-transparent text-white outline-none text-lg placeholder:text-white/60"
                />
                <kbd className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded font-mono">ESC</kbd>
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-80 overflow-y-auto">
                  {searchResults.map((r: any) => (
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
                      <div className="text-xs text-white/60 line-clamp-2">{r.snippet}</div>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="px-4 py-8 text-center text-white/60 text-sm">No results found.</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <DocsSidebar
          groupedDocs={groupedDocs}
          currentSlug={slug}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearchOpen={() => setSearchOpen(true)}
        />

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
              <p className="text-white/60">Documentation pages will appear here once they are seeded into the database.</p>
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
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Link to="/docs" className="flex items-center shadow-lg ares-cut-sm overflow-hidden group">
                    <span className="bg-ares-red px-2 py-0.5 text-xs font-heading font-bold uppercase text-white tracking-wider border-r border-white/10">ARES</span>
                    <span className="bg-white/10 text-white font-heading font-medium px-2 py-0.5 text-xs uppercase tracking-widest group-hover:bg-white/20 transition-colors">Lib</span>
                  </Link>
                  <ChevronRight size={12} />
                  <span className="text-ares-gold/60">{currentDoc.category}</span>
                  <ChevronRight size={12} />
                  <span className="text-white/60">{currentDoc.title}</span>
                </div>
                
                {isEditor && (
                <Link 
                  to={`/dashboard/docs/${currentDoc.slug}`}
                  className="flex items-center gap-2 text-xs font-bold text-ares-cyan/70 hover:text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1.5 ares-cut-sm transition-colors"
                >
                  <Edit2 size={12} />
                  EDIT PAGE
                </Link>
                )}
              </div>

              <h1 className="text-3xl lg:text-4xl font-bold font-heading mb-4 text-white">{currentDoc.title}</h1>
              {currentDoc.description && (
                <p className="text-lg text-white/50 mb-8 border-b border-white/8 pb-8">{currentDoc.description}</p>
              )}

              <div className="ares-docs-content">
                <DocsMarkdownRenderer content={currentDoc.content || ""} />

                {/* Pilot Visualizer for Robotics Logic */}
                {currentDoc.slug === "autonomous-mapping" && (
                   <div className="mt-12 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/5" />
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-ares-gold">Interactive Logic Visualization</h3>
                        <div className="h-px flex-1 bg-white/5" />
                      </div>
                      <AutonomousLogicDiagram />
                      <p className="text-[10px] text-marble/30 text-center uppercase tracking-widest font-mono">
                        ARES-FLOW Engine v1.0 // Node-based State Machine Visualization
                      </p>
                   </div>
                )}

                <div className="mt-16 pt-8 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    const currentIndex = allDocs.findIndex((d: any) => d.slug === (slug || (allDocs.length > 0 ? allDocs[0].slug : "")));
                    const prevDoc = currentIndex > 0 ? allDocs[currentIndex - 1] : null;
                    const nextDoc = currentIndex !== -1 && currentIndex < allDocs.length - 1 ? allDocs[currentIndex + 1] : null;
                    
                    return (
                      <>
                        {prevDoc ? (
                          <Link to={`/docs/${prevDoc.slug}`} className="flex flex-col p-4 ares-cut-sm border border-white/10 hover:border-ares-red/50 bg-black/20 hover:bg-black/40 transition-colors group">
                            <span className="text-ares-gray text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" /> Previous</span>
                            <span className="text-white font-bold group-hover:text-ares-red transition-colors">{prevDoc.title}</span>
                          </Link>
                        ) : <div />}
                        {nextDoc ? (
                          <Link to={`/docs/${nextDoc.slug}`} className="flex flex-col p-4 ares-cut-sm border border-white/10 hover:border-ares-cyan/50 bg-black/20 hover:bg-black/40 transition-colors group text-right items-end">
                            <span className="text-ares-gray text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1">Next <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" /></span>
                            <span className="text-white font-bold group-hover:text-ares-cyan transition-colors">{nextDoc.title}</span>
                          </Link>
                        ) : <div />}
                      </>
                    );
                  })()}
                </div>
              </div>

              {currentDoc && (
                <div className="mt-12 pt-6 border-t border-white/8 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4 text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-white/60 font-bold uppercase tracking-widest text-xs">Document Lifecycle</span>
                    <span className="text-white/50">
                      {currentDoc.updated_at ? `Last updated: ${new Date(currentDoc.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}` : 'Not yet updated'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-obsidian/50 p-2 pr-4 rounded-full border border-white/5">
                    <div className="flex items-center">
                      <div className="relative z-10 w-8 h-8 rounded-full border-2 border-ares-gray-deep overflow-hidden bg-ares-gray-dark">
                        <img 
                          src={currentDoc.original_author_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentDoc.cf_email}`}
                          alt={`${currentDoc.original_author_nickname || "Author"}'s avatar`} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="ml-2 flex flex-col justify-center">
                        <span className="text-xs uppercase font-bold text-ares-gold/80 tracking-wider leading-none">Created By</span>
                        <span className="text-white font-medium">{currentDoc.original_author_nickname || currentDoc.cf_email?.split('@')[0] || "Author"}</span>
                      </div>
                    </div>
                    
                    {contributors && contributors.length > 0 && (
                      <>
                        <div className="w-[1px] h-6 bg-white/10 mx-2"></div>
                        <div className="flex flex-col">
                          <span className="text-xs uppercase font-bold text-ares-cyan/80 tracking-wider mb-1">Contributors</span>
                          <div className="flex -space-x-2">
                            {contributors.slice(0, 5).map((c: any, idx: any) => (
                              <div key={idx} className="w-6 h-6 rounded-full border border-ares-gray-deep overflow-hidden bg-ares-gray-dark" title={c.nickname || c.author_email}>
                                <img src={c.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${c.author_email}`} alt={`${c.nickname || "Contributor"}'s avatar`} className="w-full h-full object-cover"/>
                              </div>
                            ))}
                            {contributors.length > 5 && (
                              <div className="w-6 h-6 rounded-full border border-ares-gray-deep bg-ares-gray-dark flex items-center justify-center text-xs font-bold text-white z-10">
                                +{contributors.length - 5}
                              </div>
                            )}
                          </div>
                         </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Documentation Feedback ───────────────────────────── */}
              <div className="mt-16 p-8 ares-cut bg-obsidian/50 border border-white/5 relative overflow-hidden group/feedback">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/feedback:opacity-20 transition-opacity">
                  <BookOpen size={64} className="text-ares-gold rotate-12" />
                </div>
                <div className="relative z-10">
                  <h4 className="text-xl font-bold text-white mb-2">Was this helpful?</h4>
                  <p className="text-white/50 text-sm mb-6 max-w-md">Your feedback helps our engineering team improve the documentation for the entire community.</p>
                  <Turnstile onVerify={setFeedbackToken} theme="dark" size="compact" className="mb-4" />
                  <div className="flex flex-wrap gap-4">
                    <button 
                      onClick={async () => {
                        await api.docs.submitFeedback.mutation({
                          params: { slug: slug! },
                          body: { isHelpful: true, turnstileToken: feedbackToken }
                        });
                        toast.success('Thanks for your feedback!');
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 ares-cut-sm bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan font-bold hover:bg-ares-cyan hover:text-black transition-all"
                    >
                      <span className="text-lg">👍</span> Yes, it was
                    </button>
                    <button 
                      onClick={async () => {
                        const comment = await modal.prompt({
                          title: "Feedback",
                          description: "How can we improve this page?",
                          submitText: "Submit",
                        });
                        if (comment !== null) {
                          await api.docs.submitFeedback.mutation({
                            params: { slug: slug! },
                            body: { isHelpful: false, turnstileToken: feedbackToken, comment: comment || "" }
                          });
                          toast.success('Thank you! We will use your feedback to improve this page.');
                        }
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 ares-cut-sm bg-ares-red/10 border border-ares-red/30 text-ares-red font-bold hover:bg-ares-red hover:text-white transition-all"
                    >
                      <span className="text-lg">👎</span> No, it wasn&apos;t
                    </button>
                  </div>
                </div>
              </div>
            </motion.article>
          )}
        </main>
        
        {currentDoc && (
          <DocsTableOfContents content={currentDoc.content} />
        )}
      </div>
      </div>
    </div>
  );
}
