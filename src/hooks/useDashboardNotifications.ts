// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useQuery } from "@tanstack/react-query";
import { DashboardSession, DashboardPermissions } from "./useDashboardSession";
import { api } from "../api/client";

export function useDashboardNotifications(
  _session: DashboardSession | null,
  _permissions: DashboardPermissions
) {
  const { data: actionItemsRes } = api.notifications.getDashboardActionItems.useQuery(
    ["admin", "action-items"],
    {}, 
    {
      // Remove dependency on session/permissions to fix waterfall.
      // The browser sends cookies immediately, and the server will return 401 if unauthorized.
      refetchInterval: 60000,
      staleTime: 1000 * 30,
    }
  );

  const data = actionItemsRes?.status === 200 ? actionItemsRes.body : { inquiries: [], posts: [], events: [], docs: [] };

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
