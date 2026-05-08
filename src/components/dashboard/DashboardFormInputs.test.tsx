import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardInput, DashboardTextarea, DashboardSubmitButton } from "./DashboardFormInputs";

describe("DashboardFormInputs Components", () => {
  describe("DashboardInput", () => {
    it("renders label and input correctly", () => {
      render(
        <DashboardInput
          id="test-input"
          label="Test Label"
          placeholder="Enter value"
        />
      );

      expect(screen.getByText("Test Label")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders with default ares-red focus color", () => {
      const { container } = render(
        <DashboardInput
          id="test-input"
          label="Test Label"
        />
      );

      const input = container.querySelector("input");
      expect(input).toHaveClass("focus:border-ares-red");
    });

    it("renders with ares-gold focus color", () => {
      const { container } = render(
        <DashboardInput
          id="test-input"
          label="Test Label"
          focusColor="ares-gold"
        />
      );

      const input = container.querySelector("input");
      expect(input).toHaveClass("focus:border-ares-gold");
    });

    it("renders with ares-cyan focus color", () => {
      const { container } = render(
        <DashboardInput
          id="test-input"
          label="Test Label"
          focusColor="ares-cyan"
        />
      );

      const input = container.querySelector("input");
      expect(input).toHaveClass("focus:border-ares-cyan");
    });

    it("renders with ares-bronze focus color", () => {
      const { container } = render(
        <DashboardInput
          id="test-input"
          label="Test Label"
          focusColor="ares-bronze"
        />
      );

      const input = container.querySelector("input");
      expect(input).toHaveClass("focus:border-ares-bronze");
    });

    it("applies fullWidth class when prop is true", () => {
      const { container } = render(
        <DashboardInput
          id="test-input"
          label="Test Label"
          fullWidth
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("md:col-span-2");
    });

    it("does not apply fullWidth class when prop is false", () => {
      const { container } = render(
        <DashboardInput
          id="test-input"
          label="Test Label"
          fullWidth={false}
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).not.toHaveClass("md:col-span-2");
    });

    it("renders error message when error prop is provided", () => {
      render(
        <DashboardInput
          id="test-input"
          label="Test Label"
          error="This field is required"
        />
      );

      expect(screen.getByText("This field is required")).toBeInTheDocument();
    });

    it("applies error border styling when error is present", () => {
      const { container } = render(
        <DashboardInput
          id="test-input"
          label="Test Label"
          error="Error"
        />
      );

      const input = container.querySelector("input");
      expect(input).toHaveClass("border-ares-red");
    });

    it("applies custom className", () => {
      const { container } = render(
        <DashboardInput
          id="test-input"
          label="Test Label"
          className="custom-class"
        />
      );

      const input = container.querySelector("input");
      expect(input).toHaveClass("custom-class");
    });

    it("passes through all input props", () => {
      const handleChange = vi.fn();
      const { container } = render(
        <DashboardInput
          id="test-input"
          label="Test Label"
          type="email"
          placeholder="test@example.com"
          value="test@example.com"
          onChange={handleChange}
          required
        />
      );

      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.type).toBe("email");
      expect(input.placeholder).toBe("test@example.com");
      expect(input.value).toBe("test@example.com");
      expect(input.required).toBe(true);
    });

    it("handles change events", () => {
      const handleChange = vi.fn();
      const { container } = render(
        <DashboardInput
          id="test-input"
          label="Test Label"
          onChange={handleChange}
        />
      );

      const input = container.querySelector("input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "new value" } });

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(input.value).toBe("new value");
    });

    it("associates label with input via htmlFor", () => {
      render(
        <DashboardInput
          id="test-input"
          label="Test Label"
        />
      );

      const input = screen.getByRole("textbox");
      const label = screen.getByText("Test Label");

      expect(label).toHaveAttribute("for", "test-input");
      expect(input).toHaveAttribute("id", "test-input");
    });

    it("has proper ARES styling classes", () => {
      const { container } = render(
        <DashboardInput
          id="test-input"
          label="Test Label"
        />
      );

      const input = container.querySelector("input");
      expect(input).toHaveClass("bg-white/5");
      expect(input).toHaveClass("border");
      expect(input).toHaveClass("ares-cut-sm");
      expect(input).toHaveClass("px-4");
      expect(input).toHaveClass("py-3");
      expect(input).toHaveClass("text-white");
    });

    it("label has proper styling classes", () => {
      render(
        <DashboardInput
          id="test-input"
          label="Test Label"
        />
      );

      const label = screen.getByText("Test Label");
      expect(label).toHaveClass("text-xs");
      expect(label).toHaveClass("font-bold");
      expect(label).toHaveClass("uppercase");
      expect(label).toHaveClass("tracking-widest");
      expect(label).toHaveClass("text-marble/50");
    });

    it("error text has proper styling", () => {
      render(
        <DashboardInput
          id="test-input"
          label="Test Label"
          error="Error message"
        />
      );

      const errorText = screen.getByText("Error message");
      expect(errorText.tagName).toBe("P");
      expect(errorText).toHaveClass("text-[10px]");
      expect(errorText).toHaveClass("font-black");
      expect(errorText).toHaveClass("uppercase");
      expect(errorText).toHaveClass("tracking-tighter");
      expect(errorText).toHaveClass("text-ares-red");
    });
  });

  describe("DashboardTextarea", () => {
    it("renders label and textarea correctly", () => {
      render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
          placeholder="Enter text"
        />
      );

      expect(screen.getByText("Test Label")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders with default ares-red focus color", () => {
      const { container } = render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
        />
      );

      const textarea = container.querySelector("textarea");
      expect(textarea).toHaveClass("focus:border-ares-red");
    });

    it("renders with ares-gold focus color", () => {
      const { container } = render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
          focusColor="ares-gold"
        />
      );

      const textarea = container.querySelector("textarea");
      expect(textarea).toHaveClass("focus:border-ares-gold");
    });

    it("renders with ares-cyan focus color", () => {
      const { container } = render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
          focusColor="ares-cyan"
        />
      );

      const textarea = container.querySelector("textarea");
      expect(textarea).toHaveClass("focus:border-ares-cyan");
    });

    it("renders with ares-bronze focus color", () => {
      const { container } = render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
          focusColor="ares-bronze"
        />
      );

      const textarea = container.querySelector("textarea");
      expect(textarea).toHaveClass("focus:border-ares-bronze");
    });

    it("applies fullWidth class when prop is true", () => {
      const { container } = render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
          fullWidth
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("lg:col-span-3");
    });

    it("does not apply fullWidth class when prop is false", () => {
      const { container } = render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
          fullWidth={false}
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).not.toHaveClass("lg:col-span-3");
    });

    it("renders error message when error prop is provided", () => {
      render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
          error="This field is required"
        />
      );

      expect(screen.getByText("This field is required")).toBeInTheDocument();
    });

    it("applies error border styling when error is present", () => {
      const { container } = render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
          error="Error"
        />
      );

      const textarea = container.querySelector("textarea");
      expect(textarea).toHaveClass("border-ares-red");
    });

    it("applies custom className", () => {
      const { container } = render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
          className="custom-class"
        />
      );

      const textarea = container.querySelector("textarea");
      expect(textarea).toHaveClass("custom-class");
    });

    it("passes through all textarea props", () => {
      const { container } = render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
          rows={10}
          cols={50}
          maxLength={500}
          value="Default value"
        />
      );

      const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
      expect(textarea.rows).toBe(10);
      expect(textarea.cols).toBe(50);
      expect(textarea.maxLength).toBe(500);
      expect(textarea.value).toBe("Default value");
    });

    it("handles change events", () => {
      const handleChange = vi.fn();
      const { container } = render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
          onChange={handleChange}
        />
      );

      const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "new value" } });

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(textarea.value).toBe("new value");
    });

    it("associates label with textarea via htmlFor", () => {
      render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
        />
      );

      const textarea = screen.getByRole("textbox");
      const label = screen.getByText("Test Label");

      expect(label).toHaveAttribute("for", "test-textarea");
      expect(textarea).toHaveAttribute("id", "test-textarea");
    });

    it("has proper ARES styling classes", () => {
      const { container } = render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
        />
      );

      const textarea = container.querySelector("textarea");
      expect(textarea).toHaveClass("bg-white/5");
      expect(textarea).toHaveClass("border");
      expect(textarea).toHaveClass("ares-cut-sm");
      expect(textarea).toHaveClass("px-4");
      expect(textarea).toHaveClass("py-3");
      expect(textarea).toHaveClass("text-white");
      expect(textarea).toHaveClass("min-h-[100px]");
    });

    it("has proper focus outline classes", () => {
      const { container } = render(
        <DashboardTextarea
          id="test-textarea"
          label="Test Label"
        />
      );

      const textarea = container.querySelector("textarea");
      expect(textarea).toHaveClass("outline-none");
      expect(textarea).toHaveClass("transition-colors");
    });
  });

  describe("DashboardSubmitButton", () => {
    it("renders default text when not pending", () => {
      render(
        <DashboardSubmitButton
          isPending={false}
          defaultText="Submit"
        />
      );

      expect(screen.getByText("Submit")).toBeInTheDocument();
    });

    it("renders pending text when isPending is true", () => {
      render(
        <DashboardSubmitButton
          isPending={true}
          pendingText="Processing..."
          defaultText="Submit"
        />
      );

      expect(screen.getByText("Processing...")).toBeInTheDocument();
      expect(screen.queryByText("Submit")).not.toBeInTheDocument();
    });

    it("renders default pending text when not specified", () => {
      render(
        <DashboardSubmitButton
          isPending={true}
          defaultText="Submit"
        />
      );

      expect(screen.getByText("Syncing...")).toBeInTheDocument();
    });

    it("renders icon when not pending", () => {
      render(
        <DashboardSubmitButton
          isPending={false}
          defaultText="Submit"
          icon={<span data-testid="test-icon">Icon</span>}
        />
      );

      expect(screen.getByTestId("test-icon")).toBeInTheDocument();
      expect(screen.getByText("Submit")).toBeInTheDocument();
    });

    it("does not render icon when pending", () => {
      render(
        <DashboardSubmitButton
          isPending={true}
          defaultText="Submit"
          icon={<span data-testid="test-icon">Icon</span>}
        />
      );

      expect(screen.queryByTestId("test-icon")).not.toBeInTheDocument();
    });

    it("applies red theme by default", () => {
      const { container } = render(
        <DashboardSubmitButton
          isPending={false}
          defaultText="Submit"
        />
      );

      const button = container.querySelector("button");
      expect(button).toHaveClass("bg-ares-red");
      expect(button).toHaveClass("text-white");
    });

    it("applies gold theme when specified", () => {
      const { container } = render(
        <DashboardSubmitButton
          isPending={false}
          defaultText="Submit"
          theme="gold"
        />
      );

      const button = container.querySelector("button");
      expect(button).toHaveClass("bg-gradient-to-r");
      expect(button).toHaveClass("from-ares-gold");
      expect(button).toHaveClass("text-black");
    });

    it("applies cyan theme when specified", () => {
      const { container } = render(
        <DashboardSubmitButton
          isPending={false}
          defaultText="Submit"
          theme="cyan"
        />
      );

      const button = container.querySelector("button");
      expect(button).toHaveClass("bg-ares-cyan");
      expect(button).toHaveClass("text-black");
    });

    it("disables button when isPending is true", () => {
      const { container } = render(
        <DashboardSubmitButton
          isPending={true}
          defaultText="Submit"
        />
      );

      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("enables button when isPending is false", () => {
      const { container } = render(
        <DashboardSubmitButton
          isPending={false}
          defaultText="Submit"
        />
      );

      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    it("has proper ARES styling classes", () => {
      const { container } = render(
        <DashboardSubmitButton
          isPending={false}
          defaultText="Submit"
        />
      );

      const button = container.querySelector("button");
      expect(button).toHaveClass("w-full");
      expect(button).toHaveClass("py-4");
      expect(button).toHaveClass("font-black");
      expect(button).toHaveClass("ares-cut");
      expect(button).toHaveClass("transition-all");
    });

    it("has type submit", () => {
      const { container } = render(
        <DashboardSubmitButton
          isPending={false}
          defaultText="Submit"
        />
      );

      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button.type).toBe("submit");
    });

    it("has flex layout for icon and text", () => {
      const { container } = render(
        <DashboardSubmitButton
          isPending={false}
          defaultText="Submit"
          icon={<span>Icon</span>}
        />
      );

      const button = container.querySelector("button");
      expect(button).toHaveClass("flex");
      expect(button).toHaveClass("items-center");
      expect(button).toHaveClass("justify-center");
      expect(button).toHaveClass("gap-2");
    });
  });
});
