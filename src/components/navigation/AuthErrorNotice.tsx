import { useOptionalAuth } from "@/context/AuthContext";

/**
 * Renders the shared sign-in/sign-out failure state as an alert. Placed next
 * in the shared page shell so signed-in and signed-out failures stay visible.
 * Purely presentational: without an AuthProvider (for
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
      className="mx-auto my-3 max-w-3xl border border-ares-red/40 bg-obsidian p-3 text-sm text-marble"
    >
      {authError}{" "}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-11 items-center px-2 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        Reload sign-in
      </button>{" "}
      <button
        type="button"
        onClick={clearAuthError}
        className="inline-flex min-h-11 items-center px-2 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        Dismiss
      </button>
    </p>
  );
}
