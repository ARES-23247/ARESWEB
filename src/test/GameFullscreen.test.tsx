import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { DialogShell } from "@ares/ui/dialog";
import {
  GameFullscreenButton,
  useGameFullscreen,
} from "@/components/games/GameFullscreen";

function FullscreenHarness({ children }: { children?: ReactNode }) {
  const fullscreen = useGameFullscreen();
  return (
    <main
      ref={fullscreen.targetRef}
      data-game-fullscreen={fullscreen.isFullscreen || undefined}
    >
      <GameFullscreenButton
        isFullscreen={fullscreen.isFullscreen}
        onToggle={fullscreen.toggleFullscreen}
      />
      {children}
    </main>
  );
}

function mockFullscreenApi() {
  let fullscreenElement: Element | null = null;
  const requestFullscreen = vi.fn(async () => {
    fullscreenElement = document.documentElement;
    document.dispatchEvent(new Event("fullscreenchange"));
  });
  const exitFullscreen = vi.fn(async () => {
    fullscreenElement = null;
    document.dispatchEvent(new Event("fullscreenchange"));
  });

  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => fullscreenElement,
  });
  Object.defineProperty(document.documentElement, "requestFullscreen", {
    configurable: true,
    value: requestFullscreen,
  });
  Object.defineProperty(document, "exitFullscreen", {
    configurable: true,
    value: exitFullscreen,
  });

  return {
    exitFullscreen,
    requestFullscreen,
    setFullscreenElement: (element: Element | null) => {
      fullscreenElement = element;
    },
  };
}

afterEach(() => {
  Reflect.deleteProperty(document, "fullscreenElement");
  Reflect.deleteProperty(document.documentElement, "requestFullscreen");
  Reflect.deleteProperty(document, "exitFullscreen");
  document.body.style.overflow = "";
});

describe("game full-screen controls", () => {
  it("closes a portalled game dialog with Escape before leaving viewport fullscreen", async () => {
    const api = mockFullscreenApi();
    api.requestFullscreen.mockRejectedValueOnce(new Error("not allowed"));
    function DialogGame() {
      const [open, setOpen] = useState(false);
      return (
        <FullscreenHarness>
          <button onClick={() => setOpen(true)}>Browse gardens</button>
          <DialogShell open={open} onOpenChange={setOpen} title="Gardens">
            <button>Choose a garden</button>
          </DialogShell>
        </FullscreenHarness>
      );
    }
    render(<DialogGame />);
    fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
    await waitFor(() => expect(api.requestFullscreen).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Browse gardens" }));
    const choose = await screen.findByRole("button", {
      name: "Choose a garden",
    });
    fireEvent.keyDown(choose, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Exit full screen" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.getByRole("button", { name: "Enter full screen" }),
    ).toBeInTheDocument();
  });
  it("uses and exits the native Fullscreen API when available", async () => {
    const api = mockFullscreenApi();
    render(<FullscreenHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
    await waitFor(() => expect(api.requestFullscreen).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("button", { name: "Exit full screen" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    await waitFor(() => expect(api.exitFullscreen).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("button", { name: "Enter full screen" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("tracks an exit initiated by the browser", async () => {
    const api = mockFullscreenApi();
    render(<FullscreenHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
    await screen.findByRole("button", { name: "Exit full screen" });

    api.setFullscreenElement(null);
    fireEvent(document, new Event("fullscreenchange"));
    expect(
      screen.getByRole("button", { name: "Enter full screen" }),
    ).toBeInTheDocument();
  });

  it("keeps the viewport fallback when native entry is rejected", async () => {
    const api = mockFullscreenApi();
    api.requestFullscreen.mockRejectedValueOnce(new Error("not allowed"));
    render(<FullscreenHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
    await waitFor(() => expect(api.requestFullscreen).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("button", { name: "Exit full screen" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.getByRole("button", { name: "Enter full screen" }),
    ).toBeInTheDocument();
  });

  it("returns to the page when native entry resolves without a fullscreen element", async () => {
    const api = mockFullscreenApi();
    api.requestFullscreen.mockImplementationOnce(async () => undefined);
    render(<FullscreenHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Enter full screen" }),
      ).toBeInTheDocument();
    });
  });

  it("still exits the game shell if the browser's exit promise rejects", async () => {
    const api = mockFullscreenApi();
    api.exitFullscreen.mockRejectedValueOnce(new Error("exit failed"));
    render(<FullscreenHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
    await screen.findByRole("button", { name: "Exit full screen" });

    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    await waitFor(() => expect(api.exitFullscreen).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("button", { name: "Enter full screen" }),
    ).toBeInTheDocument();
  });

  it("cancels native entry that resolves after the user has already exited", async () => {
    let resolveRequest!: () => void;
    const pendingRequest = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    const api = mockFullscreenApi();
    api.requestFullscreen.mockImplementationOnce(() => pendingRequest);
    render(<FullscreenHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    api.setFullscreenElement(document.documentElement);
    await act(async () => resolveRequest());

    await waitFor(() => expect(api.exitFullscreen).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("button", { name: "Enter full screen" }),
    ).toBeInTheDocument();
  });

  it("releases native full screen when the game unmounts", async () => {
    const api = mockFullscreenApi();
    const { unmount } = render(<FullscreenHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
    await screen.findByRole("button", { name: "Exit full screen" });

    unmount();
    expect(api.exitFullscreen).toHaveBeenCalledOnce();
  });
});
