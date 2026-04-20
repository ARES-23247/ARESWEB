import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard utility for merging Tailwind CSS classes with conditional logic.
 * 
 * This is the standard implementation using 'clsx' and 'tailwind-merge' 
 * to handle class conflicts appropriately.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
