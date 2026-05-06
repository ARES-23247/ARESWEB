import { useState } from "react";
import { Terminal, Trash2, Info, AlertTriangle, XCircle } from "lucide-react";

export interface LogEntry {
  level: "log" | "warn" | "error" | "info";
  args: string[];
  timestamp: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export function SimConsole({ 
  logs, 
  testResults = [],
  onClear, 
  onFixWithAI 
}: { 
  logs: LogEntry[]; 
  testResults?: TestResult[];
  onClear: () => void;
  onFixWithAI?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"console" | "tests">("console");
  const [filters, setFilters] = useState<Record<string, boolean>>({
    log: true,
    info: true,
    warn: true,
    error: true
  });

  const filteredLogs = logs.filter(log => filters[log.level]);
  const hasError = logs.some(l => l.level === "error");

  const toggleFilter = (level: string) => {
    setFilters(prev => ({ ...prev, [level]: !prev[level] }));
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0f14] border-t border-white/10 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#0d0f14]">
        <div className="flex items-center gap-4">
          <div className="flex bg-[#161b22] p-0.5 rounded-md border border-white/10">
            <button
              onClick={() => setActiveTab("console")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === "console" ? "bg-[#0d0f14] text-ares-gold shadow-sm" : "text-white/40 hover:text-white/80"}`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Console {logs.length > 0 && `(${logs.length})`}
            </button>
            <button
              onClick={() => setActiveTab("tests")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === "tests" ? "bg-[#0d0f14] text-ares-gold shadow-sm" : "text-white/40 hover:text-white/80"}`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Tests {testResults.length > 0 && `(${testResults.length})`}
            </button>
          </div>
          
          {activeTab === "console" && hasError && onFixWithAI && (
            <button
              onClick={onFixWithAI}
              className="text-[10px] px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors flex items-center gap-1"
            >
              <span>✨ Fix with AI</span>
            </button>
          )}
          {activeTab === "console" && (
            <div className="flex items-center gap-1.5 ml-2 border-l border-white/10 pl-4">
              <button
                onClick={() => toggleFilter("error")}
                className={`p-1 rounded transition-colors ${filters.error ? "text-red-400 bg-red-400/10" : "text-white/20 hover:text-white/40"}`}
                title="Toggle Errors"
              >
                <XCircle className="w-3 h-3" />
              </button>
              <button
                onClick={() => toggleFilter("warn")}
                className={`p-1 rounded transition-colors ${filters.warn ? "text-yellow-400 bg-yellow-400/10" : "text-white/20 hover:text-white/40"}`}
                title="Toggle Warnings"
              >
                <AlertTriangle className="w-3 h-3" />
              </button>
              <button
                onClick={() => toggleFilter("info")}
                className={`p-1 rounded transition-colors ${filters.info ? "text-blue-400 bg-blue-400/10" : "text-white/20 hover:text-white/40"}`}
                title="Toggle Info"
              >
                <Info className="w-3 h-3" />
              </button>
              <button
                onClick={() => toggleFilter("log")}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${filters.log ? "text-zinc-300 bg-zinc-300/10" : "text-white/20 hover:text-white/40"}`}
                title="Toggle Logs"
              >
                LOG
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onClear}
          title="Clear"
          className="p-1 text-white/20 hover:text-white/50 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10 font-mono text-[11px]">
        {activeTab === "console" && (
          filteredLogs.length === 0 ? (
            <div className="text-white/20 px-2 py-1 italic">
              {logs.length === 0 ? "Console is empty..." : "No logs match current filters."}
            </div>
          ) : (
            filteredLogs.map((log, i) => (
              <div
                key={i}
                className={`px-2 py-1 flex items-start gap-2 border-b border-white/5 last:border-0 ${
                  log.level === "error"
                    ? "text-red-400 bg-red-500/5"
                    : log.level === "warn"
                    ? "text-yellow-400 bg-yellow-500/5"
                    : log.level === "info"
                    ? "text-blue-400"
                    : "text-zinc-300"
                }`}
              >
                <span className="text-white/20 shrink-0 select-none">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="whitespace-pre-wrap break-all">{log.args.join(" ")}</span>
              </div>
            ))
          )
        )}
        
        {activeTab === "tests" && (
          testResults.length === 0 ? (
            <div className="text-white/20 px-2 py-1 italic">
              No tests have run yet. Use test(&apos;name&apos;, function() {'{'} expect(value).toBe(true) {'}'}) in your code.
            </div>
          ) : (
            testResults.map((tr, i) => (
              <div key={i} className="px-2 py-1.5 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  {tr.passed ? (
                    <span className="text-emerald-400 font-bold bg-emerald-400/10 px-1 rounded">PASS</span>
                  ) : (
                    <span className="text-red-400 font-bold bg-red-400/10 px-1 rounded">FAIL</span>
                  )}
                  <span className={tr.passed ? "text-emerald-100" : "text-red-100"}>{tr.name}</span>
                </div>
                {!tr.passed && tr.error && (
                  <div className="mt-1 pl-8 text-red-400/80 text-[10px] whitespace-pre-wrap">
                    {tr.error}
                  </div>
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
