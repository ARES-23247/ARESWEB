import { toast } from "sonner";

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
  } else if (err && typeof err === "object" && "message" in err) {
    const errorWithMsg = err as { message: string; code?: string; status?: number };
    message = title !== "Operation failed" ? `${title}: ${errorWithMsg.message}` : errorWithMsg.message;
    diagnostic = errorWithMsg.code || (errorWithMsg.status ? `HTTP_${errorWithMsg.status}` : "");
  } else if (typeof err === "string") {
    message = title !== "Operation failed" ? `${title}: ${err}` : err;
  }

  toast.error(message, {
    description: diagnostic ? `Diagnostic Code: ${diagnostic}` : undefined,
    duration: 5000,
  });
}
