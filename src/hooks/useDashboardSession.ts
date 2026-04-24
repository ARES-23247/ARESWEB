import { useState, useEffect } from "react";
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
}

export function useDashboardSession() {
  const [session, setSession] = useState<DashboardSession | null>(null);
  const [isPending, setIsPending] = useState(true);

  // Compute localhost bypass — SEC-F01: Harden to only allow in explicit DEV mode
  const isLocalDev =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  useEffect(() => {
    let isMounted = true;
    api.profiles.getMe.query()
      .then((res) => {
        if (!isMounted) return;
        if (res.status !== 200) {
          setSession(null);
          setIsPending(false);
          return;
        }
        const data = res.body;
        setSession({
          authenticated: true,
          user: {
            ...data.auth,
            member_type: data.member_type,
            first_name: data.first_name,
            last_name: data.last_name,
            nickname: data.nickname,
            role: (data.auth.role as string) || "unverified",
          },
        } as DashboardSession);
        setIsPending(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null);
        setIsPending(false);
      });
    
    return () => {
      isMounted = false;
    };
  }, []);

  const role = session?.user?.role || "unverified";
  const memberType = session?.user?.member_type || "student";
  const isAdmin = role === "admin" || isLocalDev;
  const isAuthorized = isAdmin || role === "author" || memberType === "coach" || memberType === "mentor";
  const isUnverified = role === "unverified" && !isLocalDev;
  const canSeeInquiries = !isUnverified;
  const canSeeLogistics = isAdmin || ["parent", "coach", "mentor"].includes(memberType);

  const permissions: DashboardPermissions = {
    role,
    memberType,
    isAdmin,
    isAuthorized,
    isUnverified,
    canSeeInquiries,
    canSeeLogistics,
  };

  return { session, isPending, permissions, isLocalDev };
}
