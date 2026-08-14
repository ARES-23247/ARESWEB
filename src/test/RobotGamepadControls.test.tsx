import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RobotGamepadControlsPage from "../app/robots/controls/page";
import {
  CONTROLLER_BUTTONS,
  DRIVERS,
  filterMappings,
  getAvailableCategories,
  getMappingForButton,
  getMappingsForDriver,
  getSafetyInterlockSummary,
} from "@/lib/gamepadControlsData";

vi.mock("@/components/SEO", () => ({ default: () => null }));

describe("RobotGamepadControlsPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <RobotGamepadControlsPage />
      </MemoryRouter>,
    );

  it("renders the driver controls page with header and default Driver 1 view", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: /Driver Controls/i })).toBeInTheDocument();
    expect(screen.getByText(/Tele-Op Drive System Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/DRIVER 1 · FIELD PILOT/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Chassis Drivetrain & Field Navigation Pilot/i),
    ).toBeInTheDocument();
  });

  it("renders all controller quick-select buttons", () => {
    renderComponent();

    for (const btn of CONTROLLER_BUTTONS) {
      expect(
        screen.getByRole("button", { name: new RegExp(`Select ${btn.name}`, "i") }),
      ).toBeInTheDocument();
    }
  });

  it("displays the default selected control in Action Inspector (Left Stick)", () => {
    renderComponent();

    const inspector = screen.getByTestId("action-inspector");
    expect(inspector).toHaveTextContent(/Left Thumbstick/i);
    expect(inspector).toHaveTextContent(/Field-Centric Drivetrain/i);
    expect(inspector).toHaveTextContent(/0.08/i);
    expect(inspector).toHaveTextContent(/Cubic Exponential/i);
  });

  it("toggles between Driver 1 and Driver 2 and updates mappings", () => {
    renderComponent();

    const driver2Tab = screen.getByRole("tab", { name: /Driver 2: Systems Operator/i });
    fireEvent.click(driver2Tab);

    expect(screen.getByText(/DRIVER 2 · SYSTEMS OPERATOR/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Subsystems & Manipulator Operator/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Dual Viper Slides/i)).toBeInTheDocument();

    const driver1Tab = screen.getByRole("tab", { name: /Driver 1: Field Pilot/i });
    fireEvent.click(driver1Tab);

    expect(screen.getByText(/DRIVER 1 · FIELD PILOT/i)).toBeInTheDocument();
  });

  it("inspects button details when a controller button is clicked", () => {
    renderComponent();

    // Click Button A (South)
    const btnA = screen.getByRole("button", { name: /Select Button A/i });
    fireEvent.click(btnA);

    const inspector = screen.getByTestId("action-inspector");
    expect(inspector).toHaveTextContent(/Button A \(South\)/i);
    expect(inspector).toHaveTextContent(/Auto-Align to Scoring Submersible/i);
    expect(inspector).toHaveTextContent(/Automation/i);

    // Click Button B (East)
    const btnB = screen.getByRole("button", { name: /Select Button B/i });
    fireEvent.click(btnB);

    expect(inspector).toHaveTextContent(/Emergency Field Brake/i);
    expect(inspector).toHaveTextContent(/Primary defense stabilization lock/i);
  });

  it("supports SVG button clicks and hover states", () => {
    renderComponent();

    // Click SVG trigger directly
    const svgLt = screen.getByRole("button", { name: "Left Trigger" });
    fireEvent.click(svgLt);

    const inspector = screen.getByTestId("action-inspector");
    expect(inspector).toHaveTextContent(/Analog Dynamic Progressive Brake/i);

    // Test mouse enter / leave for hover preview
    fireEvent.mouseEnter(svgLt);
    fireEvent.mouseLeave(svgLt);
  });

  it("supports keyboard navigation on SVG buttons (Enter and Space keys)", () => {
    renderComponent();

    const svgRt = screen.getByRole("button", { name: "Right Trigger" });
    fireEvent.keyDown(svgRt, { key: "Enter", code: "Enter" });

    const inspector = screen.getByTestId("action-inspector");
    expect(inspector).toHaveTextContent(/Straight-Line Sprint Lock/i);

    const svgLb = screen.getByRole("button", { name: "Left Bumper" });
    fireEvent.keyDown(svgLb, { key: " ", code: "Space" });
    expect(inspector).toHaveTextContent(/Slow \/ Precision Maneuver Hold/i);
  });

  it("filters mappings table by search query", () => {
    renderComponent();

    const searchInput = screen.getByRole("searchbox", {
      name: /Search mapped driver actions/i,
    });
    fireEvent.change(searchInput, { target: { value: "Brake" } });

    expect(screen.getByText(/Emergency Field Brake/i)).toBeInTheDocument();
    expect(screen.getByText(/Analog Dynamic Progressive Brake/i)).toBeInTheDocument();
    expect(screen.queryByText(/Turbo Boost/i)).not.toBeInTheDocument();
  });

  it("filters mappings table by category pill", () => {
    renderComponent();

    const automationBtn = screen.getByRole("button", { name: "Automation" });
    fireEvent.click(automationBtn);

    expect(screen.getByText(/Auto-Align to Scoring Submersible/i)).toBeInTheDocument();
    expect(screen.getByText(/Auto-Align Specimen Rung/i)).toBeInTheDocument();
    expect(screen.queryByText(/Field-Centric Drivetrain/i)).not.toBeInTheDocument();
  });

  it("shows empty state and allows resetting filters", () => {
    renderComponent();

    const searchInput = screen.getByRole("searchbox", {
      name: /Search mapped driver actions/i,
    });
    fireEvent.change(searchInput, { target: { value: "nonexistent action query" } });

    expect(screen.getByText(/No matching controls found/i)).toBeInTheDocument();

    const resetBtn = screen.getByRole("button", { name: /Reset filters/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText(/Field-Centric Drivetrain/i)).toBeInTheDocument();
  });

  it("renders print cheat sheet section and handles print trigger", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    renderComponent();

    const printBtn = screen.getByRole("button", {
      name: /Print driver quick-reference cheat sheet/i,
    });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalledTimes(1);

    const printSection = document.querySelector(".driver-cards-print");
    expect(printSection).toBeInTheDocument();
    expect(printSection).toHaveTextContent(/ARES 23247 FTC · DRIVE TEAM CHEAT SHEET/i);
    expect(printSection).toHaveTextContent(/DRIVER 1: FIELD PILOT/i);
    expect(printSection).toHaveTextContent(/DRIVER 2: SYSTEMS OPERATOR/i);
  });

  it("selects a mapping from the table list", () => {
    renderComponent();

    const rowAction = screen.getByText(/Turbo Boost \/ Max Velocity Sprint/i);
    fireEvent.click(rowAction);

    const inspector = screen.getByTestId("action-inspector");
    expect(inspector).toHaveTextContent(/Right Bumper/i);
    expect(inspector).toHaveTextContent(/Turbo Boost/i);
  });
});

