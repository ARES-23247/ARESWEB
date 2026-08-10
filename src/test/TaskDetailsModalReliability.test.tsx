import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import type { TaskItem } from "@/types/task";

const firestore = vi.hoisted(() => ({
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((...parts: unknown[]) => ({ parts })),
  updateDoc: firestore.updateDoc,
  setDoc: firestore.setDoc,
}));

vi.mock("@/lib/api", () => ({
  authenticatedFetch: vi.fn(async () => ({ ok: true, status: 200, statusText: "OK" })),
}));

vi.mock("@/lib/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock("@/components/MarkdownEditor", () => ({
  default: ({ id, value, onChange, disabled }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <textarea id={id} aria-label="Description" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
  ),
}));

vi.mock("@/app/dashboard/tasks/components/TaskCommentsSection", () => ({ default: () => <div>Comments</div> }));
vi.mock("@/app/dashboard/tasks/components/TaskEditorAiCopilot", () => ({ default: () => <div>AI Copilot</div> }));

import TaskDetailsModal from "@/app/dashboard/tasks/components/TaskDetailsModal";

const existingTask: TaskItem = {
  id: "task-1",
  title: "Reliable task",
  description: "Description",
  status: "todo",
  priority: "medium",
  subteam: "software",
  assignees: ["member-1"],
  subtasks: [],
  createdAt: "2026-08-10T00:00:00.000Z",
};

const user = { uid: "member-1", email: "member@example.com" } as User;

function renderModal(overrides: Partial<React.ComponentProps<typeof TaskDetailsModal>> = {}) {
  const props: React.ComponentProps<typeof TaskDetailsModal> = {
    taskId: "task-1",
    tasks: [existingTask],
    teamProfiles: [],
    canEdit: true,
    user,
    onClose: vi.fn(),
    onToggleSubtask: vi.fn(async () => null),
    onDeleteSubtask: vi.fn(async () => null),
    onAddSubtask: vi.fn(async () => null),
    onDeleteTask: vi.fn(async () => null),
    onArchiveTask: vi.fn(async () => null),
    ...overrides,
  };
  render(<TaskDetailsModal {...props} />);
  return props;
}

describe("TaskDetailsModal reliability", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    firestore.updateDoc.mockResolvedValue(undefined);
    firestore.setDoc.mockResolvedValue(undefined);
  });

  it("requires a non-empty title and disables create until it is valid", () => {
    renderModal({ taskId: null, tasks: [], onCreateTask: vi.fn(async () => null) });
    const title = screen.getByLabelText("Task Title");
    const saveButton = screen.getByRole("button", { name: "Add Task Card" });

    expect(saveButton).toBeDisabled();
    fireEvent.blur(title);
    expect(screen.getByText("Enter a task title before saving.")).toBeInTheDocument();

    fireEvent.change(title, { target: { value: "  Valid task  " } });
    expect(saveButton).toBeEnabled();
  });

  it("keeps the editor open and exposes diagnostic guidance when saving fails", async () => {
    const onClose = vi.fn();
    firestore.updateDoc.mockRejectedValueOnce({ code: "permission-denied", message: "Forbidden" });
    renderModal({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Unable to save task")).toBeInTheDocument();
    expect(screen.getByText(/coach or administrator/i)).toBeInTheDocument();
    expect(screen.getByText("permission-denied: Forbidden")).toHaveClass("font-mono");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows callback failures inline and does not close a failed create", async () => {
    const onClose = vi.fn();
    const onCreateTask = vi.fn(async () => ({
      title: "Unable to create task",
      message: "The change was not saved.",
      diagnostic: "unavailable: Network offline",
    }));
    renderModal({ taskId: null, tasks: [], onClose, onCreateTask });

    fireEvent.change(screen.getByLabelText("Task Title"), { target: { value: "New task" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Task Card" }));

    expect(await screen.findByText("Unable to create task")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps a subtask draft when the transaction fails", async () => {
    const onAddSubtask = vi.fn(async () => ({
      title: "Unable to add subtask",
      message: "The change was not saved.",
      diagnostic: "unavailable: Network offline",
    }));
    renderModal({
      tasks: [{ ...existingTask, subtasks: [{ id: "sub-1", title: "First", done: false }] }],
      onAddSubtask,
    });

    const input = screen.getByLabelText("Add a subtask to Reliable task");
    fireEvent.change(input, { target: { value: "Preserve this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Unable to add subtask")).toBeInTheDocument();
    expect(input).toHaveValue("Preserve this draft");
  });
});
