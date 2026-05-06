import { hc } from "hono/client";
import type { ClientResponse } from "hono/client";
import { type apiRouter } from "../../functions/api/[[route]].ts";

/**
 * Type-safe Hono client for API calls.
 * 
 * NOTE: We use hc<typeof apiRouter> to get full RPC type safety.
 */
export const client = hc<typeof apiRouter>("/api", {
  init: {
    credentials: "include",
  },
  async fetch(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const normalizedPath = url.replace(/\/+(\?|$)/, "$1");
    const headers = new Headers(init?.headers);
    const body = init?.body;
    if (!(body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(normalizedPath, {
      ...init,
      headers,
    });
  },
});

/**
 * Error class for API failures.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Helper to unwrap Hono RPC responses and handle errors.
 * Returns the data directly or throws an ApiError.
 */
export async function unwrapResponse<T>(response: ClientResponse<any>): Promise<T> {
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(response.status, errorData.error || `API Error: ${response.status}`);
  }
  return (await response.json()) as T;
}
