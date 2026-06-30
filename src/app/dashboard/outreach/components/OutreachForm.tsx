import React from "react";
import { Edit2, Plus, Clock, X, RefreshCw } from "lucide-react";

interface OutreachFormProps {
  editingId: string | null;
  title: string;
  setTitle: (t: string) => void;
  date: string;
  setDate: (d: string) => void;
  location: string;
  setLocation: (l: string) => void;
  hours: number;
  setHours: (h: number) => void;
  peopleReached: number;
  setPeopleReached: (p: number) => void;
  impactSummary: string;
  setImpactSummary: (s: string) => void;
  formEventId: string | null;
  setFormEventId: (id: string | null) => void;
  calcLogMessage: string | null;
  setCalcLogMessage: (msg: string | null) => void;
  isSaving: boolean;
  onSave: (e: React.FormEvent) => void;
  onReset: () => void;
}

export default function OutreachForm({
  editingId,
  title,
  setTitle,
  date,
  setDate,
  location,
  setLocation,
  hours,
  setHours,
  peopleReached,
  setPeopleReached,
  impactSummary,
  setImpactSummary,
  formEventId,
  setFormEventId,
  calcLogMessage,
  setCalcLogMessage,
  isSaving,
  onSave,
  onReset,
}: OutreachFormProps) {
  return (
    <div className="glass-card p-6 border border-white/10 ares-cut flex flex-col gap-6 sticky top-24 shadow-2xl text-left">
      <h2 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
        {editingId ? <Edit2 size={18} /> : <Plus size={18} />}
        {editingId ? "Edit Service Log" : "Add Service Log"}
      </h2>

      <form onSubmit={onSave} className="space-y-5">
        {/* Linked Calendar Event Notice */}
        {formEventId && (
          <div className="flex items-center justify-between text-[10px] bg-ares-gold/15 text-ares-gold border border-ares-gold/25 px-3 py-2 ares-cut-sm font-black uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Clock size={12} /> Linked to Calendar Event
            </span>
            <button
              type="button"
              onClick={() => {
                setFormEventId(null);
                setCalcLogMessage(null);
              }}
              className="text-ares-gold hover:text-white transition-colors cursor-pointer"
              title="Unlink from Calendar"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Event Title */}
        <div className="space-y-1.5">
          <label htmlFor="outreach-title" className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">
            Event Title *
          </label>
          <input
            id="outreach-title"
            type="text"
            required
            placeholder="e.g. Morgantown Library STEM Day"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
          />
        </div>

        {/* Event Date */}
        <div className="space-y-1.5">
          <label htmlFor="outreach-date" className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">
            Event Date *
          </label>
          <input
            id="outreach-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-bold"
          />
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <label htmlFor="outreach-location" className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">
            Location
          </label>
          <input
            id="outreach-location"
            type="text"
            placeholder="e.g. Westover, WV"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
          />
        </div>

        {/* Hours / Reach Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Total Service Hours */}
          <div className="space-y-1.5">
            <label htmlFor="outreach-hours" className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">
              Service Hours
            </label>
            <input
              id="outreach-hours"
              type="number"
              min="0"
              step="any"
              required
              placeholder="0"
              value={hours || ""}
              onChange={(e) => setHours(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
            />
            {calcLogMessage && (
              <p className="text-[9px] text-ares-gold/90 font-medium leading-normal bg-ares-gold/5 border border-ares-gold/10 p-1.5 ares-cut-sm mt-1 font-mono">
                {calcLogMessage}
              </p>
            )}
          </div>

          {/* People Reached */}
          <div className="space-y-1.5">
            <label htmlFor="outreach-reach" className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">
              Impact Reach
            </label>
            <input
              id="outreach-reach"
              type="number"
              min="0"
              required
              placeholder="0"
              value={peopleReached || ""}
              onChange={(e) => setPeopleReached(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
            />
          </div>
        </div>

        {/* Impact Summary */}
        <div className="space-y-1.5">
          <label htmlFor="outreach-summary" className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">
            Impact Summary
          </label>
          <textarea
            id="outreach-summary"
            placeholder="Provide a brief summary of the demonstrations performed and community impact..."
            rows={4}
            value={impactSummary}
            onChange={(e) => setImpactSummary(e.target.value)}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold resize-none"
          />
        </div>

        {/* Form Buttons */}
        <div className="flex gap-4 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 clipped-button-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold py-2.5 shadow-md"
          >
            {isSaving ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : editingId ? (
              "Update"
            ) : (
              "Record"
            )}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={onReset}
              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-wider ares-cut-sm shadow-md cursor-pointer font-bold text-center"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
