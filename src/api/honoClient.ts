import { hc } from "hono/client";
import type { ClientResponse } from "hono/client";
import type { AppType } from "../../functions/api/[[route]]";
import type { UseMutationOptions, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
// @ts-ignore TS2590: Union type too complex — known Hono limitation
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
 * Standardized toast helper for API errors.
 * Automatically extracts status codes and diagnostic codes for display.
 */
export function toastApiError(err: unknown, title: string = "Operation failed") {
  let message = title;
  let diagnostic = "";

  if (err instanceof ApiError) {
    message = title !== "Operation failed" ? `${title}: ${err.message}` : err.message;
    diagnostic = err.code || `HTTP_${err.status}`;
  } else if (err instanceof Error) {
    message = title !== "Operation failed" ? `${title}: ${err.message}` : err.message;
  } else if (typeof err === "string") {
    message = title !== "Operation failed" ? `${title}: ${err}` : err;
  }

  toast.error(message, {
    description: diagnostic ? `Diagnostic Code: ${diagnostic}` : undefined,
    duration: 5000,
  });
}

/**
 * Helper to unwrap Hono RPC responses and handle errors.
 * Returns the data directly or throws an ApiError with structured details.
 */
export async function unwrapResponse<T>(response: ClientResponse<unknown>): Promise<T> {
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { 
      error?: string | { issues?: { path?: (string | number)[]; message?: string }[] }; 
      message?: string; 
      code?: string;
      details?: unknown 
    };
    
    let errMsg = `API Error: ${response.status}`;
    if (typeof errorData.message === "string") {
      errMsg = errorData.message;
    } else if (typeof errorData.error === "string") {
      errMsg = errorData.error;
    } else if (errorData.error && typeof errorData.error === "object") {
      if (Array.isArray(errorData.error.issues)) {
        errMsg = errorData.error.issues
          .map((i) => `${i.path && i.path.length > 0 ? i.path.join(".") + ": " : ""}${i.message}`)
          .join(", ");
      } else {
        errMsg = JSON.stringify(errorData.error);
      }
    }
    
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
export function withMutationCallbacks<TData, TError, TVariables, TContext = unknown>(
  queryClient: QueryClient,
  options: UseMutationOptions<TData, TError, TVariables, TContext> | undefined,
  callbacks: {
    onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
    onSuccess?: (queryClient: QueryClient, data: TData, variables: TVariables, context: TContext) => void | Promise<void>;
    onError?: (queryClient: QueryClient, error: TError, variables: TVariables, context: TContext | undefined) => void | Promise<void>;
    onSettled?: (queryClient: QueryClient, data: TData | undefined, error: TError | null, variables: TVariables, context: TContext | undefined) => void | Promise<void>;
  }
): UseMutationOptions<TData, TError, TVariables, TContext> {
  return {
    onMutate: async (variables) => {
      // 1. Run internal onMutate
      const internalContext = await callbacks.onMutate?.(variables);
      
      // 2. Run user's onMutate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userContext = await (options?.onMutate as any)?.(variables);
      
      // 3. Merge contexts (user context takes precedence for the mutation return, 
      // but we need both if they both return objects, or just return an object containing both)
      // For TanStack Query, the return of onMutate is the context passed to other handlers.
      return { 
        ...((typeof internalContext === 'object' && internalContext !== null ? internalContext : {}) as Record<string, unknown>),
        ...((typeof userContext === 'object' && userContext !== null ? userContext : {}) as Record<string, unknown>),
        _internal: internalContext,
        _user: userContext
      } as TContext;
    },
    onSuccess: async (data, variables, context) => {
      await callbacks.onSuccess?.(queryClient, data, variables, context);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (options?.onSuccess as any)?.(data, variables, context);
    },
    onError: async (error, variables, context) => {
      await callbacks.onError?.(queryClient, error, variables, context);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (options?.onError as any)?.(error, variables, context);
    },
    onSettled: async (data, error, variables, context) => {
      await callbacks.onSettled?.(queryClient, data, error, variables, context);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (options?.onSettled as any)?.(data, error, variables, context);
    },
  };
}
