import React from "react";
import { Plus } from "lucide-react";

interface TaskFiltersProps {
  canEdit: boolean;
  onOpenCreate: () => void;
  sortBy: "newest" | "priority";
  onSortByChange: (sort: "newest" | "priority") => void;
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
  filterSubteam: string;
  onFilterSubteamChange: (subteam: string) => void;
}

export default function TaskFilters({
  canEdit,
  onOpenCreate,
  sortBy,
  onSortByChange,
  showArchived,
  onShowArchivedChange,
  filterSubteam,
  onFilterSubteamChange,
}: TaskFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center shrink-0 w-full lg:w-auto text-left">
      {/* Create Task Trigger Button */}
      {canEdit && (
        <button
          type="button"
          onClick={onOpenCreate}
          className="clipped-button-sm bg-ares-red text-white hover:bg-ares-red-dark transition-all cursor-pointer text-xs font-bold px-4 py-2 flex items-center gap-1.5 shrink-0"
        >
          <Plus size={14} /> Create Task
        </button>
      )}

      {/* Sort & Archive Controls */}
      <div className="flex items-center gap-3 bg-black/45 p-1.5 rounded-lg border border-white/5 shrink-0">
        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="board-sort" className="text-[10px] font-bold uppercase tracking-wider text-marble/55">Sort:</label>
          <select
            id="board-sort"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as any)}
            className="bg-black/60 border border-white/10 rounded px-2.5 py-1 text-[10px] font-bold uppercase text-white focus:outline-none focus:border-ares-red transition-colors cursor-pointer font-sans"
          >
            <option value="newest">Newest First</option>
            <option value="priority">Priority (High-Low)</option>
          </select>
        </div>

        <div className="h-4 w-px bg-white/10" />

        {/* Show Archived Toggle */}
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-marble/75 hover:text-white cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => onShowArchivedChange(e.target.checked)}
            className="rounded bg-black border-white/25 text-ares-red focus:ring-0 focus:ring-offset-0 cursor-pointer"
          />
          Show Archived
        </label>
      </div>

      {/* Subteam Filters */}
      <div className="flex flex-wrap gap-1.5 bg-black/45 p-1.5 rounded-lg border border-white/5 shrink-0">
        {["all", "software", "hardware", "business", "outreach"].map((st) => (
          <button
            key={st}
            onClick={() => onFilterSubteamChange(st)}
            className={`px-3 py-1.5 text-[10px] font-black uppercase rounded transition-all duration-200 cursor-pointer ${
              filterSubteam === st
                ? "bg-ares-red text-white shadow-md animate-none"
                : "text-marble/75 hover:text-white animate-none"
            }`}
          >
            {st}
          </button>
        ))}
      </div>
    </div>
  );
}
