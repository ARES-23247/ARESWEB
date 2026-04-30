/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { api } from "../api/client";
import { useDashboardNotifications } from "./useDashboardNotifications";
import { DashboardSession, DashboardPermissions } from "./useDashboardSession";

export interface MergedNotification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  link?: string;
  is_inquiry?: boolean;
}

export function useMergedNotifications(
  session: DashboardSession | null,
  permissions: DashboardPermissions
) {
  const isSignedIn = !!(session && session.authenticated);

  const { pendingInquiries, pendingPosts, pendingEvents, pendingDocs } = 
    useDashboardNotifications(session, permissions);

  const { data: notifRes } = api.notifications.getNotifications.useQuery(["notifications"], {}, {
    enabled: isSignedIn,
    refetchInterval: 30000 
  });

  const notifications = useMemo(() => {
    const rawNotifications = (notifRes?.body as any)?.notifications || [];
    
    // Filter out redundant DB notifications that duplicate our synthetic sticky action items
    // and filter out read notifications so they don't persist in the notification bar
    const filteredRawNotifications = rawNotifications.filter((n: any) => {
      if (n.is_read) return false;
      
      const t = n.title || "";
      return !(t.includes("Inquiry") && t.startsWith("New ")) &&
             !(t === "📝 Pending Blog Post") &&
             !(t === "📝 Pending Document" || t === "📝 Doc Revision Pending");
    });

    return [
      ...filteredRawNotifications,
      ...pendingInquiries.map((i: any) => ({
        id: `inquiry-${i.id}`,
        title: `New ${i.type === 'support' ? 'Support' : i.type === 'outreach' ? 'Outreach' : i.type === 'sponsor' ? 'Sponsor' : 'Inquiry'} Request`,
        message: `From ${i.name}`,
        is_read: false,
        link: '/dashboard/inquiries',
        is_inquiry: true
      })),
      ...pendingPosts.map((p: any) => ({
        id: `post-${p.slug}`,
        title: `New Pending Post`,
        message: `"${p.title}" by ${p.author_nickname || 'Student'}`,
        is_read: false,
        link: '/dashboard/manage_blog',
        is_inquiry: true // Treat as action item (cannot be marked read)
      })),
      ...pendingEvents.map((e: any) => ({
        id: `event-${e.id}`,
        title: `New Pending Event`,
        message: `"${e.title}"`,
        is_read: false,
        link: '/dashboard/manage_event',
        is_inquiry: true
      })),
      ...pendingDocs.map((d: any) => ({
        id: `doc-${d.slug}`,
        title: `New Pending Doc`,
        message: `"${d.title}"`,
        is_read: false,
        link: '/dashboard/manage_docs',
        is_inquiry: true
      }))
    ];
  }, [notifRes, pendingInquiries, pendingPosts, pendingEvents, pendingDocs]);

  const unreadCount = useMemo(() => 
    notifications.filter((n: MergedNotification) => !n.is_read).length, 
  [notifications]);

  return {
    notifications: notifications as MergedNotification[],
    unreadCount
  };
}
