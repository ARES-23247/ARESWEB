import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MermaidDiagram from "../components/docs/MermaidDiagram";

const renderMock = vi.fn();

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: (...args: unknown[]) => renderMock(...args),
  },
}));

describe("MermaidDiagram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a diagram to sanitized SVG with an accessible label", async () => {
    renderMock.mockResolvedValue({ svg: "<svg><g>diagram</g></svg>" });
    render(<MermaidDiagram code={"flowchart TD\n  A --> B"} />);

    await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("flowchart TD");
    expect(renderMock).toHaveBeenCalledWith(expect.any(String), "flowchart TD\n  A --> B");
    expect(screen.getByText(/flowchart TD/)).toBeInTheDocument();
  });

  it("uses the concise aria comment instead of diagram syntax", async () => {
    renderMock.mockResolvedValue({ svg: "<svg><g>diagram</g></svg>" });
    render(
      <MermaidDiagram
        code={"%% aria: Driver input becomes a safe motor command.\nflowchart LR\n  A --> B"}
      />,
    );

    await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Driver input becomes a safe motor command.",
    );
    expect(screen.getByText("Driver input becomes a safe motor command.")).toBeInTheDocument();
  });

  it("lets an explicit label override an aria comment", async () => {
    renderMock.mockResolvedValue({ svg: "<svg><g>diagram</g></svg>" });
    render(
      <MermaidDiagram
        code={"%% aria: Source summary.\nflowchart LR\n  A --> B"}
        label="Page-specific summary"
      />,
    );

    await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Page-specific summary",
    );
  });

  it("falls back to the diagram source when rendering fails", async () => {
    renderMock.mockRejectedValue(new Error("parse error"));
    render(<MermaidDiagram code={"not a diagram at all"} />);

    await waitFor(() => expect(screen.getByRole("note")).toBeInTheDocument());
    expect(screen.getByText("not a diagram at all")).toBeInTheDocument();
  });

  it("refuses oversized diagram sources without invoking mermaid", async () => {
    render(<MermaidDiagram code={"a".repeat(9_000)} />);
    await waitFor(() => expect(screen.getByRole("note")).toBeInTheDocument());
    expect(renderMock).not.toHaveBeenCalled();
  });
});
