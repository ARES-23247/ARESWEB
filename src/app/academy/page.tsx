"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen,
  Edit2,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  GraduationCap,
} from "lucide-react";

import SEO from "@/components/SEO";
import EducationalCredentialSchema, {
  ARES_CREDENTIALS,
} from "@/components/EducationalCredentialSchema";
import { useAuth } from "@/context/AuthContext";
import DocsMarkdownRenderer from "@/components/docs/DocsMarkdownRenderer";
import DocsSidebar, { type DocRecord } from "@/components/docs/DocsSidebar";
import DocsTableOfContents from "@/components/docs/DocsTableOfContents";
import LearningLibraryLanding from "@/components/docs/LearningLibraryLanding";
import LearningMetadataPanel from "@/components/docs/LearningMetadataPanel";
import { useAcademyProgress } from "@/hooks/useAcademyProgress";
import {
  learningPathNavigation,
  parseLearningFilters,
  relatedLearningDocuments,
} from "@/lib/learningExperience";
import { LEARNING_PATHS, labelFor } from "@/lib/learningContent";
const AutonomousLogicDiagram = React.lazy(
  () => import("@/components/docs/AutonomousLogicDiagram"),
);
import ZulipThread from "@/components/ZulipThread";
import TiptapRenderer from "@/components/TiptapRenderer";
import { logger } from "@/utils/logger";
import {
  fetchPublicDocument,
  fetchPublicDocuments,
  PublicContentApiError,
} from "@/lib/publicContentApi";
import AcademySearchModal from "./components/AcademySearchModal";
import AcademyFeedbackSection from "./components/AcademyFeedbackSection";
import AcademyRookieBanner from "./components/AcademyRookieBanner";

const ACADEMY_SIDEBAR_ORDER = [
  "AI 101",
  "Neural Networks",
  "Machine Vision",
  "Reinforcement Learning",
  "Generative AI",
  "Physics",
  "Mathematics",
  "Science of Climbing",
  "Science of Outdoor Sports",
];

