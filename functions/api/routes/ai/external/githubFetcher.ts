/**
 * Utility to fetch and parse external resources from GitHub (e.g. FTC Docs, ARESLIB).
 * 
 * NOTE: The GitHub API allows 60 requests per hour for unauthenticated requests.
 * If you need more, you'll need to provide a GITHUB_PAT in the environment.
 */

export interface GitHubFile {
  path: string;
  content: string;
  sha: string;
}

/**
 * Fetches the raw content of matching files in a GitHub repository branch.
 */
export async function fetchGithubRepoFiles(
  owner: string,
  repo: string,
  branch: string,
  allowedExtensions: string[],
  githubPat?: string
): Promise<{ files: GitHubFile[], commitSha: string, error?: string }> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "ARESWEB-RAG-Indexer",
      "Accept": "application/vnd.github.v3+json"
    };

    if (githubPat) {
      headers["Authorization"] = `token ${githubPat}`;
    }

    // 1. Get the latest commit SHA for the branch
    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, { headers });
    if (!refRes.ok) {
      return { files: [], commitSha: "", error: `Failed to fetch ref: ${refRes.statusText}` };
    }
    const refData = await refRes.json() as any;
    const commitSha = refData.object.sha;

    // 2. Get the full recursive tree
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`, { headers });
    if (!treeRes.ok) {
      return { files: [], commitSha, error: `Failed to fetch tree: ${treeRes.statusText}` };
    }
    const treeData = await treeRes.json() as any;

    // 3. Filter files by extension
    const targetFiles = treeData.tree.filter((node: any) => {
      if (node.type !== "blob") return false;
      if (!allowedExtensions || allowedExtensions.length === 0) return true;
      const ext = node.path.substring(node.path.lastIndexOf("."));
      return allowedExtensions.includes(ext);
    });

    // 4. Fetch the raw contents concurrently (with a small concurrency limit if needed, 
    // but for Cloudflare Workers, we might just do a `Promise.all` for a small subset or sequential chunks to avoid hitting subrequest limits).
    // Let's cap it to 50 files for safety.
    const filesToFetch = targetFiles.slice(0, 50);
    const files: GitHubFile[] = [];

    for (const file of filesToFetch) {
      // Use raw.githubusercontent.com for faster fetching without API rate limits on blob content
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${file.path}`;
      const fileRes = await fetch(rawUrl, { headers: { "User-Agent": "ARESWEB-RAG-Indexer" } });
      
      if (fileRes.ok) {
        const content = await fileRes.text();
        files.push({
          path: file.path,
          content,
          sha: file.sha
        });
      }
    }

    return { files, commitSha };
  } catch (error) {
    return { files: [], commitSha: "", error: String(error) };
  }
}
