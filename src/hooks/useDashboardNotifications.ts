// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useQuery } from "@tanstack/react-query";
import { DashboardSession, DashboardPermissions } from "./useDashboardSession";
import { api } from "../api/client";

export function useDashboardNotifications(
  session: DashboardSession | null,
  permissions: DashboardPermissions
) {
  const { data: inquiriesRes } = api.inquiries.list.useQuery(
    ["admin", "inquiries", "notifs"],
    { query: {} }, 
    {
      enabled: !!(session && permissions.canSeeInquiries),
      refetchInterval: 30000,
    }
  );

  const { data: postsRes } = api.posts.getAdminPosts.useQuery(
    ["admin", "posts", "notifs"],
    { query: {} }, 
    {
      enabled: !!(session && permissions.isAuthorized),
      refetchInterval: 30000,
    }
  );

  const { data: eventsRes } = api.events.getAdminEvents.useQuery(
    ["admin", "events", "notifs"],
    { query: {} }, 
    {
      enabled: !!(session && permissions.isAuthorized),
      refetchInterval: 30000,
    }
  );

  const { data: docsRes } = api.docs.adminList.useQuery(
    ["admin", "docs", "notifs"],
    { query: {} }, 
    {
      enabled: !!(session && permissions.isAuthorized),
      refetchInterval: 30000,
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inquiriesData = (inquiriesRes?.body as any)?.inquiries || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postsData = (postsRes?.body as any)?.posts || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventsData = (eventsRes?.body as any)?.events || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docsData = (docsRes?.body as any)?.docs || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingInquiries = inquiriesData?.filter((i: any) => i.status === "pending") || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingPosts = postsData?.filter((p: any) => p.status === "pending" && !p.is_deleted) || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingEvents = eventsData?.filter((e: any) => e.status === "pending" && !e.is_deleted) || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingDocs = docsData?.filter((d: any) => d.status === "pending" && !d.is_deleted) || [];

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
