"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { usePendingInquiries } from "@/lib/usePendingInquiries";
import { db } from "@/lib/firebaseFirestore";
import { logger } from "@/utils/logger";

export type DashboardNotificationState = "idle" | "loading" | "connected" | "error";

export interface DashboardNotifications {
  pendingBlogApprovals: number;
  blogApprovalsState: DashboardNotificationState;
  pendingEventApprovals?: number;
  eventApprovalsState?: DashboardNotificationState;
  pendingAcademyApprovals?: number;
  academyApprovalsState?: DashboardNotificationState;
  pendingAreslibApprovals?: number;
  areslibApprovalsState?: DashboardNotificationState;
  pendingDocumentApprovals?: number;
  documentApprovalsState?: DashboardNotificationState;
  hasPendingInquiries: boolean;
  inquiriesState: DashboardNotificationState;
}

const EMPTY_NOTIFICATIONS: DashboardNotifications = {
  pendingBlogApprovals: 0,
  blogApprovalsState: "idle",
  pendingEventApprovals: 0,
  eventApprovalsState: "idle",
  pendingAcademyApprovals: 0,
  academyApprovalsState: "idle",
  pendingAreslibApprovals: 0,
  areslibApprovalsState: "idle",
  pendingDocumentApprovals: 0,
  documentApprovalsState: "idle",
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

function isNonDeletedRecord(data: Record<string, unknown>): boolean {
  return data.isDeleted !== 1 && data.isDeleted !== true;
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
  const [pendingEventApprovals, setPendingEventApprovals] = useState(0);
  const [eventApprovalsState, setEventApprovalsState] =
    useState<DashboardNotificationState>("idle");
  const [pendingAcademyApprovals, setPendingAcademyApprovals] = useState(0);
  const [academyApprovalsState, setAcademyApprovalsState] =
    useState<DashboardNotificationState>("idle");
  const [pendingAreslibApprovals, setPendingAreslibApprovals] = useState(0);
  const [areslibApprovalsState, setAreslibApprovalsState] =
    useState<DashboardNotificationState>("idle");
  const [pendingDocumentApprovals, setPendingDocumentApprovals] = useState(0);
  const [documentApprovalsState, setDocumentApprovalsState] =
    useState<DashboardNotificationState>("idle");
  const { hasPendingInquiries, inquiriesState } = usePendingInquiries();

  useEffect(() => {
    if (!subscriptionsEnabled) {
      setPendingBlogApprovals(0);
      setBlogApprovalsState("idle");
      setPendingEventApprovals(0);
      setEventApprovalsState("idle");
      setPendingAcademyApprovals(0);
      setAcademyApprovalsState("idle");
      setPendingAreslibApprovals(0);
      setAreslibApprovalsState("idle");
      setPendingDocumentApprovals(0);
      setDocumentApprovalsState("idle");
      return;
    }

    setBlogApprovalsState("loading");
    setEventApprovalsState("loading");
    setAcademyApprovalsState("loading");
    setAreslibApprovalsState("loading");
    setDocumentApprovalsState("loading");

    const subscribeDualFieldCount = (
      collectionName: string,
      statusValue: string,
      setCount: (count: number) => void,
      setState: (state: DashboardNotificationState) => void,
      errorMessage: string,
    ) => {
      const idsByField = {
        status: new Set<string>(),
        approvalStatus: new Set<string>(),
      };
      const loadedFields = new Set<keyof typeof idsByField>();

      const subscribeField = (
        field: keyof typeof idsByField,
        expectedValue: string,
      ) =>
        onSnapshot(
          query(collection(db, collectionName), where(field, "==", expectedValue)),
          (snapshot) => {
            idsByField[field] = new Set(
              snapshot.docs
                .filter((document) => isNonDeletedRecord(document.data()))
                .map((document) => document.id),
            );
            loadedFields.add(field);
            const pendingIds = new Set([
              ...idsByField.status,
              ...idsByField.approvalStatus,
            ]);
            setCount(pendingIds.size);
            if (loadedFields.size === 2) setState("connected");
          },
          (error) => {
            logger.error(errorMessage, error);
            setState("error");
          },
        );

      const unsubStatus = subscribeField("status", statusValue);
      const unsubApproval = subscribeField("approvalStatus", "pending_approval");
      return () => {
        unsubStatus();
        unsubApproval();
      };
    };

    const subscribeEventsAndLocationsCount = () => {
      const idsBySource = {
        eventStatus: new Set<string>(),
        eventApproval: new Set<string>(),
        eventPhotos: new Set<string>(),
        locations: new Set<string>(),
      };
      const loadedSources = new Set<keyof typeof idsBySource>();

      const updateCount = () => {
        const pendingEventIds = new Set([
          ...idsBySource.eventStatus,
          ...idsBySource.eventApproval,
          ...idsBySource.eventPhotos,
        ]);
        setPendingEventApprovals(pendingEventIds.size + idsBySource.locations.size);
        if (loadedSources.size === 4) {
          setEventApprovalsState("connected");
        }
      };

      const subscribeSource = (
        source: keyof typeof idsBySource,
        collectionName: string,
        field: string,
        expectedValue: string | number,
      ) =>
        onSnapshot(
          query(collection(db, collectionName), where(field, "==", expectedValue)),
          (snapshot) => {
            idsBySource[source] = new Set(
              snapshot.docs
                .filter((document) => isNonDeletedRecord(document.data()))
                .map((document) => document.id),
            );
            loadedSources.add(source);
            updateCount();
          },
          (error) => {
            logger.error("Pending event approval subscription failed", error);
            setEventApprovalsState("error");
          },
        );

      const unsubStatus = subscribeSource("eventStatus", "events", "status", "pending");
      const unsubApproval = subscribeSource("eventApproval", "events", "approvalStatus", "pending_approval");
      const unsubPhotos = subscribeSource("eventPhotos", "events", "hasPendingPhotos", 1);
      const unsubLocations = subscribeSource("locations", "locations", "approvalStatus", "pending_approval");
      return () => {
        unsubStatus();
        unsubApproval();
        unsubPhotos();
        unsubLocations();
      };
    };

    const docsByField = {
      status: new Map<string, Record<string, unknown>>(),
      approvalStatus: new Map<string, Record<string, unknown>>(),
    };
    const loadedDocFields = new Set<keyof typeof docsByField>();
    const subscribeDocsField = (field: keyof typeof docsByField) =>
      onSnapshot(
        query(collection(db, "docs"), where(field, "==", "pending_approval")),
        (snapshot) => {
          const map = new Map<string, Record<string, unknown>>();
          for (const document of snapshot.docs) {
            const data = document.data();
            if (isNonDeletedRecord(data)) {
              map.set(document.id, data);
            }
          }
          docsByField[field] = map;
          loadedDocFields.add(field);
          const merged = new Map<string, Record<string, unknown>>([
            ...docsByField.status,
            ...docsByField.approvalStatus,
          ]);
          let academyCount = 0;
          let areslibCount = 0;
          for (const data of merged.values()) {
            if (data.displayInMathCorner === 1 || data.displayInScienceCorner === 1) {
              academyCount += 1;
            }
            if (data.displayInAreslib === 1) {
              areslibCount += 1;
            }
          }
          setPendingAcademyApprovals(academyCount);
          setPendingAreslibApprovals(areslibCount);
          if (loadedDocFields.size === 2) {
            setAcademyApprovalsState("connected");
            setAreslibApprovalsState("connected");
          }
        },
        (error) => {
          logger.error("Pending documentation approval subscription failed", error);
          setAcademyApprovalsState("error");
          setAreslibApprovalsState("error");
        },
      );

    const unsubBlogs = subscribeDualFieldCount(
      "posts",
      "pending_approval",
      setPendingBlogApprovals,
      setBlogApprovalsState,
      "Pending blog approval subscription failed",
    );
    const unsubEvents = subscribeEventsAndLocationsCount();
    const unsubDocuments = subscribeDualFieldCount(
      "documents",
      "pending_approval",
      setPendingDocumentApprovals,
      setDocumentApprovalsState,
      "Pending cloud resource approval subscription failed",
    );
    const unsubDocsStatus = subscribeDocsField("status");
    const unsubDocsApproval = subscribeDocsField("approvalStatus");

    return () => {
      unsubBlogs();
      unsubEvents();
      unsubDocuments();
      unsubDocsStatus();
      unsubDocsApproval();
    };
  }, [subscriptionsEnabled]);

  const value = useMemo<DashboardNotifications>(
    () => ({
      pendingBlogApprovals,
      blogApprovalsState,
      pendingEventApprovals,
      eventApprovalsState,
      pendingAcademyApprovals,
      academyApprovalsState,
      pendingAreslibApprovals,
      areslibApprovalsState,
      pendingDocumentApprovals,
      documentApprovalsState,
      hasPendingInquiries,
      inquiriesState,
    }),
    [
      pendingBlogApprovals,
      blogApprovalsState,
      pendingEventApprovals,
      eventApprovalsState,
      pendingAcademyApprovals,
      academyApprovalsState,
      pendingAreslibApprovals,
      areslibApprovalsState,
      pendingDocumentApprovals,
      documentApprovalsState,
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
