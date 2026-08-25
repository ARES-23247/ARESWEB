export const ACADEMY_PROGRESS_STORAGE_KEY = "ares-academy-progress-v1";
export const ACADEMY_PROGRESS_SCHEMA_VERSION = 1;
export const MAX_COMPLETED_LESSONS = 500;

export interface AcademyProgressState {
  version: 1;
  completedSlugs: string[];
}

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/u;

export function emptyAcademyProgress(): AcademyProgressState {
  return { version: ACADEMY_PROGRESS_SCHEMA_VERSION, completedSlugs: [] };
}

export function parseAcademyProgress(value: string | null): AcademyProgressState {
  if (!value) return emptyAcademyProgress();
  try {
    const parsed = JSON.parse(value) as { version?: unknown; completedSlugs?: unknown };
    if (parsed.version !== ACADEMY_PROGRESS_SCHEMA_VERSION || !Array.isArray(parsed.completedSlugs)) {
      return emptyAcademyProgress();
    }
    return {
      version: ACADEMY_PROGRESS_SCHEMA_VERSION,
      completedSlugs: [...new Set(parsed.completedSlugs
        .filter((slug): slug is string => typeof slug === "string" && SAFE_SLUG.test(slug)))]
        .slice(0, MAX_COMPLETED_LESSONS),
    };
  } catch {
    return emptyAcademyProgress();
  }
}

export function readAcademyProgress(storage: Pick<Storage, "getItem">): AcademyProgressState {
  return parseAcademyProgress(storage.getItem(ACADEMY_PROGRESS_STORAGE_KEY));
}

export function writeAcademyProgress(
  storage: Pick<Storage, "setItem">,
  state: AcademyProgressState,
): void {
  storage.setItem(ACADEMY_PROGRESS_STORAGE_KEY, JSON.stringify({
    version: ACADEMY_PROGRESS_SCHEMA_VERSION,
    completedSlugs: state.completedSlugs
      .filter((slug) => SAFE_SLUG.test(slug))
      .slice(0, MAX_COMPLETED_LESSONS),
  }));
}

export function toggleAcademyLesson(
  state: AcademyProgressState,
  slug: string,
): AcademyProgressState {
  if (!SAFE_SLUG.test(slug)) return state;
  const completed = new Set(state.completedSlugs);
  if (completed.has(slug)) completed.delete(slug);
  else if (completed.size < MAX_COMPLETED_LESSONS) completed.add(slug);
  return { version: ACADEMY_PROGRESS_SCHEMA_VERSION, completedSlugs: [...completed] };
}
