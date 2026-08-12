import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFocusTrap } from "../lib/useFocusTrap";

function TestTrapComponent({
  isOpen,
  onClose,
  empty = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  empty?: boolean;
}) {
  const trapRef = useFocusTrap(isOpen, onClose);
  return (
    <div>
      <button data-testid="outside-btn">Outside</button>
      {isOpen && (
        <div ref={trapRef} data-testid="trap-container" tabIndex={-1}>
          {!empty && (
            <>
              <button hidden>Hidden</button>
              <button data-testid="first-btn">First</button>
              <input data-testid="middle-input" />
              <button data-testid="last-btn">Last</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NestedTraps({ innerOpen, closeOuter, closeInner }: {
  innerOpen: boolean;
  closeOuter: () => void;
  closeInner: () => void;
}) {
  const outerRef = useFocusTrap(true, closeOuter);
  const innerRef = useFocusTrap(innerOpen, closeInner);
  return (
    <div ref={outerRef} tabIndex={-1}>
      <button data-testid="outer-first">Outer first</button>
      <button data-testid="inner-trigger">Open inner</button>
      {innerOpen && (
        <div ref={innerRef} tabIndex={-1}>
          <button data-testid="inner-first">Inner first</button>
          <button data-testid="inner-last">Inner last</button>
        </div>
      )}
      <button data-testid="outer-last">Outer last</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("focuses the first available element and ignores hidden controls", () => {
    vi.useFakeTimers();
    render(<TestTrapComponent isOpen onClose={vi.fn()} />);

    act(() => vi.advanceTimersByTime(50));

    expect(screen.getByTestId("first-btn")).toHaveFocus();
    vi.useRealTimers();
  });

  it("wraps focus in both directions", () => {
    render(<TestTrapComponent isOpen onClose={vi.fn()} />);
    const first = screen.getByTestId("first-btn");
    const last = screen.getByTestId("last-btn");

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("redirects programmatic focus that escapes the top-layer trap", () => {
    render(<TestTrapComponent isOpen onClose={vi.fn()} />);

    screen.getByTestId("outside-btn").focus();

    expect(screen.getByTestId("first-btn")).toHaveFocus();
  });

  it("keeps focus on an empty trap", () => {
    render(<TestTrapComponent isOpen empty onClose={vi.fn()} />);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByTestId("trap-container")).toHaveFocus();
  });

  it("lets only the top nested trap handle Escape and restores its trigger", () => {
    vi.useFakeTimers();
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    const view = render(
      <NestedTraps innerOpen={false} closeOuter={closeOuter} closeInner={closeInner} />,
    );
    act(() => vi.advanceTimersByTime(50));
    screen.getByTestId("inner-trigger").focus();

    view.rerender(
      <NestedTraps innerOpen closeOuter={closeOuter} closeInner={closeInner} />,
    );
    act(() => vi.advanceTimersByTime(50));
    expect(screen.getByTestId("inner-first")).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();

    view.rerender(
      <NestedTraps innerOpen={false} closeOuter={closeOuter} closeInner={closeInner} />,
    );
    expect(screen.getByTestId("inner-trigger")).toHaveFocus();
    vi.useRealTimers();
  });

  it("restores focus to the exact trigger when the trap closes", () => {
    vi.useFakeTimers();
    const view = render(<TestTrapComponent isOpen={false} onClose={vi.fn()} />);
    const outside = screen.getByTestId("outside-btn");
    outside.focus();

    view.rerender(<TestTrapComponent isOpen onClose={vi.fn()} />);
    act(() => vi.advanceTimersByTime(50));
    expect(screen.getByTestId("first-btn")).toHaveFocus();

    view.rerender(<TestTrapComponent isOpen={false} onClose={vi.fn()} />);
    expect(outside).toHaveFocus();
    vi.useRealTimers();
  });
});
