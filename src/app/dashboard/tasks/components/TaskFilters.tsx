import React from "react";
import { Plus, Search } from "lucide-react";
import type { TaskSortMode } from "../taskRecord";

interface TaskFiltersProps {
  canEdit: boolean;
  onOpenCreate: () => void;
  sortBy: TaskSortMode;
  onSortByChange: (sort: TaskSortMode) => void;
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
  filterSubteam: string;
  onFilterSubteamChange: (subteam: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  showDuplicatesOnly: boolean;
  onShowDuplicatesOnlyChange: (show: boolean) => void;
  duplicateTaskCount: number;
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
  searchQuery,
  onSearchQueryChange,
  showDuplicatesOnly,
  onShowDuplicatesOnlyChange,
  duplicateTaskCount,
}: TaskFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center shrink-0 w-full lg:w-auto text-left">
      {/* Create Task Trigger Button */}
      {canEdit && (
        <button
          type="button"
          onClick={onOpenCreate}
          className="clipped-button-sm bg-ares-red text-white hover:bg-ares-bronze transition-all cursor-pointer text-xs font-bold px-4 py-2 flex items-center gap-1.5 shrink-0"
        >
          <Plus size={14} /> Create Task
        </button>
      )}

      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/5 bg-black/45 px-2.5 py-1.5">
        <Search aria-hidden="true" size={13} className="shrink-0 text-marble/55" />
        <label htmlFor="task-search" className="sr-only">Search tasks</label>
        <input
          id="task-search"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search tasks"
          className="w-36 bg-transparent text-xs text-white placeholder:text-marble/45 focus-visible:outline-none sm:w-44"
        />
      </div>

      {/* Sort & Archive Controls */}
      <div className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-black/45 p-1.5 sm:w-auto">
        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="board-sort"
            className="text-[10px] font-bold uppercase tracking-wider text-marble/55"
          >
            Sort:
          </label>
          <select
            id="board-sort"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as TaskSortMode)}
            className="bg-black/60 border border-white/10 rounded px-2.5 py-1 text-[10px] font-bold uppercase text-white focus:outline-none focus:border-ares-red transition-colors cursor-pointer font-sans"
          >
            <option value="newest">Newest First</option>
            <option value="priority">Priority (High-Low)</option>
            <option value="due">Due Date (Soonest)</option>
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

        <div className="h-4 w-px bg-white/10" />

        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-marble/75 hover:text-white cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDuplicatesOnly}
            onChange={(event) => onShowDuplicatesOnlyChange(event.target.checked)}
            disabled={duplicateTaskCount === 0 && !showDuplicatesOnly}
            className="rounded bg-black border-white/25 text-ares-red focus:ring-0 focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          />
          Potential duplicates ({duplicateTaskCount})
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
