"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
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
  const subscriptionsEnabled = canReview && import.meta.env.MODE !== "e2e";
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
    if (!subscriptionsEnabled) {
      setHasPendingInquiries(false);
      setInquiriesState("idle");
      return;
    }

    setInquiriesState("loading");
    return onSnapshot(
      query(
        collection(db, "inquiries"),
        where("status", "==", "pending"),
      ),
      (snapshot) => {
        setHasPendingInquiries(!snapshot.empty);
        setInquiriesState("connected");
      },
      (error) => {
        logger.error("Pending inquiry subscription failed", error);
        setInquiriesState("error");
      },
    );
  }, [subscriptionsEnabled]);

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
