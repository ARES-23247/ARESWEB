import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import Cad3DViewerPage, {
  ROBOT_CAD_MODELS,
  isWebGLAvailable,
} from "../app/cad/page";

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class MockWebGLRenderer {
    domElement = document.createElement("canvas");
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    toneMapping = 0;
    toneMappingExposure = 1;
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

vi.mock("three/examples/jsm/controls/OrbitControls.js", () => {
  class MockOrbitControls {
    enableDamping = true;
    dampingFactor = 0.05;
    maxPolarAngle = 1;
    minDistance = 8;
    maxDistance = 80;
    target = { set: vi.fn() };
    autoRotate = false;
    autoRotateSpeed = 2;
    update = vi.fn();
    dispose = vi.fn();
  }
  return { OrbitControls: MockOrbitControls };
});

vi.mock("@/components/SEO", () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="mock-seo" data-title={title} data-description={description} />
  ),
}));

describe("Cad3DViewerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { WebGLRenderingContext?: unknown }).WebGLRenderingContext;
  });

  it("renders the hero title, season badge, and SEO metadata", () => {
    render(
      <MemoryRouter>
        <Cad3DViewerPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /interactive 3d cad viewer/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/CAD & Subsystems/i)).toBeInTheDocument();
    expect(screen.getByText("FTC 2024-2025 // INTO THE DEEP")).toBeInTheDocument();

    const seo = screen.getByTestId("mock-seo");
    expect(seo).toHaveAttribute("data-title", "Interactive 3D CAD & Subsystem Viewer");
  });

  it("switches between robot models and updates assembly specs and subsystems", () => {
    render(
      <MemoryRouter>
        <Cad3DViewerPage />
      </MemoryRouter>
    );

    // Initial state: ARES XXIV
    expect(screen.getByRole("heading", { level: 2, name: "ARES XXIV // Apex" })).toBeInTheDocument();
    expect(screen.getByText("38.4 lbs")).toBeInTheDocument();
    expect(screen.getByText('17.8" x 17.5" x 13.9"')).toBeInTheDocument();
    expect(screen.getByText("5 Assemblies")).toBeInTheDocument();

    // Click on ARES XXIII Tab
    const ares23Tab = screen.getByRole("tab", { name: "ARES XXIII // Titan V2" });
    fireEvent.click(ares23Tab);

    // Verify switched model
    expect(screen.getByRole("heading", { level: 2, name: "ARES XXIII // Titan V2" })).toBeInTheDocument();
    expect(screen.getByText("36.2 lbs")).toBeInTheDocument();
    expect(screen.getByText('16.5" x 16.5" x 14.2"')).toBeInTheDocument();
    expect(screen.getByText("2 Assemblies")).toBeInTheDocument();
    expect(screen.getByText(/GoBILDA Strafer Chassis/i)).toBeInTheDocument();
    expect(screen.getByText(/Dual Pixel Angled Deposit Box/i)).toBeInTheDocument();
  });

  it("renders the graceful WebGL fallback when hardware acceleration is unavailable", () => {
    // In standard JSDOM, WebGL is not available, so fallback renders cleanly
    render(
      <MemoryRouter>
        <Cad3DViewerPage />
      </MemoryRouter>
    );

    const fallback = screen.getByTestId("cad-webgl-fallback");
    expect(fallback).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /webgl hardware acceleration unavailable/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your current browser or hardware environment does not support webgl/i)
    ).toBeInTheDocument();

    // Fallback actions
    const openOnshapeFallback = screen.getByRole("link", { name: /open in onshape/i });
    expect(openOnshapeFallback).toHaveAttribute("target", "_blank");
    expect(openOnshapeFallback).toHaveAttribute("rel", "noopener noreferrer");

    const downloadStepFallback = screen.getByRole("link", { name: /download step archive/i });
    expect(downloadStepFallback).toHaveAttribute("download");
  });

  it("renders and initializes Three.js canvas when WebGL is available", () => {
    // Mock WebGL context and WebGLRenderingContext
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    (window as unknown as { WebGLRenderingContext: unknown }).WebGLRenderingContext = class WebGLRenderingContext {};

    const mockGlContext = {
      getExtension: vi.fn(),
      getParameter: vi.fn().mockReturnValue(8),
      createTexture: vi.fn(),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      createBuffer: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      viewport: vi.fn(),
      clearColor: vi.fn(),
      clear: vi.fn(),
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(function (
      this: HTMLCanvasElement,
      contextType: string,
      ...args: unknown[]
    ) {
      if (contextType === "webgl" || contextType === "experimental-webgl") {
        return mockGlContext as unknown as RenderingContext;
      }
      return originalGetContext.apply(this, [contextType as "2d", ...(args as [CanvasRenderingContext2DSettings | undefined])]);
    }) as unknown as typeof originalGetContext;

    const mockAnimate = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(123);
    const mockCancelAnimate = vi.spyOn(window, "cancelAnimationFrame");

    try {
      expect(isWebGLAvailable()).toBe(true);

      render(
        <MemoryRouter>
          <Cad3DViewerPage />
        </MemoryRouter>
      );

      const canvasContainer = screen.getByTestId("cad-webgl-canvas");
      expect(canvasContainer).toBeInTheDocument();

      const canvas = canvasContainer.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute("role", "img");
      expect(canvas).toHaveAttribute("tabIndex", "0");
      expect(canvas).toHaveAttribute(
        "aria-label",
        expect.stringContaining("Interactive 3D CAD model viewer")
      );
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      mockAnimate.mockRestore();
      mockCancelAnimate.mockRestore();
      delete (window as unknown as { WebGLRenderingContext?: unknown }).WebGLRenderingContext;
    }
  });

  it("supports responsive viewport controls: camera presets, shading modes, auto-spin, and explode view", () => {
    render(
      <MemoryRouter>
        <Cad3DViewerPage />
      </MemoryRouter>
    );

    // Camera Presets
    const topPresetBtn = screen.getByRole("button", { name: /top camera view/i });
    fireEvent.click(topPresetBtn);
    expect(topPresetBtn).toHaveAttribute("aria-pressed", "true");

    const frontPresetBtn = screen.getByRole("button", { name: /front camera view/i });
    fireEvent.click(frontPresetBtn);
    expect(frontPresetBtn).toHaveAttribute("aria-pressed", "true");
    expect(topPresetBtn).toHaveAttribute("aria-pressed", "false");

    // Shading Mode Toggle
    const shadingBtn = screen.getByRole("button", { name: /current shading: solid/i });
    expect(shadingBtn).toBeInTheDocument();
    fireEvent.click(shadingBtn);
    expect(screen.getByRole("button", { name: /current shading: wireframe/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /current shading: wireframe/i }));
    expect(screen.getByRole("button", { name: /current shading: studio/i })).toBeInTheDocument();

    // Auto-spin toggle
    const spinBtn = screen.getByRole("button", { name: /toggle 3d auto rotation/i });
    expect(spinBtn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(spinBtn);
    expect(spinBtn).toHaveAttribute("aria-pressed", "false");

    // Exploded View toggle
    const explodeBtn = screen.getByRole("button", { name: /toggle exploded assembly view/i });
    expect(explodeBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(explodeBtn);
    expect(explodeBtn).toHaveAttribute("aria-pressed", "true");

    // Reset View button
    const resetBtn = screen.getByRole("button", { name: /reset view and camera/i });
    fireEvent.click(resetBtn);
    expect(explodeBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /iso camera view/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("renders Onshape direct integration links and verifies external security attributes", () => {
    render(
      <MemoryRouter>
        <Cad3DViewerPage />
      </MemoryRouter>
    );

    const onshapeHeaderLink = screen.getByLabelText(/open ares xxiv.*workspace on onshape cad/i);
    expect(onshapeHeaderLink).toHaveAttribute("href", ROBOT_CAD_MODELS[0].onshapeDocumentUrl);
    expect(onshapeHeaderLink).toHaveAttribute("target", "_blank");
    expect(onshapeHeaderLink).toHaveAttribute("rel", "noopener noreferrer");

    const printablesLink = screen.getByRole("link", {
      name: /open ares 3d models on printables/i,
    });
    expect(printablesLink).toHaveAttribute("href", "https://www.printables.com/@ARESFTC_3784306");
    expect(printablesLink).toHaveAttribute("target", "_blank");
    expect(printablesLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("toggles the embedded Onshape CAD viewer drawer when available", () => {
    render(
      <MemoryRouter>
        <Cad3DViewerPage />
      </MemoryRouter>
    );

    const launchOnshapeBtn = screen.getByRole("button", { name: /launch live onshape/i });
    expect(launchOnshapeBtn).toBeInTheDocument();
    expect(launchOnshapeBtn).toHaveAttribute("aria-expanded", "false");

    // Click to open embed
    fireEvent.click(launchOnshapeBtn);
    expect(screen.getByRole("button", { name: /hide onshape frame/i })).toBeInTheDocument();

    const iframe = screen.getByTitle(/ARES XXIV.*Onshape Model/i);
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-presentation");
    expect(iframe).toHaveAttribute("src", ROBOT_CAD_MODELS[0].onshapeEmbedUrl);

    // Click to close
    fireEvent.click(screen.getByRole("button", { name: /hide onshape frame/i }));
    expect(screen.queryByTitle(/ARES XXIV.*Onshape Model/i)).not.toBeInTheDocument();
  });

  it("interactively expands subsystem assembly cards and displays engineering breakdown", () => {
    render(
      <MemoryRouter>
        <Cad3DViewerPage />
      </MemoryRouter>
    );

    const subsystemList = screen.getByRole("list", { name: /robot subsystem assemblies/i });
    expect(subsystemList).toBeInTheDocument();

    const chassisCard = screen.getByText(/Holonomic Drivetrain & Odometry/i);
    expect(chassisCard).toBeInTheDocument();

    // Click to expand Chassis subsystem
    fireEvent.click(chassisCard);

    // Verify expanded technical specifications
    expect(screen.getByText("14.2 lbs")).toBeInTheDocument();
    expect(screen.getByText("48 parts")).toBeInTheDocument();
    expect(screen.getByText("4x REV UltraPlanetary HD Hex (19.2:1)")).toBeInTheDocument();
    expect(screen.getByText("3-DOF (X, Y, Theta)")).toBeInTheDocument();
    expect(screen.getByText(/Sprung dead-wheel odometry with 2048 CPR optical encoders/i)).toBeInTheDocument();

    // Verify subsystem action links
    const onshapeTabLink = screen.getByRole("link", { name: /onshape tab/i });
    expect(onshapeTabLink).toHaveAttribute("target", "_blank");
    expect(onshapeTabLink).toHaveAttribute("rel", "noopener noreferrer");

    const stepDownloadLink = screen.getByRole("link", { name: /^step$/i });
    expect(stepDownloadLink).toHaveAttribute("download");

    const stlDownloadLink = screen.getByRole("link", { name: /^stl$/i });
    expect(stlDownloadLink).toHaveAttribute("download");

    // Click "Show Full Robot" button to deselect
    const showFullRobotBtn = screen.getByRole("button", { name: /show all subsystems/i });
    fireEvent.click(showFullRobotBtn);

    expect(screen.queryByText("14.2 lbs")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show all subsystems/i })).not.toBeInTheDocument();
  });

  it("provides full robot STEP master assembly and 3D print pack download options", () => {
    render(
      <MemoryRouter>
        <Cad3DViewerPage />
      </MemoryRouter>
    );

    const stepDownloadBtn = screen.getByRole("link", {
      name: /download step \(38\.4 lbs\)/i,
    });
    expect(stepDownloadBtn).toHaveAttribute(
      "href",
      "https://aresfirst.org/cad/ares-xxiv-full-assembly.step"
    );
    expect(stepDownloadBtn).toHaveAttribute("download");

    const stlDownloadBtn = screen.getByRole("link", {
      name: /download stl pack/i,
    });
    expect(stlDownloadBtn).toHaveAttribute(
      "href",
      "https://aresfirst.org/cad/ares-xxiv-3d-print-pack.zip"
    );
    expect(stlDownloadBtn).toHaveAttribute("download");
  });

  it("tests isWebGLAvailable utility in node and browser conditions", () => {
    // In JSDOM without WebGL mock
    expect(isWebGLAvailable()).toBe(false);
  });
});
