/**
 * API Barrel Export
 *
 * Centralized exports for all domain-specific API modules.
 * Types are imported from backend route definitions (@shared/routes/*).
 *
 * Migration from ts-rest to Hono + Zod + OpenAPI
 */

// Store
export * from "./store";

// Events
export * from "./events";

// Sponsors
export * from "./sponsors";

// Profiles
export * from "./profiles";

// Posts
export * from "./posts";

// Analytics
export * from "./analytics";

// Docs
export * from "./docs";

// Seasons
export * from "./seasons";

// Awards
export * from "./awards";

// Points
export * from "./points";

// Tasks
export * from "./tasks";

// Social Queue
export * from "./socialQueue";

// Finance
export * from "./finance";

// Inquiries
export * from "./inquiries";

// Judges
export * from "./judges";

// Outreach
export * from "./outreach";

// Media
export * from "./media";

// Settings
export * from "./settings";

// Users
export * from "./users";

// Zulip
export * from "./zulip";

// Locations
export * from "./locations";

// Badges
export * from "./badges";

// TBA
export * from "./tba";

// GitHub
export * from "./github";

// Communications
export * from "./communications";

// Galleries
export * from "./galleries";

// Videos
export * from "./videos";

// Re-export utilities and legacy client for backward compatibility
export { uploadFile, fetchBlob, fetchJson } from "../utils/apiClient";

// Re-export shared client for direct use if needed
export { client, unwrapResponse, ApiError } from "./honoClient";
