import { TeamLocation } from "@/types/location";

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
  branch: (import.meta.env.VITE_GITHUB_BRANCH as string) || 'master',
  apiUrl: `https://api.github.com/repos/${(import.meta.env.VITE_GITHUB_REPO_OWNER as string) || 'ARES-23247'}/${(import.meta.env.VITE_GITHUB_REPO_NAME as string) || 'ARESWEB'}`,
  rawUrl: `https://raw.githubusercontent.com/${(import.meta.env.VITE_GITHUB_REPO_OWNER as string) || 'ARES-23247'}/${(import.meta.env.VITE_GITHUB_REPO_NAME as string) || 'ARESWEB'}/${(import.meta.env.VITE_GITHUB_BRANCH as string) || 'master'}`,
} as const;

export const MOCK_LOCATIONS: TeamLocation[] = [
  {
    id: "mars-building",
    name: "MARS Building",
    address: "123 Science Way, Morgantown, WV 26508",
    description: "Our primary design workshop, machining center, and practice arena.",
    gmapsUrl: "https://maps.google.com/?q=123+Science+Way+Morgantown+WV+26508"
  },
  {
    id: "ares-shop",
    name: "ARES Machine Shop",
    address: "456 Tech Lane, Morgantown, WV 26505",
    description: "CNC fabrication, 3D printing farm, and anodizing workshop.",
    gmapsUrl: "https://maps.google.com/?q=456+Tech+Lane+Morgantown+WV+26505"
  },
  {
    id: "spark-museum",
    name: "SPARK! WV Museum",
    address: "9500 Mall Road, Morgantown, WV 26501",
    description: "Community science museum where we host outreach events and demo days.",
    gmapsUrl: "https://maps.google.com/?q=Morgantown+Mall+WV+26501"
  }
];

