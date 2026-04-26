import { useEffect, useRef, useCallback } from "react";
import { siteConfig } from "../site.config";

// Extend Window type for Turnstile API
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback"?: () => void;
        "error-callback"?: () => void;
        theme?: "light" | "dark" | "auto";
        size?: "normal" | "compact";
        appearance?: "always" | "execute" | "interaction-only";
      }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    ARES_E2E_BYPASS?: boolean;
  }
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
  className?: string;
}

/**
 * Cloudflare Turnstile widget — invisible CAPTCHA alternative.
 * Renders the challenge and calls `onVerify` with a token when solved.
 * Pass the token to your API as `turnstileToken` in the request body.
 *
 * Usage:
 * ```tsx
 * const [turnstileToken, setTurnstileToken] = useState("");
 * <Turnstile onVerify={setTurnstileToken} theme="dark" />
 * ```
 */
export default function Turnstile({ onVerify, onExpire, theme = "dark", size = "normal", className }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

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
    });
  }, [onVerify, onExpire, theme, size]);

  useEffect(() => {
    // SEC-03: Bypass Turnstile for E2E tests and local development
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const hasBypass = window.ARES_E2E_BYPASS;
    if (isLocal || hasBypass) {
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
}
