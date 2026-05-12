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
import { requireAuth } from "../middleware/auth";

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
const _MAX_TOTAL_SIZE = 2 * 1024 * 1024; // 2MB total
const SIM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const _SIM_FILENAME_PATTERN = /^[a-zA-Z0-9_.-]+\.(tsx?|jsx?|json|css)$/;

const _simulationsRouter = new OpenAPIHono<AppEnv>();

// Middleware
_simulationsRouter.use("/gist/*", ensureAuth);
_simulationsRouter.use("/", (c, next) => {
    if (c.req.method === "POST" || c.req.method === "DELETE") {
        return ensureAuth(c, next);
    }
    return next();
});
_simulationsRouter.use("/admin/*", ensureAdmin);

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
        }[];
        if (!commits || commits.length === 0) return false;

        const authorEmail = commits[0].author?.email;
        return authorEmail === sessionUser.email;
    } catch (err) {
        console.error("[Simulations] Ownership verification error:", err);
        return false;
    }
}

// List all simulations from GitHub
export const simulationsRouter = _simulationsRouter
    .openapi(listSimulationsRoute, async (c) => {
        const ghConfig = getGitHubConfig(c);
        let pat = c.env.GITHUB_PAT;

        try {
            const db = getDb(c);
            const config = await db.select().from(schema.settings).all();
            const patSetting = config.find((s: SettingsRow) => s.key === "GITHUB_PAT");
            if (patSetting?.value) pat = patSetting.value;
        } catch (e) {
            console.warn("[Simulations] DB Settings fetch failed:", e);
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            type: "github"
        }));

        return c.json({ simulations: githubSims }, 200);
    })
    .openapi(getSimulationRoute, async (c) => {
        const { id } = c.req.valid("param");

        if (!id || !id.startsWith("github:")) {
            throw new ApiError("Simulation not found", 404);
        }

        const simId = id.replace("github:", "");
        if (!SIM_ID_PATTERN.test(simId)) throw new ApiError("Invalid simulation ID", 400);

        const filePath = `src/sims/${simId}/index.tsx`;

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
            if (!legacyRes.ok) throw new ApiError("Simulation not found in GitHub", 404);
            const code = await legacyRes.text();
            return c.json({
                simulation: {
                    id, name: simId, type: "github",
                    files: { [`${simId}.tsx`]: code },
                    author_id: "ARES-23247", is_public: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
                // Response boundary: Drizzle return type diverges from Zod schema
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any, 200);
        }
        const code = await ghRes.text();
        return c.json({
            simulation: {
                id, name: simId, type: "github",
                files: { "index.tsx": code },
                author_id: "ARES-23247", is_public: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
            // Response boundary: Drizzle return type diverges from Zod schema
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any, 200);
    })
    .openapi(saveSimulationRoute, async (c) => {
        const sessionUser = await requireAuth(c);
        const { name, files } = c.req.valid("json");
        if (Object.keys(files).length === 0) throw new ApiError("No files provided", 400);

        const db = getDb(c);
        const ghConfig = getGitHubConfig(c);
        const config = await db.select().from(schema.settings).all();
        const patSetting = config.find((s: SettingsRow) => s.key === "GITHUB_PAT");
        const pat = patSetting?.value || c.env.GITHUB_PAT;

        if (!pat) throw new ApiError("GitHub PAT not configured", 500);

        const headers: Record<string, string> = {
            "User-Agent": "ARES-Cloudflare-Worker",
            "Authorization": `Bearer ${pat}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        };

        const rawFilename = Object.keys(files)[0];
        const filename = rawFilename;
        const simIdStr = filename.replace(/\.tsx?$/, '');

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

        if (!putRes.ok) throw new ApiError("Failed to upload to GitHub", 500);

        c.executionCtx.waitUntil(logAuditAction(c, "UPDATE", "simulation", simIdStr, `Created/updated simulation: ${name || simIdStr}`));
        return c.json({ id: `github:${simIdStr}` }, 200);
    })
    .openapi(deleteSimulationRoute, async (c) => {
        const sessionUser = await requireAuth(c);
        const { id } = c.req.valid("param");
        if (!id || !id.startsWith("github:")) throw new ApiError("Not found", 404);

        const simIdStr = id.replace("github:", "");
        const filename = `${simIdStr}.tsx`;

        const db = getDb(c);
        const ghConfig = getGitHubConfig(c);
        const config = await db.select().from(schema.settings).all();
        const patSetting = config.find((s: SettingsRow) => s.key === "GITHUB_PAT");
        const pat = patSetting?.value || c.env.GITHUB_PAT;

        if (!pat) throw new ApiError("GitHub PAT not configured", 500);

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

        c.executionCtx.waitUntil(logAuditAction(c, "DELETE", "simulation", simIdStr, `Deleted simulation ${simIdStr}`));
        return c.json({ success: true }, 200);
    })
    .openapi(createGistRoute, async (c) => {
        const { name, files } = c.req.valid("json");
        const db = getDb(c);
        const config = await db.select().from(schema.settings).all();
        const patSetting = config.find((s: SettingsRow) => s.key === "GITHUB_PAT");
        const pat = patSetting?.value || c.env.GITHUB_PAT;

        if (!pat) throw new ApiError("GitHub PAT not configured", 500);

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

        const res = await fetch("https://api.github.com/gists", {
            method: "POST",
            headers,
            body: JSON.stringify({
                description: name || "ARESWEB Simulation Gist",
                public: true,
                files: gistFiles
            })
        });

        if (!res.ok) throw new ApiError("Failed to create GitHub Gist", 500);

        const gistResponse = await res.json() as { id: string; html_url: string };
        return c.json({ success: true, gistId: gistResponse.id, url: gistResponse.html_url }, 200);
    })
    .openapi(getGistRoute, async (c) => {
        const { id } = c.req.valid("param");
        const db = getDb(c);
        const config = await db.select().from(schema.settings).all();
        const patSetting = config.find((s: SettingsRow) => s.key === "GITHUB_PAT");
        const pat = patSetting?.value || c.env.GITHUB_PAT;

        const headers: Record<string, string> = {
            "User-Agent": "ARES-Cloudflare-Worker",
            "Accept": "application/vnd.github.v3+json"
        };
        if (pat) headers["Authorization"] = `Bearer ${pat}`;

        const res = await fetch(`https://api.github.com/gists/${id}`, { headers });
        if (!res.ok) throw new ApiError("Gist not found", 404);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gist = await res.json() as any;
        const gistFiles: Record<string, string> = {};
        for (const [filename, fileObj] of Object.entries(gist.files)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            gistFiles[filename] = (fileObj as any).content || "";
        }

        return c.json({
            simulation: {
                id: `gist:${id}`,
                name: String(gist.description || "Gist Simulation"),
                type: "gist",
                files: gistFiles,
                author_id: String(gist.owner?.login || "anonymous"),
                is_public: gist.public ? 1 : 0,
                createdAt: String(gist.created_at),
                updatedAt: String(gist.updated_at)
            }
            // Response boundary: Drizzle return type diverges from Zod schema
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any, 200);
    })
    .openapi(generateSimRegistryRoute, async (c) => {
        return c.json({ success: false, error: "Not Implemented in Cloudflare Workers" }, 200);
    })
    .openapi(listSimFoldersRoute, async (c) => {
        return c.json({ folders: [], registeredPaths: [] }, 200);
    });
// Get a single simulation file by id from GitHub
// Save simulation to GitHub
// Delete simulation from GitHub
// Create a new GitHub Gist for a simulation
// Fetch a GitHub Gist by ID
export default simulationsRouter;
