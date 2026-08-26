import { createHash } from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import { ensureTeamMember, AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { logger } from "../lib/logger";
import { requireRouteParam } from "../middleware/validation";
import { distributedAnonymousQuota } from "../middleware/distributedQuota";
import {
  type PublicArtifact,
  readPublicArtifact,
  writePublicArtifact,
} from "../lib/publicArtifactCache";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many simulations requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);
router.use(distributedAnonymousQuota({
  scope: "public-simulations",
  limit: 100,
  windowMs: 15 * 60 * 1000,
}));

const SIM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const PUBLIC_CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
const REGISTRY_ARTIFACT_KEY = "simulation-registry";

interface RegistrySimulation {
  id: string;
  name: string;
}

function parseRegistry(text: string): RegistrySimulation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(502, "Simulation registry is temporarily unavailable.", "SIMULATION_REGISTRY_INVALID");
  }
  const simulators = parsed && typeof parsed === "object" && "simulators" in parsed
    ? (parsed as { simulators?: unknown }).simulators
    : undefined;
  if (!Array.isArray(simulators) || simulators.length > 100) {
    throw new ApiError(502, "Simulation registry is temporarily unavailable.", "SIMULATION_REGISTRY_INVALID");
  }
  return simulators.map((simulation) => {
    if (
      !simulation
      || typeof simulation !== "object"
      || typeof (simulation as { id?: unknown }).id !== "string"
      || !SIM_ID_PATTERN.test((simulation as { id: string }).id)
      || typeof (simulation as { name?: unknown }).name !== "string"
    ) {
      throw new ApiError(502, "Simulation registry is temporarily unavailable.", "SIMULATION_REGISTRY_INVALID");
    }
    const id = (simulation as { id: string }).id;
    const name = (simulation as { name: string }).name.trim().slice(0, 120) || id;
    return { id, name };
  });
}

function simulationArtifactKey(id: string): string {
  return `simulation-source-${createHash("sha256").update(id).digest("hex").slice(0, 32)}`;
}

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

function githubHeaders(accept = "application/vnd.github.v3.raw"): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "ARES-Firebase-Functions",
    "Accept": accept,
  };
  const pat = getGitHubPat();
  if (pat) headers.Authorization = `Bearer ${pat}`;
  return headers;
}

async function fetchRepositoryText(path: string): Promise<Response> {
  const ghConfig = getGitHubConfig();
  return fetch(`${ghConfig.apiBase}/contents/${path}`, { headers: githubHeaders() });
}

async function refreshRegistryArtifact(): Promise<PublicArtifact> {
  const response = await fetchRepositoryText("src/sims/simRegistry.json");
  if (!response.ok) {
    logger.error("simulations", "GitHub registry request failed", { status: response.status });
    throw new ApiError(502, "Simulation registry is temporarily unavailable.", "SIMULATION_UPSTREAM_ERROR");
  }
  const text = await response.text();
  parseRegistry(text);
  return writePublicArtifact(REGISTRY_ARTIFACT_KEY, text, "application/json; charset=utf-8");
}

async function registryArtifact(forceRefresh = false): Promise<PublicArtifact> {
  if (!forceRefresh) {
    const cached = await readPublicArtifact(REGISTRY_ARTIFACT_KEY);
    if (cached) {
      parseRegistry(cached.body);
      return cached;
    }
  }
  return refreshRegistryArtifact();
}

async function refreshSimulationSourceArtifact(id: string): Promise<PublicArtifact> {
  let response = await fetchRepositoryText(`src/sims/${id}/index.tsx`);
  if (!response.ok) response = await fetchRepositoryText(`src/sims/${id}.tsx`);
  if (!response.ok) throw new ApiError(404, "Simulation not found in GitHub");
  const code = await response.text();
  if (code.length > 1_000_000) {
    throw new ApiError(502, "Simulation source exceeds its safe size limit.", "SIMULATION_SOURCE_TOO_LARGE");
  }
  return writePublicArtifact(simulationArtifactKey(id), code, "text/plain; charset=utf-8");
}

async function simulationSourceArtifact(id: string, forceRefresh = false): Promise<PublicArtifact> {
  if (!forceRefresh) {
    const cached = await readPublicArtifact(simulationArtifactKey(id));
    if (cached) return cached;
  }
  return refreshSimulationSourceArtifact(id);
}

