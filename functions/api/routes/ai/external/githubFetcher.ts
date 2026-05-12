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

interface GitHubErrorResponse {
    message?: string;
    documentation_url?: string;
}

/**
 * Parses GitHub API error response to get a helpful error message.
 */
async function parseGitHubError(response: Response): Promise<string> {
    const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
    const rateLimitReset = response.headers.get("x-ratelimit-reset");

    if (response.status === 403 && rateLimitRemaining === "0") {
        const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toLocaleTimeString() : "unknown";
        return `Rate limit exceeded. Resets at ${resetTime}. Add GITHUB_PAT to increase limit to 5000/hour.`;
    }

    if (response.status === 404) {
        return "Repository or branch not found. Check that the repo is public and the branch name is correct.";
    }

    if (response.status === 401) {
        return "Authentication failed. Check that GITHUB_PAT is valid.";
    }

    try {
        const errBody = await response.json() as GitHubErrorResponse;
        return errBody.message || response.statusText;
    } catch {
        return response.statusText || "Unknown error";
    }
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
    const headers: Record<string, string> = {
        "User-Agent": "ARESWEB-RAG-Indexer",
        "Accept": "application/vnd.github.v3+json"
    };
    if (githubPat) {
        headers["Authorization"] = `token ${githubPat}`;
    }

    // Step 1: Fetch the branch reference to get the latest commit SHA
    const refUrl = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`;
    let refRes = await fetch(refUrl, { headers });

    if (!refRes.ok) {
        // Fallback: try alternative branch name
        const fallbackBranch = branch === "main" ? "master" : branch === "master" ? "main" : null;
        if (fallbackBranch) {
            refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${fallbackBranch}`, { headers });
        }

        if (!refRes.ok) {
            const errorMsg = await parseGitHubError(refRes);
            return {
                files: [],
                commitSha: "",
                error: `[${owner}/${repo}] Branch "${branch}" not found: ${errorMsg}`
            };
        }
    }

    let refData: { object: { sha: string } };
    try {
        refData = await refRes.json() as { object: { sha: string } };
    } catch {
        return {
            files: [],
            commitSha: "",
            error: `[${owner}/${repo}] Invalid response from GitHub API`
        };
    }

    const commitSha = refData.object.sha;

    // Step 2: Fetch the repository tree (all files)
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`;
    const treeRes = await fetch(treeUrl, { headers });

    if (!treeRes.ok) {
        const errorMsg = await parseGitHubError(treeRes);
        return {
            files: [],
            commitSha,
            error: `[${owner}/${repo}] Could not fetch file tree: ${errorMsg}`
        };
    }

    let treeData: { tree: Array<{ type: string; path: string; sha: string }> };
    try {
        treeData = await treeRes.json() as { tree: Array<{ type: string; path: string; sha: string }> };
    } catch {
        return {
            files: [],
            commitSha,
            error: `[${owner}/${repo}] Invalid tree response from GitHub API`
        };
    }

    // Step 3: Filter files by extension
    const targetFiles = treeData.tree.filter((node) => {
        if (node.type !== "blob") return false;
        if (!allowedExtensions || allowedExtensions.length === 0) return true;
        const ext = node.path.substring(node.path.lastIndexOf("."));
        return allowedExtensions.includes(ext);
    });

    if (targetFiles.length === 0) {
        return {
            files: [],
            commitSha,
            error: `[${owner}/${repo}] No matching files found (extensions: ${allowedExtensions.join(", ")})`
        };
    }

    // Step 4: Fetch raw file contents (limit to 15 files to avoid timeouts)
    const filesToFetch = targetFiles.slice(0, 15);
    const files: GitHubFile[] = [];
    const fetchErrors: string[] = [];

    for (const file of filesToFetch) {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${file.path}`;
        const fileRes = await fetch(rawUrl, { headers: { "User-Agent": "ARESWEB-RAG-Indexer" } });

        if (fileRes.ok) {
            const content = await fileRes.text();
            files.push({ path: file.path, content, sha: file.sha });
        } else {
            fetchErrors.push(`${file.path} (${fileRes.status})`);
        }
    }

    if (files.length === 0) {
        return {
            files: [],
            commitSha,
            error: `[${owner}/${repo}] Failed to fetch all ${filesToFetch.length} files. Errors: ${fetchErrors.join(", ")}`
        };
    }

    if (fetchErrors.length > 0) {
        console.warn(`[${owner}/${repo}] ${fetchErrors.length} files failed to load: ${fetchErrors.join(", ")}`);
    }

    return { files, commitSha };
}
