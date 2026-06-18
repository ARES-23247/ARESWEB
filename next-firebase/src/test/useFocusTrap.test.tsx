import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useFocusTrap } from "../lib/useFocusTrap";

function TestTrapComponent({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const trapRef = useFocusTrap(isOpen, onClose);
  return (
    <div>
      <button data-testid="outside-btn">Outside</button>
      {isOpen && (
        <div ref={trapRef} data-testid="trap-container" tabIndex={-1}>
          <button data-testid="first-btn">First</button>
          <input data-testid="middle-input" />
          <button data-testid="last-btn">Last</button>
        </div>
      )}
    </div>
  );
}

describe("useFocusTrap", () => {
  it("should focus the first element in the trap after a timeout", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    
    render(<TestTrapComponent isOpen={true} onClose={onClose} />);
    
    // Check initial state before timer fires
    expect(document.activeElement).not.toBe(screen.getByTestId("first-btn"));

    // Fast-forward timeout (50ms)
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(document.activeElement).toBe(screen.getByTestId("first-btn"));
    vi.useRealTimers();
  });

  it("should trigger onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    
    render(<TestTrapComponent isOpen={true} onClose={onClose} />);
    
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should restore focus to the previously active element on unmount", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    
    // Focus outside button first
    render(<TestTrapComponent isOpen={false} onClose={onClose} />);
    const outsideBtn = screen.getByTestId("outside-btn");
    outsideBtn.focus();
    expect(document.activeElement).toBe(outsideBtn);

    // Mount trap container
    const { rerender } = render(<TestTrapComponent isOpen={true} onClose={onClose} />);
    
    // Run focus setup timer
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(document.activeElement).toBe(screen.getByTestId("first-btn"));

    // Unmount trap container (isOpen = false)
    rerender(<TestTrapComponent isOpen={false} onClose={onClose} />);
    
    expect(document.activeElement).toBe(outsideBtn);
    vi.useRealTimers();
  });
});
