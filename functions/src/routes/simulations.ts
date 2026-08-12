import express from "express";
import rateLimit from "express-rate-limit";
import { ensureTeamMember, AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { logger } from "../lib/logger";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many simulations requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);

const SIM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// GitHub Repository Configuration
function getGitHubConfig() {
  const owner = process.env.GITHUB_REPO_OWNER || "ARES-23247";
  const repo = process.env.GITHUB_REPO_NAME || "ARESWEB";
  const branch = process.env.GITHUB_BRANCH || "main";
  return { owner, repo, branch, apiBase: `https://api.github.com/repos/${owner}/${repo}` };
}

// Secrets are injected by Cloud Functions Secret Manager. Never read credentials
// from Firestore, where a rules regression could expose them to client SDKs.
function getGitHubPat(): string | undefined {
  return process.env.GITHUB_PAT;
}

// GET /api/simulations - List all simulations from GitHub
router.get("/", asyncHandler(async (req, res) => {
  const ghConfig = getGitHubConfig();
  const pat = await getGitHubPat();

  const headers: Record<string, string> = {
    "User-Agent": "ARES-Firebase-Functions",
    "Accept": "application/vnd.github.v3.raw"
  };
  if (pat) headers["Authorization"] = `Bearer ${pat}`;

  const ghRes = await fetch(`${ghConfig.apiBase}/contents/src/sims/simRegistry.json`, { headers });
  if (!ghRes.ok) {
    logger.error("simulations", "GitHub registry request failed", {
      status: ghRes.status,
      statusText: ghRes.statusText,
    });
    throw new ApiError(502, `GitHub registry request failed: HTTP ${ghRes.status}`);
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

  res.json({ simulations: githubSims });
}));

// GET /api/simulations/gist/:id - Fetch a GitHub Gist by ID
router.get("/gist/:id", ensureTeamMember, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const safeId = id.match(/^[a-f0-9]{32}$/) ? id : (id.match(/^[0-9a-f]{20}$/) ? id : null);
  if (!safeId) {
    throw new ApiError(400, "Invalid Gist ID");
  }
  const pat = await getGitHubPat();

  const headers: Record<string, string> = {
    "User-Agent": "ARES-Firebase-Functions",
    "Accept": "application/vnd.github.v3+json"
  };
  if (pat) headers["Authorization"] = `Bearer ${pat}`;

  const ghRes = await fetch(`https://api.github.com/gists/${safeId}`, { headers });
  if (!ghRes.ok) {
    throw new ApiError(404, "Gist not found");
  }

  interface GitHubGist {
    description?: string | null;
    owner?: { login: string };
    public?: boolean;
    created_at?: string;
    updated_at?: string;
    files?: Record<string, { content?: string }>;
  }

  const gist = await ghRes.json() as GitHubGist;
  const gistFiles: Record<string, string> = {};
  if (gist.files) {
    for (const [filename, fileObj] of Object.entries(gist.files)) {
      gistFiles[filename] = fileObj.content || "";
    }
  }

  res.json({
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
  });
}));

// GET /api/simulations/:id - Get a single simulation file by id from GitHub
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || !id.startsWith("github:")) {
    throw new ApiError(404, "Simulation not found");
  }

  const simId = id.replace("github:", "");
  if (!SIM_ID_PATTERN.test(simId)) {
    throw new ApiError(400, "Invalid simulation ID");
  }

  const filePath = `src/sims/${simId}/index.tsx`;

  const ghConfig = getGitHubConfig();
  const pat = await getGitHubPat();
  const headers: Record<string, string> = {
    "User-Agent": "ARES-Firebase-Functions",
    "Accept": "application/vnd.github.v3.raw"
  };
  if (pat) headers["Authorization"] = `Bearer ${pat}`;
  
  const ghRes = await fetch(`${ghConfig.apiBase}/contents/${filePath}`, { headers });
  
  if (!ghRes.ok) {
    const legacyPath = `src/sims/${simId}.tsx`;
    const legacyRes = await fetch(`${ghConfig.apiBase}/contents/${legacyPath}`, { headers });
    if (!legacyRes.ok) {
      throw new ApiError(404, "Simulation not found in GitHub");
    }
    const code = await legacyRes.text();
    res.json({
      simulation: {
        id,
        name: simId,
        type: "github",
        description: null,
        files: JSON.stringify({ [`${simId}.tsx`]: code }),
        authorId: "ARES-23247",
        isPublic: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
    return;
  }

  const code = await ghRes.text();
  res.json({
    simulation: {
      id,
      name: simId,
      type: "github",
      description: null,
      files: JSON.stringify({ "index.tsx": code }),
      authorId: "ARES-23247",
      isPublic: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });
}));

// POST /api/simulations - Save simulation to GitHub
router.post("/", ensureTeamMember, asyncHandler(async (_req: AuthenticatedRequest, _res) => {
  throw new ApiError(410, "Direct repository publishing has been retired. Save a local draft or create a reviewed Gist share instead.");
}));

// DELETE /api/simulations/:id - Delete simulation from GitHub
router.delete("/:id", ensureTeamMember, asyncHandler(async (_req: AuthenticatedRequest, _res) => {
  throw new ApiError(410, "Direct repository deletion has been retired.");
}));

// POST /api/simulations/gist - Create a new GitHub Gist for a simulation
router.post("/gist", ensureTeamMember, asyncHandler(async (req, res) => {
  const { name, files } = req.body as { name?: string; files: Record<string, string> };
  if (!files || Object.keys(files).length === 0) {
    throw new ApiError(400, "No files provided");
  }

  const pat = await getGitHubPat();
  if (!pat) {
    throw new ApiError(500, "GitHub PAT not configured");
  }

  const headers: Record<string, string> = {
    "User-Agent": "ARES-Firebase-Functions",
    "Authorization": `Bearer ${pat}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json"
  };

  const gistFiles: Record<string, { content: string }> = {};
  for (const [filename, content] of Object.entries(files)) {
    gistFiles[filename] = { content: (content as string) || "// Empty file" };
  }

  const ghRes = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers,
    body: JSON.stringify({
      description: name || "ARESWEB Simulation Gist",
      public: true,
      files: gistFiles
    })
  });

  if (!ghRes.ok) {
    throw new ApiError(500, "Failed to create GitHub Gist");
  }

  const gistResponse = await ghRes.json() as { id: string; html_url: string };
  res.json({ success: true, gistId: gistResponse.id, url: gistResponse.html_url });
}));

export default router;
