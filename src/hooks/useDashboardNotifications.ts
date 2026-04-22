import { useQuery } from "@tanstack/react-query";
import { DashboardSession, DashboardPermissions } from "./useDashboardSession";
import { adminApi } from "../api/adminApi";

export function useDashboardNotifications(
  session: DashboardSession | null,
  permissions: DashboardPermissions
) {
  const { data: inquiriesData } = useQuery({
    queryKey: ["admin-inquiries"],
    queryFn: async () => {
      const d = await adminApi.get<{ inquiries?: { status: string }[] }>("/api/inquiries");
      return d.inquiries || [];
    },
    enabled: !!(session && permissions.canSeeInquiries),
  });

  const { data: postsData } = useQuery({
    queryKey: ["admin_posts"],
    queryFn: async () => {
      const d = await adminApi.get<{ posts?: { status: string }[] }>("/api/admin/posts/list");
      return d.posts || [];
    },
    enabled: !!(session && permissions.isAuthorized),
  });

  const { data: eventsData } = useQuery({
    queryKey: ["admin_events"],
    queryFn: async () => {
      const d = await adminApi.get<{ events?: { status: string }[] }>("/api/admin/events");
      return d.events || [];
    },
    enabled: !!(session && permissions.isAuthorized),
  });

  const { data: docsData } = useQuery({
    queryKey: ["admin_docs"],
    queryFn: async () => {
      const d = await adminApi.get<{ docs?: { status: string }[] }>("/api/admin/docs/list");
      return d.docs || [];
    },
    enabled: !!(session && permissions.isAuthorized),
  });

  const pendingInquiriesCount = inquiriesData?.filter((i) => i.status === "pending").length || 0;
  const pendingPostsCount = postsData?.filter((p) => p.status === "pending").length || 0;
  const pendingEventsCount = eventsData?.filter((e) => e.status === "pending").length || 0;
  const pendingDocsCount = docsData?.filter((d) => d.status === "pending").length || 0;

  return {
    pendingInquiriesCount,
    pendingPostsCount,
    pendingEventsCount,
    pendingDocsCount,
  };
}
