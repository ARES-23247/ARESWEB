import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Clock, Route, Search } from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicDocument } from "@/lib/publicContentApi";
import {
  LEARNING_CONTENT_TYPES,
  LEARNING_LEVELS,
  LEARNING_PATHS,
  LEARNING_SUBJECTS,
  labelFor,
  type LearningContentType,
  type LearningLevel,
  type LearningPathId,
  type LearningSubject,
} from "@/lib/learningContent";

interface LearningLibraryLandingProps {
  documents: PublicDocument[];
  library: "academy" | "areslib";
}

type AllOr<T extends string> = "all" | T;

export default function LearningLibraryLanding({ documents, library }: LearningLibraryLandingProps) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<AllOr<LearningSubject>>("all");
  const [level, setLevel] = useState<AllOr<LearningLevel>>("all");
  const [contentType, setContentType] = useState<AllOr<LearningContentType>>("all");
  const [pathId, setPathId] = useState<AllOr<LearningPathId>>("all");
  const basePath = library === "academy" ? "/academy" : "/docs";

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = documents.filter((document) => {
      if (subject !== "all" && document.subject !== subject) return false;
      if (level !== "all" && document.level !== level) return false;
      if (contentType !== "all" && document.contentType !== contentType) return false;
      if (pathId !== "all" && !document.pathMemberships.some((membership) => membership.pathId === pathId)) return false;
      if (!normalizedQuery) return true;
      return [document.title, document.description, document.category, ...document.topics]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
    if (pathId === "all") return matches;
    return matches.sort((left, right) => {
      const leftOrder = left.pathMemberships.find((membership) => membership.pathId === pathId)?.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.pathMemberships.find((membership) => membership.pathId === pathId)?.order ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.title.localeCompare(right.title);
    });
  }, [contentType, documents, level, pathId, query, subject]);

  const pathCounts = useMemo(() => new Map(LEARNING_PATHS.map((path) => [
    path.id,
    documents.filter((document) => document.pathMemberships.some((membership) => membership.pathId === path.id)).length,
  ])), [documents]);

  return (
    <div className="w-full max-w-6xl pb-20">
      <header className="border-b border-white/10 pb-8">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.24em] text-ares-gold">
          {library === "academy" ? "Learn across disciplines" : "Versioned engineering reference"}
        </p>
        <h1 className="mt-3 font-heading text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
          {library === "academy" ? "ARES Academy" : "ARESLib Documentation"}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-marble/75">
          {library === "academy"
            ? "Explore robotics alongside mathematics, computing, physics, and applied outdoor science. Browse by subject or follow a guided learning path."
            : "Find technical explanations and references for released ARES software. Version and source-review details appear on each document when available."}
        </p>
      </header>

      {library === "academy" && (
        <section aria-labelledby="learning-paths-heading" className="mt-10">
          <div className="flex items-center gap-3">
            <Route aria-hidden="true" className="text-ares-gold" />
            <h2 id="learning-paths-heading" className="font-heading text-2xl font-black uppercase text-white">Learning paths</h2>
          </div>
          <p className="mt-2 text-sm text-marble/65">Paths combine lessons from several subjects into a suggested order.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {LEARNING_PATHS.map((path) => {
              const count = pathCounts.get(path.id) ?? 0;
              const active = pathId === path.id;
              return (
                <button
                  key={path.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPathId(active ? "all" : path.id)}
                  className={`min-h-40 border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${active ? "border-ares-red bg-ares-red/15" : "border-white/10 bg-white/[0.04] hover:border-ares-gold/45"}`}
                >
                  <span className="font-heading text-lg font-bold uppercase text-white">{path.label}</span>
                  <span className="mt-2 block text-sm leading-6 text-marble/70">{path.description}</span>
                  <span className="mt-4 block text-xs font-bold uppercase tracking-wider text-ares-gold">
                    {count > 0 ? `${count} ${count === 1 ? "lesson" : "lessons"}` : "Curriculum in preparation"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="browse-library-heading" className="mt-12">
        <div className="flex items-center gap-3">
          <BookOpen aria-hidden="true" className="text-ares-gold" />
          <h2 id="browse-library-heading" className="font-heading text-2xl font-black uppercase text-white">Browse the library</h2>
        </div>

        <div className="mt-5 grid gap-4 border border-white/10 bg-black/25 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="sm:col-span-2 xl:col-span-4">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-marble/70">Search titles and topics</span>
            <span className="flex items-center gap-3 border border-white/15 bg-obsidian px-3 focus-within:ring-2 focus-within:ring-ares-cyan">
              <Search aria-hidden="true" size={17} className="text-marble/55" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full bg-transparent text-sm text-white outline-none placeholder:text-marble/45" placeholder="Try geometry, controls, or climbing" />
            </span>
          </label>
          <FilterSelect label="Subject" value={subject} onChange={(value) => setSubject(value as AllOr<LearningSubject>)} options={LEARNING_SUBJECTS} />
          <FilterSelect label="Level" value={level} onChange={(value) => setLevel(value as AllOr<LearningLevel>)} options={LEARNING_LEVELS} />
          <FilterSelect label="Content type" value={contentType} onChange={(value) => setContentType(value as AllOr<LearningContentType>)} options={LEARNING_CONTENT_TYPES} />
          {library === "academy" && <FilterSelect label="Learning path" value={pathId} onChange={(value) => setPathId(value as AllOr<LearningPathId>)} options={LEARNING_PATHS} />}
        </div>

        <p role="status" aria-live="polite" className="mt-4 text-sm text-marble/65">
          Showing {filtered.length} of {documents.length} {documents.length === 1 ? "item" : "items"}.
        </p>
        {pathId !== "all" && (
          <p className="mt-2 text-xs leading-5 text-marble/55">
            Items are shown in their suggested path order. Personal completion is not collected or stored.
          </p>
        )}

        {filtered.length === 0 ? (
          <div className="mt-5 border border-white/10 bg-white/[0.03] p-8 text-center">
            <h3 className="font-heading text-xl font-bold uppercase text-white">No matching lessons</h3>
            <p className="mt-2 text-sm text-marble/65">Change a filter or clear the search to see other material.</p>
            <button type="button" onClick={() => { setQuery(""); setSubject("all"); setLevel("all"); setContentType("all"); setPathId("all"); }} className="mt-5 border border-white/20 px-4 py-2 text-xs font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">Clear filters</button>
          </div>
        ) : (
          <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((document) => (
              <li key={document.slug}>
                <Link to={`${basePath}/${document.slug}`} className="group flex h-full min-h-56 flex-col border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-ares-red/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                    {pathId !== "all" && (
                      <span className="bg-ares-gold px-2 py-1 text-obsidian">
                        Suggested step {document.pathMemberships.find((membership) => membership.pathId === pathId)?.order ?? "not set"}
                      </span>
                    )}
                    <span className="bg-ares-red/20 px-2 py-1 text-white">{labelFor(LEARNING_SUBJECTS, document.subject)}</span>
                    <span className="border border-white/15 px-2 py-1 text-marble/75">{labelFor(LEARNING_LEVELS, document.level)}</span>
                    <span className="border border-white/15 px-2 py-1 text-marble/75">{labelFor(LEARNING_CONTENT_TYPES, document.contentType)}</span>
                  </div>
                  <h3 className="mt-4 font-heading text-xl font-bold text-white group-hover:text-ares-gold">{document.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-marble/70">{document.description || "Open this item to view its content."}</p>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-5 text-xs text-marble/60">
                    <span>{document.estimatedMinutes ? <><Clock aria-hidden="true" className="mr-1 inline" size={14} />{document.estimatedMinutes} min</> : document.category}</span>
                    <ArrowRight aria-hidden="true" className="text-ares-gold transition-transform group-hover:translate-x-1" size={18} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilterSelect<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { id: T; label: string }[];
}) {
  const id = `learning-filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label htmlFor={id}>
      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-marble/70">{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full border border-white/15 bg-obsidian px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
        <option value="all">All</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}
