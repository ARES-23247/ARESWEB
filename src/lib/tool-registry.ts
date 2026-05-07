// ── Interactive Tools Registry ────────────────────────────────────────
// Central registry of all custom utility tools available in the ARESWEB platform.
// Each tool declares its routing, visibility, and access requirements.

export interface ToolDefinition {
  /** Unique tool identifier */
  id: string;
  /** Display name shown in navigation */
  name: string;
  /** Short description for tooltips/subtitles */
  description: string;
  /** Dashboard route path segment (e.g., "scouting" → /dashboard/scouting) */
  route: string;
  /** Lucide icon name (resolved at render time by the sidebar) */
  icon: string;
  /** false = dashboard sidebar (auth required), true = header dropdown (public) */
  isPublic: boolean;
  /** Required role to access: "admin" | "author" | undefined (any authenticated user) */
  requiredRole?: string;
  /** Feature flag for gradual rollout */
  enabled: boolean;
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    id: "ftc-scouting",
    name: "FTC Scout",
    description: "AI-powered FTC team analysis and match predictions",
    route: "scouting",
    icon: "Crosshair",
    isPublic: false,
    enabled: true,
  },
];

/** Get tools that require authentication (shown in dashboard sidebar) */
export function getPrivateTools(): ToolDefinition[] {
  return TOOL_REGISTRY.filter((t) => !t.isPublic && t.enabled);
}

/** Get tools available without authentication (shown in header dropdown) */
export function getPublicTools(): ToolDefinition[] {
  return TOOL_REGISTRY.filter((t) => t.isPublic && t.enabled);
}
