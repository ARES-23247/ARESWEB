import { useEffect, useCallback } from "react";

interface UseSimulationSnapshotsProps {
  files: Record<string, string>;
  simName: string;
  simId: string | null;
  setFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setActiveFile: React.Dispatch<React.SetStateAction<string>>;
  setSimName: React.Dispatch<React.SetStateAction<string>>;
  setSimId: React.Dispatch<React.SetStateAction<string | null>>;
  compileCode: (files: Record<string, string>) => void;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useSimulationSnapshots({
  files,
  simName,
  simId,
  setFiles,
  setActiveFile,
  setSimName,
  setSimId,
  compileCode,
  setShowHistory
}: UseSimulationSnapshotsProps) {
  const SNAPSHOT_KEY = "ares_sim_snapshots";
  const MAX_SNAPSHOTS = 5;

  const saveSnapshot = useCallback(() => {
    try {
      const snapshot = {
        files,
        simName,
        simId,
        timestamp: Date.now()
      };
      const stored = localStorage.getItem(SNAPSHOT_KEY);
      const snapshots = stored ? JSON.parse(stored) : [];
      snapshots.unshift(snapshot);
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots.slice(0, MAX_SNAPSHOTS)));
    } catch { /* localStorage full or unavailable */ }
  }, [files, simName, simId]);

  useEffect(() => {
    const interval = setInterval(saveSnapshot, 60000);
    return () => clearInterval(interval);
  }, [saveSnapshot]);

  const getSnapshots = useCallback(() => {
    try {
      const stored = localStorage.getItem(SNAPSHOT_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }, []);

  const restoreSnapshot = useCallback((snapshot: { files: Record<string, string>; simName: string; simId: string | null }) => {
    setFiles(snapshot.files);
    setActiveFile(Object.keys(snapshot.files)[0]);
    setSimName(snapshot.simName);
    setSimId(snapshot.simId);
    compileCode(snapshot.files);
    setShowHistory(false);
    import("sonner").then(({ toast }) => toast.success("Snapshot restored"));
  }, [setFiles, setActiveFile, setSimName, setSimId, compileCode, setShowHistory]);

  return {
    getSnapshots,
    restoreSnapshot,
    saveSnapshot
  };
}
