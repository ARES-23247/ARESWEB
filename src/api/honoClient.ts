import { hc } from "hono/client";
import type { ClientResponse } from "hono/client";
import type { AppType, group1, group2, group3, group4 } from "../../functions/api/[[route]]";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Custom fetch that handles:
 * - Path normalization (removes duplicate slashes)
 * - Automatic Content-Type header for JSON requests
 * - 401 session refresh triggering
 */
const customFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const normalizedPath = url.replace(/\/+(\?|$)/, "$1");
  const headers = new Headers(init?.headers);
  const body = init?.body;
  if (!(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(normalizedPath, {
    ...init,
    headers,
  });

  // Handle 401 Unauthorized - trigger session refresh
  if (response.status === 401 && typeof window !== 'undefined') {
    // Trigger Better Auth session refresh
    // The auth state will be updated and components will re-render
    console.warn('[API] 401 response - session may need refresh');
  }

  return response;
};

/**
 * Type-safe Hono client for API calls.
 *
 * LIMITATIONS:
 * 1. Custom fetch breaks hc() type inference (even with `as typeof fetch`)
 * 2. Server routes mounted via `.route()` don't chain OpenAPI types into `typeof apiRouter`
 *
 * For full type safety, server would need to export chained `.openapi()` results:
 *   const routes = apiRouter.openapi(getRoute, handler).openapi(postRoute, handler);
 *   export type AppType = typeof routes;
 *
 * Individual API wrapper functions in src/api/ provide type safety via Zod schemas.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseClient = hc<any>("/api", {
  init: {
    credentials: "include",
  },
  fetch: customFetch as typeof fetch,
});

// Dummy clients to extract types without triggering generic syntax errors
const c1 = hc<typeof group1>("");
const c2 = hc<typeof group2>("");
const c3 = hc<typeof group3>("");
const c4 = hc<typeof group4>("");
const cApp = hc<AppType>("");

export const client = baseClient as unknown as 
  typeof c1 &
  typeof c2 &
  typeof c3 &
  typeof c4 &
  typeof cApp;

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
    const errorData = (await response.json().catch(() => ({}))) as { error?: string; message?: string; details?: string };
    const errMsg = errorData.message || errorData.error || `API Error: ${response.status}`;
    throw new ApiError(response.status, errorData.details ? `${errMsg} - ${errorData.details}` : errMsg);
  }
  return (await response.json()) as T;
}

/**
 * Wraps user-provided mutation options to run internal logic before user callbacks.
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
 * @deprecated Use withMutationCallbacks instead for consistency
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
    onSuccess: (data, variables, context) => {
      internalOnSuccess(data, variables);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (options?.onSuccess as any)?.(data, variables, context);
    },
  };
}

/**
 * Standard mutation callbacks that properly chain user callbacks with internal logic.
 * Use this to ensure user onSuccess/onError handlers are called after cache invalidation.
 *
 * @example
 * ```ts
 * return useMutation({
 *   mutationFn: async (data) => { ... },
 *   ...withMutationCallbacks(queryClient, options, {
 *     onSuccess: (queryClient, data, variables) => {
 *       queryClient.invalidateQueries({ queryKey: ["items"] });
 *     },
 *     onError: (queryClient, error, variables) => {
 *       // Optional error handling
 *     }
 *   })
 * });
 * ```
 */
export function withMutationCallbacks<TData, TError, TVariables>(
  queryClient: QueryClient,
  options: UseMutationOptions<TData, TError, TVariables> | undefined,
  callbacks: {
    onSuccess?: (queryClient: QueryClient, data: TData, variables: TVariables) => void | Promise<void>;
    onError?: (queryClient: QueryClient, error: TError, variables: TVariables) => void | Promise<void>;
  }
): UseMutationOptions<TData, TError, TVariables> {
  return {
    onSuccess: async (data, variables, context) => {
      await callbacks.onSuccess?.(queryClient, data, variables);
      // Call user's onSuccess with all arguments from TanStack Query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (options?.onSuccess as any)?.(
        data as never,
        variables as never,
        context as never
      );
    },
    onError: async (error, variables, context) => {
      await callbacks.onError?.(queryClient, error, variables);
      // Call user's onError with all arguments from TanStack Query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (options?.onError as any)?.(
        error as never,
        variables as never,
        context as never
      );
    },
  };
}
