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
  it("renders empty state when board is null", () => {
    render(<ProjectBoardKanban board={null} refreshBoard={vi.fn()} isRefreshing={false} />);
    expect(screen.getByText("GitHub Projects not configured")).toBeInTheDocument();
    expect(screen.getByText(/Set your/)).toBeInTheDocument();
  });

  it("renders empty columns when board has zero items", () => {
    const emptyBoard = {
      title: "Test Board",
      shortDescription: "Test Desc",
      items: [],
      totalCount: 0
    };
    render(<ProjectBoardKanban board={emptyBoard} refreshBoard={vi.fn()} isRefreshing={false} />);
    
    // Verify standard columns exist
    expect(screen.getByText("Todo")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    
    // Check total count is displayed
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders tasks within correct columns", () => {
    const board = {
      title: "Test Board",
      shortDescription: "Test Desc",
      items: [
        { id: "1", title: "Task 1", status: "Todo", updated_at: new Date().toISOString() },
        { id: "2", title: "Task 2", status: "In Progress", updated_at: new Date().toISOString() },
        { id: "3", title: "Task 3", status: "Done", updated_at: new Date().toISOString() },
      ],
      totalCount: 3
    };
    render(<ProjectBoardKanban board={board as any} refreshBoard={vi.fn()} isRefreshing={false} />);
    
    expect(screen.getByText("Task 1")).toBeInTheDocument();
    expect(screen.getByText("Task 2")).toBeInTheDocument();
    expect(screen.getByText("Task 3")).toBeInTheDocument();
  });
});
