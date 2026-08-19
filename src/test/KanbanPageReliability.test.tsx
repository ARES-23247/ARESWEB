import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  onSnapshot: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  runTransaction: vi.fn(),
  batchCommit: vi.fn(),
  batchUpdate: vi.fn(),
  batchSet: vi.fn(),
  countGet: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...parts: unknown[]) => ({ parts })),
  doc: vi.fn((...parts: unknown[]) => ({ parts })),
  query: vi.fn((value: unknown) => value),
  limit: vi.fn((value: number) => value),
  onSnapshot: firestore.onSnapshot,
  updateDoc: firestore.updateDoc,
  setDoc: firestore.setDoc,
  runTransaction: firestore.runTransaction,
  getCountFromServer: vi.fn(() => firestore.countGet()),
  writeBatch: vi.fn(() => ({ update: firestore.batchUpdate, set: firestore.batchSet, commit: firestore.batchCommit })),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "member-1", email: "member@example.com" },
    authorizedUser: { role: "admin" },
  }),
  useOptionalAuth: () => undefined,
}));

vi.mock("@/lib/api", () => ({
  authenticatedFetch: vi.fn(async () => ({ ok: true, json: async () => ({ members: [] }) })),
}));

vi.mock("@/app/dashboard/tasks/components/TaskFilters", () => ({
  default: ({ onOpenCreate }: { onOpenCreate: () => void }) => (
    <button type="button" onClick={onOpenCreate}>Open create</button>
  ),
}));

vi.mock("@/app/dashboard/tasks/components/TaskBoardColumn", () => ({
  default: (props: {
    col: { id: string };
    colTasks: Array<{ id: string; title: string }>;
    onDrop: (event: React.DragEvent, status: "review") => void;
    onMoveStatus: (taskId: string, status: "review") => Promise<unknown>;
    onArchiveTask: (taskId: string, archived: boolean) => Promise<unknown>;
    onArchiveAllCompleted: () => Promise<unknown>;
    onEditTask: (taskId: string) => void;
  }) => (
    <section data-testid={`column-${props.col.id}`}>
      {props.colTasks.map((task) => <span key={task.id}>{task.title}</span>)}
      {props.col.id === "todo" && (
        <>
          <button
            type="button"
            onClick={() => void props.onMoveStatus("task-1", "review")}
          >Move task</button>
          <button type="button" onClick={() => void props.onArchiveTask("task-1", true)}>Archive task</button>
          <button type="button" onClick={() => props.onEditTask("task-1")}>Edit task</button>
        </>
      )}
      {props.col.id === "completed" && (
        <button type="button" onClick={() => void props.onArchiveAllCompleted()}>Archive completed</button>
      )}
    </section>
  ),
}));

vi.mock("@/app/dashboard/tasks/components/TaskDetailsModal", () => ({
  default: (props: {
    taskId: string | null;
    onToggleSubtask: (taskId: string, subtaskId: string) => Promise<unknown>;
    onDeleteSubtask: (taskId: string, subtaskId: string) => Promise<unknown>;
    onAddSubtask: (taskId: string, title: string) => Promise<unknown>;
    onDeleteTask: (taskId: string) => Promise<unknown>;
    onCreateTask?: (task: Record<string, unknown>) => Promise<unknown>;
  }) => props.taskId ? (
    <div>
      <button type="button" onClick={() => void props.onToggleSubtask("task-1", "sub-1")}>Toggle subtask</button>
      <button type="button" onClick={() => void props.onDeleteSubtask("task-1", "sub-1")}>Delete subtask</button>
      <button type="button" onClick={() => void props.onAddSubtask("task-1", "New subtask")}>Add subtask</button>
      <button type="button" onClick={() => void props.onDeleteTask("task-1")}>Delete task</button>
    </div>
  ) : (
    <button type="button" onClick={() => void props.onCreateTask?.({
      id: "task-new",
      title: "New task",
      description: "",
      status: "todo",
      priority: "medium",
      subteam: "software",
      assignees: [],
      subtasks: [],
      createdAt: "2026-08-10T00:00:00.000Z",
    })}>Create task now</button>
  ),
}));

import KanbanPage from "@/app/dashboard/tasks/page";

const taskData = {
  title: "Existing task",
  description: "Keep server state truthful",
  status: "todo",
  priority: "high",
  subteam: "software",
  assignees: ["member-1"],
  subtasks: [{ id: "sub-1", title: "Existing subtask", done: false }],
  archived: false,
  createdAt: "2026-08-10T00:00:00.000Z",
};

