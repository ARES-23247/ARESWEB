import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DocumentDiffViewer from "@/components/dashboard/DocumentDiffViewer";
import { computeLineDiff } from "@/lib/diff";

describe("DocumentDiffViewer", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    currentTitle: "Autonomous Routines v2",
    currentContent: "Step 1: Intake\nStep 2: Score High Basket\nStep 3: Ascent Park",
    revisionTitle: "Autonomous Routines v1",
    revisionContent: "Step 1: Intake\nStep 2: Score Low Basket",
    revisionAuthor: "Lead Coach",
    revisionTimestamp: "2026-02-10T12:00:00Z",
    onRevert: vi.fn(),
  };

  it("renders diff statistics and compared document titles", () => {
    render(<DocumentDiffViewer {...defaultProps} />);

    expect(screen.getByText("Version Comparison")).toBeInTheDocument();
    expect(screen.getByText("Autonomous Routines v2")).toBeInTheDocument();
    expect(screen.getByText(/Lead Coach/)).toBeInTheDocument();

    // Check stats banner
    expect(screen.getByText(/\+2 lines added/)).toBeInTheDocument();
    expect(screen.getByText(/\-1 lines removed/)).toBeInTheDocument();
  });

  it("allows switching between unified and split view modes", () => {
    render(<DocumentDiffViewer {...defaultProps} />);

    const splitBtn = screen.getByRole("button", { name: /split/i });
    fireEvent.click(splitBtn);

    expect(screen.getByText("Current Draft")).toBeInTheDocument();
    expect(screen.getByText(/Revision \(Lead Coach\)/)).toBeInTheDocument();

    const unifiedBtn = screen.getByRole("button", { name: /unified/i });
    fireEvent.click(unifiedBtn);
    expect(screen.getByText(/\+2 lines added/)).toBeInTheDocument();
  });

  it("calls onRevert when restore button is clicked", () => {
    const onRevert = vi.fn();
    render(<DocumentDiffViewer {...defaultProps} onRevert={onRevert} />);

    const restoreBtn = screen.getByRole("button", { name: /Restore This Version/i });
    fireEvent.click(restoreBtn);

    expect(onRevert).toHaveBeenCalled();
  });

  it("closes the top-layer comparison with Escape", () => {
    const onClose = vi.fn();
    render(<DocumentDiffViewer {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps large comparisons bounded and disables the unbounded split view", () => {
    const largeRevision = Array.from({ length: 2_000 }, (_, index) => `old ${index}`).join("\n");
    const largeCurrent = Array.from({ length: 2_000 }, (_, index) => `new ${index}`).join("\n");
    render(
      <DocumentDiffViewer
        {...defaultProps}
        revisionContent={largeRevision}
        currentContent={largeCurrent}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("bounded preview");
    expect(screen.getByRole("button", { name: /split/i })).toBeDisabled();
  });

  it("preserves shared prefixes and suffixes in a bounded large comparison", () => {
    const original = [
      "shared heading",
      ...Array.from({ length: 1_100 }, (_, index) => `old ${index}`),
      "shared footer",
    ].join("\n");
    const compared = [
      "shared heading",
      ...Array.from({ length: 1_100 }, (_, index) => `new ${index}`),
      "shared footer",
    ].join("\n");

    const result = computeLineDiff(original, compared);

    expect(result.isSimplified).toBe(true);
    expect(result.unchangedCount).toBe(2);
    expect(result.lines[0]).toMatchObject({
      type: "unchanged",
      line: "shared heading",
      originalLineNumber: 1,
      comparedLineNumber: 1,
    });
    expect(result.lines.at(-1)).toMatchObject({
      type: "unchanged",
      line: "shared footer",
      originalLineNumber: 1_102,
      comparedLineNumber: 1_102,
    });
  });

  it("renders nothing when isOpen is false", () => {
    render(<DocumentDiffViewer {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
