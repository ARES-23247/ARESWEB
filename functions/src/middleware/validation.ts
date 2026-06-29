import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ApiError } from "./errorHandler";

/**
 * Express middleware to validate request bodies against a Zod schema.
 * Replaces req.body with the parsed/validated value to strip unvalidated properties
 * and bubbles validation failures as an ApiError (HTTP 400).
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map(err => {
          const path = err.path.join(".");
          return path ? `${path}: ${err.message}` : err.message;
        }).join(", ");
        next(new ApiError(400, `Validation failed: ${issues}`));
      } else {
        next(error);
      }
    }
  };
}
