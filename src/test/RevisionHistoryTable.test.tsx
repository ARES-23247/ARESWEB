import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import RevisionHistoryTable from "../components/RevisionHistoryTable";

describe("RevisionHistoryTable", () => {
  const mockRevisions = [
    {
      id: "rev-1",
      editedByAvatar: "https://avatar.url/1",
      editedByName: "Alice",
      timestamp: "2026-06-18T10:00:00Z",
      title: "Initial draft",
      description: "Drafted tournament description.",
    },
    {
      id: "rev-2",
      editedByAvatar: "https://avatar.url/2",
      editedByName: "Bob",
      timestamp: "2026-06-18T11:00:00Z",
      title: "Updated times",
      description: "Changed starting time to 9 AM.",
    },
  ];

  it("renders the loading state", () => {
    render(
      <RevisionHistoryTable
        revisions={[]}
        isLoading={true}
        onRevert={vi.fn()}
      />
    );
    expect(screen.getByText(/Loading revision history/i)).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(
      <RevisionHistoryTable
        revisions={[]}
        isLoading={false}
        onRevert={vi.fn()}
      />
    );
    expect(screen.getByText(/No past revision logs recorded/i)).toBeInTheDocument();
  });

  it("renders the list of revisions", () => {
    render(
      <RevisionHistoryTable
        revisions={mockRevisions}
        isLoading={false}
        onRevert={vi.fn()}
      />
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Initial draft")).toBeInTheDocument();
    expect(screen.getByText("Updated times")).toBeInTheDocument();
    expect(screen.getByText("Drafted tournament description.")).toBeInTheDocument();
    expect(screen.getByText("Changed starting time to 9 AM.")).toBeInTheDocument();
  });

  it("calls onRevert when revert button is clicked", () => {
    const mockOnRevert = vi.fn();
    render(
      <RevisionHistoryTable
        revisions={mockRevisions}
        isLoading={false}
        onRevert={mockOnRevert}
      />
    );

    const buttons = screen.getAllByRole("button", { name: /Revert/i });
    expect(buttons.length).toBe(2);

    fireEvent.click(buttons[1]); // Click revert for Bob's revision
    expect(mockOnRevert).toHaveBeenCalledWith(mockRevisions[1]);
  });
});
