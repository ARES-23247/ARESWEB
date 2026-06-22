import { useState, useEffect, useRef, useCallback } from "react";
import { authenticatedFetch } from "@/lib/api";
import { toast } from "sonner";

interface RobotStatus {
  enabled: boolean;
  opMode: string;
  upload?: { file: string | null; progress: number };
}

interface AutoSyncState {
  connected: boolean;
  robotStatus: RobotStatus | null;
  syncing: boolean;
  lastSyncTime: number | null;
  syncedFiles: string[];
  totalSynced: number;
}

/**
 * Determines the correct upload sub-endpoint based on log filename prefix.
 */
function getUploadRoute(fileName: string): string {
  if (fileName.startsWith("state_log_")) return "/api/upload/states";
  if (fileName.startsWith("action_log_")) return "/api/upload/actions";
  if (fileName.startsWith("input_log_")) return "/api/upload/inputs";
  if (fileName.startsWith("motor_log_")) return "/api/upload/motors";
  if (fileName.startsWith("vision_log_")) return "/api/upload/vision";
  return "/api/upload"; // Legacy CSV fallback
}

export function useAutoLogSync(ipAddress: string, enabled: boolean = true) {
  const [state, setState] = useState<AutoSyncState>({
    connected: false,
    robotStatus: null,
    syncing: false,
    lastSyncTime: null,
    syncedFiles: [],
    totalSynced: 0,
  });

  const syncingRef = useRef(false);
  const syncedFilesRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncFile = useCallback(async (fileName: string): Promise<boolean> => {
    try {
      // 1. Download from robot
      const downloadRes = await fetch(
        `http://${ipAddress}:8082/api/logs/download?file=${fileName}`
      );
      if (!downloadRes.ok) return false;
      const content = await downloadRes.text();

      // 2. Upload to cloud via authenticated Firebase endpoint
      const route = getUploadRoute(fileName);
      const contentType = fileName.endsWith(".jsonl")
        ? "application/x-jsonlines"
        : "text/csv";

      const uploadRes = await authenticatedFetch(route, {
        method: "POST",
        headers: { "Content-Type": contentType, "X-FileName": fileName },
        body: content,
      });
      if (!uploadRes.ok) return false;

      // 3. Mark as synced on robot
      await fetch(
        `http://${ipAddress}:8082/api/logs/markSynced?file=${fileName}`,
        { method: "POST" }
      );

      return true;
    } catch {
      return false;
    }
  }, [ipAddress]);

  const pollAndSync = useCallback(async () => {
    if (!ipAddress || syncingRef.current) return;

    // 1. Check robot status
    let status: RobotStatus;
    try {
      const res = await fetch(`http://${ipAddress}:8082/api/status`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) {
        setState(prev => ({ ...prev, connected: false, robotStatus: null }));
        return;
      }
      status = await res.json();
      setState(prev => ({ ...prev, connected: true, robotStatus: status }));
    } catch {
      setState(prev => ({ ...prev, connected: false, robotStatus: null }));
      return;
    }

    // 2. Only sync when robot is disabled (idle between matches)
    if (status.enabled) return;

    // 3. Get list of available log files
    let files: string[];
    try {
      const res = await fetch(`http://${ipAddress}:8082/api/logs`);
      if (!res.ok) return;
      files = await res.json();
      if (!Array.isArray(files)) return;
    } catch {
      return;
    }

    // 4. Filter to only new, unsynced files
    const newFiles = files.filter(f => !syncedFilesRef.current.has(f));
    if (newFiles.length === 0) return;

    // 5. Sync each file
    syncingRef.current = true;
    setState(prev => ({ ...prev, syncing: true }));

    let syncedCount = 0;
    for (const file of newFiles) {
      const success = await syncFile(file);
      if (success) {
        syncedFilesRef.current.add(file);
        syncedCount++;
        toast.success(`Synced ${file}`, {
          description: "Telemetry uploaded to cloud",
          duration: 3000,
        });
      } else {
        toast.error(`Failed to sync ${file}`, { duration: 5000 });
      }
    }

    syncingRef.current = false;
    setState(prev => ({
      ...prev,
      syncing: false,
      lastSyncTime: Date.now(),
      syncedFiles: [...syncedFilesRef.current],
      totalSynced: prev.totalSynced + syncedCount,
    }));
  }, [ipAddress, syncFile]);

  // Start/stop polling
  useEffect(() => {
    if (!enabled || !ipAddress) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setState(prev => ({ ...prev, connected: false }));
      return;
    }

    // Poll immediately, then every 10 seconds
    pollAndSync();
    pollIntervalRef.current = setInterval(pollAndSync, 10_000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [enabled, ipAddress, pollAndSync]);

  return state;
}
