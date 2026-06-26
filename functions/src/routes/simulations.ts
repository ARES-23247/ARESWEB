import express from "express";
import { adminDb } from "../lib/firebase-admin";
import { ensureAuth, ensureAdmin, AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { exec } from "child_process";
import path from "path";

const router = express.Router();

const SIM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SIM_FILENAME_PATTERN = /^[a-zA-Z0-9_.-]+\.(tsx?|jsx?|json|css)$/;

// GitHub Repository Configuration
function getGitHubConfig() {
  const owner = process.env.GITHUB_REPO_OWNER || "ARES-23247";
  const repo = process.env.GITHUB_REPO_NAME || "ARESWEB";
  const branch = process.env.GITHUB_BRANCH || "main";
  return { owner, repo, branch, apiBase: `https://api.github.com/repos/${owner}/${repo}` };
}

// Fetch GitHub PAT from DB settings with env fallback
async function getGitHubPat(): Promise<string | undefined> {
  try {
    const docSnap = await adminDb.collection("settings").doc("GITHUB_PAT").get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data?.value) return data.value;
    }
  } catch (err) {
    console.error("[Simulations] Failed to fetch GITHUB_PAT from settings collection:", err);
  }
  return process.env.GITHUB_PAT;
}

// Helper: Check if user owns a simulation or is admin
async function canModifySimulation(sessionUser: any, simId: string): Promise<boolean> {
  if (!sessionUser) return false;
  
  // Admins, coaches, and mentors can modify any simulation
  const userDoc = await adminDb.collection("authorized_users").doc(sessionUser.uid).get();
  if (userDoc.exists) {
    const userData = userDoc.data();
    if (userData?.role === "admin" || userData?.role === "coach" || userData?.role === "mentor") {
      return true;
    }
  }

  try {
    const ghConfig = getGitHubConfig();
    const pat = await getGitHubPat();
    if (!pat) return false;

    const headers: Record<string, string> = {
      "User-Agent": "ARES-Firebase-Functions",
      "Authorization": `Bearer ${pat}`,
      "Accept": "application/vnd.github.v3+json"
    };

    const filePath = `src/sims/${simId}.tsx`;
    const url = `${ghConfig.apiBase}/commits?path=${filePath}&per_page=1`;

    const res = await fetch(url, { headers });
    if (!res.ok) return false;

    const commits = await res.json() as { author?: { email: string } }[];
    if (!commits || commits.length === 0) return false;

    const authorEmail = commits[0].author?.email;
    return authorEmail === sessionUser.email;
  } catch (err) {
    console.error("[Simulations] Ownership verification error:", err);
    return false;
  }
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
    res.json({ simulations: [] });
    return;
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
router.get("/gist/:id", ensureAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const pat = await getGitHubPat();

  const headers: Record<string, string> = {
    "User-Agent": "ARES-Firebase-Functions",
    "Accept": "application/vnd.github.v3+json"
  };
  if (pat) headers["Authorization"] = `Bearer ${pat}`;

  const ghRes = await fetch(`https://api.github.com/gists/${id}`, { headers });
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
  
  let ghRes = await fetch(`${ghConfig.apiBase}/contents/${filePath}`, { headers });
  
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
router.post("/", ensureAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { files } = req.body as { files: Record<string, string> };
  if (!files || Object.keys(files).length === 0) {
    throw new ApiError(400, "No files provided");
  }

  // Security: Limit total payload size to 2MB to prevent DoS
  const totalSize = JSON.stringify(files).length;
  if (totalSize > 2 * 1024 * 1024) {
    throw new ApiError(400, "Payload exceeds 2MB limit");
  }

  const rawFilename = Object.keys(files)[0];
  if (!SIM_FILENAME_PATTERN.test(rawFilename)) {
    throw new ApiError(400, "Invalid filename characters or extension");
  }

  const filename = rawFilename;
  const simIdStr = filename.replace(/\.tsx?$/, "");

  const ghConfig = getGitHubConfig();
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

  const content = String(files[rawFilename]);
  const base64Content = Buffer.from(content, "utf-8").toString("base64");

  const path = `src/sims/${filename}`;
  const url = `${ghConfig.apiBase}/contents/${path}`;

  let sha: string | undefined;
  const getRes = await fetch(url, { headers });
  if (getRes.ok) {
    const getJson = (await getRes.json()) as { sha: string };
    sha = getJson.sha;
    
    // Check ownership before updating
    const canModify = await canModifySimulation(req.user, simIdStr);
    if (!canModify) {
      throw new ApiError(403, "You can only modify your own simulations");
    }
  }

  const putRes = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `feat(sims): update ${filename} via Simulation Playground`,
      content: base64Content,
      sha
    })
  });

  if (!putRes.ok) {
    throw new ApiError(500, "Failed to upload to GitHub");
  }

  res.json({ id: `github:${simIdStr}` });
}));

// DELETE /api/simulations/:id - Delete simulation from GitHub
router.delete("/:id", ensureAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!id || !id.startsWith("github:")) {
    throw new ApiError(404, "Simulation not found");
  }

  const simIdStr = id.replace("github:", "");
  if (!SIM_ID_PATTERN.test(simIdStr)) {
    throw new ApiError(400, "Invalid simulation ID");
  }

  const filename = `${simIdStr}.tsx`;
  const ghConfig = getGitHubConfig();
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

  const path = `src/sims/${filename}`;
  const url = `${ghConfig.apiBase}/contents/${path}`;

  let sha: string | undefined;
  const getRes = await fetch(url, { headers });
  if (getRes.ok) {
    const getJson = (await getRes.json()) as { sha: string };
    sha = getJson.sha;
  }

  if (sha) {
    const canModify = await canModifySimulation(req.user, simIdStr);
    if (!canModify) {
      throw new ApiError(403, "You can only delete your own simulations");
    }

    await fetch(url, {
      method: "DELETE",
      headers,
      body: JSON.stringify({
        message: `feat(sims): delete ${filename} via Simulation Playground`,
        sha
      })
    });
  }

  res.json({ success: true });
}));

// POST /api/simulations/gist - Create a new GitHub Gist for a simulation
router.post("/gist", ensureAuth, asyncHandler(async (req, res) => {
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

// POST /api/simulations/admin/generate-registry - Admin endpoint to regenerate registry
router.post("/admin/generate-registry", ensureAdmin, asyncHandler(async (req, res, next) => {
  if (process.env.FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV === "development") {
    const scriptPath = path.resolve(__dirname, "../../../scripts/generate-sim-registry.ts");
    exec(`npx ts-node "${scriptPath}"`, (err, stdout, stderr) => {
      if (err) {
        console.error("Failed to run generate-sim-registry:", err, stderr);
        next(new ApiError(500, `Failed to generate registry: ${err.message}`));
        return;
      }
      res.json({ success: true, message: "Registry regenerated successfully!" });
    });
  } else {
    throw new ApiError(403, "Regeneration is not supported in production environment.");
  }
}));

// GET /api/simulations/field-config/:id - Get a field configuration by ID
router.get("/field-config/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docSnap = await adminDb.collection("field_configs").doc(id).get();
  if (!docSnap.exists) {
    throw new ApiError(404, "Field configuration not found");
  }
  res.json(docSnap.data());
}));

export default router;
