/**
 * Shared constants for ARESWEB frontend.
 */

/**
 * Default fallback image used when a blog post, event, or doc has no cover image.
 * Configured via VITE_DEFAULT_coverImage environment variable, or falls back to
 * the ARES favicon via the media API.
 */
export const DEFAULT_coverImage = (import.meta.env.VITE_DEFAULT_coverImage as string) || "/api/media/1776551060548-favicon.webp";

/**
 * GitHub repository configuration for ARES simulations.
 * Centralized to avoid hardcoded references throughout the codebase.
 */
export const GITHUB_REPO = {
  owner: (import.meta.env.VITE_GITHUB_REPO_OWNER as string) || 'ARES-23247',
  repo: (import.meta.env.VITE_GITHUB_REPO_NAME as string) || 'ARESWEB',
  branch: (import.meta.env.VITE_GITHUB_BRANCH as string) || 'main',
  apiUrl: `https://api.github.com/repos/${(import.meta.env.VITE_GITHUB_REPO_OWNER as string) || 'ARES-23247'}/${(import.meta.env.VITE_GITHUB_REPO_NAME as string) || 'ARESWEB'}`,
  rawUrl: `https://raw.githubusercontent.com/${(import.meta.env.VITE_GITHUB_REPO_OWNER as string) || 'ARES-23247'}/${(import.meta.env.VITE_GITHUB_REPO_NAME as string) || 'ARESWEB'}/${(import.meta.env.VITE_GITHUB_BRANCH as string) || 'main'}`,
} as const;

