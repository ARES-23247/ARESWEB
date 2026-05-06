import { Hono } from "hono";
import type { Context } from "hono";
import { AppEnv, ensureAuth } from "../middleware";
import { z } from "zod";
import { logger } from "../../../src/utils/logger";

// GitHub repository configuration
// Centralized to avoid hardcoded references throughout the codebase
function getGitHubConfig(c: Context<AppEnv>) {
  const env = c.env as Record<string, unknown>;
  const owner = (env.GITHUB_REPO_OWNER as string) || 'ARES-23247';
  const repo = (env.GITHUB_REPO_NAME as string) || 'ARESWEB';
  const branch = (env.GITHUB_BRANCH as string) || 'main';
  return {
    owner,
    repo,
    branch,
    apiBase: `https://api.github.com/repos/${owner}/${repo}`
  };
}

// Validation schema for simulation save
// SECURITY: Enforce limits to prevent DoS via large payloads
const MAX_FILES = 10;
const MAX_TOTAL_SIZE = 2 * 1024 * 1024; // 2MB total
const MAX_FILE_SIZE = 500000; // 500KB per file
const SIM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SIM_FILENAME_PATTERN = /^[a-zA-Z0-9_.-]+\.(tsx?|jsx?|json|css)$/;

const saveSimulationSchema = z.object({
  name: z.string().max(100).optional(),
  files: z.record(z.string(), z.string().max(MAX_FILE_SIZE)).refine(
    (files) => {
      const fileCount = Object.keys(files).length;
      if (fileCount > MAX_FILES) {
        throw new Error(`Too many files: ${fileCount} (max ${MAX_FILES})`);
      }

      const totalSize = Object.values(files).reduce((sum, content) => sum + content.length, 0);
      if (totalSize > MAX_TOTAL_SIZE) {
        throw new Error(`Total size too large: ${totalSize} bytes (max ${MAX_TOTAL_SIZE})`);
      }

      // Validate filename patterns to prevent path traversal
      for (const filename of Object.keys(files)) {
        if (!SIM_FILENAME_PATTERN.test(filename)) {
          throw new Error(`Invalid filename: ${filename}. Must match ${SIM_FILENAME_PATTERN.source}`);
        }
      }

      return true;
    },
    { message: "Files validation failed" }
  ),
});

export const simulationsRouter = new Hono<AppEnv>();

// Helper: Check if user owns a simulation or is admin
// SECURITY: Uses multiple verification factors to prevent email spoofing
async function canModifySimulation(c: Context<AppEnv>, simId: string): Promise<boolean> {
  const sessionUser = c.get("sessionUser");
  if (!sessionUser) return false;

  // Admins can modify any simulation
  if (sessionUser.role === "admin") return true;

  try {
    const db = c.get("db");
    const ghConfig = getGitHubConfig(c);
    const config = await db.selectFrom("settings").selectAll().execute();

    const patSetting = config.find((s) => s.key === "GITHUB_PAT");
    const pat = patSetting?.value || c.env.GITHUB_PAT;

    if (!pat) return false;

    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Authorization": `Bearer ${pat}`,
      "Accept": "application/vnd.github.v3+json"
    };

    // Get the file metadata to check creation
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

    // Multi-factor ownership verification to prevent spoofing
    const commit = commits[0];
    const authorEmail = commit.author?.email;
    const committerLogin = commit.committer?.login;
    const verified = commit.commit?.verification?.verified;

    // Primary: email must match
    if (authorEmail !== sessionUser.email) return false;

    // Secondary: if commit is cryptographically verified, email is trustworthy
    if (verified) return true;

    // Tertiary: for unverified commits, verify committer identity via GitHub API
    // This prevents users from setting git config to use someone else's email
    if (committerLogin && (sessionUser as { github_login?: string }).github_login) {
      if (committerLogin === (sessionUser as { github_login?: string }).github_login) {
        return true;
      }
    }

    // If commit is unverified and committer doesn't match session user, reject
    console.warn(`[Simulations] Rejecting unverified commit by ${authorEmail} (committer: ${committerLogin})`);
    return false;
  } catch (err) {
    // If we can't verify ownership, be conservative
    console.error("[Simulations] Ownership verification error:", err);
    return false;
  }
}

