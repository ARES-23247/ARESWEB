import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, X } from "lucide-react";

/**
 * Standardized error display component for consistent error messaging across the app.
 * Addresses IN-03: Inconsistent Error Message Display.
 *
 * Features:
 * - Consistent styling and animation
 * - Optional dismiss functionality
 * - Support for both inline and toast-style display
 * - Accessible ARIA labels
 */

interface ErrorDisplayProps {
  /** The error message to display */
  message: string;
  /** Optional error title for additional context */
  title?: string;
  /** Whether the error can be dismissed by user */
  dismissible?: boolean;
  /** Callback when error is dismissed */
  onDismiss?: () => void;
  /** Visual variant */
  variant?: "inline" | "toast" | "banner";
  /** Additional CSS classes */
  className?: string;
}

export function ErrorDisplay({
  message,
  title,
  dismissible = false,
  onDismiss,
  variant = "inline",
  className = "",
}: ErrorDisplayProps) {
  const baseStyles = "border-l-4 bg-opacity-10";

  const variantStyles = {
    inline: "border-ares-red bg-ares-red rounded-lg p-4",
    toast: "border-ares-red bg-ares-red rounded-lg p-3 shadow-lg",
    banner: "border-ares-red bg-ares-red py-3 px-4",
  };

  if (variant === "toast" && dismissible) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`${baseStyles} ${variantStyles[variant]} ${className}`}
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="text-ares-red shrink-0 mt-0.5" size={18} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              {title && <p className="font-bold text-ares-red text-sm mb-1">{title}</p>}
              <p className="text-sm text-ares-red">{message}</p>
            </div>
            {dismissible && onDismiss && (
              <button
                onClick={onDismiss}
                className="shrink-0 text-ares-red hover:text-ares-red/70 transition-colors p-0.5 rounded"
                aria-label="Dismiss error"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="text-ares-red shrink-0 mt-0.5" size={18} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          {title && <p className="font-bold text-ares-red text-sm mb-1">{title}</p>}
          <p className="text-sm text-ares-red">{message}</p>
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 text-ares-red hover:text-ares-red/70 transition-colors p-0.5 rounded"
            aria-label="Dismiss error"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Simple inline error variant for form fields and compact spaces
 */
interface InlineErrorProps {
  message: string;
  className?: string;
}

export function InlineError({ message, className = "" }: InlineErrorProps) {
  return (
    <span
      className={`text-xs text-ares-red font-medium flex items-center gap-1 mt-1 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle size={12} aria-hidden="true" />
      {message}
    </span>
  );
}
