import { useEffect } from "react";

interface UseSimulationShortcutsProps {
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;
  handleRun: () => void;
  handleFormatCode: () => void;
  handleSave: () => void;
}

export function useSimulationShortcuts({
  isFullscreen,
  setIsFullscreen,
  handleRun,
  handleFormatCode,
  handleSave
}: UseSimulationShortcutsProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        handleFormatCode();
      }
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen, handleRun, handleFormatCode, handleSave, setIsFullscreen]);
}
