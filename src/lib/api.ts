import { auth } from "./firebaseAuth";
import { getAppCheckHeader } from "./firebaseAppCheck";

function requestUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) return input.href;
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
}

/**
 * Firebase ID and App Check tokens are bearer credentials for every ARES API.
 * Attach them only to this site's own origin so a configured third-party or
 * separate Cloud Run origin can never receive them through this helper.
 */
export function isSameOriginRequest(input: RequestInfo | URL): boolean {
  const origin = globalThis.location?.origin;
  if (!origin || origin === "null") return false;
  try {
    return new URL(requestUrl(input), origin).origin === origin;
  } catch {
    return false;
  }
}

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  init?.signal?.throwIfAborted();
  const headers = new Headers(
    init?.headers ?? (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined),
  );

  if (isSameOriginRequest(input)) {
    const token = await auth.currentUser?.getIdToken();
    init?.signal?.throwIfAborted();
    const appCheckHeaders = await getAppCheckHeader();
    init?.signal?.throwIfAborted();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (appCheckHeaders["X-Firebase-AppCheck"] && !headers.has("X-Firebase-AppCheck")) {
      headers.set("X-Firebase-AppCheck", appCheckHeaders["X-Firebase-AppCheck"]);
    }
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
