import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OfflineIndicator from "@/components/OfflineIndicator";
import PwaUpdatePrompt, { diagnosticMessage } from "@/components/PwaUpdatePrompt";
import { isStaleChunkError } from "@/components/ErrorBoundary";
import {
  listSimulationDrafts,
  getSimulationDraft,
  saveSimulationDraft,
} from "@/lib/simulationDrafts";
import { renderHook } from "@testing-library/react";
import { useEditorRecoveryDraft } from "@/components/dashboard/useEditorRecoveryDraft";
import { createDocumentEditorDraft } from "@/components/dashboard/documentEditorDraft";

const { registerSWMock, updateServiceWorkerMock } = vi.hoisted(() => ({
  registerSWMock: vi.fn(),
  updateServiceWorkerMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("virtual:pwa-register", () => ({
  registerSW: registerSWMock,
}));

describe("PWA Resilience Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerSWMock.mockReturnValue(updateServiceWorkerMock);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: new EventTarget(),
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Offline Fallback Banner & Connection Lifecycle", () => {
    it("remains dormant when application starts with active connection", () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      render(<OfflineIndicator />);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("displays Pit Mode banner with accessibility attributes upon network drop", () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      render(<OfflineIndicator />);

      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      const banner = screen.getByRole("status");
      expect(banner).toBeVisible();
      expect(banner).toHaveAttribute("aria-live", "polite");
      expect(banner).toHaveTextContent("Pit Mode:");
      expect(banner).toHaveTextContent(
        "You are offline. Previously loaded pages may remain available, but live data and changes will not sync.",
      );
    });

    it("renders connection restored notification when regaining connectivity and auto-dismisses", () => {
      vi.useFakeTimers();
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });
      render(<OfflineIndicator />);

      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      const banner = screen.getByRole("status");
      expect(banner).toBeVisible();
      expect(banner).toHaveTextContent(
        "Network connection restored. Live data may take a moment to refresh.",
      );

      // Verify timer boundary at 3500ms
      act(() => {
        vi.advanceTimersByTime(3499);
      });
      expect(screen.getByRole("status")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("handles rapid connection flapping without leaking timers or duplicate banners", () => {
      vi.useFakeTimers();
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      render(<OfflineIndicator />);

      act(() => window.dispatchEvent(new Event("offline")));
      expect(screen.getByText(/Pit Mode:/i)).toBeInTheDocument();

      act(() => window.dispatchEvent(new Event("online")));
      expect(screen.getByText(/Network connection restored/i)).toBeInTheDocument();

      act(() => window.dispatchEvent(new Event("offline")));
      expect(screen.getByText(/Pit Mode:/i)).toBeInTheDocument();

      act(() => window.dispatchEvent(new Event("online")));
      expect(screen.getByText(/Network connection restored/i)).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3500));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("Service Worker Update Detection & Periodic Checks", () => {
    it("surfaces update prompt when a new service worker version is waiting", () => {
      render(<PwaUpdatePrompt enabled />);
      const callbacks = registerSWMock.mock.calls[0][0];

      act(() => callbacks.onNeedRefresh());

      expect(screen.getByText("Portal update ready")).toBeVisible();
      expect(
        screen.getByText(/Reload when you are ready to use the latest version/i),
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Reload and update" }),
      ).toBeVisible();
      expect(screen.getByRole("button", { name: "Later" })).toBeVisible();
    });

    it("performs periodic update checks on the 1-hour interval when tab is visible", async () => {
      vi.useFakeTimers();
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      render(<PwaUpdatePrompt enabled />);
      const callbacks = registerSWMock.mock.calls[0][0];

      act(() => {
        callbacks.onRegisteredSW("/sw.js", {
          update: mockUpdate,
        } as unknown as ServiceWorkerRegistration);
      });

      expect(mockUpdate).not.toHaveBeenCalled();

      // Fast forward 1 hour (3600000 ms)
      await act(async () => {
        vi.advanceTimersByTime(60 * 60 * 1000);
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("triggers update check when tab visibility transitions from hidden to visible", async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      render(<PwaUpdatePrompt enabled />);
      const callbacks = registerSWMock.mock.calls[0][0];

      act(() => {
        callbacks.onRegisteredSW("/sw.js", {
          update: mockUpdate,
        } as unknown as ServiceWorkerRegistration);
      });

      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("skips background update check when document is hidden or navigator is offline", () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      render(<PwaUpdatePrompt enabled />);
      const callbacks = registerSWMock.mock.calls[0][0];

      act(() => {
        callbacks.onRegisteredSW("/sw.js", {
          update: mockUpdate,
        } as unknown as ServiceWorkerRegistration);
      });

      // Hidden document
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(mockUpdate).not.toHaveBeenCalled();

      // Offline document
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Automatic Reload Prompt & Controller Handshake", () => {
    it("handles full lifecycle: update ready -> initiate update -> controllerchange triggers single reload", async () => {
      const reloadMock = vi.fn();
      render(<PwaUpdatePrompt enabled reloadPage={reloadMock} />);
      const callbacks = registerSWMock.mock.calls[0][0];

      act(() => callbacks.onNeedRefresh());
      const updateButton = screen.getByRole("button", {
        name: "Reload and update",
      });
      fireEvent.click(updateButton);

      expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
      expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled();

      // Simulate service worker controller change event
      act(() => {
        navigator.serviceWorker.dispatchEvent(new Event("controllerchange"));
      });

      expect(reloadMock).toHaveBeenCalledTimes(1);

      // Verify onNeedReload does not cause duplicate reload loop
      act(() => callbacks.onNeedReload());
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it("times out gracefully after 8 seconds if worker activation stalls and permits retry", async () => {
      vi.useFakeTimers();
      const reloadMock = vi.fn();
      render(<PwaUpdatePrompt enabled reloadPage={reloadMock} />);
      const callbacks = registerSWMock.mock.calls[0][0];

      act(() => callbacks.onNeedRefresh());
      fireEvent.click(screen.getByRole("button", { name: "Reload and update" }));

      expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled();

      // Advance by activation timeout (8,000ms)
      await act(async () => {
        vi.advanceTimersByTimeAsync(8000);
      });

      expect(
        screen.getByText(/Update activation timed out. Reload this page or try the update again./i),
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Reload and update" }),
      ).toBeEnabled();
      expect(reloadMock).not.toHaveBeenCalled();
    });

    it("allows dismissing or deferring the reload prompt cleanly", () => {
      render(<PwaUpdatePrompt enabled />);
      const callbacks = registerSWMock.mock.calls[0][0];

      act(() => callbacks.onNeedRefresh());
      expect(screen.getByText("Portal update ready")).toBeVisible();

      // Click Later
      fireEvent.click(screen.getByRole("button", { name: "Later" }));
      expect(screen.queryByText("Portal update ready")).not.toBeInTheDocument();

      // Re-trigger update notice
      act(() => callbacks.onNeedRefresh());
      expect(screen.getByText("Portal update ready")).toBeVisible();

      // Click Dismiss (X)
      fireEvent.click(
        screen.getByRole("button", { name: "Dismiss notification" }),
      );
      expect(screen.queryByText("Portal update ready")).not.toBeInTheDocument();
    });

    it("handles diagnostic message formatting for various error inputs", () => {
      expect(diagnosticMessage(new Error("network failure"))).toBe(
        "network failure",
      );
      expect(diagnosticMessage("raw error string")).toBe("raw error string");
      expect(diagnosticMessage(404)).toBe("404");
      expect(diagnosticMessage({ custom: "obj" })).toBe("[object Object]");
    });
  });

  describe("Stale Chunk Detection & Error Self-Healing", () => {
    it("accurately classifies vite/rollup dynamic import chunk failures", () => {
      expect(
        isStaleChunkError("Failed to fetch dynamically imported module: /assets/Home-a1b2c3.js"),
      ).toBe(true);
      expect(
        isStaleChunkError("Importing a module script failed."),
      ).toBe(true);
      expect(
        isStaleChunkError("Error loading dynamically imported module"),
      ).toBe(true);
      expect(
        isStaleChunkError("FAILED TO FETCH DYNAMICALLY IMPORTED MODULE"),
      ).toBe(true);
    });

    it("distinguishes regular application or network errors from stale chunk errors", () => {
      expect(isStaleChunkError("NetworkError: Failed to fetch")).toBe(false);
      expect(isStaleChunkError("TypeError: Cannot read properties of undefined")).toBe(false);
      expect(isStaleChunkError("HTTP 503: Service Unavailable")).toBe(false);
      expect(isStaleChunkError("QuotaExceededError")).toBe(false);
    });
  });

  describe("Storage Quota Protection & Offline Persistence", () => {
    it("stores and retrieves simulation drafts within quota limits", () => {
      const mockDraft = {
        name: "Autonomous Nav v1",
        files: { "main.ts": "console.log('autonomous');" },
      };

      const saved = saveSimulationDraft(mockDraft);
      expect(saved.id).toBeDefined();
      expect(saved.name).toBe("Autonomous Nav v1");
      expect(saved.files["main.ts"]).toBe("console.log('autonomous');");

      const drafts = listSimulationDrafts();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].id).toBe(saved.id);

      const retrieved = getSimulationDraft(saved.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe("Autonomous Nav v1");
    });

    it("rejects simulation drafts exceeding 2MB serialized limit to prevent quota exhaustion", () => {
      const hugeString = "x".repeat(2.1 * 1024 * 1024);
      const oversizeDraft = {
        name: "Massive Draft",
        files: { "large.bin": hugeString },
      };

      expect(() => saveSimulationDraft(oversizeDraft)).toThrow(
        /draft is too large for local browser storage/i,
      );
    });

    it("limits total stored simulation drafts to 25 items", () => {
      for (let i = 0; i < 30; i++) {
        saveSimulationDraft({
          name: `Draft #${i}`,
          files: { "file.ts": `// content ${i}` },
        });
      }

      const drafts = listSimulationDrafts();
      expect(drafts).toHaveLength(25);
      expect(drafts[0].name).toBe("Draft #29");
    });

    it("handles corrupted localStorage JSON payload without crashing", () => {
      window.localStorage.setItem("ares_simulation_drafts_v1", "invalid-json{{{");
      expect(listSimulationDrafts()).toEqual([]);
      expect(getSimulationDraft("any-id")).toBeNull();
    });

    it("handles quota exceeded write failures gracefully in useEditorRecoveryDraft", () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError: DOM Exception 22");
      });

      const testDraft = createDocumentEditorDraft({
        editDoc: null,
        categories: ["Strategy"],
        defaultCategory: "Strategy",
        variant: "docs",
        currentUserNickname: "Lead Engineer",
      });

      const { result } = renderHook(() =>
        useEditorRecoveryDraft({
          draft: testDraft,
          isDirty: true,
          isOpen: true,
          storageKey: "test_doc_draft",
        }),
      );

      act(() => {
        const success = result.current.persistCurrentDraft();
        expect(success).toBe(false);
      });

      expect(result.current.draftError).toMatch(/could not be saved/i);
      expect(result.current.draftError).toMatch(/QuotaExceededError/i);
    });
  });
});
