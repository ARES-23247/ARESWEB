import { useEffect, useState } from "react";
import { siteConfig } from "../site.config";
import { publicApi } from "../api/publicApi";

interface DayCell {
  date: string;
  count: number;
  level: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LEVEL_COLORS = [
  "bg-white/5",           // 0 commits
  "bg-ares-red/25",       // low
  "bg-ares-red/50",       // medium
  "bg-ares-red/75",       // high
  "bg-ares-red",          // max
];

export default function GitHubHeatmap() {
  const [grid, setGrid] = useState<DayCell[][]>([]);
  const [totalCommits, setTotalCommits] = useState(0);
  const [repoCount, setRepoCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<DayCell | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await publicApi.get<{ grid: DayCell[][], totalCommits: number, repoCount: number }>("/api/github/activity");
        
        setGrid(data.grid);
        setTotalCommits(data.totalCommits);
        setRepoCount(data.repoCount);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load activity");
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Determine which month labels to show
  const monthLabels: { label: string; col: number }[] = [];
  if (grid.length > 0) {
    let lastMonth = -1;
    grid.forEach((week, i) => {
      const d = new Date(week[0].date);
      const month = d.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({ label: MONTHS[month], col: i });
        lastMonth = month;
      }
    });
  }

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 hero-card p-8 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-48 mb-4"></div>
        <div className="h-32 bg-white/10 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/5 border border-white/10 hero-card p-8">
        <p className="text-marble/50 text-sm">Unable to load GitHub activity.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 hero-card p-8 group relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="text-2xl font-bold font-heading group-hover:text-ares-gold transition-colors">
            Engineering Activity
          </h3>
          <p className="text-marble/50 text-sm mt-1">
            {totalCommits.toLocaleString()} contributions across {repoCount} repositories in the last year
          </p>
        </div>
        <a
          href={`https://github.com/${siteConfig.urls.githubOrg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ares-gold text-sm font-bold uppercase tracking-wider hover:text-white transition-colors shrink-0"
        >
          View on GitHub →
        </a>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[720px]">
          {/* Month labels */}
          <div className="flex ml-8 mb-1 text-xs text-marble/90 font-bold uppercase tracking-wider">
            {monthLabels.map((m) => (
              <div
                key={`${m.label}-${m.col}`}
                className="absolute"
                style={{ marginLeft: `${m.col * 14 + 32}px` }}
              >
                {m.label}
              </div>
            ))}
          </div>
          <div className="relative mt-4">
            <div className="flex gap-[2px]">
              {/* Day labels */}
              <div className="flex flex-col gap-[2px] mr-1 shrink-0">
                {DAYS.map((day, i) => (
                  <div
                    key={day}
                    className="h-[12px] flex items-center text-[9px] text-marble/90 font-bold uppercase"
                    style={{ visibility: i % 2 === 1 ? "visible" : "hidden" }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {week.map((day) => (
                    <div
                      key={day.date}
                      className={`w-[12px] h-[12px] rounded-[2px] transition-all duration-200 cursor-pointer ${
                        day.level === -1
                          ? "bg-transparent"
                          : `${LEVEL_COLORS[day.level]} hover:ring-1 hover:ring-white/50`
                      }`}
                      onMouseEnter={() => day.level >= 0 && setHoveredCell(day)}
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-xs text-marble/90 font-bold">
              <span>Less</span>
              {LEVEL_COLORS.map((color, i) => (
                <div key={i} className={`w-[12px] h-[12px] rounded-[2px] ${color}`} />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div className="absolute bottom-4 right-4 bg-obsidian border border-white/20 ares-cut-sm px-4 py-2 text-sm shadow-xl pointer-events-none z-10">
          <span className="text-white font-bold">{hoveredCell.count} commit{hoveredCell.count !== 1 ? "s" : ""}</span>
          <span className="text-marble/50 ml-2">{new Date(hoveredCell.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      )}
    </div>
  );
}
