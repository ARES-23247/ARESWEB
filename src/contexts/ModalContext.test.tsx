import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ModalProvider, useModal } from "./ModalContext";
import { useState } from "react";

// Dummy component to consume ModalContext
const TestConsumer = () => {
  const modal = useModal();
  const [result, setResult] = useState<string | boolean | null>(null);

  return (
    <div>
      <div data-testid="result">{result?.toString()}</div>
      <button 
        data-testid="trigger-confirm" 
        onClick={async () => {
          const res = await modal.confirm({ title: "Test Confirm", description: "Confirm this?" });
          setResult(res);
        }}
      >
        Trigger Confirm
      </button>
      <button 
        data-testid="trigger-prompt" 
        onClick={async () => {
          const res = await modal.prompt({ title: "Test Prompt", description: "Prompt this?" });
          setResult(res);
        }}
      >
        Trigger Prompt
      </button>
    </div>
  );
};

const renderWithProvider = () => {
  return render(
    <ModalProvider>
      <TestConsumer />
    </ModalProvider>
  );
};

describe("ModalContext", () => {
  it("throws an error if useModal is used outside of ModalProvider", () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrowError("useModal must be used within a ModalProvider");

    spy.mockRestore();
  });

  describe("ConfirmModal", () => {
    it("resolves to true when the confirm button is clicked", async () => {
      renderWithProvider();

      fireEvent.click(screen.getByTestId("trigger-confirm"));
      
      expect(screen.getByText("Test Confirm")).toBeInTheDocument();
      expect(screen.getByText("Confirm this?")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Confirm"));

      await waitFor(() => {
        expect(screen.getByTestId("result")).toHaveTextContent("true");
      });
      // Ensure modal is closed
      await waitFor(() => {
        expect(screen.queryByText("Test Confirm")).not.toBeInTheDocument();
      });
    });

    it("resolves to false when the cancel button is clicked", async () => {
      renderWithProvider();

      fireEvent.click(screen.getByTestId("trigger-confirm"));
      fireEvent.click(screen.getByText("Cancel"));

      await waitFor(() => {
        expect(screen.getByTestId("result")).toHaveTextContent("false");
      });
    });

    it("resolves to false when the escape key is pressed", async () => {
      renderWithProvider();

      fireEvent.click(screen.getByTestId("trigger-confirm"));
      fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(screen.getByTestId("result")).toHaveTextContent("false");
      });
    });
  });

  describe("PromptModal", () => {
    it("resolves to the inputted string when submitted", async () => {
      renderWithProvider();

      fireEvent.click(screen.getByTestId("trigger-prompt"));
      
      expect(screen.getByText("Test Prompt")).toBeInTheDocument();
      const input = screen.getByPlaceholderText("Type your response...");

      fireEvent.change(input, { target: { value: "Hello World" } });
      fireEvent.click(screen.getByText("Submit"));

      await waitFor(() => {
        expect(screen.getByTestId("result")).toHaveTextContent("Hello World");
      });
    });

    it("resolves to null when cancelled", async () => {
      renderWithProvider();

      fireEvent.click(screen.getByTestId("trigger-prompt"));
      fireEvent.click(screen.getByText("Cancel"));

      await waitFor(() => {
        // null toString is not visible, but we can verify it clears or isn't a string
        expect(screen.getByTestId("result")).toBeEmptyDOMElement();
      });
    });

    it("submits the input when the enter key is pressed", async () => {
      renderWithProvider();

      fireEvent.click(screen.getByTestId("trigger-prompt"));
      
      const input = screen.getByPlaceholderText("Type your response...");
      fireEvent.change(input, { target: { value: "Quick Data" } });
      fireEvent.keyDown(window, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByTestId("result")).toHaveTextContent("Quick Data");
      });
    });
  });
});
