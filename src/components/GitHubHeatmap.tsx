import { useEffect, useState } from "react";

interface WeekData {
  total: number;
  week: number;
  days: number[];
}

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

export default function GitHubHeatmap({ org = "ARES-23247" }: { org?: string }) {
  const [grid, setGrid] = useState<DayCell[][]>([]);
  const [totalCommits, setTotalCommits] = useState(0);
  const [repoCount, setRepoCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<DayCell | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Get all public repos for the org
        const repoRes = await fetch(`https://api.github.com/orgs/${org}/repos?per_page=100&type=public`);
        if (!repoRes.ok) throw new Error("Failed to fetch repos");
        const repos = await repoRes.json();
        setRepoCount(repos.length);

        // 2. Fetch commit activity for each repo (returns 52 weeks of data)
        const activityPromises = repos.map((repo: { name: string }) =>
          fetch(`https://api.github.com/repos/${org}/${repo.name}/stats/commit_activity`)
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [])
        );
        const allActivity: WeekData[][] = await Promise.all(activityPromises);

        // 3. Aggregate daily commits across all repos
        const dailyMap = new Map<string, number>();
        
        for (const repoWeeks of allActivity) {
          if (!Array.isArray(repoWeeks)) continue;
          for (const week of repoWeeks) {
            if (!week.days || !week.week) continue;
            const weekStart = new Date(week.week * 1000);
            for (let d = 0; d < 7; d++) {
              const day = new Date(weekStart);
              day.setDate(day.getDate() + d);
              const key = day.toISOString().split("T")[0];
              dailyMap.set(key, (dailyMap.get(key) || 0) + (week.days[d] || 0));
            }
          }
        }

        // 4. Build the grid (52 weeks × 7 days)
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        // Align to start of week (Sunday)
        const startDate = new Date(oneYearAgo);
        startDate.setDate(startDate.getDate() - startDate.getDay());

        const maxCount = Math.max(1, ...dailyMap.values());
        let total = 0;
        const weeks: DayCell[][] = [];

        const cursor = new Date(startDate);
        while (cursor <= today) {
          const week: DayCell[] = [];
          for (let d = 0; d < 7; d++) {
            const key = cursor.toISOString().split("T")[0];
            const count = dailyMap.get(key) || 0;
            total += count;

            let level = 0;
            if (count > 0) level = 1;
            if (count >= maxCount * 0.25) level = 2;
            if (count >= maxCount * 0.5) level = 3;
            if (count >= maxCount * 0.75) level = 4;

            // Don't show future dates
            if (cursor > today) {
              week.push({ date: key, count: 0, level: -1 });
            } else {
              week.push({ date: key, count, level });
            }
            cursor.setDate(cursor.getDate() + 1);
          }
          weeks.push(week);
        }

        setGrid(weeks);
        setTotalCommits(total);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load activity");
        setLoading(false);
      }
    }

    fetchData();
  }, [org]);

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
          href={`https://github.com/${org}`}
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
          <div className="flex ml-8 mb-1 text-[10px] text-marble/40 font-bold uppercase tracking-wider">
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
                    className="h-[12px] flex items-center text-[9px] text-marble/30 font-bold uppercase"
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
            <div className="flex items-center gap-2 text-[10px] text-marble/40 font-bold">
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
        <div className="absolute bottom-4 right-4 bg-obsidian border border-white/20 rounded-lg px-4 py-2 text-sm shadow-xl pointer-events-none z-10">
          <span className="text-white font-bold">{hoveredCell.count} commit{hoveredCell.count !== 1 ? "s" : ""}</span>
          <span className="text-marble/50 ml-2">{new Date(hoveredCell.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      )}
    </div>
  );
}
