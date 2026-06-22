import React, { useState, useEffect, useRef } from "react";
import { Terminal, Check, Copy, Trash2 } from "lucide-react";
import { useScopeStore } from "../store/scopeStore";

interface ConsoleLogsWidgetProps {
  showTitle?: boolean;
}

export default function ConsoleLogsWidget({ showTitle = true }: ConsoleLogsWidgetProps) {
  const { consoleLogs, setConsoleLogs, currentTimeMs } = useScopeStore();

  const [logFilter, setLogFilter] = useState("");
  const [logLevelFilter, setLogLevelFilter] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL");
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const [mainLogsCopied, setMainLogsCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const formatTime = (ms: number) => {
    const totalSecs = ms / 1000;
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
  };

  const activeLogs = consoleLogs
    ? consoleLogs.filter((log) => log.timestamp <= currentTimeMs)
    : [];

  const filteredLogs = activeLogs.filter((log) => {
    const matchesLevel = logLevelFilter === "ALL" || log.level === logLevelFilter;
    const matchesSearch = log.message.toLowerCase().includes(logFilter.toLowerCase()) || 
                          log.level.toLowerCase().includes(logFilter.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  // Auto scroll effect
  useEffect(() => {
    if (autoScrollLogs && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [activeLogs.length, autoScrollLogs]);

  return (
    <div className="flex flex-col gap-4 h-full p-6 bg-obsidian-light">
      {showTitle && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3 shrink-0">
          <h3 className="text-sm font-heading font-black uppercase text-white tracking-widest flex items-center gap-2">
            <Terminal size={14} className="text-ares-gold" />
            System Console Logs
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Filter logs..."
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-white focus:outline-none focus:border-ares-gold font-mono placeholder:text-marble/35 focus:ring-2 focus:ring-ares-cyan"
              aria-label="Filter logs"
            />
            <select
              value={logLevelFilter}
              onChange={(e) => setLogLevelFilter(e.target.value as any)}
              className="bg-black/45 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-ares-gold font-bold uppercase cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:ring-offset-obsidian"
            >
              <option value="ALL" className="bg-neutral-900 text-marble/60 font-heading">ALL LEVELS</option>
              <option value="INFO" className="bg-neutral-900 text-white font-heading">INFO</option>
              <option value="WARN" className="bg-neutral-900 text-ares-gold font-heading">WARN</option>
              <option value="ERROR" className="bg-neutral-900 text-ares-red-light font-heading">ERROR</option>
            </select>
            
            <button
              type="button"
              onClick={() => {
                if (filteredLogs.length > 0) {
                  const logsText = filteredLogs
                    .map((entry) => `[${formatTime(entry.timestamp)}] [${entry.level}] ${entry.message}`)
                    .join("\n");
                  navigator.clipboard.writeText(logsText);
                  setMainLogsCopied(true);
                  setTimeout(() => setMainLogsCopied(false), 2000);
                }
              }}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] uppercase font-black tracking-widest text-marble/55 hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-heading"
              title="Copy current filtered logs"
            >
              {mainLogsCopied ? (
                <>
                  <Check size={10} className="text-ares-success" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={10} />
                  <span>Copy Logs</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setConsoleLogs(null)}
              disabled={!consoleLogs || consoleLogs.length === 0}
              className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] uppercase font-black tracking-widest text-marble/55 hover:text-white hover:bg-white/10 hover:border-ares-red/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-heading"
              title="Clear all console logs"
            >
              <Trash2 size={10} />
              <span>Clear</span>
            </button>

            <label className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-marble/55 cursor-pointer font-heading">
              <input
                type="checkbox"
                checked={autoScrollLogs}
                onChange={(e) => setAutoScrollLogs(e.target.checked)}
                className="accent-ares-gold cursor-pointer rounded border-white/10"
              />
              Auto-scroll
            </label>
          </div>
        </div>
      )}

      <div 
        ref={logContainerRef}
        className="flex-grow overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 bg-black/30 p-4 rounded-xl border border-white/5 scrollbar-thin scrollbar-thumb-white/5"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-marble/35 text-center py-16 uppercase tracking-widest text-xs font-bold font-heading">
            {consoleLogs ? "No matching log entries." : "No console logs loaded. Upload a text log above."}
          </div>
        ) : (
          filteredLogs.map((entry, idx) => {
            let levelColor = "text-marble/70";
            let levelBg = "bg-transparent";
            if (entry.level === "WARN") {
              levelColor = "text-ares-gold";
              levelBg = "bg-ares-gold/5 border border-ares-gold/10";
            } else if (entry.level === "ERROR") {
              levelColor = "text-ares-red-light";
              levelBg = "bg-ares-red/5 border border-ares-red/10";
            }
            return (
              <div key={idx} className={`flex items-start gap-2 p-1.5 rounded hover:bg-white/5 transition-colors ${levelBg}`}>
                <span className="text-marble/35 shrink-0 select-none">[{formatTime(entry.timestamp)}]</span>
                <span className={`px-1 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 tracking-wider font-heading ${
                  entry.level === "ERROR" ? "bg-ares-red/20 text-ares-red-light" :
                  entry.level === "WARN" ? "bg-ares-gold/20 text-ares-gold" :
                  "bg-white/10 text-marble/60"
                }`}>{entry.level}</span>
                <span className={`break-all ${levelColor}`}>{entry.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