// List all simulations from GitHub
simulationsRouter.get("/", async (c: Context<AppEnv>) => {
  try {
    const ghConfig = getGitHubConfig(c);
    let pat = c.env.GITHUB_PAT;
    
    try {
      const db = c.get("db");
      const config = await db.selectFrom("settings").selectAll().execute();
      const patSetting = config.find(s => s.key === "GITHUB_PAT");
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
       return c.json({ simulations: [] });
    }
    
    const registryText = await ghRes.text();
    const registry = JSON.parse(registryText);
    
    const githubSims = registry.simulators.map((s: { id: string; name: string }) => ({
      id: `github:${s.id}`,
      name: s.name,
      author_id: "ARES-23247",
      is_public: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      type: "github"
    }));

    return c.json({ simulations: githubSims });
  } catch (e) {
    console.error("[Simulations] List error:", e);
    return c.json({ error: "Failed to list simulations from GitHub" }, 500);
  }
});

// Get a single simulation file by id from GitHub
simulationsRouter.get("/:id", async (c: Context<AppEnv>) => {
  const id = c.req.param("id");

  if (!id || !id.startsWith("github:")) {
    return c.json({ error: "Simulation not found" }, 404);
  }

  const simId = id.replace("github:", "");

  // Validate simId format to prevent path traversal and injection
  // SECURITY: Only allow simple alphanumeric folder names
  if (!/^[a-zA-Z0-9_-]+$/.test(simId)) {
    console.warn(`[Simulations] Invalid simulation ID format: ${simId}`);
    return c.json({ error: "Invalid simulation ID" }, 400);
  }

  // Explicitly check for path traversal attempts
  if (simId.includes('..') || simId.includes('/') || simId.includes('\\')) {
    console.warn(`[Simulations] Path traversal attempt blocked: ${simId}`);
    return c.json({ error: "Invalid simulation ID" }, 400);
  }

  // Sims use folder structure: src/sims/<id>/index.tsx
  const filePath = `src/sims/${simId}/index.tsx`;

  try {
    const db = c.get("db");
    const ghConfig = getGitHubConfig(c);
    const config = await db.selectFrom("settings").selectAll().execute();
    const patSetting = config.find(s => s.key === "GITHUB_PAT");
    const pat = patSetting?.value || c.env.GITHUB_PAT;

    // WR-17: Log PAT status without exposing the token value
    const patStatus = pat ? `configured (ends with ${String(pat).slice(-4)})` : "missing";
    logger.debug("[Simulations] Using GitHub PAT:", patStatus);

    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Accept": "application/vnd.github.v3.raw"
    };
    if (pat) headers["Authorization"] = `Bearer ${pat}`;

    const ghRes = await fetch(`${ghConfig.apiBase}/contents/${filePath}`, { headers });
    if (!ghRes.ok) {
      // Fallback: try legacy flat-file format (src/sims/<id>.tsx)
      const legacyPath = `src/sims/${simId}.tsx`;
      const legacyRes = await fetch(`${ghConfig.apiBase}/contents/${legacyPath}`, { headers });
      if (!legacyRes.ok) {
        return c.json({ error: "Simulation not found in GitHub" }, 404);
      }
      const code = await legacyRes.text();
      return c.json({
        simulation: {
          id: id,
          name: simId,
          type: "github",
          files: { [`${simId}.tsx`]: code },
          author_id: "ARES-23247",
          is_public: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
    }

    const code = await ghRes.text();
    return c.json({
      simulation: {
        id: id,
        name: simId,
        type: "github",
        files: { "index.tsx": code },
        author_id: "ARES-23247",
        is_public: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });
  } catch (ghErr) {
    console.error("[Simulations] GitHub get error:", ghErr);
    return c.json({ error: "Failed to get simulation from GitHub" }, 500);
  }
});

// Save simulation to GitHub
simulationsRouter.post("/", ensureAuth, async (c: Context<AppEnv>) => {
  try {
    const sessionUser = c.get("sessionUser");
    if (!sessionUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const validationResult = saveSimulationSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json({ error: "Invalid input: " + validationResult.error.issues.map(i => i.message).join(", ") }, 400);
    }

    const { name, files } = validationResult.data;

    if (Object.keys(files).length === 0) {
      return c.json({ error: "No files provided" }, 400);
    }

    const db = c.get("db");
    const ghConfig = getGitHubConfig(c);
    const config = await db.selectFrom("settings").selectAll().execute();
    const patSetting = config.find(s => s.key === "GITHUB_PAT");
    const pat = patSetting?.value || c.env.GITHUB_PAT;
    
    if (!pat) {
      return c.json({ error: "GitHub PAT not configured" }, 500);
    }

    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Authorization": `Bearer ${pat}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    };
    
    // Attempt to use the active file or generic fallback
    const rawFilename = Object.keys(files)[0];
    let filename = rawFilename;
    let simIdStr = filename.replace(/\.tsx?$/, '');

    // If it's the generic SimComponent or renamed, we map it to the requested simulation name
    if (filename === 'SimComponent.tsx' && name) {
      simIdStr = name.replace(/[^a-zA-Z0-9]/g, '');
      filename = `${simIdStr}.tsx`;
    }

    const content = files[rawFilename];
    
    // Safely encode to base64
    // Cloudflare Workers support btoa. unescape+encodeURIComponent handles utf-8 safely.
    const base64Content = btoa(unescape(encodeURIComponent(content)));

    const path = `src/sims/${filename}`;
    const url = `${ghConfig.apiBase}/contents/${path}`;

    let sha: string | undefined;
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {

      const getJson = (await getRes.json()) as { sha: string };
      sha = getJson.sha;
      // File exists - check ownership before allowing update
      if (!(await canModifySimulation(c, simIdStr))) {
        console.warn(`[Simulations] Unauthorized modification attempt by ${sessionUser.email} on ${simIdStr}`);
        return c.json({ error: "You can only modify your own simulations" }, 403);
      }
    }

    const putRes = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `feat(sims): update ${filename} via Simulation Playground`,
        content: base64Content,
        sha: sha
      })
    });
    
    if (!putRes.ok) {
      const err = await putRes.text();
      console.error("[Simulations] GitHub PUT error:", err);
      return c.json({ error: "Failed to upload to GitHub" }, 500);
    }

    // Update registry if new file was created
    // Uses retry logic to handle race conditions from concurrent saves
    if (!sha) {
      const regUrl = `${ghConfig.apiBase}/contents/src/sims/simRegistry.json`;
      const maxRetries = 3;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const regGetRes = await fetch(regUrl, { headers });
        if (!regGetRes.ok) {
          console.warn(`[Simulations] Registry fetch failed on attempt ${attempt + 1}`);
          break;
        }


        const regJson = (await regGetRes.json()) as { sha: string; content: string };
        const regSha = regJson.sha;
        const regContentStr = decodeURIComponent(escape(atob(regJson.content)));

        try {
          const registry = JSON.parse(regContentStr);

          // Check if already registered (could be added by another concurrent request)

          if (!registry.simulators.some((s: { id: string }) => s.id === simIdStr)) {
            registry.simulators.push({
              id: simIdStr,
              name: name || simIdStr,
              path: `./${simIdStr}`,
              requiresContext: false
            });

            const newRegContent = JSON.stringify(registry, null, 2);
            const newRegBase64 = btoa(unescape(encodeURIComponent(newRegContent)));

            const regPutRes = await fetch(regUrl, {
              method: "PUT",
              headers,
              body: JSON.stringify({
                message: `feat(sims): register ${simIdStr} in simRegistry.json`,
                content: newRegBase64,
                sha: regSha
              })
            });

            if (regPutRes.ok) {
              // Success - break out of retry loop
              logger.debug(`[Simulations] Registered ${simIdStr} in simRegistry.json`);
              break;
            } else if (regPutRes.status === 409 && attempt < maxRetries - 1) {
              // Conflict - another request modified the registry, retry with fresh data
              const backoffMs = 100 * Math.pow(2, attempt);
              console.warn(`[Simulations] Registry conflict on attempt ${attempt + 1}, retrying in ${backoffMs}ms`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            } else {
              console.error("[Simulations] Registry update failed:", await regPutRes.text());
              break;
            }
          } else {
            // Already registered by another request - no action needed
            logger.debug(`[Simulations] ${simIdStr} already registered, skipping`);
            break;
          }
        } catch (e) {
          console.error("[Simulations] Registry update failed on attempt", attempt + 1, ":", e);
          if (attempt === maxRetries - 1) throw e;
        }
      }
    }
    
    return c.json({ id: `github:${simIdStr}` });
  } catch (e) {
    console.error("[Simulations] Save error:", e);
    return c.json({ error: "Failed to save simulation" }, 500);
  }
});
// Delete simulation from GitHub
simulationsRouter.delete("/:id", async (c: Context<AppEnv>) => {
  try {
    const sessionUser = c.get("sessionUser");
    if (!sessionUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    if (!id || !id.startsWith("github:")) {
      return c.json({ error: "Not found" }, 404);
    }

    const simIdStr = id.replace("github:", "");

    // Validate simId format to prevent path traversal and injection
    if (!SIM_ID_PATTERN.test(simIdStr)) {
      console.warn(`[Simulations] Invalid simulation ID format in delete: ${simIdStr}`);
      return c.json({ error: "Invalid simulation ID" }, 400);
    }

    // Explicitly check for path traversal attempts
    if (simIdStr.includes('..') || simIdStr.includes('/') || simIdStr.includes('\\')) {
      console.warn(`[Simulations] Path traversal attempt blocked in delete: ${simIdStr}`);
      return c.json({ error: "Invalid simulation ID" }, 400);
    }

    const filename = `${simIdStr}.tsx`;

    const db = c.get("db");
    const ghConfig = getGitHubConfig(c);
    const config = await db.selectFrom("settings").selectAll().execute();
    const patSetting = config.find(s => s.key === "GITHUB_PAT");
    const pat = patSetting?.value || c.env.GITHUB_PAT;
    
    if (!pat) {
      return c.json({ error: "GitHub PAT not configured" }, 500);
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
      // Check ownership before allowing deletion
      if (!(await canModifySimulation(c, simIdStr))) {
        console.warn(`[Simulations] Unauthorized deletion attempt by ${sessionUser.email} on ${simIdStr}`);
        return c.json({ error: "You can only delete your own simulations" }, 403);
      }
      const delRes = await fetch(url, {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          message: `feat(sims): delete ${filename} via Simulation Playground`,
          sha: sha
        })
      });

      if (!delRes.ok) {
        console.error("[Simulations] GitHub DELETE error:", await delRes.text());
      }
    }
    
    // Also remove from registry
    const regUrl = `${ghConfig.apiBase}/contents/src/sims/simRegistry.json`;
    const regGetRes = await fetch(regUrl, { headers });
    if (regGetRes.ok) {

      const regJson = (await regGetRes.json()) as { sha: string; content: string };
      const regSha = regJson.sha;
      const regContentStr = decodeURIComponent(escape(atob(regJson.content)));
      try {
        const registry = JSON.parse(regContentStr);

        const filtered = registry.simulators.filter((s: { id: string }) => s.id !== simIdStr);
        
        if (filtered.length !== registry.simulators.length) {
          registry.simulators = filtered;
          const newRegContent = JSON.stringify(registry, null, 2);
          const newRegBase64 = btoa(unescape(encodeURIComponent(newRegContent)));
          
          await fetch(regUrl, {
            method: "PUT",
            headers,
            body: JSON.stringify({
              message: `feat(sims): remove ${simIdStr} from simRegistry.json`,
              content: newRegBase64,
              sha: regSha
            })
          });
        }
      } catch (e) {
        console.error("[Simulations] Registry update failed:", e);
      }
    }

    return c.json({ success: true });
  } catch (e) {
    console.error("[Simulations] Delete error:", e);
    return c.json({ error: "Failed to delete simulation" }, 500);
  }
});

