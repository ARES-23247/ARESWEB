import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

/**
 * Standardized API Error class to propagate specific HTTP status codes and custom messages.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Global Express error handling middleware to catch bubbled exceptions and return clean JSON responses.
 */
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the full stack trace on the server for diagnostics
  logger.error("errorHandler", "[Global Error Handler] Caught Exception:", err);

  const status = err.status || 500;
  const message = err.message || "Internal server error.";

  res.status(status).json({
    error: message
  });
};
