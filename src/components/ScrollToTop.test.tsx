import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import ScrollToTop from "./ScrollToTop";

// Mock the useLocation hook
vi.mock("@tanstack/react-router", () => ({
  useLocation: vi.fn(() => ({ pathname: "/" }))
}));

import { useLocation } from "@tanstack/react-router";

describe("ScrollToTop Component", () => {
  let scrollToSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on window.scrollTo
    scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.mocked(useLocation).mockClear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useLocation).mockReturnValue({ pathname: "/" } as any);
  });

  afterEach(() => {
    scrollToSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("renders null (invisible component)", () => {
    const { container } = render(<ScrollToTop />);
    expect(container.firstChild).toBe(null);
  });

  it("scrolls to top on initial render", () => {
    render(
      <>
        <ScrollToTop />
        <div>Content</div>
      </>
    );
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("uses smooth scroll behavior", () => {
    render(<ScrollToTop />);
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" })
    );
  });

  it("scrolls to position (0, 0)", () => {
    render(<ScrollToTop />);
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ top: 0 })
    );
  });

  it("does not scroll when pathname has not changed", () => {
    const { rerender } = render(<ScrollToTop />);

    // Clear initial call
    scrollToSpy.mockClear();

    // Re-render without route change
    rerender(<ScrollToTop />);

    // Should not call scrollTo again since pathname hasn't changed
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("scrolls to top when pathname changes", () => {
    const { rerender } = render(<ScrollToTop />);
    
    scrollToSpy.mockClear();

    // Change pathname
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useLocation).mockReturnValue({ pathname: "/about" } as any);

    rerender(<ScrollToTop />);

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});

