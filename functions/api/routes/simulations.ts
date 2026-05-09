import { typedHandler } from "../utils/handler";
import { ApiError } from "../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAuth, ensureAdmin, getDb, DrizzleDB, logAuditAction } from "../middleware";
import type { SessionUser } from "../middleware/utils";
import * as schema from "../../../src/db/schema";
import {
  listSimulationsRoute,
  getSimulationRoute,
  saveSimulationRoute,
  deleteSimulationRoute,
  createGistRoute,
  getGistRoute,
  generateSimRegistryRoute,
  listSimFoldersRoute
} from "../../../shared/routes/simulations";

/** Row shape returned by settings table queries */
interface SettingsRow { key: string | null; value: string }

// GitHub repository configuration
function getGitHubConfig(c: { env: AppEnv["Bindings"] }) {
  const owner = c.env.GITHUB_REPO_OWNER || 'ARES-23247';
  const repo = c.env.GITHUB_REPO_NAME || 'ARESWEB';
  const branch = c.env.GITHUB_BRANCH || 'main';
  return { owner, repo, branch, apiBase: `https://api.github.com/repos/${owner}/${repo}` };
}

// SECURITY: Enforce limits to prevent DoS via large payloads
const MAX_FILES = 10;
const MAX_TOTAL_SIZE = 2 * 1024 * 1024; // 2MB total
const SIM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SIM_FILENAME_PATTERN = /^[a-zA-Z0-9_.-]+\.(tsx?|jsx?|json|css)$/;

export const simulationsRouter = new OpenAPIHono<AppEnv>();

// Middleware
simulationsRouter.use("/gist/*", ensureAuth);
simulationsRouter.use("/", (c, next) => {
  if (c.req.method === "POST" || c.req.method === "DELETE") {
    return ensureAuth(c, next);
  }
  return next();
});

// Helper: Check if user owns a simulation or is admin
async function canModifySimulation(
  c: { db: DrizzleDB; env: AppEnv["Bindings"]; sessionUser?: SessionUser },
  simId: string
): Promise<boolean> {
  const sessionUser = c.sessionUser;
  if (!sessionUser) return false;
  if (sessionUser.role === "admin") return true;

  try {
    const db = c.db;
    const ghConfig = getGitHubConfig(c);
    const config = await db.select().from(schema.settings).all();

    const patSetting = config.find((s) => s.key === "GITHUB_PAT");
    const pat = patSetting?.value || c.env.GITHUB_PAT;
    if (!pat) return false;

    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Authorization": `Bearer ${pat}`,
      "Accept": "application/vnd.github.v3+json"
    };

    const path = `src/sims/${simId}.tsx`;
    const url = `${ghConfig.apiBase}/commits?path=${path}&per_page=1`;

    const res = await fetch(url, { headers });
    if (!res.ok) return false;

    const commits = await res.json() as {
      author?: { email: string };
      committer?: { login: string };
      commit?: { verification?: { verified: boolean } };
    }[];
    if (!commits || commits.length === 0) return false;

    const commit = commits[0];
    const authorEmail = commit.author?.email;
    const committerLogin = commit.committer?.login;
    const verified = commit.commit?.verification?.verified;

    if (authorEmail !== sessionUser.email) return false;
    if (verified) return true;

    if (committerLogin && sessionUser.github_login) {
      if (committerLogin === sessionUser.github_login) return true;
    }

    return false;
  } catch (err) {
    console.error("[Simulations] Ownership verification error:", err);
    return false;
  }
}

// List all simulations from GitHub
simulationsRouter.openapi(listSimulationsRoute, typedHandler<typeof listSimulationsRoute>(async (c) => {
    const ghConfig = getGitHubConfig(c);
    let pat = c.env.GITHUB_PAT;

    try {
      const db = getDb(c);
      const config = await db.select().from(schema.settings).all();
      const patSetting = config.find((s: SettingsRow) => s.key === "GITHUB_PAT");
      if (patSetting?.value) pat = patSetting.value;
    } catch (e) {
      console.warn("[Simulations] DB Settings fetch failed (likely missing table):", e);
    }

    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Accept": "application/vnd.github.v3.raw"
    };
    if (pat) headers["Authorization"] = `Bearer ${pat}`;

    const ghRes = await fetch(`${ghConfig.apiBase}/contents/src/sims/simRegistry.json`, { headers });
    if (!ghRes.ok) {
       return c.json({ simulations: [] }, 200);
    }

    const registryText = await ghRes.text();
    const registry = JSON.parse(registryText);

    const githubSims = (registry.simulators || []).map((s: { id: string; name: string }) => ({
      id: `github:${s.id}`,
      name: s.name,
      author_id: "ARES-23247",
      is_public: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      type: "github"
    }));

    return c.json({ simulations: githubSims }, 200);
}));

