import { useQuery } from "@tanstack/react-query";
import { DashboardSession, DashboardPermissions } from "./useDashboardSession";

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
    refetchInterval: 60000,
    staleTime: 1000 * 30,
  });

  const data = actionItemsRes?.status === 200 ? actionItemsRes.body as { 
    inquiries?: { id: string | number; type?: string; name?: string }[], 
    posts?: { slug: string; title: string; author_nickname?: string }[], 
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
