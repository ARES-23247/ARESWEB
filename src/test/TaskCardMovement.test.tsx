import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TaskCard from "@/app/dashboard/tasks/components/TaskCard";
import type { TaskItem } from "@/types/task";

const task: TaskItem = {
  id: "task-1",
  title: "Build intake",
  description: "Preserve the server-backed move path.",
  status: "todo",
  priority: "high",
  subteam: "hardware",
  assignees: [],
  subtasks: [],
  archived: false,
  createdAt: "2026-08-10T00:00:00.000Z",
};

function renderCard(overrides: Partial<React.ComponentProps<typeof TaskCard>> = {}) {
  const props: React.ComponentProps<typeof TaskCard> = {
    task,
    canEdit: true,
    draggingTaskId: null,
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onMoveStatus: vi.fn(async () => null),
    onEditTask: vi.fn(),
    onArchiveTask: vi.fn(),
    teamProfiles: [],
    ...overrides,
  };
  render(<TaskCard {...props} />);
  return props;
}

describe("TaskCard status movement", () => {
  it("offers a labeled deterministic status control through the existing move callback", () => {
    const onMoveStatus = vi.fn(async () => null);
    renderCard({ onMoveStatus });

    expect(screen.getByRole("article", { name: "Task: Build intake" })).toBeInTheDocument();
    const status = screen.getByRole("combobox", { name: "Move Build intake to another status" });
    expect(status).toHaveValue("todo");

    fireEvent.click(status);
    fireEvent.change(status, { target: { value: "in_progress" } });

    expect(onMoveStatus).toHaveBeenCalledOnce();
    expect(onMoveStatus).toHaveBeenCalledWith("task-1", "in_progress");
  });

  it("uses a native task-open button and does not expose move controls to viewers", () => {
    const onEditTask = vi.fn();
    renderCard({ canEdit: false, onEditTask });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    const openTask = screen.getByRole("button", { name: "Open task: Build intake" });
    fireEvent.click(openTask);
    expect(onEditTask).toHaveBeenCalledWith("task-1");
  });

  it("preserves optional drag callbacks and labels archive actions", () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const onArchiveTask = vi.fn();
    const completed = { ...task, status: "completed" as const };
    renderCard({ task: completed, onDragStart, onDragEnd, onArchiveTask });
    const card = screen.getByRole("article", { name: "Task: Build intake" });
    const dataTransfer = { setData: vi.fn() };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragEnd(card);
    fireEvent.click(screen.getByRole("button", { name: "Archive task Build intake" }));

    expect(onDragStart).toHaveBeenCalledOnce();
    expect(onDragEnd).toHaveBeenCalledOnce();
    expect(onArchiveTask).toHaveBeenCalledWith("task-1", true);
  });

  it("renders progress and bounded assignee details while preserving card-body activation", () => {
    const onEditTask = vi.fn();
    const detailedTask: TaskItem = {
      ...task,
      assignees: ["member-1", "member-2", "member-3", "member-4", "member-5"],
      subtasks: [
        { id: "sub-1", title: "Done", done: true },
        { id: "sub-2", title: "Pending", done: false },
      ],
      commentsCount: 2,
    };
    renderCard({
      task: detailedTask,
      onEditTask,
      teamProfiles: [{ uid: "member-1", nickname: "CircuitFox", avatar: "https://example.com/avatar.png" }],
    });

    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByAltText("CircuitFox")).toHaveAttribute("src", "https://example.com/avatar.png");
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Preserve the server-backed move path."));
    expect(onEditTask).toHaveBeenCalledWith("task-1");
  });

  it("shows a truthful overdue deadline without implying a time of day", () => {
    renderCard({ task: { ...task, dueDate: "2000-01-01" } });

    expect(screen.getByText("Overdue · Jan 1")).toBeInTheDocument();
    expect(screen.queryByText(/midnight/i)).not.toBeInTheDocument();
  });

  it("shows a readable summary for a legacy rich task description", () => {
    renderCard({
      duplicateCount: 3,
      task: {
        ...task,
        description: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "googleDriveEmbed",
              attrs: { title: "Ball Script", src: "https://docs.google.com/document/d/private-id/edit" },
            },
          ],
        }),
      },
    });

    expect(screen.getByText("Google Drive attachment: Ball Script")).toBeInTheDocument();
    expect(screen.getByText("Potential duplicate ×3")).toBeInTheDocument();
    expect(screen.queryByText(/private-id/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\"type\":\"doc\"/)).not.toBeInTheDocument();
  });
});
