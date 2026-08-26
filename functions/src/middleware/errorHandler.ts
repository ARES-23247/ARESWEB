import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

/**
 * Standardized API Error class to propagate specific HTTP status codes and custom messages.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** Keep diagnostic routing useful without retaining concrete user/record IDs. */
export function diagnosticRouteGroup(path: unknown): string {
  if (typeof path !== "string") return "/";
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  return `/${segments.slice(0, segments[0] === "api" ? 2 : 1).join("/")}`;
}

/**
 * Global Express error handling middleware to catch bubbled exceptions and return clean JSON responses.
 */
export const globalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const error = err instanceof Error ? err : new Error("Unknown thrown value");
  const isApiError = err instanceof ApiError;
  const status = isApiError ? err.status : 500;
  const message = isApiError ? err.message : "Internal server error.";
  const code = isApiError ? err.code || `HTTP_${status}` : "INTERNAL_ERROR";
  const securityEvent = status === 401 || status === 403
    ? "access_denied"
    : status === 429
      ? "rate_limited"
      : status >= 500
        ? "server_error"
        : "request_rejected";
  const logData = {
    routeGroup: diagnosticRouteGroup(req.path),
    method: req.method,
    status,
    errorCode: code,
    securityEvent,
    error,
  };
  if (status >= 500) logger.error("errorHandler", "Request failed", logData);
  else logger.warn("errorHandler", "Request rejected", logData);

  // A streaming response may already have sent image headers or body bytes.
  // Do not append a JSON error payload to a partial binary response; terminate
  // the connection and let the client retry the bounded media request.
  if (res.headersSent) {
    res.destroy(error);
    return;
  }

  res.status(status).json({
    error: message,
    code,
  });
};
