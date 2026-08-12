import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PwaUpdatePrompt from "@/components/PwaUpdatePrompt";

const { registerSWMock, updateServiceWorkerMock } = vi.hoisted(() => ({
  registerSWMock: vi.fn(),
  updateServiceWorkerMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("virtual:pwa-register", () => ({
  registerSW: registerSWMock,
}));

describe("PwaUpdatePrompt", () => {
  beforeEach(() => {
    registerSWMock.mockReturnValue(updateServiceWorkerMock);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("offers a controlled reload when a new service worker is ready", async () => {
    render(<PwaUpdatePrompt enabled />);
    const callbacks = registerSWMock.mock.calls[0][0];

    act(() => callbacks.onNeedRefresh());
    expect(screen.getByText("Portal update ready")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reload and update" }));
    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
  });

  it("announces offline readiness and permits dismissal", () => {
    render(<PwaUpdatePrompt enabled />);
    const callbacks = registerSWMock.mock.calls[0][0];

    act(() => callbacks.onOfflineReady());
    expect(screen.getByText("Ready for offline use")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Ready for offline use")).not.toBeInTheDocument();
  });

  it("exposes registration failures while leaving online browsing available", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<PwaUpdatePrompt enabled />);
    const callbacks = registerSWMock.mock.calls[0][0];

    act(() => callbacks.onRegisterError(new Error("registration denied")));
    expect(screen.getByText("Offline support unavailable")).toBeVisible();
    expect(screen.getByText(/registration denied/)).toHaveClass("font-mono");
  });
});
