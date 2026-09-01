import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SkipLink from "@/components/SkipLink";

describe("SkipLink", () => {
  afterEach(() => vi.restoreAllMocks());

  it("moves keyboard focus to the main content landmark", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    vi.spyOn(window.history, "replaceState");
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    render(
      <>
        <SkipLink />
        <main id="main-content" tabIndex={-1}>
          Main content
        </main>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Skip to main content" }));

    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "#main-content",
    );
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(document.getElementById("main-content")).toHaveFocus();
  });
});
