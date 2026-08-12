import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import type { TaskItem } from "@/types/task";

const firestore = vi.hoisted(() => ({
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
}));

const focusTrap = vi.hoisted(() => ({
  close: null as null | (() => void),
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
  useFocusTrap: (_active: boolean, onClose: () => void) => {
    focusTrap.close = onClose;
    return { current: null };
  },
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
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    focusTrap.close = null;
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

  it("opens an inline alertdialog, preserves drafts, and returns focus after cancellation", async () => {
    const onDeleteTask = vi.fn(async () => null);
    renderModal({ onDeleteTask });
    const title = screen.getByLabelText("Task Title");
    const description = screen.getByLabelText("Description");
    fireEvent.change(title, { target: { value: "Unsaved title draft" } });
    fireEvent.change(description, { target: { value: "Unsaved description draft" } });

    const deleteTrigger = screen.getByRole("button", { name: "Delete Card" });
    fireEvent.click(deleteTrigger);

    const confirmation = screen.getByRole("alertdialog", { name: "Delete this task card?" });
    expect(confirmation).toHaveTextContent("Reliable task");
    expect(confirmation).toHaveTextContent("Task ID: task-1");
    expect(screen.getByRole("button", { name: "Keep task" })).toHaveFocus();
    expect(title).toHaveValue("Unsaved title draft");
    expect(description).toHaveValue("Unsaved description draft");
    expect(onDeleteTask).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep task" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(deleteTrigger).toHaveFocus());
    expect(title).toHaveValue("Unsaved title draft");
    expect(description).toHaveValue("Unsaved description draft");
  });

  it("confirms deletion through the existing soft-delete callback and closes on success", async () => {
    const onClose = vi.fn();
    const onDeleteTask = vi.fn(async () => null);
    renderModal({ onClose, onDeleteTask });

    fireEvent.click(screen.getByRole("button", { name: "Delete Card" }));
    expect(screen.getByRole("button", { name: "Delete Card" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(onDeleteTask).toHaveBeenCalledWith("task-1"));
    expect(onDeleteTask).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("uses Escape to cancel confirmation before closing the editor", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const deleteTrigger = screen.getByRole("button", { name: "Delete Card" });
    fireEvent.click(deleteTrigger);

    act(() => focusTrap.close?.());

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(deleteTrigger).toHaveFocus());
    expect(onClose).not.toHaveBeenCalled();

    act(() => focusTrap.close?.());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the confirmation and drafts open when soft deletion fails", async () => {
    const onClose = vi.fn();
    const onDeleteTask = vi.fn(async () => ({
      title: "Unable to delete task",
      message: "The task remains on the board.",
      diagnostic: "HTTP 503: Service Unavailable",
    }));
    renderModal({ onClose, onDeleteTask });
    fireEvent.change(screen.getByLabelText("Task Title"), { target: { value: "Keep this draft" } });

    fireEvent.click(screen.getByRole("button", { name: "Delete Card" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(await screen.findByText("Unable to delete task")).toBeInTheDocument();
    expect(screen.getByText("HTTP 503: Service Unavailable")).toHaveClass("font-mono");
    expect(screen.getByRole("alertdialog", { name: "Delete this task card?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Task Title")).toHaveValue("Keep this draft");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm delete" })).toBeEnabled();
  });

  it("surfaces a rejected delete callback without closing or losing the draft", async () => {
    const onClose = vi.fn();
    const onDeleteTask = vi.fn(async () => {
      throw { code: "permission-denied", message: "Forbidden" };
    });
    renderModal({ onClose, onDeleteTask });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Keep details" } });

    fireEvent.click(screen.getByRole("button", { name: "Delete Card" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(await screen.findByText("Unable to delete task")).toBeInTheDocument();
    expect(screen.getByText("permission-denied: Forbidden")).toHaveClass("font-mono");
    expect(screen.getByLabelText("Description")).toHaveValue("Keep details");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
