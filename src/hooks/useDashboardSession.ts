import { useMemo } from "react";
import { api } from "../api/client";

export interface DashboardSession {
  authenticated: boolean;
  user: {
    id?: string;
    name?: string;
    email?: string;
    image?: string;
    role: string;
    member_type: string;
    first_name: string;
    last_name: string;
    nickname: string;
    [key: string]: unknown;
  };
}

export interface DashboardPermissions {
  role: string;
  memberType: string;
  isAdmin: boolean;
  isAuthorized: boolean;
  isUnverified: boolean;
  canSeeInquiries: boolean;
  canSeeLogistics: boolean;
  canSeeTasks: boolean;
}

export function useDashboardSession() {
  const { data: res, isLoading: isPending } = api.profiles.getMe.useQuery(
    ["dashboard", "session"],
    { query: {} },
    {
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      retry: false,
    }
  );

  const session: DashboardSession | null = useMemo(() => (
    res?.status === 200 && res.body.auth ? {
      authenticated: true,
      user: {
        ...res.body.auth,
        member_type: res.body.member_type,
        first_name: res.body.first_name,
        last_name: res.body.last_name,
        nickname: res.body.nickname,
        role: (res.body.auth.role as string) || "unverified",
      },
    } : null
  ), [res]);

  const permissions: DashboardPermissions = useMemo(() => {
    const role = session?.user?.role || "unverified";
    const memberType = session?.user?.member_type || "student";
    const isAdmin = role === "admin";
    const isAuthorized = isAdmin || role === "author" || memberType === "coach" || memberType === "mentor";
    const isUnverified = role === "unverified";
    const canSeeInquiries = !isUnverified;
    const canSeeLogistics = isAdmin || ["parent", "coach", "mentor"].includes(memberType);
    const canSeeTasks = !isUnverified;

    return {
      role,
      memberType,
      isAdmin,
      isAuthorized,
      isUnverified,
      canSeeInquiries,
      canSeeLogistics,
      canSeeTasks,
    };
  }, [session]);

  return useMemo(() => ({ session, isPending, permissions }), [session, isPending, permissions]);
}
