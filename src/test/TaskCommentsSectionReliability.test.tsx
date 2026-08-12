import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import type { TaskItem } from "@/types/task";

const firestore = vi.hoisted(() => ({
  onSnapshot: vi.fn(),
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(),
}));
const api = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...parts: unknown[]) => ({ parts })),
  doc: vi.fn((...parts: unknown[]) => ({ parts })),
  onSnapshot: firestore.onSnapshot,
  increment: vi.fn((value: number) => ({ increment: value })),
  writeBatch: vi.fn(() => ({
    set: firestore.batchSet,
    update: firestore.batchUpdate,
    commit: firestore.batchCommit,
  })),
}));

vi.mock("@/lib/api", () => ({ authenticatedFetch: api.authenticatedFetch }));

import TaskCommentsSection from "@/app/dashboard/tasks/components/TaskCommentsSection";

const task: TaskItem = {
  id: "task-1",
  title: "Reliable comments",
  description: "",
  status: "todo",
  priority: "medium",
  subteam: "software",
  assignees: [],
  subtasks: [],
  createdAt: "2026-08-10T00:00:00.000Z",
};

const user = { uid: "member-1", email: "member@example.com" } as User;

describe("TaskCommentsSection reliability", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    firestore.onSnapshot.mockImplementation((_reference, onNext) => {
      onNext({ docs: [] });
      return vi.fn();
    });
    firestore.batchCommit.mockResolvedValue(undefined);
    api.authenticatedFetch.mockResolvedValue({ ok: true, status: 200, statusText: "OK" });
  });

  it("keeps the comment draft and exposes diagnostics when the atomic write fails", async () => {
    firestore.batchCommit.mockRejectedValueOnce({ code: "permission-denied", message: "Forbidden" });
    render(
      <TaskCommentsSection task={task} canEdit user={user} teamProfiles={[]} />
    );

    const input = screen.getByLabelText("Add a comment to Reliable comments");
    fireEvent.change(input, { target: { value: "Do not lose this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Unable to post comment")).toBeInTheDocument();
    expect(input).toHaveValue("Do not lose this draft");
    expect(screen.getByText("permission-denied: Forbidden")).toHaveClass("font-mono");
    expect(api.authenticatedFetch).not.toHaveBeenCalled();
  });

  it("distinguishes a saved comment from a failed Zulip notification", async () => {
    api.authenticatedFetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: "Forbidden" });
    render(
      <TaskCommentsSection task={task} canEdit user={user} teamProfiles={[]} />
    );

    const input = screen.getByLabelText("Add a comment to Reliable comments");
    fireEvent.change(input, { target: { value: "Saved on the board" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Unable to notify Zulip")).toBeInTheDocument();
    expect(screen.getByText(/comment was saved/i)).toBeInTheDocument();
    expect(screen.getByText("HTTP 403: Forbidden")).toHaveClass("font-mono");
    expect(input).toHaveValue("");
  });
});
