"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { db } from "@/lib/firebaseFirestore";
import { logger } from "@/utils/logger";

export type DashboardNotificationState = "idle" | "loading" | "connected" | "error";

export interface DashboardNotifications {
  pendingBlogApprovals: number;
  blogApprovalsState: DashboardNotificationState;
  hasPendingInquiries: boolean;
  inquiriesState: DashboardNotificationState;
}

const EMPTY_NOTIFICATIONS: DashboardNotifications = {
  pendingBlogApprovals: 0,
  blogApprovalsState: "idle",
  hasPendingInquiries: false,
  inquiriesState: "idle",
};

const DashboardNotificationsContext = createContext<DashboardNotifications>(
  EMPTY_NOTIFICATIONS,
);

const APPROVER_ROLES = new Set(["admin", "coach", "mentor"]);
const INQUIRY_REVIEW_ROLES = new Set(["admin", "coach"]);

export function canReviewDashboardContent(role?: string): boolean {
  return !!role && APPROVER_ROLES.has(role);
}

export function DashboardNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, authorizedUser } = useAuth();
  const role = authorizedUser?.role;
  const canReview = !!user?.uid && canReviewDashboardContent(role);
  const canReviewInquiries = !!user?.uid && !!role && INQUIRY_REVIEW_ROLES.has(role);
  const subscriptionsEnabled = canReview && import.meta.env.MODE !== "e2e";
  const inquiryCheckEnabled = canReviewInquiries && import.meta.env.MODE !== "e2e";
  const [pendingBlogApprovals, setPendingBlogApprovals] = useState(0);
  const [blogApprovalsState, setBlogApprovalsState] =
    useState<DashboardNotificationState>("idle");
  const [hasPendingInquiries, setHasPendingInquiries] = useState(false);
  const [inquiriesState, setInquiriesState] =
    useState<DashboardNotificationState>("idle");

  useEffect(() => {
    if (!subscriptionsEnabled) {
      setPendingBlogApprovals(0);
      setBlogApprovalsState("idle");
      return;
    }

    setBlogApprovalsState("loading");
    const idsByField = {
      status: new Set<string>(),
      approvalStatus: new Set<string>(),
    };
    const loadedFields = new Set<keyof typeof idsByField>();

    const subscribe = (field: keyof typeof idsByField) =>
      onSnapshot(
        query(collection(db, "posts"), where(field, "==", "pending_approval")),
        (snapshot) => {
          idsByField[field] = new Set(
            snapshot.docs
              .filter((document) => {
                const data = document.data();
                return data.isDeleted !== 1 && data.isDeleted !== true;
              })
              .map((document) => document.id),
          );
          loadedFields.add(field);
          const pendingIds = new Set([
            ...idsByField.status,
            ...idsByField.approvalStatus,
          ]);
          setPendingBlogApprovals(pendingIds.size);
          if (loadedFields.size === 2) setBlogApprovalsState("connected");
        },
        (error) => {
          logger.error("Pending blog approval subscription failed", error);
          setBlogApprovalsState("error");
        },
      );

    const unsubscribeStatus = subscribe("status");
    const unsubscribeApprovalStatus = subscribe("approvalStatus");
    return () => {
      unsubscribeStatus();
      unsubscribeApprovalStatus();
    };
  }, [subscriptionsEnabled]);

  useEffect(() => {
    if (!inquiryCheckEnabled) {
      setHasPendingInquiries(false);
      setInquiriesState("idle");
      return;
    }

    const controller = new AbortController();
    setInquiriesState("loading");

    async function loadPendingInquiries() {
      try {
        const response = await authenticatedFetch(
          "/api/inquiries/pending-exists",
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: ${response.statusText || "Request failed"}`,
          );
        }
        const payload = (await response.json()) as { hasPending?: unknown };
        if (typeof payload.hasPending !== "boolean") {
          throw new Error("Invalid pending inquiry response");
        }
        setHasPendingInquiries(payload.hasPending);
        setInquiriesState("connected");
      } catch (error) {
        if (controller.signal.aborted) return;
        logger.error("Pending inquiry status check failed", error);
        setHasPendingInquiries(false);
        setInquiriesState("error");
      }
    }

    void loadPendingInquiries();
    return () => controller.abort();
  }, [inquiryCheckEnabled]);

  const value = useMemo<DashboardNotifications>(
    () => ({
      pendingBlogApprovals,
      blogApprovalsState,
      hasPendingInquiries,
      inquiriesState,
    }),
    [
      pendingBlogApprovals,
      blogApprovalsState,
      hasPendingInquiries,
      inquiriesState,
    ],
  );

  return (
    <DashboardNotificationsContext.Provider value={value}>
      {children}
    </DashboardNotificationsContext.Provider>
  );
}

export function useDashboardNotifications(): DashboardNotifications {
  return useContext(DashboardNotificationsContext);
}