describe("Kanban page reliability", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    firestore.countGet.mockResolvedValue({ data: () => ({ count: 3 }) });
    firestore.batchSet.mockResolvedValue(undefined);
    firestore.batchCommit.mockResolvedValue(undefined);
    firestore.onSnapshot.mockImplementation((_query, onNext) => {
      onNext({
        empty: false,
        docs: [{ id: "task-1", data: () => taskData }],
      });
      return vi.fn();
    });
    firestore.updateDoc.mockResolvedValue(undefined);
    firestore.setDoc.mockResolvedValue(undefined);
    firestore.batchCommit.mockResolvedValue(undefined);
  });

  it("keeps a card in its server-backed column and exposes permission guidance when a move fails", async () => {
    firestore.batchCommit.mockRejectedValueOnce({ code: "permission-denied", message: "Forbidden" });
    render(<KanbanPage />);

    fireEvent.click(screen.getByRole("button", { name: "Move task" }));

    expect(await screen.findByText("Unable to move task")).toBeInTheDocument();
    expect(screen.getByText(/coach or administrator/i)).toBeInTheDocument();
    expect(screen.getByTestId("column-todo")).toHaveTextContent("Existing task");
    expect(screen.getByTestId("column-review")).not.toHaveTextContent("Existing task");
  });

  it("surfaces failed archive, soft-delete, and create operations without local success", async () => {
    // Board operations commit through batched writes; inject the failure there.
    firestore.batchCommit.mockRejectedValue({ code: "unavailable", message: "Network offline" });
    render(<KanbanPage />);

    fireEvent.click(screen.getByRole("button", { name: "Archive task" }));
    expect(await screen.findByText("Unable to archive task")).toBeInTheDocument();
    expect(screen.getByTestId("column-todo")).toHaveTextContent("Existing task");

    fireEvent.click(screen.getByRole("button", { name: "Edit task" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));
    expect(await screen.findByText("Unable to delete task")).toBeInTheDocument();
    expect(firestore.batchUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isDeleted: 1, archived: true }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Open create" }));
    fireEvent.click(screen.getByRole("button", { name: "Create task now" }));
    expect(await screen.findByText("Unable to create task")).toBeInTheDocument();
    expect(screen.getByTestId("column-todo")).not.toHaveTextContent("New task");
  });

  it("uses the latest transaction snapshot for subtask changes and reports transaction failures", async () => {
    const transactionUpdate = vi.fn();
    firestore.runTransaction.mockImplementationOnce(async (_db, callback) => callback({
      get: async () => ({
        exists: () => true,
        data: () => ({ subtasks: [
          { id: "sub-1", title: "Existing subtask", done: false },
          { id: "concurrent", title: "Added elsewhere", done: false },
        ] }),
      }),
      update: transactionUpdate,
    }));
    render(<KanbanPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit task" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle subtask" }));

    await waitFor(() => expect(transactionUpdate).toHaveBeenCalledWith(expect.anything(), {
      subtasks: [
        { id: "sub-1", title: "Existing subtask", done: true },
        { id: "concurrent", title: "Added elsewhere", done: false },
      ],
    }));

    firestore.runTransaction.mockRejectedValueOnce({ code: "aborted", message: "Write conflict" });
    fireEvent.click(screen.getByRole("button", { name: "Delete subtask" }));
    expect(await screen.findByText("Unable to delete subtask")).toBeInTheDocument();
    expect(screen.getByText(/same time/i)).toBeInTheDocument();

    firestore.runTransaction.mockRejectedValueOnce({ code: "unavailable", message: "Network offline" });
    fireEvent.click(screen.getByRole("button", { name: "Add subtask" }));
    expect(await screen.findByText("Unable to add subtask")).toBeInTheDocument();
  });

  it("commits archive-all as one batch and exposes a failed commit", async () => {
    firestore.onSnapshot.mockImplementationOnce((_query, onNext) => {
      onNext({ empty: false, docs: [{ id: "task-1", data: () => ({ ...taskData, status: "completed" }) }] });
      return vi.fn();
    });
    firestore.batchCommit.mockRejectedValueOnce({ code: "unavailable", message: "Network offline" });
    render(<KanbanPage />);

    fireEvent.click(screen.getByRole("button", { name: "Archive completed" }));
    expect(await screen.findByText("Unable to archive completed tasks")).toBeInTheDocument();
    expect(firestore.batchUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("column-completed")).toHaveTextContent("Existing task");
  });
});
