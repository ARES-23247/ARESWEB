/**
 * Centralized storage keys for localStorage and sessionStorage.
 * Prevents typos and provides single source of truth for key names.
 *
 * SEC-STORAGE: Security Considerations for Web Storage
 *
 * localStorage:
 * - Persists indefinitely across sessions
 * - Accessible by any JavaScript on the same domain
 * - Vulnerable to XSS attacks (any script can read/write)
 * - NEVER store: auth tokens, passwords, API keys, sensitive personal data
 * - OK to store: UI preferences, non-sensitive progress data, cached non-sensitive info
 *
 * sessionStorage:
 * - Cleared when browser tab/window closes
 * - Still accessible by any JavaScript on the same domain (XSS risk remains)
 * - Slightly better for auth-like data due to automatic cleanup
 * - Still requires server-side validation for any security decisions
 *
 * General Rules:
 * 1. Always assume stored data can be read/modified by malicious scripts
 * 2. Never make security decisions based solely on stored data
 * 3. Validate all stored data server-side before using it for auth/authorization
 * 4. Consider security implications before adding new storage keys
 */

export const STORAGE_KEYS = {
  // Judges Hub
  JUDGE_CODE: "ares_judge_code",

  // RAG Chatbot
  RAG_SESSION: "ares_rag_session",

  // Tutorial progress (dynamic key)
  TUTORIAL_PROGRESS: (title: string) => `tutorial-${title}-progress`,

  // Simulation Playground chat
  SIM_CHAT_PREFIX: "sim_chat_v2_",

  // Error boundary reload tracking
  ERROR_BOUNDARY_RELOAD: (componentName: string) =>
    `ares_error_reload_${componentName}`,

  // Simulation playground storage
  SIM_STORAGE_PREFIX: "sim_chat_v2_",
} as const;

// Helper function for building full storage keys
export function getSimChatKey(simId: string | null): string {
  return `${STORAGE_KEYS.SIM_STORAGE_PREFIX}${simId || 'new'}`;
}
