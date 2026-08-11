import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary, { isStaleChunkError } from "@/components/ErrorBoundary";

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

  it("recognizes deployment chunk failures without classifying ordinary errors", () => {
    expect(isStaleChunkError("Failed to fetch dynamically imported module: /assets/page-old.js")).toBe(true);
    expect(isStaleChunkError("Importing a module script failed")).toBe(true);
    expect(isStaleChunkError("error loading dynamically imported module")).toBe(true);
    expect(isStaleChunkError("HTTP 503: Service Unavailable")).toBe(false);
  });
});
