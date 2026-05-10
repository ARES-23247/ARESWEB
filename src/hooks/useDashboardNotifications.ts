import { useQuery } from "@tanstack/react-query";
import { DashboardSession, DashboardPermissions } from "./useDashboardSession";

// Named constants for notification polling intervals
const NOTIFICATIONS_REFETCH_INTERVAL_MS = 60000; // 1 minute - how often to refetch from server
const NOTIFICATIONS_STALE_TIME_MS = 30000; // 30 seconds - how long to consider data fresh

export function useDashboardNotifications(
  _session: DashboardSession | null,
  _permissions: DashboardPermissions
) {
  const { data: actionItemsRes } = useQuery({
    queryKey: ["admin", "action-items"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/action-items");
      if (!res.ok) throw new Error("Failed to fetch");
      return { status: res.status, body: await res.json() };
    },
    refetchInterval: NOTIFICATIONS_REFETCH_INTERVAL_MS,
    staleTime: NOTIFICATIONS_STALE_TIME_MS,
  });

  const data = actionItemsRes?.status === 200 ? actionItemsRes.body as { 
    inquiries?: { id: string | number; type?: string; name?: string }[], 
    posts?: { slug: string; title: string; authorNickname?: string }[], 
    events?: { id: string | number; title: string }[], 
    docs?: { slug: string; title: string }[] 
  } : { inquiries: [], posts: [], events: [], docs: [] };

  const pendingInquiries = data.inquiries || [];
  const pendingPosts = data.posts || [];
  const pendingEvents = data.events || [];
  const pendingDocs = data.docs || [];

  return {
    pendingInquiriesCount: pendingInquiries.length,
    pendingPostsCount: pendingPosts.length,
    pendingEventsCount: pendingEvents.length,
    pendingDocsCount: pendingDocs.length,
    pendingInquiries,
    pendingPosts,
    pendingEvents,
    pendingDocs,
  };
}

