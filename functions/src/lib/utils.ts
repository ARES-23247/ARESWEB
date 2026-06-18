import { Request, Response, NextFunction } from "express";

/**
 * Express wrapper helper to automatically catch promise rejections and forward them to the global error middleware.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
