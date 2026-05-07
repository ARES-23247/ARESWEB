/* eslint-disable @typescript-eslint/no-explicit-any */
import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, getSocialConfig, checkPersistentRateLimit } from "../middleware";
import { buildGitHubConfig, fetchProjectBoard, createProjectItem } from "../../utils/githubProjects";
import { getBoardRoute, createItemRoute, getActivityRoute } from "../../../shared/routes/github";
import { siteConfig } from "../../utils/site.config";

export const githubRouter = new OpenAPIHono<AppEnv>();

interface WeekData {
  total: number;
  week: number;
  days: number[];
}

/**
 * Strips internal metadata and TODOs from content before judge consumption.
 * Ensures the printed portfolio is championship-ready.
 */
// WR-01: Apply rate limiting to prevent abuse of GitHub API calls
githubRouter.openapi(getActivityRoute, typedHandler<typeof getActivityRoute>(async (c) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const ua = c.req.header("User-Agent") || "unknown";
  if (!(await checkPersistentRateLimit(c.get("db") as any, `github-activity:${ip}`, ua, 10, 60))) {
    return c.json({ error: "Rate limit exceeded" } as any, 429 as any);
  }

  const org = siteConfig.urls.githubOrg;
  const cacheUrl = new URL(c.req.url);
  const cacheKey = new Request(cacheUrl.toString(), c.req.raw);
  const cache = await caches.open("ares-github-activity-v3"); // Bumped cache version

  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    const data = await cachedResponse.json();
    return c.json(data as any, 200 as any);
  }

  try {
    const config = await getSocialConfig(c);
    const pat = config["GITHUB_PAT"];

    const headers: Record<string, string> = {
      "User-Agent": `${siteConfig.team.name}-Cloudflare-Worker`
    };

    if (pat) {
      headers["Authorization"] = `Bearer ${pat}`;
    }

    const repoRes = await fetch(`https://api.github.com/orgs/${org}/repos?per_page=100&type=public`, { headers });
    if (!repoRes.ok) throw new Error(`GitHub API Error: ${repoRes.status}`);
    const repos = await repoRes.json() as { name: string }[];

    const activityResults = await Promise.all(
      repos.map((repo: any) =>
        fetch(`https://api.github.com/repos/${org}/${repo.name}/stats/commit_activity`, { headers })
          .then((res: any) => res.ok && res.status !== 202 ? res.json() : null)
          .catch(() => null)
      )
    );

    const allActivity = activityResults.filter((json): json is WeekData[] => Array.isArray(json) && json.length > 0);

    const dailyMap = new Map<string, number>();
    for (const repoWeeks of allActivity) {
      for (const week of repoWeeks) {
        const weekStart = new Date(week.week * 1000);
        for (let d = 0; d < 7; d++) {
          const day = new Date(weekStart);
          day.setDate(day.getDate() + d);
          const key = day.toISOString().split("T")[0];
          dailyMap.set(key, (dailyMap.get(key) || 0) + (week.days[d] || 0));
        }
      }
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setFullYear(today.getFullYear() - 1);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const maxCount = Math.max(1, ...Array.from(dailyMap.values()));
    let totalCommits = 0;

    const weeks: unknown[][] = [];

    const cursor = new Date(startDate);
    while (cursor <= today || weeks.length < 53) {
      const week: unknown[] = [];
      for (let d = 0; d < 7; d++) {
        const key = cursor.toISOString().split("T")[0];
        const count = dailyMap.get(key) || 0;
        totalCommits += count;

        let level = 0;
        if (count > 0) level = 1;
        if (count >= maxCount * 0.25) level = 2;
        if (count >= maxCount * 0.5) level = 3;
        if (count >= maxCount * 0.75) level = 4;

        week.push({ date: key, count, level });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
      if (cursor > today && weeks.length >= 52) break;
    }

    const payload = { grid: weeks, totalCommits, repoCount: repos.length };

    // DO NOT CACHE IF WE RECEIVED MOSTLY 202 ACCEPTED (Empty Activity)
    // GitHub might be compiling stats. We don't want to freeze the graph empty.
    if (totalCommits > 0 || repos.length === 0) {
      const response = new Response(JSON.stringify(payload), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=3600, max-age=3600"
        }
      });
      c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return c.json(payload as any, 200 as any);
  } catch (e) {
    console.error("[GitHub:Activity] Error", e);
    return c.json({ error: "Failed to fetch GitHub activity" } as any, 500 as any);
  }
}) as any);

githubRouter.use("/projects/*", ensureAdmin);

githubRouter.openapi(getBoardRoute, typedHandler<typeof getBoardRoute>(async (c) => {
  try {
    const config = await getSocialConfig(c);
    const ghConfig = buildGitHubConfig(config);
    if (!ghConfig) {
      console.error("[GitHub:Board] Configuration missing — GITHUB_PAT or GITHUB_PROJECT_ID not set");
      // Return empty board instead of 500 so the frontend can distinguish "not configured"
      return c.json({ success: false, board: [] } as any, 200 as any);
    }

    const boardResults = await fetchProjectBoard(ghConfig);

    const board = (boardResults.items || []).map((i: unknown) => {
      const item = i as Record<string, unknown>;
      return {
        id: String(item.id),
        title: String(item.title),
        status: String(item.status || "Todo"),
        updated_at: String(item.updatedAt || item.updated_at || new Date().toISOString()),
        assignees: Array.isArray(item.assignees) ? item.assignees : [],
        type: String(item.type || "DRAFT_ISSUE"),
      };
    });

    return c.json({ success: true, board } as any, 200 as any);
  } catch (e) {
    console.error("[GitHub:Board] Error fetching board:", (e as Error).message, (e as Error).stack);
    // Return empty board with success:false so the frontend shows a meaningful error
    return c.json({ success: false, board: [] } as any, 200 as any);
  }
}));

githubRouter.openapi(createItemRoute, typedHandler<typeof createItemRoute>(async (c) => {
  try {
    const { title } = c.req.valid("json");
    const config = await getSocialConfig(c);
    const ghConfig = buildGitHubConfig(config);
    if (!ghConfig) {
      console.error("[GitHub:Create] Configuration missing");
      return c.json({ error: "GitHub configuration missing" } as any, 500 as any);
    }

    await createProjectItem(ghConfig, title);
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[GitHub:Create] Error", e);
    return c.json({ error: "Failed to create project item" } as any, 500 as any);
  }
}));

export default githubRouter;
