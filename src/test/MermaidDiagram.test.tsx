import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MermaidDiagram from "../components/docs/MermaidDiagram";

vi.mock("@xyflow/react", () => ({
  MarkerType: { ArrowClosed: "arrowclosed" },
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  ReactFlow: ({
    nodes,
    edges,
  }: {
    nodes: Array<{ id: string; data: { label: string } }>;
    edges: Array<{ id: string; label?: string }>;
  }) => (
    <div data-testid="flowchart-canvas">
      {nodes.map((node) => (
        <span key={node.id}>{node.data.label}</span>
      ))}
      {edges.map((edge) => (
        <span key={edge.id}>{edge.label}</span>
      ))}
    </div>
  ),
}));

describe("MermaidDiagram", () => {
  it("renders a bounded flowchart with an accessible label", () => {
    render(
      <MermaidDiagram
        code={'flowchart TD\n  A["Start"] --> B{"Safe?"}'}
      />,
    );

    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "flowchart TD",
    );
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Safe?")).toBeInTheDocument();
  });

  it("uses the concise aria comment instead of diagram syntax", () => {
    render(
      <MermaidDiagram
        code={
          '%% aria: Driver input becomes a safe motor command.\nflowchart LR\n  A["Input"] --> B["Output"]'
        }
      />,
    );

    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Driver input becomes a safe motor command.",
    );
    expect(
      screen.getByText("Driver input becomes a safe motor command."),
    ).toBeInTheDocument();
  });

  it("lets an explicit label override an aria comment", () => {
    render(
      <MermaidDiagram
        code={
          '%% aria: Source summary.\nflowchart LR\n  A["Input"] --> B["Output"]'
        }
        label="Page-specific summary"
      />,
    );

    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Page-specific summary",
    );
  });

  it("falls back to source for unsupported diagram syntax", () => {
    render(<MermaidDiagram code={"sequenceDiagram\n  A->>B: hello"} />);

    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(screen.getByText(/sequenceDiagram/u)).toBeInTheDocument();
    expect(screen.getByText(/supports bounded Mermaid flowcharts/u)).toBeVisible();
  });

  it("refuses oversized and empty diagram sources", () => {
    const { rerender } = render(
      <MermaidDiagram code={"a".repeat(9_000)} />,
    );
    expect(screen.getByRole("note")).toBeInTheDocument();

    rerender(<MermaidDiagram code={""} />);
    expect(screen.getByText("(empty diagram)")).toBeInTheDocument();
  });
});
