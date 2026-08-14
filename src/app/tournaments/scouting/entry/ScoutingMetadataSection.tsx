import React from "react";
import { Shield, Flag } from "lucide-react";
import type { MatchScoutingEntry, AllianceColor } from "@/lib/scoutingData";
import type { Tournament } from "@/types/tournament";

export interface ScoutingMetadataSectionProps {
  entry: MatchScoutingEntry;
  tournaments: Tournament[];
  validationErrors: Record<string, string>;
  onTournamentSelect: (id: string) => void;
  onTournamentNameChange: (name: string) => void;
  onMatchNumberChange: (match: string) => void;
  onTeamNumberChange: (team: string) => void;
  onTeamNameChange: (name: string) => void;
  onScoutNameChange: (name: string) => void;
  onAllianceChange: (alliance: AllianceColor) => void;
}

export function ScoutingMetadataSection({
  entry,
  tournaments,
  validationErrors,
  onTournamentSelect,
  onTournamentNameChange,
  onMatchNumberChange,
  onTeamNumberChange,
  onTeamNameChange,
  onScoutNameChange,
  onAllianceChange,
}: ScoutingMetadataSectionProps) {
  return (
    <section
      aria-labelledby="section-metadata-title"
      className="glass-card hero-card p-6 border border-white/10 bg-black/40"
    >
      <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-ares-gold" aria-hidden="true" />
          <h2 id="section-metadata-title" className="text-base md:text-lg font-bold text-white uppercase font-heading">
            1. Match & Team Identification
          </h2>
        </div>
        <span className="text-[10px] uppercase font-black tracking-widest text-ares-gold/70">
          Required Info
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tournament Selector */}
        <div className="sm:col-span-2">
          <label htmlFor="scout-tournament" className="text-xs font-bold text-marble/80 uppercase tracking-wider block mb-1.5">
            Tournament <span className="text-ares-red">*</span>
          </label>
          {tournaments.length > 0 ? (
            <select
              id="scout-tournament"
              value={entry.tournamentId}
              onChange={(e) => onTournamentSelect(e.target.value)}
              className={`w-full bg-white/5 border rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-ares-gold transition-all ${
                validationErrors.tournamentId ? "border-ares-red" : "border-white/15"
              }`}
            >
              <option value="" className="bg-obsidian text-marble">
                -- Select Tournament Event --
              </option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id} className="bg-obsidian text-white">
                  {t.name} ({t.location})
                </option>
              ))}
            </select>
          ) : (
            <input
              id="scout-tournament"
              type="text"
              placeholder="Enter Tournament Event Name"
              value={entry.tournamentName || entry.tournamentId}
              onChange={(e) => onTournamentNameChange(e.target.value)}
              className={`w-full bg-white/5 border rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-marble/40 focus:outline-none focus:border-ares-gold transition-all ${
                validationErrors.tournamentId ? "border-ares-red" : "border-white/15"
              }`}
            />
          )}
          {validationErrors.tournamentId && (
            <p className="text-[11px] text-ares-red mt-1">{validationErrors.tournamentId}</p>
          )}
        </div>

        {/* Match Number */}
        <div>
          <label htmlFor="scout-match-number" className="text-xs font-bold text-marble/80 uppercase tracking-wider block mb-1.5">
            Match Number <span className="text-ares-red">*</span>
          </label>
          <input
            id="scout-match-number"
            type="text"
            placeholder="e.g. QM1, SF1-1, F1"
            value={entry.matchNumber}
            onChange={(e) => onMatchNumberChange(e.target.value)}
            className={`w-full bg-white/5 border rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-marble/40 focus:outline-none focus:border-ares-gold font-mono font-bold transition-all ${
              validationErrors.matchNumber ? "border-ares-red" : "border-white/15"
            }`}
          />
          {validationErrors.matchNumber && (
            <p className="text-[11px] text-ares-red mt-1">{validationErrors.matchNumber}</p>
          )}
        </div>

        {/* Team Number */}
        <div>
          <label htmlFor="scout-team-number" className="text-xs font-bold text-marble/80 uppercase tracking-wider block mb-1.5">
            Team Number <span className="text-ares-red">*</span>
          </label>
          <input
            id="scout-team-number"
            type="text"
            placeholder="e.g. 23247"
            value={entry.teamNumber}
            onChange={(e) => onTeamNumberChange(e.target.value.replace(/\D/g, ""))}
            className={`w-full bg-white/5 border rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-marble/40 focus:outline-none focus:border-ares-gold font-mono font-bold transition-all ${
              validationErrors.teamNumber ? "border-ares-red" : "border-white/15"
            }`}
          />
          {validationErrors.teamNumber && (
            <p className="text-[11px] text-ares-red mt-1">{validationErrors.teamNumber}</p>
          )}
        </div>

        {/* Team Name */}
        <div>
          <label htmlFor="scout-team-name" className="text-xs font-bold text-marble/80 uppercase tracking-wider block mb-1.5">
            Team Name (Optional)
          </label>
          <input
            id="scout-team-name"
            type="text"
            placeholder="e.g. ARES"
            value={entry.teamName}
            onChange={(e) => onTeamNameChange(e.target.value)}
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-marble/40 focus:outline-none focus:border-ares-gold transition-all"
          />
        </div>

        {/* Scout Name */}
        <div>
          <label htmlFor="scout-scout-name" className="text-xs font-bold text-marble/80 uppercase tracking-wider block mb-1.5">
            Scout Initials / Name
          </label>
          <input
            id="scout-scout-name"
            type="text"
            placeholder="e.g. David / JD"
            value={entry.scoutName}
            onChange={(e) => onScoutNameChange(e.target.value)}
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-marble/40 focus:outline-none focus:border-ares-gold transition-all"
          />
        </div>

        {/* Alliance Color Picker */}
        <div className="sm:col-span-2">
          <label id="alliance-selector-label" className="text-xs font-bold text-marble/80 uppercase tracking-wider block mb-1.5">
            Alliance Color <span className="text-ares-red">*</span>
          </label>
          <div role="radiogroup" aria-labelledby="alliance-selector-label" className="grid grid-cols-2 gap-3">
            <button
              type="button"
              role="radio"
              aria-checked={entry.alliance === "red"}
              onClick={() => onAllianceChange("red")}
              className={`py-2.5 px-4 rounded-lg font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                entry.alliance === "red"
                  ? "bg-red-600/90 text-white border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.4)] scale-[1.02]"
                  : "bg-white/5 text-marble/60 border-white/10 hover:bg-white/10"
              }`}
            >
              <Flag size={14} className={entry.alliance === "red" ? "text-white" : "text-red-400"} />
              <span>Red Alliance</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={entry.alliance === "blue"}
              onClick={() => onAllianceChange("blue")}
              className={`py-2.5 px-4 rounded-lg font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                entry.alliance === "blue"
                  ? "bg-blue-600/90 text-white border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)] scale-[1.02]"
                  : "bg-white/5 text-marble/60 border-white/10 hover:bg-white/10"
              }`}
            >
              <Flag size={14} className={entry.alliance === "blue" ? "text-white" : "text-blue-400"} />
              <span>Blue Alliance</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
