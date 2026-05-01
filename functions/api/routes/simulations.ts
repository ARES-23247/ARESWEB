import { Hono } from "hono";
import { AppEnv, ensureAdmin, persistentRateLimitMiddleware } from "../middleware";

export const simulationsRouter = new Hono<AppEnv>();

const GITHUB_REPO = "ARES-23247/ARESWEB";
const GITHUB_BRANCH = "master"; // or main? We will assume master as per previous phases

// Helper for GitHub API requests
async function fetchGithub(path: string, token: string, method = "GET", body?: any) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "ARESWEB-SimPlayground"
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return res;
}

// List all simulations directly from src/sims/
simulationsRouter.get("/", async (c) => {
  try {
    const token = c.env.GITHUB_PAT;
    if (!token) return c.json({ error: "GITHUB_PAT not configured" }, 500);

    const res = await fetchGithub("contents/src/sims", token);
    
    if (!res.ok) {
      if (res.status === 404) return c.json({ simulations: [] });
      throw new Error(`GitHub API error: ${res.statusText}`);
    }

    const files = await res.json() as any[];
    
    const formattedSims = files
      .filter(f => f.type === "file" && f.name.endsWith(".tsx"))
      .map(f => ({
        id: f.name, // The filename is the ID
        name: f.name,
        author_id: "github",
        created_at: new Date().toISOString(), // GitHub contents API doesn't return dates directly here
        updated_at: new Date().toISOString(),
        type: "github",
        sha: f.sha
      }));

    return c.json({ simulations: formattedSims });
  } catch (e) {
    console.error("[Simulations] List error:", e);
    return c.json({ error: "Failed to list simulations from GitHub" }, 500);
  }
});

// Get a single simulation file by filename
simulationsRouter.get("/:id", async (c) => {
  const filename = c.req.param("id"); // ID is the filename
  try {
    const token = c.env.GITHUB_PAT;
    if (!token) return c.json({ error: "GITHUB_PAT not configured" }, 500);

    const res = await fetchGithub(`contents/src/sims/${filename}`, token);
    if (!res.ok) {
      return c.json({ error: "Simulation not found on GitHub" }, 404);
    }
    
    const fileData = await res.json() as any;
    
    if (fileData.encoding === "base64") {
      const content = atob(fileData.content);
      return c.json({
        simulation: {
          id: filename,
          name: filename,
          type: "github",
          files: {
            [filename]: content
          },
          sha: fileData.sha
        }
      });
    }

    return c.json({ error: "Unknown encoding from GitHub" }, 500);
  } catch (e) {
    console.error("[Simulations] Get error:", e);
    return c.json({ error: "Failed to get simulation from GitHub" }, 500);
  }
});

// Commit a simulation file to GitHub
simulationsRouter.post("/", persistentRateLimitMiddleware(10, 60), ensureAdmin, async (c) => {
  const body = await c.req.json();
  const { id, name, files } = body as { 
    id?: string; 
    name?: string; 
    files?: Record<string, string>;
  };

  const targetName = name || id;
  if (!targetName || !files || Object.keys(files).length === 0) {
    return c.json({ error: "Name and files are required" }, 400);
  }

  // Find the primary file content (if multiple, we just use the first .tsx or whatever matches name)
  let targetFilename = targetName.endsWith(".tsx") ? targetName : `${targetName}.tsx`;
  // Sanitize filename
  targetFilename = targetFilename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  
  // Try to find the file content, favoring one that matches the targetFilename or just grab the first one
  let fileContent = files[targetFilename];
  if (!fileContent) {
    const firstKey = Object.keys(files)[0];
    fileContent = files[firstKey];
    if (firstKey.endsWith(".tsx")) {
      targetFilename = firstKey;
    }
  }

  try {
    const token = c.env.GITHUB_PAT;
    if (!token) return c.json({ error: "GITHUB_PAT not configured" }, 500);

    // 1. Get current SHA if the file exists
    let currentSha: string | undefined;
    const getRes = await fetchGithub(`contents/src/sims/${targetFilename}`, token);
    if (getRes.ok) {
      const existingFile = await getRes.json() as any;
      currentSha = existingFile.sha;
    }

    // 2. Commit the file
    const message = currentSha 
      ? `Update simulation ${targetFilename} via Playground`
      : `Create simulation ${targetFilename} via Playground`;

    const payload = {
      message,
      content: btoa(unescape(encodeURIComponent(fileContent))), // base64 encode UTF-8
      branch: GITHUB_BRANCH,
      ...(currentSha ? { sha: currentSha } : {})
    };

    const putRes = await fetchGithub(`contents/src/sims/${targetFilename}`, token, "PUT", payload);

    if (!putRes.ok) {
      const errText = await putRes.text();
      console.error("GitHub PUT error:", errText);
      throw new Error(`Failed to commit: ${putRes.statusText}`);
    }

    return c.json({ success: true, id: targetFilename });
  } catch (e) {
    console.error("[Simulations] Save error:", e);
    return c.json({ error: "Failed to save simulation to GitHub" }, 500);
  }
});

// Delete a simulation from GitHub
simulationsRouter.delete("/:id", ensureAdmin, async (c) => {
  const filename = c.req.param("id");
  try {
    const token = c.env.GITHUB_PAT;
    if (!token) return c.json({ error: "GITHUB_PAT not configured" }, 500);

    // 1. Get SHA
    const getRes = await fetchGithub(`contents/src/sims/${filename}`, token);
    if (!getRes.ok) return c.json({ error: "Simulation not found" }, 404);
    
    const fileData = await getRes.json() as any;
    
    // 2. Delete file
    const payload = {
      message: `Delete simulation ${filename} via Playground`,
      sha: fileData.sha,
      branch: GITHUB_BRANCH
    };

    const delRes = await fetchGithub(`contents/src/sims/${filename}`, token, "DELETE", payload);
    if (!delRes.ok) throw new Error("Delete failed");

    return c.json({ success: true });
  } catch (e) {
    console.error("[Simulations] Delete error:", e);
    return c.json({ error: "Failed to delete simulation from GitHub" }, 500);
  }
});
