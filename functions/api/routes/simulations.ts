import { Hono } from "hono";
import { AppEnv } from "../middleware";

export const simulationsRouter = new Hono<AppEnv>();

// List all simulations from GitHub
simulationsRouter.get("/", async (c) => {
  try {
    const db = c.get("db");
    const config = await db.selectFrom("settings").selectAll().execute();
    const patSetting = config.find(s => s.key === "GITHUB_PAT");
    const pat = patSetting?.value || c.env.GITHUB_PAT;
    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Accept": "application/vnd.github.v3.raw"
    };
    if (pat) headers["Authorization"] = `Bearer ${pat}`;

    const ghRes = await fetch(`https://api.github.com/repos/ARES-23247/ARESWEB/contents/src/sims/simRegistry.json`, { headers });
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
simulationsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  if (!id.startsWith("github:")) {
    return c.json({ error: "Simulation not found" }, 404);
  }

  const simId = id.replace("github:", "");
  try {
    const db = c.get("db");
    const config = await db.selectFrom("settings").selectAll().execute();
    const patSetting = config.find(s => s.key === "GITHUB_PAT");
    const pat = patSetting?.value || c.env.GITHUB_PAT;
    const headers: Record<string, string> = {
      "User-Agent": "ARES-Cloudflare-Worker",
      "Accept": "application/vnd.github.v3.raw"
    };
    if (pat) headers["Authorization"] = `Bearer ${pat}`;

    const ghRes = await fetch(`https://api.github.com/repos/ARES-23247/ARESWEB/contents/src/sims/${simId}.tsx`, { headers });
    if (!ghRes.ok) {
      return c.json({ error: "Simulation not found in GitHub" }, 404);
    }
    
    const code = await ghRes.text();
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
  } catch (ghErr) {
    console.error("[Simulations] GitHub get error:", ghErr);
    return c.json({ error: "Failed to get simulation from GitHub" }, 500);
  }
});

// Save simulation to GitHub
simulationsRouter.post("/", async (c) => {
  try {
    const sessionUser = c.get("sessionUser");
    if (!sessionUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    const body = await c.req.json();
    const { name, files } = body;
    
    if (!files || Object.keys(files).length === 0) {
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
    const url = `https://api.github.com/repos/ARES-23247/ARESWEB/contents/${path}`;
    
    let sha: string | undefined;
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
      const getJson = (await getRes.json()) as any;
      sha = getJson.sha;
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

    // Update registry if new
    if (!sha) {
      const regUrl = `https://api.github.com/repos/ARES-23247/ARESWEB/contents/src/sims/simRegistry.json`;
      const regGetRes = await fetch(regUrl, { headers });
      if (regGetRes.ok) {
        const regJson = (await regGetRes.json()) as any;
        const regSha = regJson.sha;
        const regContentStr = decodeURIComponent(escape(atob(regJson.content)));
        try {
          const registry = JSON.parse(regContentStr);
          
          if (!registry.simulators.some((s: any) => s.id === simIdStr)) {
            registry.simulators.push({
              id: simIdStr,
              name: name || simIdStr,
              path: `./${simIdStr}`,
              requiresContext: false
            });
            
            const newRegContent = JSON.stringify(registry, null, 2);
            const newRegBase64 = btoa(unescape(encodeURIComponent(newRegContent)));
            
            await fetch(regUrl, {
              method: "PUT",
              headers,
              body: JSON.stringify({
                message: `feat(sims): register ${simIdStr} in simRegistry.json`,
                content: newRegBase64,
                sha: regSha
              })
            });
          }
        } catch (e) {
          console.error("[Simulations] Registry update failed:", e);
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
simulationsRouter.delete("/:id", async (c) => {
  try {
    const sessionUser = c.get("sessionUser");
    if (!sessionUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    const id = c.req.param("id");
    if (!id.startsWith("github:")) {
      return c.json({ error: "Not found" }, 404);
    }
    
    const simIdStr = id.replace("github:", "");
    
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

    const path = `src/sims/${simIdStr}.tsx`;
    const url = `https://api.github.com/repos/ARES-23247/ARESWEB/contents/${path}`;
    
    let sha: string | undefined;
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
      const getJson = (await getRes.json()) as any;
      sha = getJson.sha;
    }
    
    if (sha) {
      const delRes = await fetch(url, {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          message: `feat(sims): delete ${simIdStr}.tsx via Simulation Playground`,
          sha: sha
        })
      });
      
      if (!delRes.ok) {
        console.error("[Simulations] GitHub DELETE error:", await delRes.text());
      }
    }
    
    // Also remove from registry
    const regUrl = `https://api.github.com/repos/ARES-23247/ARESWEB/contents/src/sims/simRegistry.json`;
    const regGetRes = await fetch(regUrl, { headers });
    if (regGetRes.ok) {
      const regJson = (await regGetRes.json()) as any;
      const regSha = regJson.sha;
      const regContentStr = decodeURIComponent(escape(atob(regJson.content)));
      try {
        const registry = JSON.parse(regContentStr);
        const filtered = registry.simulators.filter((s: any) => s.id !== simIdStr);
        
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
