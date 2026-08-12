export function getLocalFirebaseEmulatorHost(): string | null {
  if (typeof window === "undefined") return null;

  const useEmulator =
    import.meta.env.VITE_USE_EMULATOR !== "false" &&
    import.meta.env.NEXT_PUBLIC_USE_EMULATOR !== "false";
  if (!useEmulator) return null;

  const host = window.location.hostname;
  const isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.endsWith(".local");

  if (!isLocalHost) return null;
  return host === "localhost" || host === "127.0.0.1" || !host ? "127.0.0.1" : host;
}
