import { hc } from "hono/client";
import type { ClientResponse } from "hono/client";
import { type AppType } from "../../functions/api/[[route]]";
import { type UseMutationOptions } from "@tanstack/react-query";

/**
 * Type-safe Hono client for API calls.
 *
 * NOTE: We use hc<AppType> to get full RPC type safety where possible.
 *
 * IMPORTANT: The client uses a loose type (extends Client) because OpenAPIHono
 * route types are not fully inferrable by Hono's hc() client. OpenAPIHono extends
 * Hono with additional metadata (for OpenAPI spec generation) that creates
 * structural incompatibilities with hc's type inference. Individual API
 * wrapper functions handle their own type safety through Zod schemas and
 * explicit type annotations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const client: any = hc<AppType>("/api", {
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
export async function unwrapResponse<T>(response: ClientResponse<unknown>): Promise<T> {
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(response.status, errorData.error || `API Error: ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * Wraps user-provided mutation options to run internal logic before user callbacks.
 *
 * This solves a type system limitation where TanStack Query's UseMutationOptions
 * doesn't support "wrapping" callbacks cleanly. The internal onSuccess needs to
 * run (for cache invalidation), then forward to the user's onSuccess, but the
 * type signatures don't align perfectly.
 *
 * @example
 * ```ts
 * return useMutation({
 *   mutationFn: ...,
 *   ...wrapOnSuccess(options, (data, variables) => {
 *     queryClient.invalidateQueries({ queryKey: ["key"] });
 *   }),
 * });
 * ```
 */
export function wrapOnSuccess<TData, TError, TVariables>(
  options: UseMutationOptions<TData, TError, TVariables> | undefined,
  internalOnSuccess: (data: TData, variables: TVariables) => void
): UseMutationOptions<TData, TError, TVariables> {
  if (!options) {
    return { onSuccess: internalOnSuccess };
  }

  return {
    ...options,
    onSuccess: (data, variables) => {
      internalOnSuccess(data, variables);
      // Forward to user's callback. The type cast is safe because we're preserving
      // the parameters the user expects (data, variables). TanStack Query types
      // include a third 'context' parameter that our hooks don't use.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (options.onSuccess as any)?.(data, variables);
    },
  };
}
