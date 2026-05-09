import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonthViewGrid } from "./MonthViewGrid";

// Mock @tanstack/react-router Link
vi.mock("@tanstack/react-router", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ children, to, params, className }: any) => {
    let href = to;
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        href = href?.replace(`$${key}`, value as string);
      });
    }
    return <a href={href} className={className}>{children}</a>;
  }
}));

// Mock QuickAddEventModal
vi.mock("./QuickAddEventModal", () => ({
  QuickAddEventModal: ({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="quick-add-modal">
        <button onClick={onClose}>Close</button>
        <button onClick={onSuccess}>Success</button>
      </div>
    );
  },
}));

// Mock queryClient
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

function renderWithRouter(component: React.ReactElement) {
  return render(component);
}

describe("MonthViewGrid Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders weekday headers", () => {
    renderWithRouter(<MonthViewGrid currentDate={new Date("2024-01-01")} events={[]} />);

    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.getByText("Thu")).toBeInTheDocument();
    expect(screen.getByText("Fri")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
  });

  it("renders calendar days for a month", () => {
    renderWithRouter(<MonthViewGrid currentDate={new Date("2024-01-01")} events={[]} />);

    // January 2024 has 31 days, calendar should show date numbers
    const day15 = screen.getByText("15");
    expect(day15).toBeInTheDocument();
  });

  it("renders without errors when events array is empty", () => {
    renderWithRouter(<MonthViewGrid currentDate={new Date("2024-01-01")} events={[]} />);

    // Should render the grid
    expect(screen.getByText("Sun")).toBeInTheDocument();
  });

  it("has proper grid structure", () => {
    const { container } = renderWithRouter(
      <MonthViewGrid currentDate={new Date("2024-01-01")} events={[]} />
    );

    // Should have main container
    const grid = container.querySelector(".grid");
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass("grid-cols-7");
  });

  it("has proper ARES styling classes", () => {
    const { container } = renderWithRouter(
      <MonthViewGrid currentDate={new Date("2024-01-01")} events={[]} />
    );

    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toHaveClass("w-full");
    expect(mainContainer).toHaveClass("flex");
    expect(mainContainer).toHaveClass("bg-obsidian");
    expect(mainContainer).toHaveClass("border");
    expect(mainContainer).toHaveClass("ares-cut-sm");
  });

  it("has proper accessibility attributes for add event buttons", () => {
    renderWithRouter(<MonthViewGrid currentDate={new Date("2024-01-01")} events={[]} />);

    const addButtons = screen.getAllByLabelText(/Add event on/);
    expect(addButtons.length).toBeGreaterThan(0);
    addButtons.forEach(button => {
      expect(button).toHaveAttribute("aria-label");
      expect(button.getAttribute("aria-label")).toMatch(/Add event on/);
    });
  });

  it("renders proper number of day cells", () => {
    renderWithRouter(<MonthViewGrid currentDate={new Date("2024-01-01")} events={[]} />);

    // Week grid should have multiple day cells
    const dayCells = screen.getAllByText(/^\d+$/);
    expect(dayCells.length).toBeGreaterThan(30);
  });

  it("has weekday header styling", () => {
    renderWithRouter(<MonthViewGrid currentDate={new Date("2024-01-01")} events={[]} />);

    const sundayHeader = screen.getByText("Sun");
    expect(sundayHeader).toHaveClass("text-xs");
    expect(sundayHeader).toHaveClass("font-bold");
    expect(sundayHeader).toHaveClass("uppercase");
    expect(sundayHeader).toHaveClass("tracking-widest");
  });

  it("handles leap year correctly", () => {
    renderWithRouter(<MonthViewGrid currentDate={new Date("2024-02-01")} events={[]} />);

    // February 2024 is a leap year with 29 days
    // Use getAllByText and find the one with current month styling (text-marble)
    const twentyNines = screen.getAllByText("29");
    const feb29 = twentyNines.find(el => el.className.includes("text-marble"));
    expect(feb29).toBeInTheDocument();
  });

  it("renders December with 31 days", () => {
    renderWithRouter(<MonthViewGrid currentDate={new Date("2024-12-01")} events={[]} />);

    expect(screen.getByText("31")).toBeInTheDocument();
  });

  it("has proper header row structure", () => {
    const { container } = renderWithRouter(
      <MonthViewGrid currentDate={new Date("2024-01-01")} events={[]} />
    );

    const headerGrid = container.querySelector(".grid-cols-7.border-b");
    expect(headerGrid).toBeInTheDocument();
    expect(headerGrid).toHaveClass("bg-white/5");
  });
});

