import { fireEvent, render, screen, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import HardwareElectronicsPage, {
  HARDWARE_COMPONENTS,
  WIRE_GAUGES,
  CALC_PRESETS,
  INITIAL_CHECKLIST
} from "../app/hardware/page";

vi.mock("@/components/SEO", () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="mock-seo" data-title={title} data-description={description} />
  )
}));

describe("HardwareElectronicsPage Component Suite", () => {
  const renderComponent = () =>
    render(
      <BrowserRouter>
        <HardwareElectronicsPage />
      </BrowserRouter>
    );

  it("renders page header, title, SEO tags, and safety metric badge", () => {
    renderComponent();

    expect(screen.getByRole("heading", { level: 1, name: /Robot Hardware & Wiring Inspector/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Electrical Architecture/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/FTC #23247 Hardware Engineering/i)).toBeInTheDocument();
    expect(screen.getByText(/Electrical Safety Rating/i)).toBeInTheDocument();
    expect(screen.getAllByText(/100%/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/FTC Rule Compliant/i)).toBeInTheDocument();

    const seo = screen.getByTestId("mock-seo");
    expect(seo).toHaveAttribute("data-title", "Robot Hardware & Electrical Architecture");
    expect(seo).toHaveAttribute("data-description", expect.stringContaining("REV Robotics Control Hub"));
  });

  it("renders all 5 primary navigation tabs and allows smooth tab switching", () => {
    renderComponent();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs[0]).toHaveTextContent(/Bus Topology & Circuit Diagram/i);
    expect(tabs[1]).toHaveTextContent(/Component & Pinout Inspector/i);
    expect(tabs[2]).toHaveTextContent(/Wire Gauge & Voltage Drop Calculator/i);
    expect(tabs[3]).toHaveTextContent(/Pre-Flight Circuit Checklist/i);
    expect(tabs[4]).toHaveTextContent(/FIRST Safety & Rule Disclosures/i);

    // Initial tab is Architecture
    expect(screen.getByRole("tabpanel", { name: /Bus Topology & Circuit Diagram/i })).toBeInTheDocument();
    expect(screen.getByText(/System Topology & Signal Bus Network/i)).toBeInTheDocument();

    // Switch to Components Tab
    fireEvent.click(tabs[1]);
    expect(screen.getByRole("tabpanel", { name: /Component & Pinout Inspector/i })).toBeInTheDocument();
    expect(screen.getByText(/Component & Sensor Pinout Inspector/i)).toBeInTheDocument();

    // Switch to Calculator Tab
    fireEvent.click(tabs[2]);
    expect(screen.getByRole("tabpanel", { name: /Wire Gauge & Voltage Drop Calculator/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Wire Gauge & Voltage Drop Calculator/i).length).toBeGreaterThanOrEqual(1);

    // Switch to Checklist Tab
    fireEvent.click(tabs[3]);
    expect(screen.getByRole("tabpanel", { name: /Pre-Flight Circuit Checklist/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Pre-Flight Electrical & Diagnostic Checklist/i).length).toBeGreaterThanOrEqual(1);

    // Switch to Safety Tab
    fireEvent.click(tabs[4]);
    expect(screen.getByRole("tabpanel", { name: /FIRST Safety & Rule Disclosures/i })).toBeInTheDocument();
    expect(screen.getAllByText(/FIRST Tech Challenge Electrical Safety & Rules Compliance/i).length).toBeGreaterThanOrEqual(1);
  });

  it("supports bus signal filtering and interactive node selection in architecture view", () => {
    renderComponent();

    // Filter to Power Bus
    const powerBusFilter = screen.getByRole("button", { name: /12V Power Bus/i });
    fireEvent.click(powerBusFilter);
    expect(powerBusFilter).toHaveClass("ring-2");

    // Filter to RS485
    const rs485Filter = screen.getByRole("button", { name: /RS485 Differential/i });
    fireEvent.click(rs485Filter);
    expect(rs485Filter).toHaveClass("ring-2");

    // Filter back to All
    const allFilter = screen.getByRole("button", { name: /All Busses/i });
    fireEvent.click(allFilter);
    expect(allFilter).toHaveClass("ring-2");

    // Click on node in SVG (e.g. Battery node)
    const batteryNode = screen.getByRole("button", { name: /Select Battery Node/i });
    fireEvent.click(batteryNode);

    // Verify it transitioned to components view and selected 12V Power Distribution & 20A Main Fuse
    expect(screen.getByRole("heading", { level: 3, name: /12V Power Distribution & 20A Main Fuse Isolation/i })).toBeInTheDocument();
  });

  it("inspects components, displays pinout tables, wire colors, electrical ratings, and search filter", () => {
    renderComponent();

    // Switch to Components Tab
    const componentsTab = screen.getByRole("tab", { name: /Component & Pinout Inspector/i });
    fireEvent.click(componentsTab);

    // Verify all 8 core components are present in data
    expect(HARDWARE_COMPONENTS).toHaveLength(8);

    // Inspect REV Control Hub default view
    expect(screen.getByRole("heading", { level: 3, name: /REV Robotics Control Hub/i })).toBeInTheDocument();
    expect(screen.getAllByText(/REV-31-1595/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/VBAT \(\+12V\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/DATA\+/i).length).toBeGreaterThanOrEqual(1);

    // Select Limelight 3A Vision
    const limelightItem = screen.getByRole("button", { name: /Limelight 3A \/ OpenCV/i });
    fireEvent.click(limelightItem);

    expect(screen.getByRole("heading", { level: 3, name: /Limelight 3A/i })).toBeInTheDocument();
    expect(screen.getAllByText(/LL-3A-AI/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/5V_VCC/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/USB_DATA\+/i).length).toBeGreaterThanOrEqual(1);

    // Select Odometry Dead-Wheel Encoders
    const odoItem = screen.getByRole("button", { name: /Odometry Dead-Wheel/i });
    fireEvent.click(odoItem);
    expect(screen.getByRole("heading", { level: 3, name: /Odometry Dead-Wheel/i })).toBeInTheDocument();
    expect(screen.getAllByText(/8192 CPR/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CHANNEL A/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CHANNEL B/i).length).toBeGreaterThanOrEqual(1);

    // Test Search Filtering
    const searchInput = screen.getByPlaceholderText(/Search components or pinouts.../i);
    fireEvent.change(searchInput, { target: { value: "Color Sensor" } });

    expect(screen.getByRole("button", { name: /REV Color Sensor V3/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Limelight 3A \/ OpenCV/i })).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getAllByRole("button", { name: /Limelight 3A/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("calculates accurate wire resistance, voltage drops, power dissipation, and handles presets and warnings", () => {
    renderComponent();

    // Switch to Calculator Tab
    const calcTab = screen.getByRole("tab", { name: /Wire Gauge & Voltage Drop Calculator/i });
    fireEvent.click(calcTab);

    // Initial state: 18 AWG, 18 in (1.5 ft one way = 3 ft loop), 12A, 12V
    // Resistance = 3 ft * 0.006385 = 0.019155 Ohm = 19.15 mOhm
    // Voltage drop = 12A * 0.019155 = 0.230 V
    // Percentage = (0.230 / 12) * 100 = 1.92%
    // Power = 12^2 * 0.019155 = 2.76 W
    const calcPanel = screen.getByRole("tabpanel", { name: /Wire Gauge & Voltage Drop Calculator/i });
    expect(within(calcPanel).getAllByText(/0.230/i).length).toBeGreaterThanOrEqual(1);
    expect(within(calcPanel).getAllByText(/1.92%/i).length).toBeGreaterThanOrEqual(1);
    expect(within(calcPanel).getAllByText(/19.15/i).length).toBeGreaterThanOrEqual(1);
    expect(within(calcPanel).getAllByText(/2.76/i).length).toBeGreaterThanOrEqual(1);
    expect(within(calcPanel).getByText(/Circuit Status: Optimal & FTC Rule Compliant/i)).toBeInTheDocument();

    // Apply Limelight 3A Preset (20 AWG, 16 in, 2.2A, 5V)
    const limelightPreset = within(calcPanel).getByRole("button", { name: /Limelight 3A Vision Line/i });
    fireEvent.click(limelightPreset);

    expect(within(calcPanel).getByDisplayValue(/20 AWG/i)).toBeInTheDocument();
    expect(within(calcPanel).getByText(/0.060/i)).toBeInTheDocument();
    expect(within(calcPanel).getByText(/Circuit Status: Optimal & FTC Rule Compliant/i)).toBeInTheDocument();

    // Change gauge to 22 AWG and set current to 15A to trigger FTC Over-Current Warning
    const gaugeSelect = within(calcPanel).getByLabelText(/Conductor Wire Gauge \(AWG\)/i);
    fireEvent.change(gaugeSelect, { target: { value: "22 AWG" } });

    const currentSlider = within(calcPanel).getByLabelText(/Current Load/i);
    fireEvent.change(currentSlider, { target: { value: "15" } });

    expect(within(calcPanel).getByText(/FTC Rule Warning: Over-Current on Selected Gauge/i)).toBeInTheDocument();
    expect(within(calcPanel).getByText(/FTC rule <RE04> prohibits drawing 15A through 22 AWG/i)).toBeInTheDocument();
  });

  it("manages interactive pre-flight diagnostic checklist, categories, bulk toggles, and progress counter", () => {
    renderComponent();

    // Switch to Checklist Tab
    const checklistTab = screen.getByRole("tab", { name: /Pre-Flight Circuit Checklist/i });
    fireEvent.click(checklistTab);

    const checklistPanel = screen.getByRole("tabpanel", { name: /Pre-Flight Circuit Checklist/i });
    expect(INITIAL_CHECKLIST).toHaveLength(10);
    expect(within(checklistPanel).getByText(/12V Battery Retention & Mechanical Lock/i)).toBeInTheDocument();
    expect(within(checklistPanel).getByText(/20A Main Fuse Seating & Continuity/i)).toBeInTheDocument();
    expect(within(checklistPanel).getByText(/Chassis Galvanic Ground Isolation/i)).toBeInTheDocument();

    // Initial count is 3 of 10 verified (30%)
    expect(within(checklistPanel).getByText(/3 of 10 Verified/i)).toBeInTheDocument();
    expect(within(checklistPanel).getByText(/30%/i)).toBeInTheDocument();

    // Toggle Chassis Ground Isolation item (chk-3)
    const groundItem = within(checklistPanel).getByText(/Chassis Galvanic Ground Isolation/i);
    fireEvent.click(groundItem);

    // Now 4 of 10 verified (40%)
    expect(within(checklistPanel).getByText(/4 of 10 Verified/i)).toBeInTheDocument();
    expect(within(checklistPanel).getByText(/40%/i)).toBeInTheDocument();

    // Click "Verify All"
    const verifyAllBtn = within(checklistPanel).getByRole("button", { name: /Verify All/i });
    fireEvent.click(verifyAllBtn);

    expect(within(checklistPanel).getByText(/10 of 10 Verified/i)).toBeInTheDocument();
    expect(within(checklistPanel).getByText(/100%/i)).toBeInTheDocument();
    expect(within(checklistPanel).getByText(/Ready for Match Queuing/i)).toBeInTheDocument();

    // Click "Reset"
    const resetBtn = within(checklistPanel).getByRole("button", { name: /Reset/i });
    fireEvent.click(resetBtn);

    expect(within(checklistPanel).getByText(/0 of 10 Verified/i)).toBeInTheDocument();
    expect(within(checklistPanel).getByText(/0%/i)).toBeInTheDocument();

    // Filter by Category
    const motorsFilter = within(checklistPanel).getByRole("button", { name: /Motors & Servos/i });
    fireEvent.click(motorsFilter);
    expect(within(checklistPanel).getByText(/Motor Power Lead Crimps/i)).toBeInTheDocument();
    expect(within(checklistPanel).getByText(/Servo Lead Polarity & Strain Relief/i)).toBeInTheDocument();
    expect(within(checklistPanel).queryByText(/12V Battery Retention/i)).not.toBeInTheDocument();
  });

  it("verifies FIRST Safety & Competition Rules and ESD mitigation disclosures", () => {
    renderComponent();

    // Switch to Safety Tab
    const safetyTab = screen.getByRole("tab", { name: /FIRST Safety & Rule Disclosures/i });
    fireEvent.click(safetyTab);

    const safetyPanel = screen.getByRole("tabpanel", { name: /FIRST Safety & Rule Disclosures/i });
    expect(within(safetyPanel).getByText(/<RE01> Single Approved 12V Battery Pack/i)).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/<RE02> Robot Main Power Switch Placement/i)).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/<RE03> 20A Over-Current Circuit Protection/i)).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/<RE04> Wire Gauge Minimum Standards/i)).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/<RE05> Chassis Isolation & Zero Frame Grounding/i)).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/<RE06> Controller & Expansion Hub Limits/i)).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/<RE07> Maximum DC Motor Allotment/i)).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/<RE15> External Coprocessors & Vision Regulations/i)).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/Electrostatic Discharge \(ESD\) & Carpet Field Mitigation Standard/i)).toBeInTheDocument();
  });
});
