import { Request, Response, NextFunction } from "express";

/**
 * Express wrapper helper to automatically catch promise rejections and forward them to the global error middleware.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => (req: Request, res: Response, next: NextFunction) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Masks name by keeping only the first and last character.
 */
export function maskName(name: string): string {
  const nameVal = name.trim();
  if (nameVal.length <= 2) return nameVal;
  return nameVal.charAt(0) + "***" + nameVal.charAt(nameVal.length - 1);
}

/**
 * Masks email address by keeping the first character of the username and the domain.
 */
export function maskEmail(email: string): string {
  const emailVal = email.trim().toLowerCase();
  const emailParts = emailVal.split("@");
  if (emailParts.length !== 2) return emailVal;
  return emailParts[0].charAt(0) + "***@" + emailParts[1];
}

