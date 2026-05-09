import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import ProjectBoardKanban, { TaskItem } from "./ProjectBoardKanban";

// Mock matchMedia for testing environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock TaskDetailsModal since it uses complex hooks
vi.mock("../kanban/TaskDetailsModal", () => ({
  default: () => <div data-testid="mock-task-details-modal">Details Modal</div>
}));

describe("ProjectBoardKanban Component", () => {
  const defaultProps = {
    tasks: [],
    isLoading: false,
    onCreateTask: vi.fn(),
    onUpdateTask: vi.fn().mockResolvedValue(undefined),
    onDeleteTask: vi.fn(),
    onReorder: vi.fn(),
    onRefresh: vi.fn(),
    isCreating: false
  };

  it("renders empty columns correctly", () => {
    render(<ProjectBoardKanban {...defaultProps} />);
    expect(screen.getAllByText("Todo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In Progress").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Done").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Parked").length).toBeGreaterThan(0);
  });

  it("renders tasks with assignees", async () => {
    const tasks = [
      {
        id: "t1",
        title: "Urgent fix",
        description: null,
        status: "todo",
        priority: "urgent",
        sort_order: 0,
        assignees: [{ id: "u1", nickname: "Alice" }],
        created_by: "u1",
        creator_name: "Test User",
        due_date: null,
        subteam: null,
        parent_id: null,
        time_spent_seconds: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
    ];
    await act(async () => {
      render(<ProjectBoardKanban {...defaultProps} tasks={tasks as TaskItem[]} />);
    });

    // Use findBy* instead of getBy* to wait for async state updates in GenericKanbanBoard
    expect(await screen.findByText("urgent")).toBeInTheDocument();
    expect(await screen.findByTitle("Alice")).toBeInTheDocument();
  });
});
