/**
 * Logger utility that disables debug output in production.
 * Prevents leaking debugging information in production builds.
 *
 * SAFETY: Uses optional chaining for browser production build compatibility.
 */
const isDev = import.meta.env?.DEV ?? false;
const browserConsole = globalThis.console;

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (isDev) {
      browserConsole.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  info: (message: string, ...args: unknown[]) => {
    if (isDev) {
      browserConsole.info(`[INFO] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: unknown[]) => {
    if (isDev) {
      browserConsole.warn(`[WARN] ${message}`, ...args);
    }
  },

  error: (message: string, ...args: unknown[]) => {
    // Errors are always logged but without sensitive details in production
    if (isDev) {
      browserConsole.error(`[ERROR] ${message}`, ...args);
    } else {
      browserConsole.error(`[ERROR] ${message}`);
    }
  }
};
