import { hc } from "hono/client";
import type { ClientResponse } from "hono/client";
import type { AppType } from "../../functions/api/[[route]]";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

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
export const client: any = // eslint-disable-line @typescript-eslint/no-explicit-any
  hc<AppType>("/api", {
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
    onSuccess: (data, variables) => {
      internalOnSuccess(data, variables);
      const userOnSuccess = options.onSuccess as ((data: TData, variables: TVariables, context: unknown) => void) | undefined;
      userOnSuccess?.(data, variables, undefined);
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
    onSuccess: async (...args) => {
      const [data, variables, context] = args as unknown as [TData, TVariables, unknown];
      await callbacks.onSuccess?.(queryClient, data, variables);
      // Call user's onSuccess with all arguments from TanStack Query
      await options?.onSuccess?.(
        data as never,
        variables as never,
        context,
        args[3] as never
      );
    },
    onError: async (...args) => {
      const [error, variables, context] = args as unknown as [TError, TVariables, unknown];
      await callbacks.onError?.(queryClient, error, variables);
      // Call user's onError with all arguments from TanStack Query
      await options?.onError?.(
        error as never,
        variables as never,
        context,
        args[3] as never
      );
    },
  };
}
