import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACADEMY_PROGRESS_STORAGE_KEY,
  emptyAcademyProgress,
  parseAcademyProgress,
  readAcademyProgress,
  toggleAcademyLesson,
  writeAcademyProgress,
  type AcademyProgressState,
} from "@/lib/academyProgress";

interface AcademyProgressController {
  completedSlugs: ReadonlySet<string>;
  storageAvailable: boolean;
  toggleCompleted: (slug: string) => void;
  resetProgress: () => void;
}

function initialState(): { progress: AcademyProgressState; storageAvailable: boolean } {
  if (typeof window === "undefined") return { progress: emptyAcademyProgress(), storageAvailable: false };
  try {
    return { progress: readAcademyProgress(window.localStorage), storageAvailable: true };
  } catch {
    return { progress: emptyAcademyProgress(), storageAvailable: false };
  }
}

export function useAcademyProgress(): AcademyProgressController {
  const [state, setState] = useState(initialState);

  const persist = useCallback((progress: AcademyProgressState): boolean => {
    try {
      writeAcademyProgress(window.localStorage, progress);
      return true;
    } catch {
      return false;
    }
  }, []);

  const toggleCompleted = useCallback((slug: string) => {
    setState((current) => {
      const progress = toggleAcademyLesson(current.progress, slug);
      return { progress, storageAvailable: persist(progress) };
    });
  }, [persist]);

  const resetProgress = useCallback(() => {
    const progress = emptyAcademyProgress();
    setState({ progress, storageAvailable: persist(progress) });
  }, [persist]);

  useEffect(() => {
    const syncProgress = (event: StorageEvent) => {
      if (event.key !== ACADEMY_PROGRESS_STORAGE_KEY) return;
      setState((current) => ({
        ...current,
        progress: parseAcademyProgress(event.newValue),
      }));
    };
    window.addEventListener("storage", syncProgress);
    return () => window.removeEventListener("storage", syncProgress);
  }, []);

  return {
    completedSlugs: useMemo(() => new Set(state.progress.completedSlugs), [state.progress.completedSlugs]),
    storageAvailable: state.storageAvailable,
    toggleCompleted,
    resetProgress,
  };
}