// Get a single simulation file by id from GitHub
simulationsRouter.openapi(getSimulationRoute, typedHandler<typeof getSimulationRoute>(async (c) => {
  const { id } = c.req.valid("param");

  if (!id || !id.startsWith("github:")) {
    throw new ApiError("Simulation not found", 404);
  }

  const simId = id.replace("github:", "");

  if (!SIM_ID_PATTERN.test(simId)) {
    throw new ApiError("Invalid simulation ID", 400);
  }

  if (simId.includes('..') || simId.includes('/') || simId.includes('\\')) {
    throw new ApiError("Invalid simulation ID", 400);
  }

  const filePath = `src/sims/${simId}/index.tsx`;

  try {
    const db = getDb(c);
    const ghConfig = getGitHubConfig(c);
    const config = await db.select().from(schema.settings).all();
    const patSetting = config.find((s: SettingsRow) => s.key === "GITHUB_PAT");
    const pat = patSetting?.value || c.env.GITHUB_PAT;

    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Accept": "application/vnd.github.v3.raw"
    };
    if (pat) headers["Authorization"] = `Bearer ${pat}`;

    const ghRes = await fetch(`${ghConfig.apiBase}/contents/${filePath}`, { headers });
    if (!ghRes.ok) {
      const legacyPath = `src/sims/${simId}.tsx`;
      const legacyRes = await fetch(`${ghConfig.apiBase}/contents/${legacyPath}`, { headers });
      if (!legacyRes.ok) {
        throw new ApiError("Simulation not found in GitHub", 404);
      }
      const code = await legacyRes.text();
      return c.json({
        simulation: {
          id, name: simId, type: "github",
          files: { [`${simId}.tsx`]: code },
          author_id: "ARES-23247", is_public: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }, 200);
    }

    const code = await ghRes.text();
    return c.json({
      simulation: {
        id, name: simId, type: "github",
        files: { "index.tsx": code },
        author_id: "ARES-23247", is_public: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }, 200);
  } catch (ghErr) {
    console.error("[Simulations] GitHub get error:", ghErr);
    throw new ApiError("Failed to get simulation from GitHub", 500);
  }
}));

// Save simulation to GitHub
simulationsRouter.openapi(saveSimulationRoute, typedHandler<typeof saveSimulationRoute>(async (c) => {
    const sessionUser = c.get("sessionUser");
    if (!sessionUser) {
      throw new ApiError("Unauthorized", 401);
    }

    const { name, files } = c.req.valid("json");

    if (Object.keys(files).length === 0) {
      throw new ApiError("No files provided", 400);
    }

    const fileCount = Object.keys(files).length;
    if (fileCount > MAX_FILES) {
      throw new ApiError(`Too many files: ${fileCount} (max ${MAX_FILES})`, 400);
    }
    const totalSize = (Object.values(files) as string[]).reduce((sum, content) => sum + content.length, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      throw new ApiError(`Total size too large: ${totalSize} bytes (max ${MAX_TOTAL_SIZE})`, 400);
    }
    for (const filename of Object.keys(files)) {
      if (!SIM_FILENAME_PATTERN.test(filename)) {
        throw new ApiError(`Invalid filename: ${filename}.`, 400);
      }
    }

    const db = getDb(c);
    const ghConfig = getGitHubConfig(c);
    const config = await db.select().from(schema.settings).all();
    const patSetting = config.find((s: SettingsRow) => s.key === "GITHUB_PAT");
    const pat = patSetting?.value || c.env.GITHUB_PAT;

    if (!pat) {
      throw new ApiError("GitHub PAT not configured", 500);
    }

    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Authorization": `Bearer ${pat}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    };

    const rawFilename = Object.keys(files)[0];
    let filename = rawFilename;
    let simIdStr = filename.replace(/\.tsx?$/, '');

    if (filename === 'SimComponent.tsx' && name) {
      simIdStr = name.replace(/[^a-zA-Z0-9]/g, '');
      filename = `${simIdStr}.tsx`;
    }

    const content = String(files[rawFilename]);
    const base64Content = btoa(unescape(encodeURIComponent(content)));

    const path = `src/sims/${filename}`;
    const url = `${ghConfig.apiBase}/contents/${path}`;

    let sha: string | undefined;
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
      const getJson = (await getRes.json()) as { sha: string };
      sha = getJson.sha;
      if (!(await canModifySimulation({ db: getDb(c), env: c.env, sessionUser }, simIdStr))) {
        throw new ApiError("You can only modify your own simulations", 403);
      }
    }

    const putRes = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ message: `feat(sims): update ${filename} via Simulation Playground`, content: base64Content, sha })
    });

    if (!putRes.ok) {
      throw new ApiError("Failed to upload to GitHub", 500);
    }

    if (!sha) {
      const regUrl = `${ghConfig.apiBase}/contents/src/sims/simRegistry.json`;
      const maxRetries = 3;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const regGetRes = await fetch(regUrl, { headers });
        if (!regGetRes.ok) break;

        const regJson = (await regGetRes.json()) as { sha: string; content: string };
        const regSha = regJson.sha;
        const regContentStr = decodeURIComponent(escape(atob(regJson.content)));

        try {
          const registry = JSON.parse(regContentStr);

          if (!registry.simulators.some((s: { id: string }) => s.id === simIdStr)) {
            registry.simulators.push({ id: simIdStr, name: name || simIdStr, path: `./${simIdStr}`, requiresContext: false });

            const newRegContent = JSON.stringify(registry, null, 2);
            const newRegBase64 = btoa(unescape(encodeURIComponent(newRegContent)));

            const regPutRes = await fetch(regUrl, {
              method: "PUT",
              headers,
              body: JSON.stringify({ message: `feat(sims): register ${simIdStr} in simRegistry.json`, content: newRegBase64, sha: regSha })
            });

            if (regPutRes.ok) break;
            // Retry on 409 conflict with exponential backoff, bounded by maxRetries
            else if (regPutRes.status === 409 && attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
              continue;
            } else break;
          } else break;
        } catch (e) {
          if (attempt === maxRetries - 1) throw e;
        }
      }
    }

    c.executionCtx.waitUntil(logAuditAction(c, "UPDATE", "simulation", simIdStr, `Created/updated simulation: ${name || simIdStr}`));
    return c.json({ id: `github:${simIdStr}` }, 200);
}));

