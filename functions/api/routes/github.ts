import { Hono } from "hono";
import { Bindings } from "./_shared";

const githubRouter = new Hono<{ Bindings: Bindings }>();

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

githubRouter.get("/activity", async (c) => {
  const org = "ARES-23247";
  
  // Use Cloudflare's Cache API to cache the expensive aggregation for 1 hour
  const cacheUrl = new URL(c.req.url);
  const cacheKey = new Request(cacheUrl.toString(), c.req);
  const cache = await caches.open("ares-github-activity");
  
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": "ARES-23247-Cloudflare-Worker"
    };

    // 1. Fetch public repos
    const repoRes = await fetch(`https://api.github.com/orgs/${org}/repos?per_page=100&type=public`, { headers });
    if (!repoRes.ok) throw new Error("Failed to fetch repos: " + repoRes.status);
    const repos = await repoRes.json() as { name: string }[];
    const repoCount = repos.length;

    // 2. Fetch commit activity sequentially to avoid triggering GitHub's simultaneous secondary rate limit
    const allActivity: WeekData[][] = [];
    for (const repo of repos) {
      const actRes = await fetch(`https://api.github.com/repos/${org}/${repo.name}/stats/commit_activity`, { headers });
      
      if (actRes.status === 202) {
        // GitHub is compiling stats, wait 2 seconds and retry once
         await new Promise(resolve => setTimeout(resolve, 2000));
         const retryRes = await fetch(`https://api.github.com/repos/${org}/${repo.name}/stats/commit_activity`, { headers });
         if (retryRes.ok && retryRes.status === 200) {
            allActivity.push(await retryRes.json() as WeekData[]);
         }
      } else if (actRes.ok) {
        // We might just get a {} if the repo has no commits, so ensure it's an array
        const text = await actRes.text();
        try {
          const json = JSON.parse(text);
          if (Array.isArray(json)) allActivity.push(json);
        } catch { /* ignore */ }
      }
    }

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

    const maxCount = Math.max(1, ...Array.from(dailyMap.values()));
    let totalCommits = 0;
    const weeks: DayCell[][] = [];

    const cursor = new Date(startDate);
    while (cursor <= today) {
      const week: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const key = cursor.toISOString().split("T")[0];
        const count = dailyMap.get(key) || 0;
        totalCommits += count;

        let level = 0;
        if (count > 0) level = 1;
        if (count >= maxCount * 0.25) level = 2;
        if (count >= maxCount * 0.5) level = 3;
        if (count >= maxCount * 0.75) level = 4;

        if (cursor > today) {
          week.push({ date: key, count: 0, level: -1 });
        } else {
          week.push({ date: key, count, level });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }

    const payload = {
      grid: weeks,
      totalCommits,
      repoCount
    };

    const response = c.json(payload);
    // Add CDN Cache Control for global edge caching for 1 hour
    response.headers.set("Cache-Control", "public, s-maxage=3600, max-age=3600");
    
    // Put into Cache API
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    
    return response;

  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default githubRouter;
