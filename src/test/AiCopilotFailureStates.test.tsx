import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventEditorAiCopilot from "@/app/dashboard/events/components/EventEditorAiCopilot";
import DocFormDrawerAiCopilot from "@/components/dashboard/DocFormDrawerAiCopilot";
import { authenticatedFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));

describe("AI copilot failure states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticatedFetch).mockRejectedValue(new Error("provider-private-detail"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("keeps an event draft unchanged when grammar checking is unavailable", async () => {
    const setDescription = vi.fn();
    render(
      <EventEditorAiCopilot
        formTitle="Demo"
        formDescription="Original event description"
        setFormDescription={setDescription}
        formLocationId=""
        locations={[]}
        setRevertAlert={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run Spelling Audit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Grammar checking is temporarily unavailable",
    );
    expect(setDescription).not.toHaveBeenCalled();
    expect(screen.queryByText("offline check")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply Corrections" })).not.toBeInTheDocument();
  });

  it("does not offer fabricated document edits or generated copy after failures", async () => {
    const applyGrammarFixes = vi.fn();
    const appendContent = vi.fn();
    render(
      <DocFormDrawerAiCopilot
        formContent="Original document content"
        formTitle="Controls"
        formCategory="Engineering"
        onApplyGrammarFixes={applyGrammarFixes}
        onAppendContent={appendContent}
        setRevertAlert={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Verify Content Grammar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Grammar checking is temporarily unavailable",
    );
    expect(applyGrammarFixes).not.toHaveBeenCalled();
    expect(screen.queryByText("offline check")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Write a brief section/), {
      target: { value: "Draft a calibration paragraph" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate AI Draft" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(
      "Gemini is temporarily unavailable",
    ));
    expect(appendContent).not.toHaveBeenCalled();
    expect(screen.queryByText(/Local AI Fallback|Using offline fallback/)).not.toBeInTheDocument();
  });
});
