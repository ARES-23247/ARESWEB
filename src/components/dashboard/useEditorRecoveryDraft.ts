import { useCallback, useEffect, useState } from "react";
import { logger } from "@/utils/logger";
import {
  parseRecoveryDraft,
  type DocumentEditorDraft,
} from "./documentEditorDraft";

interface EditorRecoveryOptions {
  draft: DocumentEditorDraft;
  isDirty: boolean;
  isOpen: boolean;
  storageKey: string;
}

export function useEditorRecoveryDraft({
  draft,
  isDirty,
  isOpen,
  storageKey,
}: EditorRecoveryOptions) {
  const [recoveryDraft, setRecoveryDraft] =
    useState<Partial<DocumentEditorDraft> | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const describeFailure = (action: string, error: unknown) => {
    const diagnostic = error instanceof Error ? error.message : String(error);
    logger.error(`Unable to ${action} editor recovery draft.`);
    setDraftError(`Recovery draft could not be ${action}: ${diagnostic}`);
  };

  const persistCurrentDraft = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
      setDraftError(null);
      return true;
    } catch (error) {
      describeFailure("saved", error);
      return false;
    }
  }, [draft, storageKey]);

  const discardRecoveryDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
      setRecoveryDraft(null);
      setDraftError(null);
    } catch (error) {
      describeFailure("discarded", error);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!isOpen) return;
    setRecoveryDraft(null);
    setDraftError(null);
    try {
      const storedDraft = window.localStorage.getItem(storageKey);
      if (storedDraft)
        setRecoveryDraft(parseRecoveryDraft(JSON.parse(storedDraft)));
    } catch (error) {
      describeFailure("read", error);
    }
  }, [isOpen, storageKey]);

  useEffect(() => {
    if (!isOpen || !isDirty) return;
    const timeout = window.setTimeout(persistCurrentDraft, 400);
    return () => window.clearTimeout(timeout);
  }, [isDirty, isOpen, persistCurrentDraft]);

  useEffect(() => {
    if (!isOpen || !isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty, isOpen]);

  return {
    recoveryDraft,
    setRecoveryDraft,
    draftError,
    persistCurrentDraft,
    discardRecoveryDraft,
  };
}
