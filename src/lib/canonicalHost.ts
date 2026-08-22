const DIRECT_HOSTS = new Set([
  "aresfirst-portal.web.app",
  "aresfirst-portal.firebaseapp.com",
]);

const DEPLOYMENT_PROBE_PATTERN = /^[a-f0-9]{40}$/;

type BrowserLocation = Pick<
  Location,
  "hostname" | "pathname" | "search" | "hash"
>;

/**
 * Returns the canonical redirect for Firebase's direct Hosting domains.
 * A commit-addressed deployment probe stays on the direct origin so CI can
 * verify the newly deployed Firebase surface without crossing a CDN boundary.
 */
export function getCanonicalRedirect(location: BrowserLocation): string | null {
  if (!DIRECT_HOSTS.has(location.hostname)) return null;

  const deploymentId = new URLSearchParams(location.search).get("deployment");
  if (deploymentId && DEPLOYMENT_PROBE_PATTERN.test(deploymentId)) return null;

  return `https://aresfirst.org${location.pathname}${location.search}${location.hash}`;
}
