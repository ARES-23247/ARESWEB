import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TaskSequenceLab, { evaluateTaskTree } from "@/sims/task-sequence-lab";

describe("TaskSequenceLab", () => {
  it("matches each current ARES task-group finish rule", () => {
    expect(
      evaluateTaskTree("sequence", "DRIVE", "DRIVE", "normal"),
    ).toMatchObject({
      builds: true,
      finishRule: "The group finishes after Task A, then Task B, finish.",
    });
    expect(
      evaluateTaskTree("parallel", "DRIVE", "INTAKE", "normal").finishRule,
    ).toContain("both tasks");
    expect(
      evaluateTaskTree("race", "DRIVE", "INTAKE", "normal").finishRule,
    ).toContain("first task");
    expect(
      evaluateTaskTree("deadline", "DRIVE", "INTAKE", "normal").finishRule,
    ).toContain("Task A decides");
  });

  it("allows sequential resource reuse and rejects concurrent overlap", () => {
    expect(
      evaluateTaskTree("sequence", "DRIVE", "DRIVE", "normal").builds,
    ).toBe(true);
    expect(
      evaluateTaskTree("parallel", "DRIVE", "DRIVE", "normal"),
    ).toMatchObject({
      builds: false,
      conflict:
        "parallel cannot be built because Task A and Task B both claim DRIVE.",
    });
    expect(evaluateTaskTree("race", "NONE", "NONE", "normal").builds).toBe(
      true,
    );
  });

  it("keeps failure, cancellation, cleanup actions, and dispatch ownership visible", () => {
    const failure = evaluateTaskTree("deadline", "DRIVE", "INTAKE", "failure");
    expect(failure.terminalRule).toContain("group fail");
    expect(failure.terminalRule).toContain("aborts queued and preempted work");
    expect(failure.actionsRule).toContain("lifecycle owner must dispatch");

    const cancellation = evaluateTaskTree(
      "parallel",
      "DRIVE",
      "INTAKE",
      "cancel",
    );
    expect(cancellation.terminalRule).toContain("group cancel");
    expect(cancellation.terminalRule).toContain("Interrupted cleanup");
  });

  it("supports native controls, live conflict feedback, and deterministic reset", () => {
    render(<TaskSequenceLab />);
    fireEvent.change(screen.getByLabelText("Task group"), { target: { value: "parallel" } });
    fireEvent.change(screen.getByLabelText("Task B resource"), {
      target: { value: "DRIVE" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Resource conflict");
    expect(screen.getByRole("status")).toHaveTextContent("both claim DRIVE");

    fireEvent.change(screen.getByLabelText("Task B resource"), {
      target: { value: "INTAKE" },
    });
    fireEvent.change(screen.getByLabelText("Trace event"), { target: { value: "failure" } });
    expect(
      screen.getByText(/A failed child makes the group fail/u),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Task group")).toHaveValue("sequence");
    expect(screen.getByLabelText("Task A resource")).toHaveValue("DRIVE");
    expect(screen.getByLabelText("Task B resource")).toHaveValue("INTAKE");
    expect(screen.getByRole("status")).toHaveTextContent("Tree can be built");
  });

  it("states a precise fidelity boundary", () => {
    render(<TaskSequenceLab />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("mirrors the current two-child group");
    expect(note).toHaveTextContent("does not build Kotlin");
    expect(note).toHaveTextContent("command hardware");
  });
});
