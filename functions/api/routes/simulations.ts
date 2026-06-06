import { ApiError } from "../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAuth, ensureAdmin, getDb, DrizzleDB, logAuditAction, typedJson } from "../middleware";
import type { SessionUser } from "../middleware/utils";
import * as schema from "../../../src/db/schema";
import {
    listSimulationsRoute,
    getSimulationRoute,
    saveSimulationRoute,
    deleteSimulationRoute,
    createGistRoute,
    getGistRoute,
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

/** Fetch GitHub PAT from DB settings with env fallback (shared helper) */
async function getGitHubPat(c: { env: AppEnv["Bindings"] }): Promise<string | undefined> {
    try {
        const db = getDb(c as Parameters<typeof getDb>[0]);
        const rows = await db
            .select({ key: schema.settings.key, value: schema.settings.value })
            .from(schema.settings)
            .all();
        const patSetting = rows.find((s: SettingsRow) => s.key === "GITHUB_PAT");
        return patSetting?.value || c.env.GITHUB_PAT;
    } catch (e) {
        console.error("[Simulations] Failed to fetch GitHub PAT from DB:", e);
        return c.env.GITHUB_PAT;
    }
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
        const ghConfig = getGitHubConfig(c);
        const pat = await getGitHubPat(c);
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
        const pat = await getGitHubPat(c);

        const headers: Record<string, string> = {
            "User-Agent": "ARES-Cloudflare-Worker",
            "Accept": "application/vnd.github.v3.raw"
        };
        if (pat) headers["Authorization"] = `Bearer ${pat}`;

        const ghRes = await fetch(`${ghConfig.apiBase}/contents/src/sims/simRegistry.json`, { headers });
        if (!ghRes.ok) {return typedJson(c, { simulations: [] }, 200);
        }

        const registryText = await ghRes.text();
        const registry = JSON.parse(registryText);

        const githubSims = (registry.simulators || []).map((s: { id: string; name: string }) => ({
            id: `github:${s.id}`,
            name: s.name,
            description: null,
            authorId: "ARES-23247",
            isPublic: 1,
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

        const ghConfig = getGitHubConfig(c);
        const pat = await getGitHubPat(c);
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
                    id, name: simId, type: "github", description: null,
                    files: JSON.stringify({ [`${simId}.tsx`]: code }),
                    authorId: "ARES-23247", isPublic: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            }, 200);
        }
        const code = await ghRes.text();return c.json({
            simulation: {
                id, name: simId, type: "github", description: null,
                files: JSON.stringify({ "index.tsx": code }),
                authorId: "ARES-23247", isPublic: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }, 200);
    })
    .openapi(saveSimulationRoute, async (c) => {
        const sessionUser = await requireAuth(c);
        const { name, files } = c.req.valid("json");
        if (Object.keys(files).length === 0) throw new ApiError("No files provided", 400);

        const ghConfig = getGitHubConfig(c);
        const pat = await getGitHubPat(c);

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

        c.executionCtx?.waitUntil(logAuditAction(c, "UPDATE", "simulation", simIdStr, `Created/updated simulation: ${name || simIdStr}`));return typedJson(c, { id: `github:${simIdStr}` }, 200);
    })
    .openapi(deleteSimulationRoute, async (c) => {
        const sessionUser = await requireAuth(c);
        const { id } = c.req.valid("param");
        if (!id || !id.startsWith("github:")) throw new ApiError("Not found", 404);

        const simIdStr = id.replace("github:", "");
        const filename = `${simIdStr}.tsx`;

        const ghConfig = getGitHubConfig(c);
        const pat = await getGitHubPat(c);

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

        c.executionCtx?.waitUntil(logAuditAction(c, "DELETE", "simulation", simIdStr, `Deleted simulation ${simIdStr}`));
        return c.json({ success: true }, 200);
    })
    .openapi(createGistRoute, async (c) => {
        const { name, files } = c.req.valid("json");
        const pat = await getGitHubPat(c);

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
        const pat = await getGitHubPat(c);

        const headers: Record<string, string> = {
            "User-Agent": "ARES-Cloudflare-Worker",
            "Accept": "application/vnd.github.v3+json"
        };
        if (pat) headers["Authorization"] = `Bearer ${pat}`;

        const res = await fetch(`https://api.github.com/gists/${id}`, { headers });
        if (!res.ok) throw new ApiError("Gist not found", 404);

        interface GitHubGist {
            description?: string | null;
            owner?: { login: string };
            public?: boolean;
            created_at?: string;
            updated_at?: string;
            files?: Record<string, { content?: string }>;
        }

        const gist = await res.json() as GitHubGist;
        const gistFiles: Record<string, string> = {};
        if (gist.files) {
            for (const [filename, fileObj] of Object.entries(gist.files)) {
                gistFiles[filename] = fileObj.content || "";
            }
        }

        return c.json({
            simulation: {
                id: `gist:${id}`,
                name: String(gist.description || "Gist Simulation"),
                type: "gist",
                description: null,
                files: JSON.stringify(gistFiles),
                authorId: String(gist.owner?.login || "anonymous"),
                isPublic: gist.public ? 1 : 0,
                createdAt: String(gist.created_at),
                updatedAt: String(gist.updated_at)
            }
        }, 200);
    });
// Get a single simulation file by id from GitHub
// Save simulation to GitHub
// Delete simulation from GitHub
// Create a new GitHub Gist for a simulation
// Fetch a GitHub Gist by ID
export default simulationsRouter;
