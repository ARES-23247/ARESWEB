import { auth } from "./firebaseAuth";
import { getAppCheckHeader } from "./firebaseAppCheck";

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const appCheckHeaders = await getAppCheckHeader();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (appCheckHeaders["X-Firebase-AppCheck"] && !headers.has("X-Firebase-AppCheck")) {
    headers.set("X-Firebase-AppCheck", appCheckHeaders["X-Firebase-AppCheck"]);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
