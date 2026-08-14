import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import OfflineIndicator from "@/components/OfflineIndicator";

describe("OfflineIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders nothing when online by default", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    render(<OfflineIndicator />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders Pit Mode banner when offline event fires", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    render(<OfflineIndicator />);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const statusBanner = screen.getByRole("status");
    expect(statusBanner).toBeInTheDocument();
    expect(statusBanner).toHaveTextContent("Pit Mode:");
    expect(statusBanner).toHaveTextContent("Previously loaded pages may remain available, but live data and changes will not sync.");
  });

  it("renders connection restored toast when online event fires", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    render(<OfflineIndicator />);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    const statusBanner = screen.getByRole("status");
    expect(statusBanner).toBeInTheDocument();
    expect(statusBanner).toHaveTextContent("Network connection restored. Live data may take a moment to refresh.");
  });

  it("clears the transient reconnect status after its bounded timeout", () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    render(<OfflineIndicator />);

    act(() => window.dispatchEvent(new Event("online")));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3500));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
