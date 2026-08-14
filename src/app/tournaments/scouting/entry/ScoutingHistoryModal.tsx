import React from "react";
import { Trophy, ListOrdered, Trash2, Download, FileSpreadsheet } from "lucide-react";
import {
  type MatchScoutingEntry,
  calculateScoringBreakdown,
  exportScoutingToCsv,
  exportScoutingToJson,
} from "@/lib/scoutingData";

export interface ScoutingHistoryModalProps {
  isOpen: boolean;
  history: MatchScoutingEntry[];
  onClose: () => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
}

export function ScoutingHistoryModal({
  isOpen,
  history,
  onClose,
  onDeleteRecord,
  onClearAll,
}: ScoutingHistoryModalProps) {
  if (!isOpen) return null;

  const handleExportCsv = () => {
    if (history.length === 0) return;
    const csvData = exportScoutingToCsv(history);
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ARES_Scouting_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    if (history.length === 0) return;
    const jsonData = exportScoutingToJson(history);
    const blob = new Blob([jsonData], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ARES_Scouting_Export_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-matches-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="glass-card bg-obsidian border border-white/15 w-full max-w-3xl max-h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <ListOrdered size={20} className="text-ares-gold" />
            <h3 id="saved-matches-title" className="text-lg font-bold text-white uppercase font-heading">
              Saved Scouting History ({history.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-marble/60 hover:text-white transition-colors cursor-pointer"
            aria-label="Close saved matches dialog"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-12 text-marble/50">
              <Trophy className="mx-auto text-marble/25 mb-3" size={40} />
              <p className="text-sm font-bold text-white uppercase">No Scouted Matches in Local Storage</p>
              <p className="text-xs text-marble/50 mt-1">
                Complete and save a match scouting sheet to view records here.
              </p>
            </div>
          ) : (
            history.map((record) => {
              const breakdown = calculateScoringBreakdown(record);
              return (
                <div
                  key={record.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          record.alliance === "red"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}
                      >
                        {record.alliance}
                      </span>
                      <span className="text-sm font-black text-white font-heading">
                        Match {record.matchNumber} · Team {record.teamNumber}
                      </span>
                      {record.teamName && (
                        <span className="text-xs text-marble/60">({record.teamName})</span>
                      )}
                    </div>
                    <p className="text-[11px] text-marble/60">
                      Auto: {breakdown.autoPoints} pts | TeleOp: {breakdown.teleopPoints} pts | Endgame: {breakdown.endgamePoints} pts | Total: {breakdown.totalPoints} pts
                    </p>
                    <span className="text-[10px] text-marble/40 mt-1 block">
                      Scouted by {record.scoutName || "ARES Scout"} · {new Date(record.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-marble/50 uppercase font-bold block">Rating</span>
                      <span className="text-lg font-black text-ares-gold font-heading">
                        {breakdown.matchRating}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteRecord(record.id)}
                      aria-label={`Delete record for match ${record.matchNumber}`}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {history.length > 0 && (
          <div className="p-6 border-t border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer"
            >
              Clear All Records
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download size={14} /> JSON
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="px-4 py-2 rounded-lg bg-ares-gold hover:bg-ares-gold/90 text-obsidian font-black text-xs uppercase inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
              >
                <FileSpreadsheet size={14} /> Export CSV
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
