import { useOptionalAuth } from "@/context/AuthContext";

/**
 * Renders the shared sign-in/sign-out failure state as an alert. Placed next
 * to authentication entry points so a failed popup or network call is never
 * silently swallowed. Purely presentational: without an AuthProvider (for
 * example in isolated component tests) it renders nothing.
 */
export default function AuthErrorNotice() {
  const context = useOptionalAuth();
  if (!context) return null;
  const { authError, clearAuthError } = context;
  if (!authError) return null;

  return (
    <p
      role="alert"
      className="mt-3 border border-ares-red/40 bg-ares-red/10 p-3 text-sm text-marble"
    >
      {authError}{" "}
      <button
        type="button"
        onClick={clearAuthError}
        className="ml-1 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        Dismiss
      </button>
    </p>
  );
}