// Delete simulation from GitHub
simulationsRouter.openapi(deleteSimulationRoute, typedHandler<typeof deleteSimulationRoute>(async (c) => {
  try {
    const sessionUser = c.get("sessionUser");
    if (!sessionUser) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id } = c.req.valid("param");
    if (!id || !id.startsWith("github:")) {
      throw new ApiError("Not found", 404);
    }

    const simIdStr = id.replace("github:", "");

    if (!SIM_ID_PATTERN.test(simIdStr)) {
      throw new ApiError("Invalid simulation ID", 400);
    }

    if (simIdStr.includes('..') || simIdStr.includes('/') || simIdStr.includes('\\')) {
      throw new ApiError("Invalid simulation ID", 400);
    }

    const filename = `${simIdStr}.tsx`;

    const db = getDb(c);
    const ghConfig = getGitHubConfig(c);
    const config = await db.select().from(schema.settings).all();
    const patSetting = config.find((s: SettingsRow) => s.key === "GITHUB_PAT");
    const pat = patSetting?.value || c.env.GITHUB_PAT;

    if (!pat) {
      throw new ApiError("GitHub PAT not configured", 500);
    }

    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Authorization": `Bearer ${pat}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    };

    const path = `src/sims/${filename}`;
    const url = `${ghConfig.apiBase}/contents/${path}`;

    let sha: string | undefined;
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
      const getJson = (await getRes.json()) as { sha: string };
      sha = getJson.sha;
    }

    if (sha) {
      if (!(await canModifySimulation({ db: getDb(c), env: c.env, sessionUser }, simIdStr))) {
        throw new ApiError("You can only delete your own simulations", 403);
      }
      await fetch(url, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ message: `feat(sims): delete ${filename} via Simulation Playground`, sha })
      });
    }

    const regUrl = `${ghConfig.apiBase}/contents/src/sims/simRegistry.json`;
    const regGetRes = await fetch(regUrl, { headers });
    if (regGetRes.ok) {
      const regJson = (await regGetRes.json()) as { sha: string; content: string };
      const regSha = regJson.sha;
      const regContentStr = decodeURIComponent(escape(atob(regJson.content)));
      try {
        const registry = JSON.parse(regContentStr);
        const filtered = (registry.simulators || []).filter((s: { id: string }) => s.id !== simIdStr);
        if (filtered.length !== registry.simulators.length) {
          registry.simulators = filtered;
          const newRegContent = JSON.stringify(registry, null, 2);
          const newRegBase64 = btoa(unescape(encodeURIComponent(newRegContent)));
          await fetch(regUrl, {
            method: "PUT",
            headers,
            body: JSON.stringify({ message: `feat(sims): remove ${simIdStr} from simRegistry.json`, content: newRegBase64, sha: regSha })
          });
        }
      } catch (e) {
        console.error("[Simulations] Registry update failed:", e);
      }
    }

    c.executionCtx.waitUntil(logAuditAction(c, "DELETE", "simulation", simIdStr, `Deleted simulation ${simIdStr}`));
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Simulations] Delete error:", e);
    throw new ApiError("Failed to delete simulation", 500);
  }
}));