/** Scheduled refresh path; public requests consume the durable result. */
export async function refreshSimulationArtifacts(): Promise<void> {
  const registry = await registryArtifact(true);
  const simulations = parseRegistry(registry.body);
  for (const simulation of simulations) {
    await simulationSourceArtifact(simulation.id, true);
  }
  logger.info("simulations", "Durable simulation artifacts refreshed", {
    artifactCount: simulations.length + 1,
  });
}

function setPublicArtifactHeaders(res: express.Response, artifact: PublicArtifact): void {
  res.setHeader("Cache-Control", PUBLIC_CACHE_CONTROL);
  res.setHeader("ETag", artifact.etag);
}

// GET /api/simulations - List all simulations from GitHub
router.get("/", asyncHandler(async (req, res) => {
  const artifact = await registryArtifact();
  setPublicArtifactHeaders(res, artifact);
  if (req.get("If-None-Match") === artifact.etag) {
    res.status(304).end();
    return;
  }
  const githubSims = parseRegistry(artifact.body).map((s) => ({
    id: `github:${s.id}`,
    name: s.name,
    description: null,
    authorId: "ARES-23247",
    isPublic: 1,
    createdAt: artifact.generatedAt,
    updatedAt: artifact.generatedAt,
    type: "github"
  }));

  res.json({ simulations: githubSims });
}));

// GET /api/simulations/gist/:id - Fetch a GitHub Gist by ID
router.get("/gist/:id", ensureTeamMember, asyncHandler(async (req, res) => {
  const id = requireRouteParam(req.params.id, "Gist ID");
  const safeId = id.match(/^[a-f0-9]{32}$/) ? id : (id.match(/^[0-9a-f]{20}$/) ? id : null);
  if (!safeId) {
    throw new ApiError(400, "Invalid Gist ID");
  }
  const headers = githubHeaders("application/vnd.github.v3+json");

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
  const id = requireRouteParam(req.params.id, "simulation ID");

  if (!id || !id.startsWith("github:")) {
    throw new ApiError(404, "Simulation not found");
  }

  const simId = id.replace("github:", "");
  if (!SIM_ID_PATTERN.test(simId)) {
    throw new ApiError(400, "Invalid simulation ID");
  }

  const registry = await registryArtifact();
  const registered = parseRegistry(registry.body).find((simulation) => simulation.id === simId);
  if (!registered) throw new ApiError(404, "Simulation not found");
  const artifact = await simulationSourceArtifact(simId);
  setPublicArtifactHeaders(res, artifact);
  if (req.get("If-None-Match") === artifact.etag) {
    res.status(304).end();
    return;
  }
  res.json({
    simulation: {
      id,
      name: registered.name,
      type: "github",
      description: null,
      files: JSON.stringify({ "index.tsx": artifact.body }),
      authorId: "ARES-23247",
      isPublic: 1,
      createdAt: artifact.generatedAt,
      updatedAt: artifact.generatedAt,
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
  // Gists publish under the team account, so bounds are enforced before the
  // GitHub call: bounded name, a small file set, safe filenames, sized content.
  const gistName = typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : "ARESWEB Simulation Gist";
  if (!files || typeof files !== "object" || Array.isArray(files) || Object.keys(files).length === 0) {
    throw new ApiError(400, "No files provided");
  }
  const fileEntries = Object.entries(files);
  if (fileEntries.length > 20) {
    throw new ApiError(400, "A gist may contain at most 20 files");
  }
  let totalBytes = 0;
  for (const [filename, content] of fileEntries) {
    if (!/^[\w][\w.\- ]{0,99}$/.test(filename)) {
      throw new ApiError(400, "Gist filenames may only contain letters, digits, dashes, dots, and spaces");
    }
    if (typeof content !== "string") {
      throw new ApiError(400, "Every gist file must be text content");
    }
    totalBytes += content.length;
    if (content.length > 100_000) {
      throw new ApiError(400, "A gist file may not exceed 100,000 characters");
    }
  }
  if (totalBytes > 300_000) {
    throw new ApiError(400, "A gist may not exceed 300,000 characters in total");
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
      description: gistName,
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
