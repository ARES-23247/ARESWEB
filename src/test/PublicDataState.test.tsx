import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicDataState } from "@/components/PublicDataState";

describe("PublicDataState", () => {
  it("renders user guidance and technical diagnostics", () => {
    render(
      <PublicDataState
        title="Unable to load events"
        message="Check your connection and try again."
        diagnostic="FirebaseError: Missing or insufficient permissions."
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load events");
    expect(screen.getByText("Check your connection and try again.")).toBeVisible();
    expect(screen.getByText("Diagnostic code: permission-denied")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("invokes the retry action", () => {
    const onRetry = vi.fn();
    render(<PublicDataState title="Unavailable" message="Retry the request." onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("redacts unexpected diagnostic details", () => {
    render(
      <PublicDataState
        title="Unavailable"
        message="Retry the request."
        diagnostic="Database host db-internal.example failed with secret-shaped detail"
      />
    );

    expect(screen.getByText("Diagnostic code: request-failed")).toBeVisible();
    expect(screen.queryByText(/db-internal\.example/)).not.toBeInTheDocument();
  });
});
