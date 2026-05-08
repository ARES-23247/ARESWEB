import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PromptModal from "./PromptModal";

describe("PromptModal Component", () => {
  let mockSubmit: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSubmit = vi.fn();
    mockCancel = vi.fn();
    // Mock getBoundingClientRect for framer-motion measurements
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 400,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
      right: 400,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders when isOpen is true", () => {
    render(
      <PromptModal
        isOpen={true}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Please enter a value:"
      />
    );

    expect(screen.getByText("Please enter a value:")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <PromptModal
        isOpen={false}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Enter value:"
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container.firstChild).toBe(null);
  });

  it("renders custom title", () => {
    render(
      <PromptModal
        isOpen={true}
        title="Rename File"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Enter new filename:"
      />
    );

    expect(screen.getByText("Rename File")).toBeInTheDocument();
  });

  it("renders default title when none provided", () => {
    render(
      <PromptModal
        isOpen={true}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Test description"
      />
    );

    expect(screen.getByText("Input Required")).toBeInTheDocument();
  });

  it("renders custom button text", () => {
    render(
      <PromptModal
        isOpen={true}
        submitText="Save"
        cancelText="Discard"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Enter name:"
      />
    );

    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Discard")).toBeInTheDocument();
  });

  it("renders input field", () => {
    render(
      <PromptModal
        isOpen={true}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Type something:"
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Type your response...");
  });

  it("initializes input with defaultValue", () => {
    render(
      <PromptModal
        isOpen={true}
        defaultValue="Default Value"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Edit value:"
      />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("Default Value");
  });

  it("updates input value when user types", async () => {
    render(
      <PromptModal
        isOpen={true}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Type something:"
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hello World" } });

    expect(input).toHaveValue("Hello World");
  });

  it("calls onSubmit with input value when submit button is clicked", async () => {
    render(
      <PromptModal
        isOpen={true}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Enter value:"
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Test Value" } });

    const submitButton = screen.getByText("Submit");
    fireEvent.click(submitButton);

    expect(mockSubmit).toHaveBeenCalledWith("Test Value");
  });

  it("calls onCancel when cancel button is clicked", () => {
    render(
      <PromptModal
        isOpen={true}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Cancel test:"
      />
    );

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("calls onCancel when backdrop is clicked", () => {
    render(
      <PromptModal
        isOpen={true}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Click outside to cancel"
      />
    );

    // The backdrop is the first child of the fixed container (the motion.div with opacity)
    const fixedContainer = document.querySelector(".fixed.inset-0");
    const backdrop = fixedContainer?.firstElementChild;

    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockCancel).toHaveBeenCalledTimes(1);
    }
  });

  it("calls onSubmit when Enter key is pressed", async () => {
    render(
      <PromptModal
        isOpen={true}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Press enter to submit"
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Enter Test" } });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSubmit).toHaveBeenCalledWith("Enter Test");
  });

  it("calls onCancel when Escape key is pressed", () => {
    render(
      <PromptModal
        isOpen={true}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Press escape to cancel"
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("auto-focuses and selects input on open", async () => {
    render(
      <PromptModal
        isOpen={true}
        defaultValue="Select Me"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Auto focus test"
      />
    );

    await waitFor(() => {
      const input = screen.getByRole("textbox");
      expect(input).toHaveFocus();
    }, { timeout: 100 });
  });

  it("resets input value when reopening with different defaultValue", async () => {
    const { rerender } = render(
      <PromptModal
        isOpen={true}
        defaultValue="First Value"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Reset test:"
      />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("First Value");

    // Close and reopen with new default value
    rerender(
      <PromptModal
        isOpen={false}
        defaultValue="First Value"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Reset test:"
      />
    );

    rerender(
      <PromptModal
        isOpen={true}
        defaultValue="Second Value"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Reset test:"
      />
    );

    expect(input.value).toBe("Second Value");
  });

  it("has proper ARIA attributes", () => {
    render(
      <PromptModal
        isOpen={true}
        title="Prompt Title"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Prompt description"
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "prompt-modal-title");
    expect(dialog).toHaveAttribute("aria-describedby", "prompt-modal-desc");

    // The id is on the h3 and p elements directly, not their parent
    expect(screen.getByText("Prompt Title")).toHaveAttribute("id", "prompt-modal-title");
    expect(screen.getByText("Prompt description")).toHaveAttribute("id", "prompt-modal-desc");
  });

  it("handles empty input submission", () => {
    render(
      <PromptModal
        isOpen={true}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        description="Empty test:"
      />
    );

    const submitButton = screen.getByText("Submit");
    fireEvent.click(submitButton);

    expect(mockSubmit).toHaveBeenCalledWith("");
  });
});
