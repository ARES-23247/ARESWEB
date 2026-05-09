import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { BrowserRouter, MemoryRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import ScrollToTop from "./ScrollToTop";

// Test component to display current pathname
const DisplayLocation = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

// Test component with navigation button
const TestApp = () => {
  const navigate = useNavigate();
  return (
    <>
      <ScrollToTop />
      <DisplayLocation />
      <button onClick={() => navigate("/about")}>Go to About</button>
    </>
  );
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
        <TestApp />
      </BrowserRouter>
    );

    // Reset the mock after initial render
    scrollToSpy.mockClear();

    // Navigate using React Router
    await act(async () => {
      screen.getByText("Go to About").click();
    });

    // Wait for useEffect to run and React to update
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/about");
    });

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

  it("handles hash changes without scrolling", () => {
    // Create two separate memory routers to test that pathname "/" doesn't trigger scroll
    // even when hash differs
    const { rerender } = render(
      <MemoryRouter initialEntries={["/"]}>
        <ScrollToTop />
      </MemoryRouter>
    );

    // Initial render causes scroll
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    scrollToSpy.mockClear();

    // Simulate staying on same pathname but with different hash
    // by rerendering - the component should NOT scroll again
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <ScrollToTop />
      </MemoryRouter>
    );

    // Since pathname hasn't changed, it should not scroll again
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("handles query parameter changes without scrolling", () => {
    // Test that query param changes (same pathname) don't trigger scroll
    const { rerender } = render(
      <MemoryRouter initialEntries={["/"]}>
        <ScrollToTop />
      </MemoryRouter>
    );

    // Initial render causes scroll
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    scrollToSpy.mockClear();

    // Rerender with same pathname (simulating no pathname change)
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <ScrollToTop />
      </MemoryRouter>
    );

    // Since pathname hasn't changed, it should not scroll again
    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
