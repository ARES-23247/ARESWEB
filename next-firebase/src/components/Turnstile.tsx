import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { siteConfig } from "@/lib/site-config";

/**
 * Turnstile CAPTCHA Component
 *
 * SECURITY NOTE (IN-08): The Turnstile site key is intentionally exposed in client-side code.
 * This is expected behavior for Turnstile - the site key is public by design and must be
 * included in the client bundle. Security is enforced server-side through:
 * 1. Secret key verification on the backend (never exposed to client)
 * 2. Token validation with Cloudflare APIs
 * 3. Site key rotation via environment-specific configuration
 *
 * For environment-specific keys, configure via VITE_TURNSTLE_SITE_KEY env var.
 */

// Extend Window type for E2E tests
declare global {
  interface TurnstileWidget {
    reset: (widgetId: string) => void;
    render: (element: string | HTMLElement, options: Record<string, unknown>) => string;
    remove: (widgetId: string) => void;
  }

  interface Window {
    ARES_E2E_BYPASS?: boolean;
    turnstile?: TurnstileWidget;
  }
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
  className?: string;
}

export interface TurnstileRef {
  reset: () => void;
}

/**
 * Cloudflare Turnstile widget — invisible CAPTCHA alternative.
 * Renders the challenge and calls `onVerify` with a token when solved.
 * Pass the token to your API as `turnstileToken` in the request body.
 *
 * Usage:
 * ```tsx
 * const [turnstileToken, setTurnstileToken] = useState("");
 * const turnstileRef = useRef<TurnstileRef>(null);
 * <Turnstile ref={turnstileRef} onVerify={setTurnstileToken} theme="dark" />
 * ```
 */
const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(({ onVerify, onExpire, theme = "dark", size = "normal", className }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      } else {
        // If bypassed, fire again
        const isDev = import.meta.env.DEV;
        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        if ((isLocal && isDev) || window.ARES_E2E_BYPASS) {
          setTimeout(() => onVerify("test-bypass-token"), 200);
        }
      }
    }
  }));

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteConfig.turnstile.siteKey,
      callback: (token: string) => {
        onVerify(token);
      },
      "expired-callback": () => {
        onVerify("");
        onExpire?.();
      },
      "error-callback": () => {
        onVerify("");
      },
      theme,
      size,
      appearance: "always",
    }) as string | null;
  }, [onVerify, onExpire, theme, size]);

  useEffect(() => {
    // SEC-WR-07: Bypass Turnstile for E2E tests and local development only
    // Check both hostname AND development environment to prevent bypass in production
    const isDev = import.meta.env.DEV;
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const hasBypass = window.ARES_E2E_BYPASS;

    // Only allow bypass if we're in development mode AND on localhost OR explicit E2E bypass
    if ((isLocal && isDev) || hasBypass) {
      setTimeout(() => onVerify("test-bypass-token"), 200);
      return;
    }

    // If turnstile is already loaded, render immediately
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Otherwise poll until it's available (script loads async)
    const interval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(interval);
        renderWidget();
      }
    }, 200);

    return () => {
      clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget, onVerify]);

  return <div ref={containerRef} className={className} />;
});

Turnstile.displayName = "Turnstile";

export default Turnstile;
