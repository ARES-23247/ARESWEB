import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import MarkdownEditor from "../components/MarkdownEditor";

// Mock Firebase Storage
vi.mock("@/lib/firebase", () => ({
  storage: {}
}));

vi.mock("firebase/storage", () => ({
  ref: vi.fn((storage, path) => ({ path })),
  uploadBytes: vi.fn((ref, file) => Promise.resolve({ ref })),
  getDownloadURL: vi.fn((ref) =>
    Promise.resolve(`https://firebasestorage.googleapis.com/v0/b/mock/o/${encodeURIComponent(ref.path)}`)
  )
}));

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

  it("opens image embed modal and inserts image from URL", async () => {
    render(<TestWrapper initialValue="Initial text" />);
    const textarea = screen.getByPlaceholderText("Type here...") as HTMLTextAreaElement;

    // Click Insert Image button to open modal
    const imageButton = screen.getByLabelText("Insert image");
    fireEvent.click(imageButton);

    // Modal should render
    expect(screen.getByText("Embed Image")).toBeInTheDocument();

    // Switch to Image URL tab
    const urlTabButton = screen.getByText("Image URL");
    fireEvent.click(urlTabButton);

    // Focus and set selection range to end of text
    textarea.focus();
    textarea.setSelectionRange(12, 12);

    // Enter URL and Alt Text
    const urlInput = screen.getByPlaceholderText("https://example.com/image.png");
    fireEvent.change(urlInput, { target: { value: "https://example.com/robot.jpg" } });

    const altInput = screen.getByPlaceholderText("Describe image contents");
    fireEvent.change(altInput, { target: { value: "Robot Setup" } });

    // Submit form
    const insertButton = screen.getByRole("button", { name: "Insert Image" });
    fireEvent.click(insertButton);

    // Modal should close and image markdown should be appended
    expect(screen.queryByText("Embed Image")).not.toBeInTheDocument();
    expect(textarea.value).toBe("Initial text![Robot Setup](https://example.com/robot.jpg)");
  });

  it("uploads local file and embeds generated URL", async () => {
    const { container } = render(<TestWrapper initialValue="Start " />);
    const textarea = screen.getByPlaceholderText("Type here...") as HTMLTextAreaElement;

    // Open image modal
    const imageButton = screen.getByLabelText("Insert image");
    fireEvent.click(imageButton);

    // Focus and set selection range to end of text
    textarea.focus();
    textarea.setSelectionRange(6, 6);

    // Enter alt text first
    const altInput = screen.getByPlaceholderText("Describe image contents");
    fireEvent.change(altInput, { target: { value: "Intake Mechanism" } });

    // Create a mock image file
    const file = new File(["dummy content"], "intake.png", { type: "image/png" });

    // Find hidden file input and trigger upload
    const fileInput = container.querySelector("input[type='file']") as HTMLInputElement;


    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // Modal should close and markdown should embed the mock storage URL
    expect(screen.queryByText("Embed Image")).not.toBeInTheDocument();
    expect(textarea.value).toContain("Start ![Intake Mechanism](https://firebasestorage.googleapis.com/v0/b/mock/o/editor%2Fuploads%2F");
  });
});

