import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ProjectBoardKanban from "./ProjectBoardKanban";

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

describe("ProjectBoardKanban Component", () => {
  const defaultProps = {
    tasks: [],
    isLoading: false,
    isCreating: false,
    onCreateTask: vi.fn(),
    onUpdateTask: vi.fn(),
    onDeleteTask: vi.fn(),
    onReorder: vi.fn(),
    onRefresh: vi.fn(),
  };

  it("renders empty columns when tasks is empty", () => {
    render(<ProjectBoardKanban {...defaultProps} />);
    
    // Verify standard columns exist
    expect(screen.getAllByText("Todo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In Progress").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Done").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    
    // Check total count is displayed
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  it("renders tasks within correct columns", () => {
    const tasks = [
      { id: "1", title: "Task 1", status: "todo", priority: "normal", sort_order: 0, created_by: "u1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: "2", title: "Task 2", status: "in_progress", priority: "high", sort_order: 0, created_by: "u1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: "3", title: "Task 3", status: "done", priority: "normal", sort_order: 0, created_by: "u1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    render(<ProjectBoardKanban {...defaultProps} tasks={tasks} />);
    
    expect(screen.getByText("Task 1")).toBeInTheDocument();
    expect(screen.getByText("Task 2")).toBeInTheDocument();
    expect(screen.getByText("Task 3")).toBeInTheDocument();
  });

  it("shows loading state when loading with no tasks", () => {
    render(<ProjectBoardKanban {...defaultProps} isLoading={true} />);
    expect(screen.getByText("Loading task board...")).toBeInTheDocument();
  });

  it("renders priority badge for non-normal priority", () => {
    const tasks = [
      { id: "1", title: "Urgent Task", status: "todo", priority: "urgent", sort_order: 0, created_by: "u1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    render(<ProjectBoardKanban {...defaultProps} tasks={tasks} />);
    
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });
});
