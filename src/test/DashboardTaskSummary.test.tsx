import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  getCountFromServer: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  and: vi.fn((...constraints: unknown[]) => ({ constraints })),
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  getCountFromServer: firestore.getCountFromServer,
  limit: vi.fn((value: number) => ({ limit: value })),
  onSnapshot: firestore.onSnapshot,
  or: vi.fn((...constraints: unknown[]) => ({ constraints })),
  query: vi.fn((...constraints: unknown[]) => ({ constraints })),
  where: vi.fn((...constraint: unknown[]) => ({ constraint })),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      uid: "admin-1",
      email: "admin@example.test",
      displayName: "Team Admin",
      photoURL: null,
    },
    authorizedUser: { role: "admin" },
  }),
}));

import DashboardHome from "@/app/dashboard/page";

describe("Command center task summary", () => {
  beforeEach(() => {
    firestore.getCountFromServer
      .mockResolvedValueOnce({ data: () => ({ count: 3 }) })
      .mockResolvedValueOnce({ data: () => ({ count: 5 }) });
    firestore.onSnapshot.mockImplementation((_query, onNext) => {
      onNext({
        docs: [
          {
            id: "legacy-active",
            data: () => ({
              title: "Legacy mechanical task",
              status: "todo",
              priority: "normal",
              subteam: "Mechanical",
              createdAt: "2026-08-14T00:00:00.000Z",
            }),
          },
          {
            id: "completed",
            data: () => ({
              title: "Completed task",
              status: "completed",
              priority: "high",
              subteam: "software",
            }),
          },
          {
            id: "deleted",
            data: () => ({
              title: "Deleted task",
              status: "todo",
              priority: "high",
              subteam: "software",
              isDeleted: 1,
            }),
          },
        ],
      });
      return vi.fn();
    });
  });

  it("uses normalized live records for truthful task and content summaries", async () => {
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    expect(await screen.findByText("Legacy mechanical task")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.queryByText("Deleted task")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Priority Operational Tasks/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
    });
    expect(screen.getByText("Role eligible")).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.getByText("Signed in")).toBeInTheDocument();
  });
});
