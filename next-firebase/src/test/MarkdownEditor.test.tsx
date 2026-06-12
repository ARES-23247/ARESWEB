import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import MarkdownEditor from "../components/MarkdownEditor";

// Simple wrapper to test state changes
function TestWrapper({ initialValue = "" }: { initialValue?: string }) {
  const [val, setVal] = useState(initialValue);
  return (
    <MarkdownEditor
      id="test-editor"
      value={val}
      onChange={setVal}
      placeholder="Type here..."
    />
  );
}

describe("MarkdownEditor Component", () => {
  it("renders the editor toolbar and textarea in write mode by default", () => {
    render(<TestWrapper />);
    
    // Check for toolbar buttons
    expect(screen.getByLabelText("Insert bold text")).toBeInTheDocument();
    expect(screen.getByLabelText("Insert italic text")).toBeInTheDocument();
    expect(screen.getByLabelText("Insert Heading 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Insert code block")).toBeInTheDocument();

    // Check for textarea
    const textarea = screen.getByPlaceholderText("Type here...") as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("inserts bold formatting wrapper when clicking the Bold button", async () => {
    render(<TestWrapper />);
    const textarea = screen.getByPlaceholderText("Type here...") as HTMLTextAreaElement;
    
    // Set some value and focus
    fireEvent.change(textarea, { target: { value: "Hello world" } });
    
    // Select the word "world" (indices 6 to 11)
    textarea.focus();
    textarea.setSelectionRange(6, 11);
    
    // Click bold button
    const boldButton = screen.getByLabelText("Insert bold text");
    fireEvent.click(boldButton);

    // It should insert ** around "world" -> "Hello **world**"
    expect(textarea.value).toBe("Hello **world**");
  });

  it("inserts Heading 3 prefix at start of the line", async () => {
    render(<TestWrapper initialValue={`Line one
Line two`} />);
    const textarea = screen.getByPlaceholderText("Type here...") as HTMLTextAreaElement;
    
    // Focus in the middle of Line two (index 14)
    textarea.focus();
    textarea.setSelectionRange(14, 14);
    console.log("TEST DEBUG: value =", JSON.stringify(textarea.value));
    console.log("TEST DEBUG: selectionStart =", textarea.selectionStart);

    // Click heading button
    const headingButton = screen.getByLabelText("Insert Heading 3");
    fireEvent.click(headingButton);

    // It should prepend "### " to the start of "Line two"
    expect(textarea.value).toBe(`Line one
### Line two`);
  });

  it("switches to preview mode and displays rendered markdown", async () => {
    const { container } = render(<TestWrapper initialValue={`### Welcome to ARES
This is **bold** text`} />);
    
    // Switch to preview mode
    const previewButton = screen.getByText("Preview");
    fireEvent.click(previewButton);

    console.log("TEST DEBUG: Rendered DOM =", container.innerHTML);

    // Textarea should no longer be visible
    expect(screen.queryByPlaceholderText("Type here...")).not.toBeInTheDocument();

    // Markdown content should render
    // Headings are rendered as h3 in our DocsMarkdownRenderer mapping for "### "
    const heading = screen.getByText("Welcome to ARES");
    expect(heading.tagName).toBe("H3");

    const boldText = screen.getByText("bold");
    expect(boldText.tagName).toBe("STRONG");
  });
});
