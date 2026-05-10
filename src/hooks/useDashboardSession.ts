import { useMemo } from "react";

import { useGetMe } from "../api";

export interface DashboardSession {
  authenticated: boolean;
  user: {
    id?: string;
    name?: string;
    email?: string;
    image?: string;
    role: string;
    memberType: string;
    firstName: string;
    lastName: string;
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
  // Named constant for session cache duration
  // AUTH-CRITICAL-01: Reduced from 5 minutes to 30 seconds since session data
  // is authentication-critical and must reflect changes quickly (e.g., role changes,
  // account switches, sign-outs). Server-side validation is still used for sensitive ops.
  const SESSION_CACHE_DURATION_MS = 1000 * 30; // 30 seconds

  // NOTE: Session is cached for 30 seconds to reduce API calls while ensuring
  // timely updates to authentication state. Permission changes may take up to
  // 30 seconds to reflect in the UI. For sensitive operations requiring immediate
  // permission validation, use server-side checks instead.
  const { data: res, isLoading: isPending } = useGetMe({
    staleTime: SESSION_CACHE_DURATION_MS,
    retry: false,
  });

  const session: DashboardSession | null = useMemo(() => {
    const _res = res;
    return _res?.auth ? {
      authenticated: true,
      user: {
        ..._res.auth,
        name: _res.auth.name ?? undefined,
        image: _res.auth.image ?? undefined,
        memberType: _res.memberType || "student",
        firstName: _res.firstName || "",
        lastName: _res.lastName || "",
        nickname: _res.nickname || "",
        role: (_res.auth.role as string) || "unverified",
      },
    } : null;
  }, [res]);

  const permissions: DashboardPermissions = useMemo(() => {
    const role = session?.user?.role || "unverified";
    const memberType = session?.user?.memberType || "student";
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

