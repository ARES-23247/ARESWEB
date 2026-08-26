import { adminDb } from "./firebase-admin";
import { ApiError } from "../middleware/errorHandler";

const CONTROL_CACHE_MS = 15_000;
let cached: { enabled: boolean; expiresAt: number } | null = null;

/**
 * Reversible AI-only circuit breaker. The environment override is suitable for
 * an emergency redeploy; the server-only Firestore setting supports a faster
 * operational switch without exposing configuration to browser SDKs.
 */
export async function isAiGenerationEnabled(): Promise<boolean> {
  if (process.env.AI_GENERATION_DISABLED === "true") return false;
  if (cached && cached.expiresAt > Date.now()) return cached.enabled;

  try {
    const snapshot = await adminDb.collection("system_settings").doc("ai_generation").get();
    const enabled = !snapshot.exists || snapshot.data()?.enabled !== false;
    cached = { enabled, expiresAt: Date.now() + CONTROL_CACHE_MS };
    return enabled;
  } catch {
    // The cost-control plane fails closed while every non-AI site feature stays
    // available through its independent route group.
    throw new ApiError(503, "AI generation is temporarily unavailable.", "AI_CONTROL_UNAVAILABLE");
  }
}

export async function requireAiGenerationEnabled(): Promise<void> {
  if (!await isAiGenerationEnabled()) {
    throw new ApiError(503, "AI generation is temporarily disabled.", "AI_GENERATION_DISABLED");
  }
}

/** Test seam for deterministic control-state behavior. */
export function resetAiControlCache(): void {
  cached = null;
}
