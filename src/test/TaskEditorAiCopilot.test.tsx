import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TaskEditorAiCopilot from "@/app/dashboard/tasks/components/TaskEditorAiCopilot";
import { authenticatedFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));

const mockedAuthenticatedFetch = vi.mocked(authenticatedFetch);

function renderCopilot() {
  render(
    <TaskEditorAiCopilot
      modalTitle="Repair drivetrain"
      modalSubteam="hardware"
      modalPriority="high"
      modalDesc="Inspect the left drive module."
      setModalDesc={vi.fn()}
      setRevertAlert={vi.fn()}
    />,
  );
}

describe("TaskEditorAiCopilot failure diagnostics", () => {
  beforeEach(() => {
    mockedAuthenticatedFetch.mockReset();
  });

  it("exposes grammar HTTP failures instead of silently returning no edits", async () => {
    mockedAuthenticatedFetch.mockResolvedValue(new Response(
      JSON.stringify({ error: "Requires author privileges" }),
      { status: 403, statusText: "Forbidden", headers: { "Content-Type": "application/json" } },
    ));
    renderCopilot();

    fireEvent.click(screen.getByRole("button", { name: "Verify Spelling & Grammar" }));

    await waitFor(() => expect(screen.getByText(/HTTP 403: Forbidden/)).toBeInTheDocument());
    expect(screen.getByText(/Requires author privileges/)).toBeInTheDocument();
  });

  it("does not fabricate fallback task content after an assistant failure", async () => {
    mockedAuthenticatedFetch.mockResolvedValue(new Response(
      JSON.stringify({ message: "Model unavailable" }),
      { status: 503, statusText: "Service Unavailable", headers: { "Content-Type": "application/json" } },
    ));
    renderCopilot();

    fireEvent.change(screen.getByLabelText("Instructions for the task AI writer"), {
      target: { value: "Expand the acceptance criteria" },
    });
    fireEvent.click(screen.getByRole("button", { name: "🚀 Ask AI" }));

    await waitFor(() => expect(screen.getByText(/HTTP 503: Service Unavailable/)).toBeInTheDocument());
    expect(screen.queryByText(/Using offline fallback/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Our team is committed/)).not.toBeInTheDocument();
  });
});
