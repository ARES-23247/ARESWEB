import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DocumentDraftPreview from "@/components/dashboard/DocumentDraftPreview";
import { createDocumentEditorDraft } from "@/components/dashboard/documentEditorDraft";

vi.mock("@/components/docs/DocsMarkdownRenderer", () => ({
  default: ({ content }: { content: string }) => <div data-testid="markdown-preview">{content}</div>,
}));
vi.mock("@/components/TiptapRenderer", () => ({
  default: ({ node }: { node: { type: string } }) => <div data-testid="tiptap-preview">{node.type}</div>,
}));
vi.mock("@/components/docs/LearningMetadataPanel", () => ({
  default: ({ document }: { document: { subject: string } }) => <div data-testid="metadata-preview">{document.subject}</div>,
}));

function draft() {
  return createDocumentEditorDraft({
    editDoc: null,
    categories: ["Robotics & Engineering"],
    defaultCategory: "Robotics & Engineering",
    variant: "docs",
    currentUserNickname: "Lead Coach",
    today: "2026-08-25",
  });
}

describe("DocumentDraftPreview", () => {
  it("explains validation failures without saving the draft", () => {
    render(<DocumentDraftPreview draft={draft()} variant="docs" defaultCategory="Robotics & Engineering" />);
    expect(screen.getByRole("alert")).toHaveTextContent("A title and URL slug are required");
  });

  it("renders unsaved Markdown with the public learning metadata panel", () => {
    render(<DocumentDraftPreview
      draft={{ ...draft(), title: "Safe robot intent", slug: "safe-robot-intent", content: "# Safety first" }}
      variant="docs"
      defaultCategory="Robotics & Engineering"
    />);
    expect(screen.getByRole("heading", { name: "Safe robot intent" })).toBeInTheDocument();
    expect(screen.getByTestId("metadata-preview")).toHaveTextContent("robotics-engineering");
    expect(screen.getByTestId("markdown-preview")).toHaveTextContent("# Safety first");
    expect(screen.getByText(/does not save, approve, or publish/i)).toBeInTheDocument();
  });

  it("uses the same Tiptap renderer for an unsaved ProseMirror document", () => {
    render(<DocumentDraftPreview
      draft={{ ...draft(), title: "Structured lesson", slug: "structured-lesson", content: JSON.stringify({ type: "doc", content: [] }) }}
      variant="docs"
      defaultCategory="Robotics & Engineering"
    />);
    expect(screen.getByTestId("tiptap-preview")).toHaveTextContent("doc");
    expect(screen.queryByTestId("markdown-preview")).not.toBeInTheDocument();
  });
});
