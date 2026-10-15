import { useCallback, useEffect, useRef, useState } from "react";

export type CopyStatus = "idle" | "copied" | "error";

export interface UseCopyToClipboardResult {
  copied: boolean;
  copyStatus: CopyStatus;
  copyToClipboard: (text: string) => Promise<boolean>;
}

export function useCopyToClipboard(resetMs = 2000): UseCopyToClipboardResult {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const timerRef = useRef<number | null>(null);

  const clearResetTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearResetTimer, [clearResetTimer]);

  const copyToClipboard = useCallback(
    async (text: string): Promise<boolean> => {
      clearResetTimer();
      if (!text || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        setCopyStatus("error");
        return false;
      }
      try {
        await navigator.clipboard.writeText(text);
        setCopyStatus("copied");
        timerRef.current = window.setTimeout(() => {
          setCopyStatus("idle");
          timerRef.current = null;
        }, resetMs);
        return true;
      } catch {
        setCopyStatus("error");
        return false;
      }
    },
    [clearResetTimer, resetMs],
  );

  return {
    copied: copyStatus === "copied",
    copyStatus,
    copyToClipboard,
  };
}
