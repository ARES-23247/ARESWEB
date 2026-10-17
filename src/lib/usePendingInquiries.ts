import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";

export const PENDING_INQUIRIES_QUERY_KEY = ["pending-inquiries"] as const;

/** Share the boolean-only queue status across navigation and dashboard badges. */
export function usePendingInquiries() {
  const { user, authorizedUser } = useAuth();
  const role = authorizedUser?.role;
  const enabled = !!user?.uid && (role === "admin" || role === "coach");
  const query = useQuery({
    queryKey: [...PENDING_INQUIRIES_QUERY_KEY, user?.uid, role],
    enabled,
    queryFn: async ({ signal }) => {
      const response = await authenticatedFetch("/api/inquiries/pending-exists", { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText || "Request failed"}`);
      }
      const payload = (await response.json()) as { hasPending?: unknown };
      if (typeof payload.hasPending !== "boolean") {
        throw new Error("Invalid pending inquiry response");
      }
      return payload.hasPending;
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  return {
    hasPendingInquiries: enabled && !query.isError && query.data === true,
    inquiriesState: !enabled ? "idle" as const
      : query.isError ? "error" as const
        : query.isPending ? "loading" as const : "connected" as const,
    error: enabled ? query.error : null,
  };
}