export default function AcademyPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const { user, authorizedUser } = useAuth();
  const academyProgress = useAcademyProgress();

  const isAresLib = pathname.startsWith("/docs");
  const basePath = isAresLib ? "/docs" : "/academy";
  const requestedPath = useMemo(() => {
    const parsed = parseLearningFilters(new URLSearchParams(location.search));
    return parsed.pathId === "all" ? null : parsed.pathId;
  }, [location.search]);

  const userRole = authorizedUser?.role;
  const isEditor = Boolean(
    user &&
      userRole &&
      ["admin", "coach", "mentor", "member"].includes(userRole),
  );
  const canSubmitFeedback = Boolean(
    user && authorizedUser && authorizedUser.role !== "unverified",
  );

  const [allDocs, setAllDocs] = useState<DocRecord[]>([]);
  const [currentDoc, setCurrentDoc] = useState<DocRecord | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    const params = new URLSearchParams(location.search);
    if (params.has("q")) {
      params.delete("q");
      const newSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: newSearch ? `?${newSearch}` : "",
        },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate]);

  const navigateToSearchResult = useCallback(
    (resultSlug: string) => {
      setSearchOpen(false);
      setSearchQuery("");
      const params = new URLSearchParams(location.search);
      params.delete("q");
      const newSearch = params.toString();
      navigate({
        pathname: `${basePath}/${resultSlug}`,
        search: newSearch ? `?${newSearch}` : "",
      });
    },
    [basePath, location.search, navigate],
  );

  // Parse search query parameter 'q' and open the search overlay on boot
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q) {
      setSearchQuery(q);
      setSearchOpen(true);
    }
  }, [location.search]);

  // Fetch all documents
  useEffect(() => {
    const fetchAllDocs = async () => {
      setListLoading(true);
      setListError(null);
      try {
        setAllDocs(
          await fetchPublicDocuments(isAresLib ? "areslib" : "academy"),
        );
      } catch (err) {
        logger.error("Error loading all docs:", err);
        setListError(
          "The lesson library could not be reached. Check your connection and try again.",
        );
      } finally {
        setListLoading(false);
      }
    };
    void fetchAllDocs();
  }, [isAresLib, reloadToken]);

  // Fetch current document details when slug changes
  useEffect(() => {
    if (!slug) return;
    const fetchCurrentDoc = async () => {
      setDocLoading(true);
      setDocError(null);
      setCurrentDoc(null);
      try {
        setCurrentDoc(
          await fetchPublicDocument(slug, isAresLib ? "areslib" : "academy"),
        );
      } catch (err) {
        if (err instanceof PublicContentApiError && err.status === 404) {
          setCurrentDoc(null);
          return;
        }
        logger.error("Error loading doc:", err);
        setDocError(
          "This lesson could not be loaded. Check your connection and try again.",
        );
      } finally {
        setDocLoading(false);
      }
    };
    void fetchCurrentDoc();
  }, [isAresLib, slug, reloadToken]);

  // Client-side quick search over documents
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allDocs
      .filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          (d.content?.toLowerCase().includes(q) ?? false),
      )
      .map((d) => ({
        slug: d.slug,
        title: d.title,
        category: d.category,
        snippet:
          d.description ||
          (d.content
            ? d.content.substring(0, 100) + "..."
            : "Open this item to read more."),
      }));
  }, [searchQuery, allDocs]);

  // Group documentation categories in the requested sidebar ordering
  const groupedDocs = useMemo(() => {
    const groups: Record<string, DocRecord[]> = {};
    for (const doc of allDocs) {
      if (!groups[doc.category]) groups[doc.category] = [];
      groups[doc.category].push(doc);
    }
    const ordered: [string, DocRecord[]][] = [];
    for (const cat of ACADEMY_SIDEBAR_ORDER) {
      if (groups[cat]) ordered.push([cat, groups[cat]]);
    }
    for (const [cat, docs] of Object.entries(groups)) {
      if (!ACADEMY_SIDEBAR_ORDER.includes(cat)) ordered.push([cat, docs]);
    }
    return ordered;
  }, [allDocs]);

  const pathNavigation = useMemo(
    () =>
      currentDoc
        ? learningPathNavigation(allDocs, currentDoc.slug, requestedPath)
        : {
            pathId: null,
            documents: [],
            position: -1,
            previous: null,
            next: null,
          },
    [allDocs, currentDoc, requestedPath],
  );
  const relatedDocuments = useMemo(
    () => (currentDoc ? relatedLearningDocuments(allDocs, currentDoc.slug) : []),
    [allDocs, currentDoc],
  );

  // Handle Ctrl+K overlay search shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        setSearchOpen((o) => {
          const next = !o;
          if (!next) {
            closeSearch();
          }
          return next;
        });
      }
      if (e.key === "Escape") {
        closeSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSearch]);

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col w-full">
      <SEO
        title={
          currentDoc?.title
            ? `${currentDoc.title} — ${isAresLib ? "ARESLib" : "ARES Academy"}`
            : isAresLib
              ? "ARESLib Documentation"
              : "ARES Academy"
        }
        description={
          currentDoc?.description ||
          (isAresLib
            ? "ARESLib documentation, control loops, and API references."
            : "ARES Academy lessons and interactive simulations.")
        }
      />
      <EducationalCredentialSchema credentials={ARES_CREDENTIALS} />

      <AcademySearchModal
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        searchResults={searchResults}
        onSearchQueryChange={setSearchQuery}
        onClose={closeSearch}
        onSelectResult={navigateToSearchResult}
      />

      <div className="flex flex-1 w-full">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <DocsSidebar
          groupedDocs={groupedDocs}
          currentSlug={slug}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearchOpen={() => setSearchOpen(true)}
          basePath={basePath}
        />

        <div className="flex-1 flex w-full">
          <div
            className={`min-w-0 flex-1 px-6 pb-16 pt-24 lg:px-12 ${slug ? "mx-auto max-w-4xl xl:mx-0 xl:max-w-3xl" : "max-w-none"}`}
          >
            {docLoading && slug && (
              <div className="flex justify-center items-center py-20">
                <div className="w-10 h-10 border-4 border-ares-red/30 border-t-ares-red rounded-full animate-spin"></div>
              </div>
            )}

            {listError && (
              <div
                role="alert"
                className="border border-ares-red/40 bg-ares-red/15 p-6 text-white"
              >
                <h2 className="text-xl font-bold">Lesson library unavailable</h2>
                <p className="mt-2 text-sm text-marble/80">{listError}</p>
                <button
                  type="button"
                  onClick={() => setReloadToken((value) => value + 1)}
                  className="mt-4 bg-ares-red px-4 py-2 text-xs font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  Try again
                </button>
              </div>
            )}

            {docError && !listError && (
              <div
                role="alert"
                className="border border-ares-red/40 bg-ares-red/15 p-6 text-white"
              >
                <h2 className="text-xl font-bold">Lesson unavailable</h2>
                <p className="mt-2 text-sm text-marble/80">{docError}</p>
                <button
                  type="button"
                  onClick={() => setReloadToken((value) => value + 1)}
                  className="mt-4 bg-ares-red px-4 py-2 text-xs font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  Try again
                </button>
              </div>
            )}

            {slug && !docLoading && !docError && !currentDoc && !listError && (
              <div className="border border-white/10 bg-white/5 p-8 text-center">
                <BookOpen
                  aria-hidden="true"
                  size={48}
                  className="mx-auto mb-4 text-white/20"
                />
                <h1 className="text-2xl font-bold text-white">
                  Lesson not found
                </h1>
                <p className="mt-2 text-sm text-marble/70">
                  This lesson may have moved, been archived, or never existed.
                </p>
                <Link
                  to={basePath}
                  className="mt-5 inline-block bg-ares-red px-4 py-2 text-xs font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  Browse lessons
                </Link>
              </div>
            )}

            {!slug && !listLoading && !listError && allDocs.length === 0 && (
              <div className="text-center py-20">
                <BookOpen size={48} className="text-white/20 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">
                  No Lessons Yet
                </h2>
                <p className="text-white/60">
                  Educational lessons will appear here once they are seeded into
                  the database.
                </p>
              </div>
            )}

            {!slug && listLoading && !listError && (
              <div
                role="status"
                aria-live="polite"
                className="flex min-h-[50vh] items-center justify-center"
              >
                <div className="text-center">
                  <div
                    aria-hidden="true"
                    className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-ares-red/30 border-t-ares-red"
                  />
                  <p className="mt-4 text-sm text-marble/70">
                    Loading the learning library…
                  </p>
                </div>
              </div>
            )}

            {!slug && !listLoading && !listError && allDocs.length > 0 && (
              <>
                {!isAresLib && <AcademyRookieBanner documents={allDocs} />}
                <LearningLibraryLanding
                  documents={allDocs}
                  library={isAresLib ? "areslib" : "academy"}
                  progress={academyProgress}
                />
              </>
            )}

            {currentDoc && !docLoading && (
              <motion.article
                key={currentDoc.slug}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-white/60">
                    <Link
                      to={
                        pathNavigation.pathId
                          ? `${basePath}?path=${pathNavigation.pathId}`
                          : basePath
                      }
                      className="flex shrink-0 items-center overflow-hidden shadow-lg ares-cut-sm group"
                    >
                      <span className="bg-ares-red px-2 py-0.5 text-xs font-heading font-bold uppercase text-white tracking-wider border-r border-white/10 flex items-center gap-1">
                        <GraduationCap size={12} /> ARES
                      </span>
                      <span className="bg-white/10 text-white font-heading font-medium px-2 py-0.5 text-xs uppercase tracking-widest group-hover:bg-white/20 transition-colors">
                        {isAresLib ? "Lib" : "Academy"}
                      </span>
                    </Link>
                    <ChevronRight size={12} />
                    <span className="min-w-0 break-words text-ares-gold/60">
                      {currentDoc.category}
                    </span>
                    <ChevronRight size={12} />
                    <span className="min-w-0 break-words text-white/60">
                      {currentDoc.title}
                    </span>
                  </div>

                  {isEditor && (
                    <Link
                      to={`/dashboard/${isAresLib ? "areslib" : "academy"}?edit=${currentDoc.slug}`}
                      className="flex items-center gap-2 text-xs font-bold text-ares-cyan/70 hover:text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1.5 ares-cut-sm transition-colors"
                    >
                      <Edit2 size={12} />
                      EDIT PAGE
                    </Link>
                  )}
                </div>

                <h1 className="text-3xl lg:text-4xl font-bold font-heading mb-4 text-white">
                  {currentDoc.title}
                </h1>
                {currentDoc.description && (
                  <p className="text-lg text-white/50 mb-8 border-b border-white/8 pb-8">
                    {currentDoc.description}
                  </p>
                )}

                <LearningMetadataPanel document={currentDoc} />

                <section
                  className="mb-8 border border-white/10 bg-white/[0.03] p-5"
                  aria-labelledby="lesson-progress-heading"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2
                        id="lesson-progress-heading"
                        className="font-heading text-lg font-black uppercase text-white"
                      >
                        Your local progress
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-marble/65">
                        This completion mark stays only in this browser. It is
                        not connected to your name or ARES account.
                        {!academyProgress.storageAvailable &&
                          " Browser storage is unavailable, so this mark will last only until the page closes."}
                      </p>
                      {pathNavigation.pathId && (
                        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ares-gold">
                          {labelFor(LEARNING_PATHS, pathNavigation.pathId)} ·
                          Lesson {pathNavigation.position + 1} of{" "}
                          {pathNavigation.documents.length}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-pressed={academyProgress.completedSlugs.has(
                        currentDoc.slug,
                      )}
                      onClick={() =>
                        academyProgress.toggleCompleted(currentDoc.slug)
                      }
                      className={`min-h-11 shrink-0 border px-5 py-3 text-xs font-black uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${academyProgress.completedSlugs.has(currentDoc.slug) ? "border-ares-cyan bg-ares-cyan text-obsidian" : "border-white/20 text-white hover:border-ares-cyan"}`}
                    >
                      {academyProgress.completedSlugs.has(currentDoc.slug)
                        ? "Completed — undo"
                        : "Mark lesson complete"}
                    </button>
                  </div>
                </section>

                {currentDoc.prerequisites.length > 0 && (
                  <section
                    className="mb-8 border-l-4 border-ares-gold bg-ares-gold/[0.06] p-5"
                    aria-labelledby="prerequisites-heading"
                  >
                    <h2
                      id="prerequisites-heading"
                      className="font-heading text-lg font-black uppercase text-white"
                    >
                      Before you start
                    </h2>
                    <ul className="mt-3 space-y-2 text-sm text-marble/75">
                      {currentDoc.prerequisites.map((prerequisite) => {
                        const prerequisiteDocument = allDocs.find(
                          (document) => document.slug === prerequisite,
                        );
                        return (
                          <li key={prerequisite}>
                            {prerequisiteDocument ? (
                              <Link
                                to={`${basePath}/${prerequisiteDocument.slug}${pathNavigation.pathId ? `?path=${pathNavigation.pathId}` : ""}`}
                                className="font-bold text-ares-gold hover:underline focus-visible:ring-2 focus-visible:ring-ares-cyan"
                              >
                                {prerequisiteDocument.title}
                              </Link>
                            ) : (
                              prerequisite
                            )}
                            {prerequisiteDocument &&
                              academyProgress.completedSlugs.has(
                                prerequisiteDocument.slug,
                              ) && (
                                <span className="ml-2 text-xs font-bold uppercase text-ares-cyan">
                                  Completed locally
                                </span>
                              )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                <div className="ares-docs-content">
                  {(() => {
                    const content = currentDoc.content || "";
                    let parsedAst = null;
                    try {
                      const parsed = JSON.parse(content);
                      if (
                        parsed &&
                        typeof parsed === "object" &&
                        parsed.type === "doc"
                      ) {
                        parsedAst = parsed;
                      }
                    } catch {
                      // Not JSON, fallback to Markdown
                    }

                    return parsedAst ? (
                      <TiptapRenderer node={parsedAst} />
                    ) : (
                      <DocsMarkdownRenderer content={content} />
                    );
                  })()}

                  {/* Pilot Visualizer for Robotics Logic */}
                  {currentDoc.slug === "autonomous-mapping" && (
                    <div className="mt-12 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/5" />
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-ares-gold">
                          Interactive Logic Visualization
                        </h3>
                        <div className="h-px flex-1 bg-white/5" />
                      </div>
                      <React.Suspense
                        fallback={
                          <div className="h-64 flex items-center justify-center text-xs text-marble/40">
                            Loading logic diagram...
                          </div>
                        }
                      >
                        <AutonomousLogicDiagram />
                      </React.Suspense>
                      <p className="text-[10px] text-marble/30 text-center uppercase tracking-widest font-mono">
                        ARES-FLOW Engine v1.0 // Node-based State Machine
                        Visualization
                      </p>
                    </div>
                  )}

                  <div className="mt-16 pt-8 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(() => {
                      const prevDoc = pathNavigation.previous;
                      const nextDoc = pathNavigation.next;
                      const pathSearch = pathNavigation.pathId
                        ? `?path=${pathNavigation.pathId}`
                        : "";
                      return (
                        <>
                          {prevDoc ? (
                            <Link
                              to={`${basePath}/${prevDoc.slug}${pathSearch}`}
                              className="flex flex-col p-4 ares-cut-sm border border-white/10 hover:border-ares-red/50 bg-black/20 hover:bg-black/40 transition-colors group"
                            >
                              <span className="text-marble/60 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                                <ArrowLeft
                                  size={12}
                                  className="group-hover:-translate-x-1 transition-transform"
                                />{" "}
                                Previous
                              </span>
                              <span className="text-white font-bold group-hover:text-ares-red-light transition-colors">
                                {prevDoc.title}
                              </span>
                            </Link>
                          ) : (
                            <div />
                          )}
                          {nextDoc ? (
                            <Link
                              to={`${basePath}/${nextDoc.slug}${pathSearch}`}
                              className="flex flex-col p-4 ares-cut-sm border border-white/10 hover:border-ares-cyan/50 bg-black/20 hover:bg-black/40 transition-colors group text-right items-end"
                            >
                              <span className="text-marble/60 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                                Next{" "}
                                <ArrowRight
                                  size={12}
                                  className="group-hover:translate-x-1 transition-transform"
                                />
                              </span>
                              <span className="text-white font-bold group-hover:text-ares-cyan transition-colors">
                                {nextDoc.title}
                              </span>
                            </Link>
                          ) : (
                            <div />
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {relatedDocuments.length > 0 && (
                    <section
                      className="mt-10 border-t border-white/10 pt-8"
                      aria-labelledby="related-lessons-heading"
                    >
                      <h2
                        id="related-lessons-heading"
                        className="font-heading text-xl font-black uppercase text-white"
                      >
                        Related lessons
                      </h2>
                      <ul className="mt-4 grid gap-3 md:grid-cols-3">
                        {relatedDocuments.map((document) => (
                          <li key={document.slug}>
                            <Link
                              to={`${basePath}/${document.slug}`}
                              className="flex h-full min-h-24 flex-col border border-white/10 bg-black/20 p-4 hover:border-ares-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                            >
                              <span className="text-xs font-bold uppercase tracking-wider text-ares-gold">
                                {document.category}
                              </span>
                              <span className="mt-2 font-bold text-white">
                                {document.title}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>

                {currentDoc && (
                  <div className="mt-12 pt-6 border-t border-white/8 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4 text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="text-white/60 font-bold uppercase tracking-widest text-xs">
                        Document Lifecycle
                      </span>
                      <span className="text-white/50">
                        {currentDoc.updatedAt
                          ? `Last updated: ${new Date(
                              currentDoc.updatedAt,
                            ).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}`
                          : "Not yet updated"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 bg-obsidian/50 p-2 pr-4 rounded-full border border-white/5">
                      <div className="flex items-center">
                        <div className="relative z-10 w-8 h-8 rounded-full border-2 border-obsidian overflow-hidden bg-obsidian/80">
                          <img
                            src={
                              currentDoc.original_authorAvatar ||
                              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                                currentDoc.original_authorNickname ||
                                  currentDoc.title ||
                                  "Author",
                              )}`
                            }
                            alt={`${currentDoc.original_authorNickname || "Author"}'s avatar`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="ml-2 flex flex-col justify-center">
                          <span className="text-xs uppercase font-bold text-ares-gold/80 tracking-wider leading-none">
                            Created By
                          </span>
                          <span className="text-white font-medium">
                            {currentDoc.original_authorNickname ||
                              "ARES Member"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {slug && (
                  <AcademyFeedbackSection
                    slug={slug}
                    canSubmitFeedback={canSubmitFeedback}
                  />
                )}

                {/* ── Documentation Discussion ───────────────────────────── */}
                {slug && user && currentDoc && (
                  <ZulipThread
                    stream="announcements"
                    topic={`Doc Slug: ${currentDoc.slug}`}
                  />
                )}
              </motion.article>
            )}
          </div>

          {currentDoc && (
            <DocsTableOfContents content={currentDoc.content ?? undefined} />
          )}
        </div>
      </div>
    </div>
  );
}