// Create a new GitHub Gist for a simulation
simulationsRouter.post("/gist", async (c: Context<AppEnv>) => {
  try {
    const body = await c.req.json();
    const validationResult = saveSimulationSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json({ error: "Invalid input: " + validationResult.error.issues.map(i => i.message).join(", ") }, 400);
    }

    const { name, files } = validationResult.data;
    if (Object.keys(files).length === 0) {
      return c.json({ error: "No files provided" }, 400);
    }

    const db = c.get("db");
    const config = await db.selectFrom("settings").selectAll().execute();
    const patSetting = config.find(s => s.key === "GITHUB_PAT");
    const pat = patSetting?.value || c.env.GITHUB_PAT;
    
    if (!pat) {
      return c.json({ error: "GitHub PAT not configured" }, 500);
    }

    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Authorization": `Bearer ${pat}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    };

    // Format files for GitHub Gist API
    const gistFiles: Record<string, { content: string }> = {};
    for (const [filename, content] of Object.entries(files)) {
      gistFiles[filename] = { content: content || "// Empty file" };
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
      console.error("[Simulations] Gist creation failed:", await res.text());
      return c.json({ error: "Failed to create GitHub Gist" }, 500);
    }

    const gistResponse = await res.json() as { id: string; html_url: string };
    return c.json({ success: true, gistId: gistResponse.id, url: gistResponse.html_url });
  } catch (e) {
    console.error("[Simulations] Gist POST error:", e);
    return c.json({ error: "Failed to create Gist" }, 500);
  }
});