describe("Gamepad Controls Helper Data Functions", () => {
  it("retrieves all mappings for Driver 1 and Driver 2", () => {
    const d1Mappings = getMappingsForDriver("driver1");
    const d2Mappings = getMappingsForDriver("driver2");

    expect(d1Mappings.length).toBeGreaterThanOrEqual(14);
    expect(d2Mappings.length).toBeGreaterThanOrEqual(14);
    expect(d1Mappings.every((m) => m.driverId === "driver1")).toBe(true);
    expect(d2Mappings.every((m) => m.driverId === "driver2")).toBe(true);
  });

  it("retrieves specific button mapping by id", () => {
    const d1Stick = getMappingForButton("driver1", "left_stick");
    expect(d1Stick).toBeDefined();
    expect(d1Stick?.category).toBe("Drivetrain");

    const d2Claw = getMappingForButton("driver2", "left_bumper");
    expect(d2Claw).toBeDefined();
    expect(d2Claw?.actionName).toContain("Claw Gripper");

    const unknown = getMappingForButton("driver1", "nonexistent_btn");
    expect(unknown).toBeUndefined();
  });

  it("filters mappings with various queries and categories", () => {
    const emptyFilter = filterMappings("driver1", "", "All");
    expect(emptyFilter.length).toBe(getMappingsForDriver("driver1").length);

    const scoringFilter = filterMappings("driver2", "", "Scoring");
    expect(scoringFilter.length).toBeGreaterThan(0);
    expect(scoringFilter.every((m) => m.category === "Scoring")).toBe(true);

    const textFilter = filterMappings("driver2", "high basket");
    expect(textFilter.length).toBe(1);
    expect(textFilter[0].actionName).toContain("High Basket");
  });

  it("retrieves available categories and safety summaries", () => {
    const d1Cats = getAvailableCategories("driver1");
    expect(d1Cats).toContain("Drivetrain");
    expect(d1Cats).toContain("Automation");
    expect(d1Cats).toContain("System");

    const d2Summary = getSafetyInterlockSummary("driver2");
    expect(d2Summary.count).toBeGreaterThan(0);
    expect(d2Summary.items.length).toBe(d2Summary.count);
    expect(d2Summary.items[0]).toHaveProperty("action");
    expect(d2Summary.items[0]).toHaveProperty("interlocks");
  });

  it("has valid driver profile definitions", () => {
    expect(DRIVERS.driver1.id).toBe("driver1");
    expect(DRIVERS.driver2.id).toBe("driver2");
    expect(DRIVERS.driver1.subsystems.length).toBeGreaterThan(0);
    expect(DRIVERS.driver2.subsystems.length).toBeGreaterThan(0);
  });
});
