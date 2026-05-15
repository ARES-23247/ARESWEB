
import { motion, AnimatePresence } from "framer-motion";
import { Search, BookOpen, Edit2, ChevronRight, ArrowLeft, ArrowRight, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import SEO from "../components/SEO";
import EducationalCredentialSchema, { ARES_CREDENTIALS } from "../components/EducationalCredentialSchema";
import { useSession } from "../utils/auth-client";
import Turnstile from "../components/Turnstile";
import DocsMarkdownRenderer from "../components/docs/DocsMarkdownRenderer";
import DocsSidebar from "../components/docs/DocsSidebar";
import DocsTableOfContents from "../components/docs/DocsTableOfContents";
import AutonomousLogicDiagram from "../components/docs/AutonomousLogicDiagram";
import { useSubmitDocFeedback } from "../api/docs";
import { useModal } from "../contexts/ModalContext";
import ZulipThread from "../components/ZulipThread";
import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { useAcademy } from "../hooks/useAcademy";
import { ContributorStack } from "../components/ui/ContributorStack";
import TiptapRenderer from "../components/TiptapRenderer";

export default function Academy() {
  const { slug } = useParams({ strict: false }) as Record<string, string>;
  const navigate = useNavigate();
  const { data: session } = useSession();
  const modal = useModal();

  const userRole = (session?.user as Record<string, unknown>)?.role || "user";
  const isEditor = userRole === "admin" || userRole === "author";

  const feedbackMutation = useSubmitDocFeedback({
    onSuccess: () => {
      // Success toast shown inline
    }
  });

  const {
    allDocs,
    currentDoc,

    docLoading,
    searchResults,
    groupedDocs,
    searchQuery,
    setSearchQuery,
    searchOpen,
    setSearchOpen,
    feedbackToken,
    setFeedbackToken,
  } = useAcademy(slug);

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col">
      <SEO title={currentDoc?.title ? `${currentDoc.title} — ARES Academy` : "ARES Academy"} description={currentDoc?.description || "ARES Academy lessons and interactive simulations."} />
      <EducationalCredentialSchema credentials={ARES_CREDENTIALS} />

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
              className="w-full max-w-2xl bg-black/80 border border-white/10 ares-cut-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-xl"
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
                  {searchResults.map((r: { slug: string; title: string; category: string; snippet: string }) => (
                    <button
                      key={r.slug}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 transition-colors"
                      onClick={() => {
                        navigate({ to: "/academy/$slug", params: { slug: r.slug } });
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
          basePath="/academy"
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
              <h2 className="text-2xl font-bold text-white mb-2">No Lessons Yet</h2>
              <p className="text-white/60">Educational lessons will appear here once they are seeded into the database.</p>
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
                  <Link to="/academy" className="flex items-center shadow-lg ares-cut-sm overflow-hidden group">
                    <span className="bg-ares-red px-2 py-0.5 text-xs font-heading font-bold uppercase text-white tracking-wider border-r border-white/10 flex items-center gap-1">
                      <GraduationCap size={12} /> ARES
                    </span>
                    <span className="bg-white/10 text-white font-heading font-medium px-2 py-0.5 text-xs uppercase tracking-widest group-hover:bg-white/20 transition-colors">Academy</span>
                  </Link>
                  <ChevronRight size={12} />
                  <span className="text-ares-gold/60">{currentDoc.category}</span>
                  <ChevronRight size={12} />
                  <span className="text-white/60">{currentDoc.title}</span>
                </div>

                {isEditor && (
                <Link
                  to="/dashboard/docs/$editSlug" params={{ editSlug: currentDoc.slug }}
                  className="flex items-center gap-2 text-xs font-bold text-ares-cyan/70 hover:text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1.5 ares-cut-sm transition-colors"
                >
                  <Edit2 size={12} />
                  EDIT PAGE
                </Link>
                )}
              </div>

              <h1 className="text-4xl lg:text-6xl font-black font-heading mb-6 text-white uppercase tracking-tighter leading-none">{currentDoc.title}</h1>
              {currentDoc.description && (
                <p className="text-xl text-marble/40 mb-12 border-b border-white/5 pb-12 leading-relaxed font-medium">{currentDoc.description}</p>
              )}

              <div className="ares-docs-content">
                {(() => {
                  const content = currentDoc.content || "";
                  let parsedAst = null;
                  try {
                    const parsed = JSON.parse(content);
                    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
                      parsedAst = parsed;
                    }
                  } catch {
                    // Not JSON, fallback to Markdown
                  }

                  return parsedAst
                    ? <TiptapRenderer node={parsedAst} />
                    : <DocsMarkdownRenderer content={content} />;
                })()}

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
                    const currentIndex = allDocs.findIndex((d: { slug: string }) => d.slug === (slug || (allDocs.length > 0 ? allDocs[0].slug : "")));
                    const prevDoc = currentIndex > 0 ? allDocs[currentIndex - 1] : null;
                    const nextDoc = currentIndex !== -1 && currentIndex < allDocs.length - 1 ? allDocs[currentIndex + 1] : null;

                    return (
                      <>
                        {prevDoc ? (
                          <Link to="/academy/$slug" params={{ slug: prevDoc.slug }} className="flex flex-col p-8 ares-cut-lg border border-white/5 hover:border-ares-red/30 bg-black/40 hover:bg-black/60 transition-all duration-500 group backdrop-blur-sm">
                            <span className="text-marble/20 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-3"><ArrowLeft size={12} className="group-hover:-translate-x-2 transition-transform" /> Previous Lesson</span>
                            <span className="text-white font-black text-lg uppercase tracking-tight group-hover:text-ares-red transition-colors">{prevDoc.title}</span>
                          </Link>
                        ) : <div />}
                        {nextDoc ? (
                          <Link to="/academy/$slug" params={{ slug: nextDoc.slug }} className="flex flex-col p-8 ares-cut-lg border border-white/5 hover:border-ares-cyan/30 bg-black/40 hover:bg-black/60 transition-all duration-500 group text-right items-end backdrop-blur-sm">
                            <span className="text-marble/20 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-3">Next Lesson <ArrowRight size={12} className="group-hover:translate-x-2 transition-transform" /></span>
                            <span className="text-white font-black text-lg uppercase tracking-tight group-hover:text-ares-cyan transition-colors">{nextDoc.title}</span>
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
                      {currentDoc.updatedAt ? `Last updated: ${new Date(currentDoc.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}` : 'Not yet updated'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 bg-obsidian/50 p-2 pr-4 rounded-full border border-white/5">
                    <div className="flex items-center">
                      <div className="relative z-10 w-8 h-8 rounded-full border-2 border-ares-gray-deep overflow-hidden bg-ares-gray-dark">
                        <img
                          src={currentDoc.original_authorAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentDoc.cf_email}`}
                          alt={`${currentDoc.original_authorNickname || "Author"}'s avatar`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="ml-2 flex flex-col justify-center">
                        <span className="text-xs uppercase font-bold text-ares-gold/80 tracking-wider leading-none">Created By</span>
                        <span className="text-white font-medium">{currentDoc.original_authorNickname || currentDoc.cf_email?.split('@')[0] || "Author"}</span>
                      </div>
                    </div>

                    <div className="w-[1px] h-6 bg-white/10 mx-2"></div>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase font-bold text-ares-cyan/80 tracking-wider mb-1">Contributors</span>
                      <ContributorStack roomId={`doc_${currentDoc.slug}`} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Documentation Feedback ───────────────────────────── */}
              <div className="mt-20 p-12 ares-cut-lg bg-black/40 border border-white/5 relative overflow-hidden group/feedback mb-12 backdrop-blur-sm">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover/feedback:opacity-10 transition-opacity">
                  <BookOpen size={120} className="text-ares-gold rotate-12" />
                </div>
                <div className="relative z-10">
                  <div className="bg-ares-gold/10 text-ares-gold px-4 py-1 ares-cut-sm font-black uppercase tracking-[0.2em] text-[10px] mb-6 border border-ares-gold/20 inline-block">
                    Peer Review // Documentation
                  </div>
                  <h4 className="text-3xl font-black text-white mb-3 uppercase tracking-tighter">Was this <span className="text-ares-gold">helpful?</span></h4>
                  <p className="text-marble/40 text-sm mb-10 max-w-md font-medium leading-relaxed">Your feedback helps our engineering team improve the documentation for the entire community.</p>
                  <Turnstile onVerify={setFeedbackToken} theme="dark" size="compact" className="mb-8" />
                  <div className="flex flex-wrap gap-6">
                    <button
                      onClick={() => {
                        if (!slug) return;
                        feedbackMutation.mutate({
                          slug,
                          data: { isHelpful: true, turnstileToken: feedbackToken }
                        });
                        toast.success('Thanks for your feedback!');
                      }}
                      disabled={feedbackMutation.isPending}
                      className="clipped-button flex items-center gap-3 px-8 py-4 bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan font-black uppercase tracking-widest text-xs hover:bg-ares-cyan hover:text-black transition-all disabled:opacity-50"
                    >
                      <span className="text-lg">👍</span> Affirmative
                    </button>
                    <button
                      onClick={async () => {
                        const comment = await modal.prompt({
                          title: "Feedback",
                          description: "How can we improve this page?",
                          submitText: "Submit",
                        });
                        if (comment !== null && slug) {
                          feedbackMutation.mutate({
                            slug,
                            data: { isHelpful: false, turnstileToken: feedbackToken, comment: comment || "" }
                          });
                          toast.success('Thank you! We will use your feedback to improve this page.');
                        }
                      }}
                      disabled={feedbackMutation.isPending}
                      className="clipped-button flex items-center gap-3 px-8 py-4 bg-ares-red/10 border border-ares-red/30 text-ares-red font-black uppercase tracking-widest text-xs hover:bg-ares-red hover:text-white transition-all disabled:opacity-50"
                    >
                      <span className="text-lg">👎</span> Negative
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Documentation Discussion ───────────────────────────── */}
              {slug && session && <ZulipThread stream="announcements" topic={`Doc: ${currentDoc.title}`} />}
            </motion.article>
          )}
        </main>

        {currentDoc && (
          <DocsTableOfContents content={currentDoc.content ?? undefined} />
        )}
      </div>
      </div>
    </div>
  );
}



