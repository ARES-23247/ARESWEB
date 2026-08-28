import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TelemetryGraphLab, { makeGraph } from "@/sims/telemetry-graph-lab";

describe("TelemetryGraphLab", () => {
  it("breaks graph lines at a missing sample instead of inventing a value", () => {
    const graph = makeGraph([
      { time: 0, value: 1 },
      { time: 1, value: 2 },
      { time: 2, value: null },
      { time: 3, value: 4 },
    ]);
    expect(graph.points).toHaveLength(3);
    expect(graph.segments).toHaveLength(2);
  });

  it("lets keyboard-ready buttons classify evidence and resets deterministically", () => {
    render(<TelemetryGraphLab />);
    fireEvent.click(screen.getByRole("button", { name: /motor probably caused/u }));
    expect(screen.getByRole("status")).toHaveTextContent("possible explanation");

    fireEvent.click(screen.getByRole("button", { name: "Missing sample" }));
    fireEvent.click(screen.getByRole("button", { name: /no wheel-speed value/u }));
    expect(screen.getByRole("status")).toHaveTextContent("Correct");
    fireEvent.click(screen.getByText("Read the values as a table"));
    expect(screen.getByText("No sample")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("button", { name: "Voltage dip" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Choose one statement");
  });

  it("states that the teaching data is not authentic robot evidence", () => {
    render(<TelemetryGraphLab />);
    expect(screen.getByRole("note")).toHaveTextContent("not logs from a team robot");
  });
});
