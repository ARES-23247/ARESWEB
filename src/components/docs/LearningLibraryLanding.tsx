import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, Clock, Route, Search } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { PublicDocument } from "@/lib/publicContentApi";
import {
  LEARNING_CONTENT_TYPES,
  LEARNING_LEVELS,
  LEARNING_PATHS,
  LEARNING_PLATFORMS,
  LEARNING_SUBJECTS,
  labelFor,
} from "@/lib/learningContent";
import {
  DEFAULT_LEARNING_FILTERS,
  filterLearningDocuments,
  learningFiltersToSearchParams,
  learningPathStepStatuses,
  learningTopics,
  parseLearningFilters,
  type LearningFilters,
} from "@/lib/learningExperience";

interface LearningLibraryLandingProps {
  documents: PublicDocument[];
  library: "academy" | "areslib";
  progress?: {
    completedSlugs: ReadonlySet<string>;
    storageAvailable: boolean;
    resetProgress: () => void;
  };
}

const FILTER_QUERY_KEYS = ["search", "subject", "level", "type", "path", "platform", "topic", "duration", "progress"] as const;

export default function LearningLibraryLanding({ documents, library, progress }: LearningLibraryLandingProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const basePath = library === "academy" ? "/academy" : "/docs";
  const filters = useMemo(() => parseLearningFilters(new URLSearchParams(location.search)), [location.search]);
  const pathId = filters.pathId === "all"
    || documents.some((document) => document.pathMemberships.some((membership) => membership.pathId === filters.pathId))
    ? filters.pathId
    : "all";

  const updateFilters = (next: LearningFilters) => {
    const params = new URLSearchParams(location.search);
    FILTER_QUERY_KEYS.forEach((key) => params.delete(key));
    const normalized = progress ? next : { ...next, progress: "all" as const };
    learningFiltersToSearchParams(normalized).forEach((value, key) => params.set(key, value));
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
  };

  const setFilter = <Key extends keyof LearningFilters>(key: Key, value: LearningFilters[Key]) => {
    updateFilters({ ...filters, [key]: value });
  };

  const filtered = useMemo(
    () => filterLearningDocuments(
      documents,
      { ...filters, pathId, progress: library === "academy" && progress ? filters.progress : "all" },
      progress?.completedSlugs,
    ),
    [documents, filters, library, pathId, progress],
  );
  const topics = useMemo(() => learningTopics(documents), [documents]);

  const pathCounts = useMemo(() => new Map(LEARNING_PATHS.map((path) => [
    path.id,
    documents.filter((document) => document.pathMemberships.some((membership) => membership.pathId === path.id)).length,
  ])), [documents]);
  const pathCompletedCounts = useMemo(() => new Map(LEARNING_PATHS.map((path) => [
    path.id,
    documents.filter((document) =>
      document.pathMemberships.some((membership) => membership.pathId === path.id)
      && progress?.completedSlugs.has(document.slug)).length,
  ])), [documents, progress]);
  const availablePaths = useMemo(
    () => LEARNING_PATHS.filter((path) => (pathCounts.get(path.id) ?? 0) > 0),
    [pathCounts],
  );

  const selectedPath = pathId === "all" ? null : LEARNING_PATHS.find((path) => path.id === pathId) ?? null;
  const selectedPathSteps = useMemo(
    () => pathId === "all"
      ? []
      : learningPathStepStatuses(documents, pathId, progress?.completedSlugs),
    [documents, pathId, progress?.completedSlugs],
  );
  const completedInPath = selectedPathSteps.filter((step) => step.completed).length;
  const continueDocument = selectedPathSteps.find((step) => step.ready)?.document
    ?? selectedPathSteps.find((step) => !step.completed)?.document
    ?? selectedPathSteps[0]?.document
    ?? null;
  const pathActionLabel = completedInPath === selectedPathSteps.length && selectedPathSteps.length > 0
    ? "Review path"
    : completedInPath > 0
      ? "Continue path"
      : "Start path";

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

      {availablePaths.length > 0 && (
        <section aria-labelledby="learning-paths-heading" className="mt-10">
          <div className="flex items-center gap-3">
            <Route aria-hidden="true" className="text-ares-gold" />
            <h2 id="learning-paths-heading" className="font-heading text-2xl font-black uppercase text-white">
              {library === "academy" ? "Learning paths" : "Guided reference paths"}
            </h2>
          </div>
          <p className="mt-2 text-sm text-marble/65">
            {library === "academy"
              ? "Paths combine lessons from several subjects into a suggested order."
              : "Paths arrange related references in a suggested order while keeping every source and version note visible."}
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availablePaths.map((path) => {
              const count = pathCounts.get(path.id) ?? 0;
              const completed = pathCompletedCounts.get(path.id) ?? 0;
              const active = pathId === path.id;
              return (
                <button
                  key={path.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter("pathId", active ? "all" : path.id)}
                  className={`min-h-40 border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${active ? "border-ares-red bg-ares-red/15" : "border-white/10 bg-white/[0.04] hover:border-ares-gold/45"}`}
                >
                  <span className="mb-3 block text-[10px] font-black uppercase tracking-[0.16em] text-ares-cyan">
                    {path.beginnerGuidance}
                  </span>
                  <span className="font-heading text-lg font-bold uppercase text-white">{path.label}</span>
                  <span className="mt-2 block text-sm leading-6 text-marble/70">{path.description}</span>
                  <span className="mt-4 block text-xs font-bold uppercase tracking-wider text-ares-gold">
                    {count > 0 ? `${count} ${count === 1 ? "lesson" : "lessons"}` : "Curriculum in preparation"}
                  </span>
                  {progress && count > 0 && (
                    <span className="mt-1 block text-xs font-bold text-ares-cyan">
                      {completed} of {count} complete on this browser
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedPath && (
            <div className="mt-6 border border-ares-gold/35 bg-ares-gold/[0.07] p-5" aria-labelledby="selected-path-heading">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-ares-gold">Selected learning path</p>
                  <h3 id="selected-path-heading" className="mt-2 font-heading text-xl font-black uppercase text-white">
                    {selectedPath.label}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-marble/70">
                    Lessons below are in their recommended order. Complete them at your own pace; prerequisites appear on each lesson.
                  </p>
                  {progress && (
                    <p className="mt-3 text-sm font-bold text-ares-cyan">
                      {completedInPath} of {selectedPathSteps.length} complete on this browser
                    </p>
                  )}
                </div>
                {continueDocument && (
                  <Link
                    to={`${basePath}/${continueDocument.slug}?path=${selectedPath.id}`}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-ares-red px-5 py-3 text-xs font-black uppercase tracking-wider text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    {pathActionLabel}
                    <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                )}
              </div>
              {selectedPathSteps.length > 0 && (
                <ol className="mt-5 grid gap-2 border-t border-white/10 pt-5 md:grid-cols-2">
                  {selectedPathSteps.map((step, index) => {
                    const { document } = step;
                    const status = step.completed
                      ? "Lesson completed"
                      : step.ready
                        ? "Ready next"
                        : `${step.missingPrerequisites.length} ${step.missingPrerequisites.length === 1 ? "prerequisite" : "prerequisites"} remaining`;
                    return (
                      <li key={document.slug} className="flex items-start gap-3 text-sm text-marble/75">
                        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border text-xs font-bold ${step.completed ? "border-ares-cyan bg-ares-cyan text-obsidian" : "border-white/20 text-white"}`}>
                          {step.completed ? <Check aria-hidden="true" size={15} /> : index + 1}
                        </span>
                        <span className="min-w-0">
                          <Link to={`${basePath}/${document.slug}?path=${selectedPath.id}`} className="hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-ares-cyan">
                            {document.title}
                          </Link>
                          <span className={`mt-0.5 block text-xs font-bold ${step.ready ? "text-ares-gold" : "text-marble/55"}`}>
                            {status}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="browse-library-heading" className="mt-12">
        <div className="flex items-center gap-3">
          <BookOpen aria-hidden="true" className="text-ares-gold" />
          <h2 id="browse-library-heading" className="font-heading text-2xl font-black uppercase text-white">Browse the library</h2>
        </div>

        <div className="mt-5 grid gap-4 border border-white/10 bg-black/25 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="sm:col-span-2 xl:col-span-4">
            <label htmlFor="learning-library-search" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marble/70">Search titles and topics</label>
            <span className="flex items-center gap-3 border border-white/15 bg-obsidian px-3 focus-within:ring-2 focus-within:ring-ares-cyan">
              <Search aria-hidden="true" size={17} className="text-marble/55" />
              <input id="learning-library-search" value={filters.search} onChange={(event) => setFilter("search", event.target.value.slice(0, 120))} className="min-h-11 w-full bg-transparent text-sm text-white outline-none placeholder:text-marble/45" placeholder="Try geometry, controls, or climbing" />
            </span>
            <span className="mt-1 block text-xs text-marble/50">Search also checks lesson objectives and prerequisites.</span>
          </div>
          <FilterSelect label="Subject" value={filters.subject} onChange={(value) => setFilter("subject", value as LearningFilters["subject"])} options={LEARNING_SUBJECTS} />
          <FilterSelect label="Level" value={filters.level} onChange={(value) => setFilter("level", value as LearningFilters["level"])} options={LEARNING_LEVELS} />
          <FilterSelect label="Content type" value={filters.contentType} onChange={(value) => setFilter("contentType", value as LearningFilters["contentType"])} options={LEARNING_CONTENT_TYPES} />
          <FilterSelect label="Platform" value={filters.platform} onChange={(value) => setFilter("platform", value as LearningFilters["platform"])} options={LEARNING_PLATFORMS} />
          <FilterSelect label="Topic" value={filters.topic} onChange={(value) => setFilter("topic", value)} options={topics.map((topic) => ({ id: topic, label: topic }))} />
          <FilterSelect label="Duration" value={filters.duration} onChange={(value) => setFilter("duration", value as LearningFilters["duration"])} options={[
            { id: "15", label: "15 minutes or less" },
            { id: "30", label: "30 minutes or less" },
            { id: "60", label: "60 minutes or less" },
          ] as const} />
          {library === "academy" && progress && <FilterSelect label="Progress" value={filters.progress} onChange={(value) => setFilter("progress", value as LearningFilters["progress"])} options={[
            { id: "not-started", label: "Not started" },
            { id: "completed", label: "Completed" },
          ] as const} />}
          {availablePaths.length > 0 && <FilterSelect label={library === "academy" ? "Learning path" : "Reference path"} value={pathId} onChange={(value) => setFilter("pathId", value as LearningFilters["pathId"])} options={availablePaths} />}
          <button
            type="button"
            onClick={() => updateFilters(DEFAULT_LEARNING_FILTERS)}
            className="min-h-11 self-end border border-white/20 px-4 py-2 text-xs font-bold uppercase text-white hover:border-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            Clear filters
          </button>
        </div>

        <p role="status" aria-live="polite" className="mt-4 text-sm text-marble/65">
          Showing {filtered.length} of {documents.length} {documents.length === 1 ? "item" : "items"}.
        </p>
        {pathId !== "all" && (
          <p className="mt-2 text-xs leading-5 text-marble/55">
            Items are shown in their suggested path order. Completion stays only in this browser and is not connected to a student account.
          </p>
        )}

        {progress && (
          <div className="mt-4 border border-white/10 bg-white/[0.03] p-4 text-sm text-marble/70">
            <p>
              Progress is private to this browser. It is not sent to ARES, shared between devices, or tied to a sign-in.
              {!progress.storageAvailable && " Browser storage is unavailable, so changes will last only until this page closes."}
            </p>
            {progress.completedSlugs.size > 0 && (
              confirmingReset ? (
                <div className="mt-3 flex flex-wrap items-center gap-3" role="group" aria-label="Confirm progress reset">
                  <span className="font-bold text-white">Clear all local lesson progress?</span>
                  <button type="button" onClick={() => { progress.resetProgress(); setConfirmingReset(false); }} className="min-h-11 bg-ares-red px-4 py-2 text-xs font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">Yes, clear it</button>
                  <button type="button" onClick={() => setConfirmingReset(false)} className="min-h-11 border border-white/20 px-4 py-2 text-xs font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmingReset(true)} className="mt-3 min-h-11 border border-white/20 px-4 py-2 text-xs font-bold uppercase text-white hover:border-ares-red focus-visible:ring-2 focus-visible:ring-ares-cyan">Reset local progress</button>
              )
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="mt-5 border border-white/10 bg-white/[0.03] p-8 text-center">
            <h3 className="font-heading text-xl font-bold uppercase text-white">No matching lessons</h3>
            <p className="mt-2 text-sm text-marble/65">Change a filter or clear the search to see other material.</p>
            <button type="button" onClick={() => updateFilters(DEFAULT_LEARNING_FILTERS)} className="mt-5 min-h-11 border border-white/20 px-4 py-2 text-xs font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">Clear filters</button>
          </div>
        ) : (
          <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((document) => (
              <li key={document.slug}>
                <Link to={`${basePath}/${document.slug}${pathId !== "all" ? `?path=${pathId}` : ""}`} className="group flex h-full min-h-56 flex-col border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-ares-red/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                    {progress?.completedSlugs.has(document.slug) && (
                      <span className="inline-flex items-center gap-1 bg-ares-cyan px-2 py-1 text-obsidian">
                        <Check aria-hidden="true" size={12} /> Complete
                      </span>
                    )}
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
