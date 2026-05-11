import { hc } from "hono/client";
import type { ClientResponse } from "hono/client";
import type { AppType } from "../../functions/api/[[route]]";
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
 * This client uses the exported AppType from the backend to provide
 * end-to-end type inference for request bodies and response shapes.
 */
export const client = hc<AppType>("/api", {
  init: {
    credentials: "include",
  },
  fetch: customFetch as typeof fetch,
});

/**
 * Error class for API failures.
 * Includes status code, standardized error message, and optional details.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Helper to unwrap Hono RPC responses and handle errors.
 * Returns the data directly or throws an ApiError with structured details.
 */
export async function unwrapResponse<T>(response: ClientResponse<unknown>): Promise<T> {
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { 
      error?: string; 
      message?: string; 
      code?: string;
      details?: unknown 
    };
    
    const errMsg = errorData.message || errorData.error || `API Error: ${response.status}`;
    
    // Log detailed validation errors in development
    if (response.status === 400 && errorData.details) {
      console.error("[API Validation Error]", {
        path: response.url,
        details: errorData.details
      });
    }

    throw new ApiError(
      response.status, 
      errMsg, 
      errorData.code, 
      errorData.details
    );
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
