import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "@/components/ErrorBoundary";

function BrokenChild(): never {
  throw new Error("render exploded");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows recovery guidance while keeping diagnostics collapsed", () => {
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("This section could not be displayed");
    expect(screen.getByText(/support ID/i)).toBeVisible();
    expect(screen.getByText("Technical details").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Reload page" })).toBeVisible();
  });
});