// Fetch a GitHub Gist by ID
simulationsRouter.get("/gist/:id", async (c: Context<AppEnv>) => {
  const id = c.req.param("id");
  if (!id || !/^[a-zA-Z0-9]+$/.test(id)) {
    return c.json({ error: "Invalid Gist ID" }, 400);
  }

  try {
    const db = c.get("db");
    let pat = c.env.GITHUB_PAT;
    try {
      const config = await db.selectFrom("settings").selectAll().execute();
      const patSetting = config.find(s => s.key === "GITHUB_PAT");
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
      if (res.status === 404) return c.json({ error: "Gist not found" }, 404);
      return c.json({ error: "Failed to fetch from GitHub API" }, 500);
    }

    const gist = await res.json() as { description: string; files: Record<string, { content: string }>; owner: { login: string }; public: boolean; created_at: string; updated_at: string };
    
    // Convert gist files object to simple Record<string, string>
    const files: Record<string, string> = {};
    for (const [filename, fileObj] of Object.entries(gist.files)) {
      files[filename] = fileObj.content || "";
    }

    return c.json({
      simulation: {
        id: `gist:${id}`,
        name: gist.description || "Gist Simulation",
        type: "gist",
        files: files,
        author_id: gist.owner?.login || "anonymous",
        is_public: gist.public,
        created_at: gist.created_at,
        updated_at: gist.updated_at
      }
    });
  } catch (e) {
    console.error("[Simulations] Gist GET error:", e);
    return c.json({ error: "Failed to fetch Gist" }, 500);
  }
});

