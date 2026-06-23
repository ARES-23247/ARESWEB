import React, { useState, useEffect } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { authenticatedFetch } from "@/lib/api";
import { Cloud, Wifi, X, RefreshCw, Check, Upload } from "lucide-react";

import { getUploadRoute } from "@/hooks/scope/useAutoLogSync";

interface SyncRobotLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ipAddress: string;
  setIpAddress: (ip: string) => void;
}

export default function SyncRobotLogsModal({
  isOpen,
  onClose,
  ipAddress,
  setIpAddress,
}: SyncRobotLogsModalProps) {
  const [robotLogs, setRobotLogs] = useState<string[]>([]);
  const [fetchingLogs, setFetchingLogs] = useState(false);
  const [syncStatuses, setSyncStatuses] = useState<Record<string, "unsynced" | "syncing" | "synced" | "error">>({});
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncModalRef = useFocusTrap(isOpen, onClose);

  const fetchRobotLogs = async () => {
    setFetchingLogs(true);
    setSyncError(null);
    try {
      const res = await fetch(`http://${ipAddress}:8082/api/logs`);
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const logs = await res.json();
      if (Array.isArray(logs)) {
        setRobotLogs(logs);
        const initialStatuses: Record<string, "unsynced" | "syncing" | "synced" | "error"> = {};
        logs.forEach(file => {
          initialStatuses[file] = "unsynced";
        });
        setSyncStatuses(initialStatuses);
      } else {
        throw new Error("Invalid response format from robot web server.");
      }
    } catch (err: any) {
      console.error("Failed to query robot logs:", err);
      setSyncError(`Could not connect to robot server at http://${ipAddress}:8082. Make sure you are connected to the robot Wi-Fi and that the robot web server is running.`);
    } finally {
      setFetchingLogs(false);
    }
  };

  // Auto-fetch logs when modal mounts/opens
  useEffect(() => {
    if (isOpen) {
      fetchRobotLogs();
    }
  }, [isOpen]);

  const syncLogToCloud = async (fileName: string) => {
    setSyncStatuses(prev => ({ ...prev, [fileName]: "syncing" }));
    try {
      // 1. Download file content from robot
      const downloadRes = await fetch(`http://${ipAddress}:8082/api/logs/download?file=${fileName}`);
      if (!downloadRes.ok) throw new Error(`Failed to download from robot: HTTP ${downloadRes.status}`);
      const csvText = await downloadRes.text();

      // 2. Route to correct sub-endpoint based on file type
      const route = getUploadRoute(fileName);
      const contentType = fileName.endsWith(".jsonl")
        ? "application/x-jsonlines"
        : "text/csv";

      const uploadRes = await authenticatedFetch(route, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          "X-FileName": fileName,
        },
        body: csvText,
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Firebase upload returned HTTP ${uploadRes.status}`);
      }

      // 3. Mark file as synced on the robot
      const markRes = await fetch(`http://${ipAddress}:8082/api/logs/markSynced?file=${fileName}`, {
        method: "POST"
      });
      if (!markRes.ok) throw new Error(`Successfully uploaded to cloud, but failed to archive on robot: HTTP ${markRes.status}`);

      setSyncStatuses(prev => ({ ...prev, [fileName]: "synced" }));
    } catch (err: any) {
      console.error(`Failed to sync log ${fileName}:`, err);
      setSyncError(`Failed to sync ${fileName}: ${err.message}`);
      setSyncStatuses(prev => ({ ...prev, [fileName]: "error" }));
    }
  };

  const syncAllLogs = async () => {
    const unsyncedLogs = robotLogs.filter(file => syncStatuses[file] === "unsynced" || syncStatuses[file] === "error");
    for (const file of unsyncedLogs) {
      await syncLogToCloud(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md transition-all duration-300 animate-fade-in">
      <div 
        ref={syncModalRef} 
        tabIndex={-1} 
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-modal-title"
        className="glass-card border border-white/10 bg-neutral-950 p-6 max-w-md w-full rounded-2xl flex flex-col gap-5 shadow-2xl relative focus:outline-none animate-scale-up"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-marble/40 hover:text-white cursor-pointer transition-colors"
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ares-gold/10 border border-ares-gold/20 flex items-center justify-center text-ares-gold">
            <Cloud size={20} />
          </div>
          <div>
            <h3 id="sync-modal-title" className="font-extrabold text-white text-md tracking-tight uppercase font-heading">
              Sync Robot Logs
            </h3>
            <p className="text-marble/55 text-[10px] font-bold uppercase tracking-wider">
              Wi-Fi Direct Log Ingestion
            </p>
          </div>
        </div>

        <div className="flex items-center bg-black/50 border border-white/5 px-3 py-2 rounded-xl text-xs gap-2 shrink-0">
          <Wifi size={14} className="text-ares-gold" />
          <span className="text-marble/55 uppercase font-bold text-[10px] tracking-wider">Robot IP:</span>
          <input
            type="text"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            className="bg-transparent text-white font-mono text-xs focus:outline-none w-28"
          />
          <button
            onClick={fetchRobotLogs}
            className="ml-auto px-2.5 py-1 bg-white/5 hover:bg-white/10 text-marble/60 hover:text-white rounded border border-white/10 text-[9px] uppercase font-bold tracking-wider transition-colors"
          >
            Refresh
          </button>
        </div>

        {syncError && (
          <div className="bg-ares-red/10 border border-ares-red/20 rounded-xl p-3 text-[10px] text-ares-red-light leading-normal text-left">
            {syncError}
          </div>
        )}

        <div className="flex-grow max-h-60 overflow-y-auto space-y-2 pr-1">
          {fetchingLogs ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <RefreshCw size={24} className="text-ares-gold animate-spin" />
              <span className="text-[10px] uppercase font-bold text-marble/45 tracking-widest font-heading">
                Scanning Robot Logs...
              </span>
            </div>
          ) : robotLogs.length === 0 ? (
            <div className="text-center py-12 text-marble/35 uppercase text-[10px] font-bold tracking-widest leading-normal">
              No practice logs found on the robot.<br />
              <span className="text-[8px] text-marble/25 normal-case font-medium">Logs are saved under /sdcard/FIRST/telemetry_logs/</span>
            </div>
          ) : (
            robotLogs.map((file) => {
              const status = syncStatuses[file] || "unsynced";
              return (
                <div key={file} className="flex items-center justify-between p-3 bg-black/30 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex flex-col text-left gap-0.5 max-w-[70%]">
                    <span className="text-[10px] font-mono text-white truncate" title={file}>
                      {file}
                    </span>
                    <span className="text-[8px] text-marble/45 uppercase tracking-wider font-bold">
                      Unsynced
                    </span>
                  </div>
                  
                  {status === "synced" ? (
                    <span className="text-[9px] font-black uppercase text-ares-success tracking-widest flex items-center gap-1">
                      <Check size={10} className="stroke-[3]" /> Synced
                    </span>
                  ) : status === "syncing" ? (
                    <span className="text-[9px] font-black uppercase text-ares-gold tracking-widest flex items-center gap-1 animate-pulse">
                      <RefreshCw size={10} className="animate-spin" /> Syncing...
                    </span>
                  ) : status === "error" ? (
                    <span className="text-[9px] font-black uppercase text-ares-red tracking-widest flex items-center gap-1">
                      <X size={10} className="stroke-[3]" /> Error
                    </span>
                  ) : (
                    <button
                      onClick={() => syncLogToCloud(file)}
                      className="text-[9px] font-black uppercase text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors"
                    >
                      Sync
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-3 mt-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-grow py-3 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest rounded-xl transition-all duration-300 font-bold cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={syncAllLogs}
            disabled={fetchingLogs || robotLogs.length === 0 || !robotLogs.some(f => syncStatuses[f] === "unsynced" || syncStatuses[f] === "error")}
            className="flex-grow py-3 bg-ares-gold disabled:opacity-50 text-black hover:bg-ares-gold-soft text-[10px] uppercase font-black tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
          >
            <Upload size={12} className="stroke-[3]" /> Sync All
          </button>
        </div>
      </div>
    </div>
  );
}
