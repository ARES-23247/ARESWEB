import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import ScrollToTop from "./ScrollToTop";

// Test component to display current pathname
const DisplayLocation = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

describe("ScrollToTop Component", () => {
  let scrollToSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on window.scrollTo
    scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    scrollToSpy.mockRestore();
  });

  it("renders null (invisible component)", () => {
    const { container } = render(
      <BrowserRouter>
        <ScrollToTop />
      </BrowserRouter>
    );

    expect(container.firstChild).toBe(null);
  });

  it("scrolls to top when pathname changes", async () => {
    render(
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route path="/about" element={<div>About</div>} />
        </Routes>
      </BrowserRouter>
    );

    // Reset the mock
    scrollToSpy.mockClear();

    // Navigate to a different route
    window.history.pushState({}, "", "/about");
    window.dispatchEvent(new PopStateEvent("popstate"));

    // Wait for useEffect to run
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("scrolls to top on initial render", () => {
    render(
      <BrowserRouter>
        <ScrollToTop />
        <div>Content</div>
      </BrowserRouter>
    );

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("uses smooth scroll behavior", () => {
    render(
      <BrowserRouter>
        <ScrollToTop />
      </BrowserRouter>
    );

    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" })
    );
  });

  it("scrolls to position (0, 0)", () => {
    render(
      <BrowserRouter>
        <ScrollToTop />
      </BrowserRouter>
    );

    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ top: 0 })
    );
  });

  it("does not scroll when pathname has not changed", async () => {
    const { rerender } = render(
      <BrowserRouter>
        <ScrollToTop />
        <DisplayLocation />
      </BrowserRouter>
    );

    // Clear initial call
    scrollToSpy.mockClear();

    // Re-render without route change
    rerender(
      <BrowserRouter>
        <ScrollToTop />
        <DisplayLocation />
      </BrowserRouter>
    );

    // Should not call scrollTo again since pathname hasn't changed
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("handles hash changes without scrolling", async () => {
    render(
      <BrowserRouter>
        <ScrollToTop />
        <DisplayLocation />
      </BrowserRouter>
    );

    scrollToSpy.mockClear();

    // Change hash (same pathname, different hash)
    window.history.pushState({}, "", "/#section");
    window.dispatchEvent(new PopStateEvent("popstate"));

    await new Promise(resolve => setTimeout(resolve, 0));

    // Since pathname is still "/", it should not scroll
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("handles query parameter changes without scrolling", async () => {
    render(
      <BrowserRouter>
        <ScrollToTop />
        <DisplayLocation />
      </BrowserRouter>
    );

    scrollToSpy.mockClear();

    // Change query params (same pathname)
    window.history.pushState({}, "", "/?foo=bar");
    window.dispatchEvent(new PopStateEvent("popstate"));

    await new Promise(resolve => setTimeout(resolve, 0));

    // Since pathname is still "/", it should not scroll
    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
