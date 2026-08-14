import React from "react";
import { Search, RefreshCw, AlertCircle, Sparkles, MapPin, Clock, Edit2, Archive, ArchiveRestore, Award } from "lucide-react";

export interface OutreachLog {
  id: string;
  title: string;
  date: string;
  location?: string | null;
  hours: number;
  peopleReached: number;
  impactSummary?: string | null;
  eventId?: string | null;
  isDeleted: 0 | 1;
  createdAt?: string | null;
  archivedAt?: string | null;
}

interface OutreachLogsListProps {
  logs: OutreachLog[];
  isLoading: boolean;
  error: string;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onEdit: (log: OutreachLog) => void;
  archiveConfirmationId: string | null;
  onRequestArchive: (id: string) => void;
  onCancelArchive: () => void;
  onArchive: (log: OutreachLog) => void;
  onRestore: (log: OutreachLog) => void;
  onFetchLogs: () => void;
  onExportPortfolio?: () => void;
}

export default function OutreachLogsList({
  logs,
  isLoading,
  error,
  searchQuery,
  onSearchQueryChange,
  onEdit,
  archiveConfirmationId,
  onRequestArchive,
  onCancelArchive,
  onArchive,
  onRestore,
  onFetchLogs,
  onExportPortfolio,
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
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" size={16} />
          <label htmlFor="outreach-search" className="sr-only">Search outreach logs</label>
          <input
            id="outreach-search"
            type="text"
            placeholder="Search outreach events by title, summary, or location..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm pl-10 pr-4 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan/20 transition-all font-semibold"
          />
        </div>

        {onExportPortfolio && (
          <button
            type="button"
            onClick={onExportPortfolio}
            className="px-4 py-2 bg-ares-gold/15 hover:bg-ares-gold/25 border border-ares-gold/40 text-ares-gold ares-cut-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(229,168,35,0.15)] shrink-0"
            title="Generate FIRST Award & Outreach Portfolio"
          >
            <Award size={14} />
            <span>Award Portfolio</span>
          </button>
        )}
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
              className="bg-white/5 border border-white/10 p-6 ares-cut flex flex-col md:flex-row md:flex-wrap justify-between gap-6 hover:border-white/20 transition-all shadow-xl"
            >
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-marble/55 font-mono font-bold uppercase">
                  {log.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={10} className="text-ares-cyan" /> {log.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={10} className="text-ares-gold" /> {log.date}
                  </span>
                </div>

                <h3 className="font-extrabold text-white text-lg tracking-tight truncate leading-tight uppercase font-heading">
                  {log.title}
                </h3>

                {log.isDeleted === 1 && (
                  <span className="inline-flex bg-ares-gold text-obsidian px-2 py-0.5 border border-ares-gold text-[9px] font-black uppercase tracking-widest ares-cut-sm">
                    Archived
                  </span>
                )}

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
                {log.isDeleted !== 1 && <button
                  onClick={() => onEdit(log)}
                  className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-marble/85 hover:text-white ares-cut-sm transition-all cursor-pointer"
                  aria-label={`Edit ${log.title}`}
                >
                  <Edit2 size={12} aria-hidden="true" />
                </button>}
                {log.isDeleted === 1 ? <button
                  onClick={() => onRestore(log)}
                  className="p-2 bg-ares-gold text-obsidian border border-ares-gold hover:bg-white ares-cut-sm transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  aria-label={`Restore ${log.title}`}
                >
                  <ArchiveRestore size={14} aria-hidden="true" />
                </button> : <button
                  onClick={() => onRequestArchive(log.id)}
                  className="p-2 bg-ares-red text-white border border-ares-red hover:bg-white hover:text-obsidian ares-cut-sm transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  aria-label={`Archive ${log.title}`}
                >
                  <Archive size={14} aria-hidden="true" />
                </button>}
              </div>

              {archiveConfirmationId === log.id && log.isDeleted !== 1 && (
                <div role="group" aria-label={`Confirm archive for ${log.title}`} className="md:basis-full border border-ares-red/40 bg-ares-red/10 p-3 ares-cut-sm">
                  <p className="text-xs text-white">Archive {log.title}? It will leave the public outreach record but can be restored.</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => onArchive(log)} className="bg-ares-red text-white px-3 py-1.5 text-xs font-bold ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan">Confirm archive</button>
                    <button type="button" onClick={onCancelArchive} className="bg-white/10 text-white px-3 py-1.5 text-xs font-bold ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
