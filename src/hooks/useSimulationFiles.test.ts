 
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSimulationFiles, SavedSim, GithubSim } from "./useSimulationFiles";
import { logger } from "../utils/logger";

// Mock dependencies
vi.mock("../utils/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("../utils/constants", () => ({
  GITHUB_REPO: {
    rawUrl: "https://raw.githubusercontent.com/ARES-23247/ARESWEB/main",
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock window.location and window.history
const mockLocation = {
  href: "https://example.com/sim",
  search: "",
  origin: "https://example.com",
};

const mockHistory = {
  replaceState: vi.fn(),
};

Object.defineProperty(window, "location", {
  value: mockLocation,
  writable: true,
});

Object.defineProperty(window, "history", {
  value: mockHistory,
  writable: true,
});

describe("useSimulationFiles hook", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.search = "";
    mockHistory.replaceState.mockClear();

    // Mock fetch — vi.stubGlobal handles vitest v4 stricter Mock types
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    // Mock dynamic import of sonner
    vi.doMock("sonner", () => ({
      toast: {
        success: vi.fn(),
        error: vi.fn(),
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("should initialize with default state", () => {
      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      expect(result.current.savedSims).toEqual([]);
      expect(result.current.githubSims).toEqual([]);
      expect(result.current.isLoadingSims).toBe(false);
      expect(result.current.isLoadingGithubSims).toBe(false);
      expect(result.current.simId).toBeNull();
      expect(result.current.simName).toBe("Untitled Simulation");
    });

    it("should provide setter functions", () => {
      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      expect(typeof result.current.setSimId).toBe("function");
      expect(typeof result.current.setSimName).toBe("function");
      expect(typeof result.current.fetchSavedSims).toBe("function");
      expect(typeof result.current.fetchGithubSims).toBe("function");
      expect(typeof result.current.handleLoadSim).toBe("function");
      expect(typeof result.current.handleLoadGithubSim).toBe("function");
      expect(typeof result.current.handleLoadGist).toBe("function");
    });
  });

  describe("setSimId and setSimName", () => {
    it("should update simId state", () => {
      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      act(() => {
        result.current.setSimId("test-sim-123");
      });

      expect(result.current.simId).toBe("test-sim-123");
    });

    it("should update simName state", () => {
      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      act(() => {
        result.current.setSimName("My Custom Simulation");
      });

      expect(result.current.simName).toBe("My Custom Simulation");
    });
  });

  describe("fetchSavedSims", () => {
    it("should fetch and set saved simulations successfully", async () => {
      const mockSims: SavedSim[] = [
        {
          id: "1",
          name: "Sim 1",
          author_id: "user1",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-02",
        },
        {
          id: "2",
          name: "Sim 2",
          author_id: "user2",
          createdAt: "2024-01-03",
          updatedAt: "2024-01-04",
          type: "custom",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulations: mockSims }),
      });

      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.fetchSavedSims();
      });

      expect(result.current.savedSims).toEqual(mockSims);
      expect(result.current.isLoadingSims).toBe(false);
    });

    it("should handle empty simulations array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulations: [] }),
      });

      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.fetchSavedSims();
      });

      expect(result.current.savedSims).toEqual([]);
      expect(result.current.isLoadingSims).toBe(false);
    });

    it("should handle missing simulations field in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.fetchSavedSims();
      });

      expect(result.current.savedSims).toEqual([]);
    });

    it("should handle fetch error gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.fetchSavedSims();
      });

      expect(logger.error).toHaveBeenCalledWith(
        "[SimPlayground] Failed to fetch sims:",
        expect.any(Error)
      );
      expect(result.current.isLoadingSims).toBe(false);
    });

    it("should handle non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.fetchSavedSims();
      });

      expect(result.current.savedSims).toEqual([]);
      expect(result.current.isLoadingSims).toBe(false);
    });

    it("should set loading state during fetch", async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ simulations: [] }),
              });
            }, 100);
          })
      );

      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      act(() => {
        result.current.fetchSavedSims();
      });

      expect(result.current.isLoadingSims).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoadingSims).toBe(false);
      });
    });
  });

  describe("fetchGithubSims", () => {
    it("should fetch and set github simulations successfully", async () => {
      const mockGithubSims: GithubSim[] = [
        {
          id: "sim1",
          name: "GitHub Sim 1",
          path: "./sims/sim1",
          requiresContext: false,
        },
        {
          id: "sim2",
          name: "GitHub Sim 2",
          path: "./sims/sim2",
          requiresContext: true,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulators: mockGithubSims }),
      });

      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.fetchGithubSims();
      });

      expect(result.current.githubSims).toEqual(mockGithubSims);
      expect(result.current.isLoadingGithubSims).toBe(false);
    });

    it("should handle empty simulators array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulators: [] }),
      });

      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.fetchGithubSims();
      });

      expect(result.current.githubSims).toEqual([]);
    });

    it("should handle missing simulators field in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.fetchGithubSims();
      });

      expect(result.current.githubSims).toEqual([]);
    });

    it("should handle fetch error gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.fetchGithubSims();
      });

      expect(logger.error).toHaveBeenCalledWith(
        "[SimPlayground] Failed to fetch github sims:",
        expect.any(Error)
      );
      expect(result.current.isLoadingGithubSims).toBe(false);
    });

    it("should fetch from correct GitHub URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulators: [] }),
      });

      const mockCompileCode = vi.fn();
      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.fetchGithubSims();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/ARES-23247/ARESWEB/main/src/sims/simRegistry.json"
      );
    });
  });

  describe("handleLoadSim", () => {
    const mockSetFiles = vi.fn();
    const mockSetActiveFile = vi.fn();
    const mockCompileCode = vi.fn();

    beforeEach(() => {
      mockSetFiles.mockClear();
      mockSetActiveFile.mockClear();
      mockCompileCode.mockClear();
    });

    it("should load simulation with object files successfully", async () => {
      const mockSim = {
        id: "sim-123",
        name: "Test Simulation",
        files: {
          "main.tsx": "export default function App() { return <div /> }",
          "utils.ts": "export const helper = () => {}",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadSim("sim-123", mockSetFiles, mockSetActiveFile);
      });

      expect(mockSetFiles).toHaveBeenCalledWith(mockSim.files);
      expect(mockSetActiveFile).toHaveBeenCalledWith("main.tsx");
      expect(result.current.simName).toBe("Test Simulation");
      expect(result.current.simId).toBe("sim-123");
      expect(mockCompileCode).toHaveBeenCalledWith(mockSim.files);
      expect(mockHistory.replaceState).toHaveBeenCalled();
    });

    it("should load simulation with string files (JSON)", async () => {
      const mockFiles = {
        "index.tsx": "export default function App() { return <div /> }",
      };
      const mockSim = {
        id: "sim-456",
        name: "JSON Sim",
        files: JSON.stringify(mockFiles),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadSim("sim-456", mockSetFiles, mockSetActiveFile);
      });

      expect(mockSetFiles).toHaveBeenCalledWith(mockFiles);
      expect(mockSetActiveFile).toHaveBeenCalledWith("index.tsx");
    });

    it("should load simulation with invalid JSON string files", async () => {
      const mockSim = {
        id: "sim-789",
        name: "Invalid JSON Sim",
        files: "not a valid json string",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadSim("sim-789", mockSetFiles, mockSetActiveFile);
      });

      expect(mockSetFiles).toHaveBeenCalledWith({
        "sim-789": "not a valid json string",
      });
    });

    it("should handle empty files object", async () => {
      const mockSim = {
        id: "sim-empty",
        name: "Empty Files Sim",
        files: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadSim("sim-empty", mockSetFiles, mockSetActiveFile);
      });

      expect(mockSetFiles).toHaveBeenCalledWith({
        "SimComponent.jsx": "",
      });
      expect(mockSetActiveFile).toHaveBeenCalledWith("SimComponent.jsx");
    });

    it("should update URL with simId parameter", async () => {
      const mockSim = {
        id: "sim-url-test",
        name: "URL Test Sim",
        files: { "main.tsx": "code" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadSim("sim-url-test", mockSetFiles, mockSetActiveFile);
      });

      expect(mockHistory.replaceState).toHaveBeenCalledWith(
        {},
        "",
        expect.stringContaining("simId=sim-url-test")
      );
    });

    it("should handle fetch error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadSim("sim-error", mockSetFiles, mockSetActiveFile);
      });

      expect(logger.error).toHaveBeenCalledWith(
        "[SimPlayground] Load failed:",
        expect.any(Error)
      );
      expect(mockSetFiles).not.toHaveBeenCalled();
    });

    it("should handle non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadSim("sim-404", mockSetFiles, mockSetActiveFile);
      });

      expect(logger.error).toHaveBeenCalledWith(
        "[SimPlayground] Load failed:",
        expect.any(Error)
      );
    });

    it("should show toast success message", async () => {
      const mockSim = {
        id: "sim-toast",
        name: "Toast Test Sim",
        files: { "main.tsx": "code" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const sonner = await import("sonner");

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadSim("sim-toast", mockSetFiles, mockSetActiveFile);
      });

      expect(sonner.toast.success).toHaveBeenCalledWith("Loaded: Toast Test Sim");
    });

    it("should show toast error message on failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const sonner = await import("sonner");

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadSim("sim-error-toast", mockSetFiles, mockSetActiveFile);
      });

      expect(sonner.toast.error).toHaveBeenCalledWith("Failed to load simulation");
    });
  });

  describe("handleLoadGithubSim", () => {
    const mockSetFiles = vi.fn();
    const mockSetActiveFile = vi.fn();
    const mockCompileCode = vi.fn();

    beforeEach(() => {
      mockSetFiles.mockClear();
      mockSetActiveFile.mockClear();
      mockCompileCode.mockClear();
    });

    it("should load github simulation successfully", async () => {
      const mockSim: GithubSim = {
        id: "github-sim-1",
        name: "GitHub Sim 1",
        path: "./sims/test-sim",
        requiresContext: false,
      };
      const code = "export default function GitHubSim() { return <div /> }";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => code,
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGithubSim(mockSim, mockSetFiles, mockSetActiveFile);
      });

      const expectedFilename = "sims/test-sim/index.tsx";
      expect(mockSetFiles).toHaveBeenCalledWith({
        [expectedFilename]: code,
      });
      expect(mockSetActiveFile).toHaveBeenCalledWith(expectedFilename);
      expect(result.current.simName).toBe("GitHub Sim 1");
      expect(result.current.simId).toBe("github:github-sim-1");
      expect(mockCompileCode).toHaveBeenCalledWith({ [expectedFilename]: code });
    });

    it("should fetch from correct GitHub URL", async () => {
      const mockSim: GithubSim = {
        id: "test-sim",
        name: "Test",
        path: "./sims/test",
        requiresContext: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "code",
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGithubSim(mockSim, mockSetFiles, mockSetActiveFile);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/ARES-23247/ARESWEB/main/src/sims/sims/test/index.tsx"
      );
    });

    it("should handle paths without ./ prefix correctly", async () => {
      const mockSim: GithubSim = {
        id: "test-sim-2",
        name: "Test Sim 2",
        path: "sims/test-sim-2",
        requiresContext: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "code",
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGithubSim(mockSim, mockSetFiles, mockSetActiveFile);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/ARES-23247/ARESWEB/main/src/sims/sims/test-sim-2/index.tsx"
      );
    });

    it("should update URL with github simId parameter", async () => {
      const mockSim: GithubSim = {
        id: "github-url-test",
        name: "URL Test",
        path: "./sims/url-test",
        requiresContext: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "code",
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGithubSim(mockSim, mockSetFiles, mockSetActiveFile);
      });

      expect(mockHistory.replaceState).toHaveBeenCalledWith(
        {},
        "",
        expect.stringContaining("simId=github%3Agithub-url-test")
      );
    });

    it("should handle fetch error", async () => {
      const mockSim: GithubSim = {
        id: "github-error",
        name: "GitHub Error Sim",
        path: "./sims/error",
        requiresContext: false,
      };

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGithubSim(mockSim, mockSetFiles, mockSetActiveFile);
      });

      expect(logger.error).toHaveBeenCalledWith(
        "[SimPlayground] GitHub Load failed:",
        expect.any(Error)
      );
    });

    it("should handle non-ok response", async () => {
      const mockSim: GithubSim = {
        id: "github-404",
        name: "GitHub 404 Sim",
        path: "./sims/notfound",
        requiresContext: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGithubSim(mockSim, mockSetFiles, mockSetActiveFile);
      });

      expect(logger.error).toHaveBeenCalledWith(
        "[SimPlayground] GitHub Load failed:",
        expect.any(Error)
      );
    });

    it("should show toast success message", async () => {
      const mockSim: GithubSim = {
        id: "github-toast",
        name: "GitHub Toast Sim",
        path: "./sims/toast",
        requiresContext: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "code",
      });

      const sonner = await import("sonner");

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGithubSim(mockSim, mockSetFiles, mockSetActiveFile);
      });

      expect(sonner.toast.success).toHaveBeenCalledWith("Loaded Official Sim: GitHub Toast Sim");
    });

    it("should show toast error message on failure", async () => {
      const mockSim: GithubSim = {
        id: "github-error-toast",
        name: "GitHub Error Toast",
        path: "./sims/error-toast",
        requiresContext: false,
      };

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const sonner = await import("sonner");

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGithubSim(mockSim, mockSetFiles, mockSetActiveFile);
      });

      expect(sonner.toast.error).toHaveBeenCalledWith(
        "Failed to load GitHub Error Toast from GitHub"
      );
    });
  });

  describe("handleLoadGist", () => {
    const mockSetFiles = vi.fn();
    const mockSetActiveFile = vi.fn();
    const mockCompileCode = vi.fn();

    beforeEach(() => {
      mockSetFiles.mockClear();
      mockSetActiveFile.mockClear();
      mockCompileCode.mockClear();
    });

    it("should load gist simulation successfully", async () => {
      const mockGistId = "gist-abc123";
      const mockSim = {
        id: mockGistId,
        name: "Gist Test Sim",
        files: {
          "main.tsx": "export default function GistSim() { return <div /> }",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGist(mockGistId, mockSetFiles, mockSetActiveFile);
      });

      expect(mockSetFiles).toHaveBeenCalledWith(mockSim.files);
      expect(mockSetActiveFile).toHaveBeenCalledWith("main.tsx");
      expect(result.current.simName).toBe("Gist Test Sim");
      expect(result.current.simId).toBe(mockGistId);
      expect(mockCompileCode).toHaveBeenCalledWith(mockSim.files);
    });

    it("should fetch from correct gist API URL", async () => {
      const mockGistId = "gist-url-test";
      const mockSim = {
        id: mockGistId,
        name: "Gist URL Test",
        files: { "index.tsx": "code" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGist(mockGistId, mockSetFiles, mockSetActiveFile);
      });

      expect(mockFetch).toHaveBeenCalledWith(`/api/simulations/gist/${mockGistId}`);
    });

    it("should handle empty files object", async () => {
      const mockGistId = "gist-empty";
      const mockSim = {
        id: mockGistId,
        name: "Empty Gist Sim",
        files: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGist(mockGistId, mockSetFiles, mockSetActiveFile);
      });

      expect(mockSetFiles).toHaveBeenCalledWith({
        "SimComponent.jsx": "",
      });
      expect(mockSetActiveFile).toHaveBeenCalledWith("SimComponent.jsx");
    });

    it("should update URL with gist parameter (not simId)", async () => {
      const mockGistId = "gist-url-param";
      const mockSim = {
        id: mockGistId,
        name: "Gist URL Param Test",
        files: { "index.tsx": "code" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGist(mockGistId, mockSetFiles, mockSetActiveFile);
      });

      expect(mockHistory.replaceState).toHaveBeenCalledWith(
        {},
        "",
        expect.stringContaining("gist=gist-url-param")
      );
    });

    it("should remove simId from URL when loading gist", async () => {
      mockLocation.search = "?simId=old-sim-123";
      const mockGistId = "gist-clear";
      const mockSim = {
        id: mockGistId,
        name: "Clear SimId Test",
        files: { "index.tsx": "code" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGist(mockGistId, mockSetFiles, mockSetActiveFile);
      });

      const replaceCall = mockHistory.replaceState.mock.calls[0];
      const newUrl = replaceCall[2] as string;
      expect(newUrl).not.toContain("simId=");
      expect(newUrl).toContain("gist=gist-clear");
    });

    it("should handle fetch error", async () => {
      const mockGistId = "gist-error";
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGist(mockGistId, mockSetFiles, mockSetActiveFile);
      });

      expect(logger.error).toHaveBeenCalledWith(
        "[SimPlayground] Gist Load failed:",
        expect.any(Error)
      );
    });

    it("should handle non-ok response", async () => {
      const mockGistId = "gist-404";
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGist(mockGistId, mockSetFiles, mockSetActiveFile);
      });

      expect(logger.error).toHaveBeenCalledWith(
        "[SimPlayground] Gist Load failed:",
        expect.any(Error)
      );
    });

    it("should show toast success message", async () => {
      const mockGistId = "gist-toast";
      const mockSim = {
        id: mockGistId,
        name: "Gist Toast Sim",
        files: { "index.tsx": "code" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const sonner = await import("sonner");

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGist(mockGistId, mockSetFiles, mockSetActiveFile);
      });

      expect(sonner.toast.success).toHaveBeenCalledWith(`Loaded Gist: Gist Toast Sim`);
    });

    it("should show toast error message on failure", async () => {
      const mockGistId = "gist-error-toast";
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const sonner = await import("sonner");

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGist(mockGistId, mockSetFiles, mockSetActiveFile);
      });

      expect(sonner.toast.error).toHaveBeenCalledWith("Failed to load Gist simulation");
    });
  });

  describe("URL parameter handling on mount", () => {
    it("should load gist when gist parameter is in URL", async () => {
      mockLocation.search = "?gist=gist-from-url";
      const mockSim = {
        id: "gist-from-url",
        name: "Gist From URL",
        files: { "index.tsx": "code" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const mockCompileCode = vi.fn();

      renderHook(() => useSimulationFiles(mockCompileCode));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/simulations/gist/gist-from-url");
      });
    });

    it("should not load gist when simId parameter is in URL", async () => {
      mockLocation.search = "?simId=sim-from-url";
      const mockCompileCode = vi.fn();

      const { result } = renderHook(() => useSimulationFiles(mockCompileCode));

      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalledWith("/api/simulations/gist/");
      });

      expect(result.current.simId).toBeNull();
    });

    it("should not load anything when no URL parameters", async () => {
      mockLocation.search = "";
      const mockCompileCode = vi.fn();

      const { result } = renderHook(() => useSimulationFiles(mockCompileCode));

      expect(result.current.simId).toBeNull();
      expect(result.current.savedSims).toEqual([]);
    });
  });

  describe("compileCode integration", () => {
    it("should call compileCode after loading saved simulation", async () => {
      const mockSim = {
        id: "sim-compile",
        name: "Compile Test",
        files: { "main.tsx": "code" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const mockCompileCode = vi.fn().mockResolvedValue("compiled-code");

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadSim("sim-compile", vi.fn(), vi.fn());
      });

      expect(mockCompileCode).toHaveBeenCalledWith(mockSim.files);
    });

    it("should call compileCode after loading github simulation", async () => {
      const mockSim: GithubSim = {
        id: "gh-compile",
        name: "GitHub Compile Test",
        path: "./sims/compile-test",
        requiresContext: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "github-code",
      });

      const mockCompileCode = vi.fn().mockResolvedValue("compiled-code");

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGithubSim(mockSim, vi.fn(), vi.fn());
      });

      expect(mockCompileCode).toHaveBeenCalledWith({
        "sims/compile-test/index.tsx": "github-code",
      });
    });

    it("should call compileCode after loading gist simulation", async () => {
      const mockGistId = "gist-compile";
      const mockSim = {
        id: mockGistId,
        name: "Gist Compile Test",
        files: { "main.tsx": "gist-code" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ simulation: mockSim }),
      });

      const mockCompileCode = vi.fn().mockResolvedValue("compiled-code");

      const { result } = renderHook(() =>
        useSimulationFiles(mockCompileCode)
      );

      await act(async () => {
        await result.current.handleLoadGist(mockGistId, vi.fn(), vi.fn());
      });

      expect(mockCompileCode).toHaveBeenCalledWith(mockSim.files);
    });
  });
});

