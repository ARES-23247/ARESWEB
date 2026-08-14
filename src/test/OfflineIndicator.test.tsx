import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import OfflineIndicator from "@/components/OfflineIndicator";

describe("OfflineIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(statusBanner).toHaveTextContent("Interactive simulations, engineering references, and cached tools are fully operational.");
  });

  it("renders connection restored toast when online event fires", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    render(<OfflineIndicator />);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    const statusBanner = screen.getByRole("status");
    expect(statusBanner).toBeInTheDocument();
    expect(statusBanner).toHaveTextContent("Connected — Team portal sync restored.");
  });
});
