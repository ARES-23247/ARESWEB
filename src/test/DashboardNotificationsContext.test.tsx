import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  value: {
    user: { uid: "mentor-1" },
    authorizedUser: { role: "mentor" },
  },
}));

const firestore = vi.hoisted(() => ({
  onSnapshot: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => auth.value,
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  where: vi.fn((field: string, operator: string, value: string) => ({
    field,
    operator,
    value,
  })),
  query: vi.fn((...constraints: unknown[]) => ({ constraints })),
  onSnapshot: firestore.onSnapshot,
}));

vi.mock("@/utils/logger", () => ({
  logger: { error: vi.fn() },
}));

import {
  canReviewDashboardContent,
  DashboardNotificationsProvider,
  useDashboardNotifications,
} from "@/context/DashboardNotificationsContext";

function NotificationProbe() {
  const notifications = useDashboardNotifications();
  return (
    <output>
      {notifications.pendingBlogApprovals}|
      {notifications.blogApprovalsState}|
      {String(notifications.hasPendingInquiries)}|
      {notifications.inquiriesState}
    </output>
  );
}

function queryDetails(value: unknown) {
  const constraints = (value as { constraints: Array<{ name?: string; field?: string }> }).constraints;
  return {
    collection: constraints.find((constraint) => constraint.name)?.name,
    field: constraints.find((constraint) => constraint.field)?.field,
  };
}

describe("dashboard notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.value = {
      user: { uid: "mentor-1" },
      authorizedUser: { role: "mentor" },
    };
  });

  it("recognizes only roles that may review content", () => {
    expect(canReviewDashboardContent("admin")).toBe(true);
    expect(canReviewDashboardContent("coach")).toBe(true);
    expect(canReviewDashboardContent("mentor")).toBe(true);
    expect(canReviewDashboardContent("member")).toBe(false);
    expect(canReviewDashboardContent()).toBe(false);
  });

  it("deduplicates pending records across both approval fields and shares inquiry state", async () => {
    firestore.onSnapshot.mockImplementation((queryValue, onNext) => {
      const details = queryDetails(queryValue);
      if (details.collection === "posts" && details.field === "status") {
        onNext({
          docs: [{ id: "post-1", data: () => ({ isDeleted: 0 }) }],
        });
      } else if (details.collection === "posts") {
        onNext({
          docs: [
            { id: "post-1", data: () => ({ isDeleted: 0 }) },
            { id: "post-2", data: () => ({ isDeleted: 0 }) },
            { id: "archived", data: () => ({ isDeleted: 1 }) },
          ],
        });
      } else {
        onNext({ empty: false });
      }
      return vi.fn();
    });

    const view = render(
      <DashboardNotificationsProvider>
        <NotificationProbe />
      </DashboardNotificationsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("2|connected|true|connected")).toBeInTheDocument();
    });
    expect(firestore.onSnapshot).toHaveBeenCalledTimes(3);
    view.unmount();
  });

  it("reports subscription failures instead of presenting an empty queue", async () => {
    firestore.onSnapshot.mockImplementation((queryValue, onNext, onError) => {
      const details = queryDetails(queryValue);
      if (details.collection === "posts") onError(new Error("offline"));
      else onNext({ empty: true });
      return vi.fn();
    });

    render(
      <DashboardNotificationsProvider>
        <NotificationProbe />
      </DashboardNotificationsProvider>,
    );

    expect(await screen.findByText("0|error|false|connected")).toBeInTheDocument();
  });

  it("does not subscribe for members who cannot review queues", () => {
    auth.value = {
      user: { uid: "member-1" },
      authorizedUser: { role: "member" },
    };

    render(
      <DashboardNotificationsProvider>
        <NotificationProbe />
      </DashboardNotificationsProvider>,
    );

    expect(screen.getByText("0|idle|false|idle")).toBeInTheDocument();
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });
});
