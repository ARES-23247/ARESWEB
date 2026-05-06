import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../api";

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
  canSeeSimulations: boolean;
}

export function useDashboardSession() {
  // NOTE: Session is cached for 5 minutes to reduce API calls. This means
  // permission changes (role updates, member_type changes) may not reflect
  // immediately for the user. For sensitive operations requiring immediate
  // permission validation, use server-side checks instead.
  const { data: res, isLoading: isPending } = useQuery({
    queryKey: ["dashboard", "session"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API response shape varies based on auth state
    queryFn: () => fetchJson<any>("/api/profile/me"),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    retry: false,
  });

  const session: DashboardSession | null = useMemo(() => {
    const _res = res;
    return _res?.auth ? {
      authenticated: true,
      user: {
        ..._res.auth,
        member_type: _res.member_type,
        first_name: _res.first_name,
        last_name: _res.last_name,
        nickname: _res.nickname,
        role: (_res.auth.role as string) || "unverified",
      },
    } : null;
  }, [res]);

  const permissions: DashboardPermissions = useMemo(() => {
    const role = session?.user?.role || "unverified";
    const memberType = session?.user?.member_type || "student";
    const isAdmin = role === "admin";
    const isAuthorized = isAdmin || role === "author" || memberType === "coach" || memberType === "mentor";
    const isUnverified = role === "unverified";
    const canSeeInquiries = !isUnverified;
    const canSeeLogistics = isAdmin || ["parent", "coach", "mentor"].includes(memberType);
    const canSeeTasks = !isUnverified;
    const canSeeSimulations = !isUnverified;

    return {
      role,
      memberType,
      isAdmin,
      isAuthorized,
      isUnverified,
      canSeeInquiries,
      canSeeLogistics,
      canSeeTasks,
      canSeeSimulations,
    };
  }, [session]);

  return useMemo(() => ({ session, isPending, permissions }), [session, isPending, permissions]);
}
