import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import GearboxSimulator from "@/app/academy/widgets/GearboxSimulator";
import CenterOfMassEstimator from "@/app/academy/widgets/CenterOfMassEstimator";
import PidTuningVisualizer from "@/app/academy/widgets/PidTuningVisualizer";
import StemWidgetsHub from "@/app/academy/widgets/StemWidgetsHub";
import AcademyPlaygroundPage from "@/app/academy/playground/page";
import AcademyToolsPage from "@/app/academy/tools/page";

// Mock clipboard
const writeTextMock = vi.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: {
    writeText: writeTextMock,
  },
});

// Mock SimulationPlayground to keep unit tests fast
vi.mock("@/components/SimulationPlayground", () => ({
  default: () => <div data-testid="mock-simulation-playground">Simulation Playground Sandbox</div>,
}));

vi.mock("@/components/SEO", () => ({
  default: ({ title }: { title: string }) => <div data-testid="mock-seo">{title}</div>,
}));

describe("Academy Interactive STEM Widgets Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 1. GearboxSimulator Tests
   * ────────────────────────────────────────────────────────────────────────── */
  describe("GearboxSimulator", () => {
    it("renders default spur gear train with 9:1 ratio and correct speeds/torques", () => {
      render(<GearboxSimulator />);

      expect(screen.getByTestId("gearbox-simulator")).toBeInTheDocument();
      expect(screen.getByText(/Gear Ratio & Torque Simulator/i)).toBeInTheDocument();

      // Default spur: Stage 1 (14T->42T, 3:1) * Stage 2 (16T->48T, 3:1) = 9.00:1
      expect(screen.getByText("9.00")).toBeInTheDocument();

      // Free speed: 6000 / 9 = 667 RPM
      expect(screen.getByText("667")).toBeInTheDocument();

      // Output stall torque: 0.12 * 9 * (0.95^2) = 0.97 N·m
      expect(screen.getByText("0.97")).toBeInTheDocument();
    });

    it("calculates planetary reduction with sun, planet, and ring fixed teeth", () => {
      render(<GearboxSimulator />);

      // Switch to planetary architecture mode
      const planetaryButton = screen.getByRole("button", { name: /^Planetary$/i });
      fireEvent.click(planetaryButton);

      // Default planetary: Sun 12T, Planet 18T => Ring = 12 + 2*18 = 48T. Stage ratio = 1 + 48/12 = 5:1. 2 stages = 25:1.
      expect(screen.getByText(/48 Teeth/i)).toBeInTheDocument();
      expect(screen.getByText("25.00")).toBeInTheDocument();

      // Free speed: 6000 / 25 = 240 RPM
      expect(screen.getByText("240")).toBeInTheDocument();
    });

    it("calculates bevel gear reduction with 90° angle", () => {
      render(<GearboxSimulator />);

      // Switch to bevel architecture mode
      const bevelButton = screen.getByRole("button", { name: /^Bevel \(90°\)$/i });
      fireEvent.click(bevelButton);

      // Default bevel: Pinion 15T, Crown 30T => 2:1
      expect(screen.getByText("2.00")).toBeInTheDocument();
      expect(screen.getByText("3000")).toBeInTheDocument();
    });

    it("updates motor preset to NEO brushless and recalculates stall torque", () => {
      render(<GearboxSimulator />);

      const motorSelect = screen.getByLabelText(/Motor Model Preset/i);
      fireEvent.change(motorSelect, { target: { value: "neo_brushless" } });

      // NEO has free speed 5676 RPM, stall torque 3.75 N·m
      expect(screen.getByText("30.46")).toBeInTheDocument();
    });

    it("allows adding and removing spur stages dynamically", () => {
      render(<GearboxSimulator />);

      // Add stage
      const addStageBtn = screen.getByRole("button", { name: /\+ Add Stage/i });
      fireEvent.click(addStageBtn);

      expect(screen.getByText(/Stage 3/i)).toBeInTheDocument();

      // Remove stage 3
      const removeBtn = screen.getByRole("button", { name: /Remove stage 3/i });
      fireEvent.click(removeBtn);

      expect(screen.queryByText(/Stage 3/i)).not.toBeInTheDocument();
    });

    it("applies FTC YellowJacket 19.2:1 and FRC Toughbox presets", () => {
      render(<GearboxSimulator />);

      // Apply FTC preset
      const ftcPresetBtn = screen.getByRole("button", { name: /FTC YellowJacket 19.2:1/i });
      fireEvent.click(ftcPresetBtn);
      expect(screen.getByText("29.47")).toBeInTheDocument();

      // Apply FRC Toughbox preset
      const frcPresetBtn = screen.getByRole("button", { name: /FRC Toughbox 10.71:1/i });
      fireEvent.click(frcPresetBtn);
      expect(screen.getByText("10.71")).toBeInTheDocument();
    });

    it("toggles gear animation and copies formula to clipboard", async () => {
      render(<GearboxSimulator />);

      const animBtn = screen.getByRole("button", { name: /Pause gear animation/i });
      fireEvent.click(animBtn);
      expect(screen.getByRole("button", { name: /Play gear animation/i })).toBeInTheDocument();

      // Copy formulas
      const copyBtn = screen.getByRole("button", { name: /Copy Formulas/i });
      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalled();
      expect(await screen.findByText(/Copied to Clipboard!/i)).toBeInTheDocument();

      // Reset
      const resetBtn = screen.getByRole("button", { name: /Reset gearbox simulator to defaults/i });
      fireEvent.click(resetBtn);
      expect(screen.getByText("9.00")).toBeInTheDocument();
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 2. CenterOfMassEstimator Tests
   * ────────────────────────────────────────────────────────────────────────── */
  describe("CenterOfMassEstimator", () => {
    it("calculates 2D center of mass and static wheel loads correctly", () => {
      render(<CenterOfMassEstimator />);

      expect(screen.getByTestId("com-estimator")).toBeInTheDocument();
      expect(screen.getByText(/Center of Mass & Tipping Estimator/i)).toBeInTheDocument();

      // Total mass: 4.2 + 2.4 + 3.2 + 3.6 + 1.6 = 15.00 kg
      expect(screen.getByText("15.00")).toBeInTheDocument();

      expect(screen.getByText(/X:22.4/i)).toBeInTheDocument();
      expect(screen.getByText(/Y:10.1/i)).toBeInTheDocument();

      // Critical tipping angle
      expect(screen.getByText("62.8°")).toBeInTheDocument();
    });

    it("triggers tipping risk when incline slope shifts gravity line outside wheelbase", () => {
      render(<CenterOfMassEstimator />);

      const inclineSlider = screen.getByRole("slider");
      fireEvent.change(inclineSlider, { target: { value: "40" } });

      const highArmBtn = screen.getByRole("button", { name: /High Arm \(Tipping Risk\)/i });
      fireEvent.click(highArmBtn);

      fireEvent.change(inclineSlider, { target: { value: "35" } });
      expect(screen.getByText(/TIPPING RISK!/i)).toBeInTheDocument();
    });

    it("allows adding, editing, and removing components", () => {
      render(<CenterOfMassEstimator />);

      // Add component
      const addBtn = screen.getByRole("button", { name: /Add Component/i });
      fireEvent.click(addBtn);

      expect(screen.getByText(/Component 6/i)).toBeInTheDocument();

      // Remove component
      const deleteButtons = screen.getAllByLabelText(/Delete/i);
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);

      expect(screen.queryByText(/Component 6/i)).not.toBeInTheDocument();
    });

    it("copies center of mass formulas to clipboard and resets", async () => {
      render(<CenterOfMassEstimator />);

      const copyBtn = screen.getByRole("button", { name: /Copy Formulas/i });
      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalled();
      expect(await screen.findByText(/Copied to Clipboard!/i)).toBeInTheDocument();

      const resetBtn = screen.getByRole("button", { name: /Reset center of mass estimator to defaults/i });
      fireEvent.click(resetBtn);
      expect(screen.getByText("15.00")).toBeInTheDocument();
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 3. PidTuningVisualizer Tests
   * ────────────────────────────────────────────────────────────────────────── */
  describe("PidTuningVisualizer", () => {
    it("renders PID controller visualizer with default critically damped response", () => {
      render(<PidTuningVisualizer />);

      expect(screen.getByTestId("pid-visualizer")).toBeInTheDocument();
      expect(screen.getByText(/PID Controller Step-Response Visualizer/i)).toBeInTheDocument();
      expect(screen.getByText(/Critically Damped/i)).toBeInTheDocument();

      // Default Kp=1.8, Ki=0.4, Kd=0.32
      expect(screen.getByText("1.80")).toBeInTheDocument();
      expect(screen.getByText("0.40")).toBeInTheDocument();
      expect(screen.getByText("0.32")).toBeInTheDocument();
    });

    it("applies presets for Underdamped, Overdamped, and Flywheel velocity", () => {
      render(<PidTuningVisualizer />);

      // Underdamped preset
      const underdampedBtn = screen.getByRole("button", { name: /Underdamped \(Fast\)/i });
      fireEvent.click(underdampedBtn);
      expect(screen.getByText("2.80")).toBeInTheDocument();

      // Flywheel preset
      const flywheelBtn = screen.getByRole("button", { name: /Flywheel Velocity \+ FF/i });
      fireEvent.click(flywheelBtn);
      expect(screen.getByText("0.45")).toBeInTheDocument();
      expect(screen.getByText("0.85")).toBeInTheDocument();

      // Oscillatory preset
      const unstableBtn = screen.getByRole("button", { name: /Oscillatory Hunting/i });
      fireEvent.click(unstableBtn);
      expect(screen.getByText("7.50")).toBeInTheDocument();
    });

    it("switches physical plant models (Arm Position, Flywheel, Heading)", () => {
      render(<PidTuningVisualizer />);

      const flywheelPlantBtn = screen.getByRole("button", { name: /^Flywheel$/i });
      fireEvent.click(flywheelPlantBtn);
      expect(flywheelPlantBtn).toHaveClass("border-ares-gold");

      const headingPlantBtn = screen.getByRole("button", { name: /^Heading/i });
      fireEvent.click(headingPlantBtn);
      expect(headingPlantBtn).toHaveClass("border-ares-gold");
    });

    it("copies PID control law formulas to clipboard and resets", async () => {
      render(<PidTuningVisualizer />);

      const copyBtn = screen.getByRole("button", { name: /Copy Formulas/i });
      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalled();
      expect(await screen.findByText(/Copied to Clipboard!/i)).toBeInTheDocument();

      const resetBtn = screen.getByRole("button", { name: /Reset PID tuner to defaults/i });
      fireEvent.click(resetBtn);
      expect(screen.getByText("1.80")).toBeInTheDocument();
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 4. StemWidgetsHub & Page Routing Tests
   * ────────────────────────────────────────────────────────────────────────── */
  describe("StemWidgetsHub & Navigation", () => {
    it("switches tabs between Gearbox, Center of Mass, and PID controllers", () => {
      render(<StemWidgetsHub initialTab="gearbox" />);

      expect(screen.getByTestId("stem-widgets-hub")).toBeInTheDocument();
      expect(screen.getByTestId("gearbox-simulator")).toBeInTheDocument();

      // Switch to Center of Mass
      const comTab = screen.getByRole("tab", { name: /Center of Mass & Tipping/i });
      fireEvent.click(comTab);
      expect(screen.getByTestId("com-estimator")).toBeInTheDocument();

      // Switch to PID
      const pidTab = screen.getByRole("tab", { name: /PID Step-Response/i });
      fireEvent.click(pidTab);
      expect(screen.getByTestId("pid-visualizer")).toBeInTheDocument();
    });

    it("renders AcademyPlaygroundPage and switches between STEM Widgets and Code Sandbox", () => {
      render(
        <MemoryRouter initialEntries={["/academy/playground"]}>
          <Routes>
            <Route path="/academy/playground" element={<AcademyPlaygroundPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId("academy-playground-page")).toBeInTheDocument();
      expect(screen.getByTestId("stem-widgets-hub")).toBeInTheDocument();

      // Switch to Code Sandbox mode
      const sandboxTab = screen.getByRole("tab", { name: /Code Sandbox/i });
      fireEvent.click(sandboxTab);

      expect(screen.getByTestId("mock-simulation-playground")).toBeInTheDocument();
    });

    it("renders AcademyToolsPage standalone section with query parameter deep link", () => {
      render(
        <MemoryRouter initialEntries={["/academy/tools?tool=pid"]}>
          <Routes>
            <Route path="/academy/tools" element={<AcademyToolsPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId("stem-widgets-hub")).toBeInTheDocument();
      expect(screen.getByTestId("pid-visualizer")).toBeInTheDocument();
    });
  });
});