// Create a new GitHub Gist for a simulation
simulationsRouter.openapi(createGistRoute, typedHandler<typeof createGistRoute>(async (c) => {
    const { name, files } = c.req.valid("json");
    if (Object.keys(files).length === 0) {
      throw new ApiError("No files provided", 400);
    }

    const db = getDb(c);
    const config = await db.select().from(schema.settings).all();
    const patSetting = config.find((s: SettingsRow) => s.key === "GITHUB_PAT");
    const pat = patSetting?.value || c.env.GITHUB_PAT;

    if (!pat) {
      throw new ApiError("GitHub PAT not configured", 500);
    }

    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Authorization": `Bearer ${pat}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    };

    const gistFiles: Record<string, { content: string }> = {};
    for (const [filename, content] of Object.entries(files)) {
      gistFiles[filename] = { content: (content as string) || "// Empty file" };
    }

    const gistData = {
      description: name ? `ARESWEB Simulation: ${name}` : "ARESWEB Simulation Playground Export",
      public: true,
      files: gistFiles
    };

    const res = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers,
      body: JSON.stringify(gistData)
    });

    if (!res.ok) {
      throw new ApiError("Failed to create GitHub Gist", 500);
    }

    const gistResponse = await res.json() as { id: string; html_url: string };
    return c.json({ success: true, gistId: gistResponse.id, url: gistResponse.html_url }, 200);
}));

// Fetch a GitHub Gist by ID
simulationsRouter.openapi(getGistRoute, typedHandler<typeof getGistRoute>(async (c) => {
  const { id } = c.req.valid("param");

    const db = getDb(c);
    let pat = c.env.GITHUB_PAT;
    try {
      const config = await db.select().from(schema.settings).all();
      const patSetting = config.find((s: SettingsRow) => s.key === "GITHUB_PAT");
      if (patSetting?.value) pat = patSetting.value;
    } catch (e) {
      console.warn("[Simulations] DB Settings fetch failed:", e);
    }

    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Accept": "application/vnd.github.v3+json"
    };
    if (pat) headers["Authorization"] = `Bearer ${pat}`;

    const res = await fetch(`https://api.github.com/gists/${id}`, { headers });

    if (!res.ok) {
      if (res.status === 404) throw new ApiError("Gist not found", 404);
      throw new ApiError("Failed to fetch from GitHub API", 500);
    }

    const gist = await res.json() as {
      description: string;
      files: Record<string, { content: string }>;
      owner: { login: string };
      public: boolean;
      created_at: string;
      updated_at: string;
    };

    const gistFiles: Record<string, string> = {};
    for (const [filename, fileObj] of Object.entries(gist.files)) {
      gistFiles[filename] = fileObj.content || "";
    }

    return c.json({
      simulation: {
        id: `gist:${id}`,
        name: gist.description || "Gist Simulation",
        type: "gist",
        files: gistFiles,
        author_id: gist.owner?.login || "anonymous",
        is_public: gist.public ? 1 : 0,
        created_at: gist.created_at,
        updated_at: gist.updated_at
      }
    }, 200);
}));

// ── Admin Routes ─────────────────────────────────────────────────────────────

// Generate simulation registry by running npm script
simulationsRouter.openapi(generateSimRegistryRoute, ensureAdmin, typedHandler<typeof generateSimRegistryRoute>(async (c) => {
  try {
    // In Cloudflare Workers, we can't directly run shell commands.
    // This endpoint would need to be implemented differently or called via a different mechanism.
    // For now, we'll return an error indicating this limitation.
    throw new ApiError("Registry generation requires shell access. Please run 'npm run generate:sims' locally.", 501);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}));

// List unregistered simulation folders
simulationsRouter.openapi(listSimFoldersRoute, ensureAdmin, typedHandler<typeof listSimFoldersRoute>(async (c) => {
  // In Cloudflare Workers, we don't have filesystem access.
  // This endpoint would need to be implemented differently, such as:
  // 1. Using the GitHub API to scan the repository for sims
  // 2. Maintaining a registry in the database
  // For now, we return empty arrays with a note.
  return c.json({
    folders: [],
    registeredPaths: [],
    note: "Filesystem scanning not available in Cloudflare Workers. Use GitHub API to scan src/sims directory."
  }, 200);
}));

export default simulationsRouter;
