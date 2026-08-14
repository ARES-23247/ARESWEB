import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
      value: new EventTarget(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("offers a controlled reload when a new service worker is ready", async () => {
    const reloadPage = vi.fn();
    render(<PwaUpdatePrompt enabled reloadPage={reloadPage} />);
    const callbacks = registerSWMock.mock.calls[0][0];

    act(() => callbacks.onNeedRefresh());
    expect(screen.getByText("Portal update ready")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reload and update" }));
    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled();

    act(() =>
      navigator.serviceWorker.dispatchEvent(new Event("controllerchange")),
    );
    expect(reloadPage).toHaveBeenCalledTimes(1);
    act(() => callbacks.onNeedReload());
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("recovers when an update never activates", async () => {
    vi.useFakeTimers();
    render(<PwaUpdatePrompt enabled reloadPage={vi.fn()} />);
    const callbacks = registerSWMock.mock.calls[0][0];

    act(() => callbacks.onNeedRefresh());
    fireEvent.click(screen.getByRole("button", { name: "Reload and update" }));
    await act(async () => vi.advanceTimersByTimeAsync(8_000));

    expect(
      screen.getByRole("button", { name: "Reload and update" }),
    ).toBeEnabled();
    expect(screen.getByText(/activation timed out/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByText("Portal update ready")).not.toBeInTheDocument();
  });

  it("dismisses an available update before activation starts", () => {
    render(<PwaUpdatePrompt enabled />);
    const callbacks = registerSWMock.mock.calls[0][0];

    act(() => callbacks.onNeedRefresh());
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );

    expect(screen.queryByText("Portal update ready")).not.toBeInTheDocument();
  });

  it("defers an available update with the Later action", () => {
    render(<PwaUpdatePrompt enabled />);
    const callbacks = registerSWMock.mock.calls[0][0];

    act(() => callbacks.onNeedRefresh());
    fireEvent.click(screen.getByRole("button", { name: "Later" }));

    expect(screen.queryByText("Portal update ready")).not.toBeInTheDocument();
  });

  it("reports an activation rejection and permits retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    updateServiceWorkerMock.mockRejectedValueOnce(
      new Error("activation blocked"),
    );
    render(<PwaUpdatePrompt enabled reloadPage={vi.fn()} />);
    const callbacks = registerSWMock.mock.calls[0][0];

    act(() => callbacks.onNeedRefresh());
    fireEvent.click(screen.getByRole("button", { name: "Reload and update" }));

    expect(await screen.findByText(/activation blocked/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reload and update" }),
    ).toBeEnabled();
  });

  it("checks a registered worker when connectivity returns and exposes update errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const update = vi
      .fn()
      .mockRejectedValue(new Error("update endpoint offline"));
    render(<PwaUpdatePrompt enabled />);
    const callbacks = registerSWMock.mock.calls[0][0];

    act(() =>
      callbacks.onRegisteredSW("/sw.js", {
        update,
      } as unknown as ServiceWorkerRegistration),
    );
    act(() => window.dispatchEvent(new Event("online")));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/update endpoint offline/i)).toBeVisible();
  });

  it("re-registers when connectivity returns before a worker is registered", () => {
    render(<PwaUpdatePrompt enabled />);

    act(() => window.dispatchEvent(new Event("online")));

    expect(registerSWMock).toHaveBeenCalledTimes(2);
  });

  it("announces offline readiness and permits dismissal", () => {
    render(<PwaUpdatePrompt enabled />);
    const callbacks = registerSWMock.mock.calls[0][0];

    act(() => callbacks.onOfflineReady());
    expect(screen.getByText("Ready for offline use")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );
    expect(screen.queryByText("Ready for offline use")).not.toBeInTheDocument();
  });

  it("recovers from a transient registration failure without showing an alert", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(<PwaUpdatePrompt enabled />);
    const firstCallbacks = registerSWMock.mock.calls[0][0];

    act(() =>
      firstCallbacks.onRegisterError(new Error("temporary network fault")),
    );
    expect(
      screen.queryByText("Offline support unavailable"),
    ).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_500));
    expect(registerSWMock).toHaveBeenCalledTimes(2);
    const retryCallbacks = registerSWMock.mock.calls[1][0];
    act(() => retryCallbacks.onRegisteredSW("/sw.js", { update: vi.fn() }));
    expect(
      screen.queryByText("Offline support unavailable"),
    ).not.toBeInTheDocument();
  });

  it("exposes repeated registration failures while leaving online browsing available", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<PwaUpdatePrompt enabled />);

    act(() =>
      registerSWMock.mock.calls[0][0].onRegisterError(
        new Error("registration denied"),
      ),
    );
    act(() => vi.advanceTimersByTime(1_500));
    act(() =>
      registerSWMock.mock.calls[1][0].onRegisterError(
        new Error("registration denied"),
      ),
    );
    act(() => vi.advanceTimersByTime(1_500));
    act(() =>
      registerSWMock.mock.calls[2][0].onRegisterError(
        new Error("registration denied"),
      ),
    );

    expect(screen.getByText("Offline support unavailable")).toBeVisible();
    expect(screen.getByText(/registration denied/)).toHaveClass("font-mono");
  });
});
