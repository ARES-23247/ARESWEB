import React from "react";
import { Search, RefreshCw, AlertCircle, Sparkles, MapPin, Clock, Edit2, Trash2 } from "lucide-react";

export interface OutreachLog {
  id: string;
  title: string;
  date: string;
  location?: string | null;
  hours: number;
  peopleReached: number;
  impactSummary?: string | null;
  eventId?: string | null;
  createdAt?: string | null;
}

interface OutreachLogsListProps {
  logs: OutreachLog[];
  isLoading: boolean;
  error: string;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onEdit: (log: OutreachLog) => void;
  onDelete: (id: string) => void;
  onFetchLogs: () => void;
}

export default function OutreachLogsList({
  logs,
  isLoading,
  error,
  searchQuery,
  onSearchQueryChange,
  onEdit,
  onDelete,
  onFetchLogs,
}: OutreachLogsListProps) {
  // Filter logs based on search query
  const filteredLogs = logs.filter((log) => {
    const queryLower = searchQuery.toLowerCase();
    return (
      log.title.toLowerCase().includes(queryLower) ||
      (log.location && log.location.toLowerCase().includes(queryLower)) ||
      (log.impactSummary && log.impactSummary.toLowerCase().includes(queryLower))
    );
  });

  return (
    <div className="space-y-6 text-left">
      {/* Search bar */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" size={16} />
        <input
          type="text"
          placeholder="Search outreach events by title, summary, or location..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="w-full bg-obsidian border border-white/10 ares-cut-sm pl-10 pr-4 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan/20 transition-all font-semibold"
        />
      </div>

      {/* List display */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 ares-cut gap-4">
          <RefreshCw size={36} className="text-ares-red animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest text-marble/55">
            Loading impact logs...
          </span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 bg-ares-red/10 border border-ares-red/20 ares-cut gap-4 text-center">
          <AlertCircle size={36} className="text-ares-red" />
          <span className="text-sm font-bold bg-ares-red text-white px-3 py-1.5 rounded">{error}</span>
          <button
            onClick={onFetchLogs}
            className="px-4 py-2 bg-ares-red text-white text-xs font-black uppercase tracking-wider ares-cut-sm shadow-md cursor-pointer font-bold"
          >
            Retry
          </button>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 ares-cut gap-3 text-center">
          <Sparkles size={36} className="text-marble/30" />
          <span className="text-sm font-bold text-white/80 font-heading">No Events Recorded</span>
          <span className="text-xs text-marble/50 font-medium">
            Record a STEM service log using the panel on the right.
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-white/5 border border-white/10 p-6 ares-cut flex flex-col md:flex-row justify-between gap-6 hover:border-white/20 transition-all shadow-xl"
            >
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-marble/55 font-mono font-bold uppercase">
                  {log.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={10} className="text-ares-red" /> {log.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={10} className="text-ares-gold" /> {log.date}
                  </span>
                </div>

                <h3 className="font-extrabold text-white text-lg tracking-tight truncate leading-tight uppercase font-heading">
                  {log.title}
                </h3>

                {log.impactSummary && <p className="text-xs text-marble/75 leading-relaxed">{log.impactSummary}</p>}

                <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-wider text-marble/60 pt-1">
                  <span className="flex items-center gap-1 border border-white/10 bg-white/5 px-2 py-0.5 ares-cut-sm">
                    Hours: <strong className="text-white">{log.hours}</strong>
                  </span>
                  <span className="flex items-center gap-1 border border-white/10 bg-white/5 px-2 py-0.5 ares-cut-sm">
                    Reach: <strong className="text-white">{log.peopleReached}</strong>
                  </span>
                </div>
              </div>

              {/* Actions Drawer */}
              <div className="flex items-center gap-3 shrink-0 self-end md:self-auto border-t md:border-t-0 border-white/5 pt-3 md:pt-0 mt-3 md:mt-0 w-full md:w-auto justify-end">
                <button
                  onClick={() => onEdit(log)}
                  className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-marble/85 hover:text-white ares-cut-sm transition-all cursor-pointer"
                  title="Edit Log Details"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => onDelete(log.id)}
                  className="p-2 bg-ares-red/10 border border-ares-red/30 hover:bg-ares-red/20 text-ares-red hover:text-white ares-cut-sm transition-all cursor-pointer"
                  title="Delete Log"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
