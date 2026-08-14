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

/**
 * Global Express error handling middleware to catch bubbled exceptions and return clean JSON responses.
 */
export const globalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log the full stack trace on the server for diagnostics
  const error = err instanceof Error ? err : new Error("Unknown thrown value");
  logger.error("errorHandler", "[Global Error Handler] Caught Exception:", {
    path: req.path,
    method: req.method,
    error,
  });

  const isApiError = err instanceof ApiError;
  const status = isApiError ? err.status : 500;
  const message = isApiError ? err.message : "Internal server error.";
  const code = isApiError ? err.code || `HTTP_${status}` : "INTERNAL_ERROR";

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
