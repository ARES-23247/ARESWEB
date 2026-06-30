import React from "react";
import { RotateCcw } from "lucide-react";

interface EventsFilterPanelProps {
  filterStatus: "all" | "published" | "pending" | "draft" | "deleted";
  setFilterStatus: (status: "all" | "published" | "pending" | "draft" | "deleted") => void;
  filterCategory: "all" | "internal" | "outreach";
  setFilterCategory: (category: "all" | "internal" | "outreach") => void;
  filterSearch: string;
  setFilterSearch: (search: string) => void;
  filterMonth: string;
  setFilterMonth: (month: string) => void;
  filterYear: string;
  setFilterYear: (year: string) => void;
  counts: { all: number; published: number; pending: number; draft: number; deleted: number };
  yearOptions: string[];
  handleClearFilters: () => void;
}

export default function EventsFilterPanel({
  filterStatus,
  setFilterStatus,
  filterCategory,
  setFilterCategory,
  filterSearch,
  setFilterSearch,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  counts,
  yearOptions,
  handleClearFilters
}: EventsFilterPanelProps) {
  const hasActiveFilters = !!(
    filterSearch ||
    filterStatus !== "all" ||
    filterCategory !== "all" ||
    filterMonth !== "all" ||
    filterYear !== "all"
  );

  return (
    <div className="space-y-4 mb-6">
      {/* Status Pills / Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-2 text-[10px] uppercase font-black tracking-wider">
        {(["all", "published", "pending", "draft", "deleted"] as const).map((status) => {
          const isActive = filterStatus === status;
          const count = counts[status];
          
          // Color codes
          let colorClass = "hover:text-white border-transparent text-marble/45";
          if (isActive) {
            if (status === "deleted") colorClass = "border-ares-red/30 text-ares-red bg-ares-red/10";
            else if (status === "pending") colorClass = "border-amber-500/30 text-amber-500 bg-amber-500/10";
            else if (status === "published") colorClass = "border-ares-success/30 text-ares-success bg-ares-success/10";
            else colorClass = "border-ares-gold/35 text-white bg-white/5";
          }

          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-2 border rounded-t-lg transition-all cursor-pointer flex items-center gap-1.5 ${colorClass}`}
            >
              <span>
                {status === "all" && "📁 All Operations"}
                {status === "published" && "🟢 Published"}
                {status === "pending" && "🟡 Pending Approval"}
                {status === "draft" && "📝 Drafts"}
                {status === "deleted" && "🗑️ Trash"}
              </span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                isActive ? "bg-white/10 text-white" : "bg-white/5 text-marble/40"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dropdown Filters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-black/20 p-4 border border-white/5 rounded-xl text-left">
        {/* Search */}
        <div className="md:col-span-2 relative">
          <input
            type="text"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Search events by title, description..."
            aria-label="Search events"
            className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-cyan focus:ring-2 focus:ring-ares-cyan/25 transition-all placeholder:text-marble/30 font-medium"
          />
          {filterSearch && (
            <button
              onClick={() => setFilterSearch("")}
              className="absolute right-3 top-3 text-[10px] text-marble/40 hover:text-white uppercase font-bold cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category */}
        <div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as any)}
            aria-label="Filter events by category"
            className="w-full bg-black/60 border border-white/10 text-xs text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-ares-cyan cursor-pointer focus:ring-2 focus:ring-ares-cyan/25 font-bold"
          >
            <option value="all">📁 All Categories</option>
            <option value="internal">🏠 Internal Practices</option>
            <option value="outreach">🌍 Outreach Operations</option>
          </select>
        </div>

        {/* Month */}
        <div>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            aria-label="Filter events by month"
            className="w-full bg-black/60 border border-white/10 text-xs text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-ares-cyan cursor-pointer focus:ring-2 focus:ring-ares-cyan/25 font-bold"
          >
            <option value="all">📅 All Months</option>
            <option value="0">January</option>
            <option value="1">February</option>
            <option value="2">March</option>
            <option value="3">April</option>
            <option value="4">May</option>
            <option value="5">June</option>
            <option value="6">July</option>
            <option value="7">August</option>
            <option value="8">September</option>
            <option value="9">October</option>
            <option value="10">November</option>
            <option value="11">December</option>
          </select>
        </div>

        {/* Year */}
        <div className="flex gap-2">
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            aria-label="Filter events by year"
            className="flex-grow bg-black/60 border border-white/10 text-xs text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-ares-cyan cursor-pointer focus:ring-2 focus:ring-ares-cyan/25 font-bold"
          >
            <option value="all">🗓️ All Years</option>
            {yearOptions.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 bg-white/5 hover:bg-ares-red/10 border border-white/10 hover:border-ares-red/20 rounded-lg text-marble/60 hover:text-ares-red-light transition-all flex items-center justify-center cursor-pointer shrink-0"
              title="Reset Filters"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
