import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TaskFilters from "@/app/dashboard/tasks/components/TaskFilters";

function renderFilters(overrides: Partial<React.ComponentProps<typeof TaskFilters>> = {}) {
  const props: React.ComponentProps<typeof TaskFilters> = {
    canEdit: true,
    onOpenCreate: vi.fn(),
    sortBy: "newest",
    onSortByChange: vi.fn(),
    showArchived: false,
    onShowArchivedChange: vi.fn(),
    filterSubteam: "all",
    onFilterSubteamChange: vi.fn(),
    searchQuery: "",
    onSearchQueryChange: vi.fn(),
    showDuplicatesOnly: false,
    onShowDuplicatesOnlyChange: vi.fn(),
    duplicateTaskCount: 3,
    ...overrides,
  };
  render(<TaskFilters {...props} />);
  return props;
}

describe("TaskFilters", () => {
  it("exposes search, duplicate review, sorting, and subteam filters", () => {
    const props = renderFilters();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), {
      target: { value: "intake" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Potential duplicates (3)" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort:" }), {
      target: { value: "due" },
    });
    fireEvent.click(screen.getByRole("button", { name: "hardware" }));

    expect(props.onSearchQueryChange).toHaveBeenCalledWith("intake");
    expect(props.onShowDuplicatesOnlyChange).toHaveBeenCalledWith(true);
    expect(props.onSortByChange).toHaveBeenCalledWith("due");
    expect(props.onFilterSubteamChange).toHaveBeenCalledWith("hardware");
  });

  it("disables an empty duplicate filter while preserving viewer search", () => {
    renderFilters({ canEdit: false, duplicateTaskCount: 0 });

    expect(screen.queryByRole("button", { name: "Create Task" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search tasks" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Potential duplicates (0)" })).toBeDisabled();
  });
});
