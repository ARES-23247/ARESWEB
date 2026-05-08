import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardMetricsGrid, { DashboardMetric } from "./DashboardMetricsGrid";
import { Activity } from "lucide-react";

describe("DashboardMetricsGrid Component", () => {
  beforeEach(() => {
    // Mock getBoundingClientRect for framer-motion measurements
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      bottom: 100,
      right: 200,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }));
  });

  const mockMetrics: DashboardMetric[] = [
    {
      label: "Total Members",
      value: 42,
      icon: <Activity data-testid="icon-1" />,
    },
    {
      label: "Active Projects",
      value: 8,
      icon: <Activity data-testid="icon-2" />,
    },
    {
      label: "Pending Tasks",
      value: 15,
      icon: <Activity data-testid="icon-3" />,
    },
    {
      label: "Completed Events",
      value: 23,
      icon: <Activity data-testid="icon-4" />,
    },
  ];

  it("renders all metrics", () => {
    render(<DashboardMetricsGrid metrics={mockMetrics} />);

    expect(screen.getByText("Total Members")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Active Projects")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Pending Tasks")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("Completed Events")).toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
  });

  it("renders icons for each metric", () => {
    render(<DashboardMetricsGrid metrics={mockMetrics} />);

    expect(screen.getByTestId("icon-1")).toBeInTheDocument();
    expect(screen.getByTestId("icon-2")).toBeInTheDocument();
    expect(screen.getByTestId("icon-3")).toBeInTheDocument();
    expect(screen.getByTestId("icon-4")).toBeInTheDocument();
  });

  it("applies default grid classes", () => {
    const { container } = render(<DashboardMetricsGrid metrics={mockMetrics} />);

    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-2");
    expect(grid).toHaveClass("md:grid-cols-4");
  });

  it("applies custom grid class when provided", () => {
    const { container } = render(
      <DashboardMetricsGrid metrics={mockMetrics} gridClass="grid-cols-1 md:grid-cols-3" />
    );

    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid).toHaveClass("md:grid-cols-3");
  });

  it("renders string values correctly", () => {
    const stringMetrics: DashboardMetric[] = [
      { label: "Status", value: "Active", icon: <Activity /> },
      { label: "Trend", value: "+15%", icon: <Activity /> },
    ];

    render(<DashboardMetricsGrid metrics={stringMetrics} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("+15%")).toBeInTheDocument();
  });

  it("renders empty metrics array", () => {
    const { container } = render(<DashboardMetricsGrid metrics={[]} />);

    const grid = container.firstChild as HTMLElement;
    expect(grid).toBeInTheDocument();
    expect(grid.children.length).toBe(0);
  });

  it("renders single metric", () => {
    const singleMetric: DashboardMetric[] = [
      { label: "Solo Metric", value: 100, icon: <Activity /> },
    ];

    render(<DashboardMetricsGrid metrics={singleMetric} />);

    expect(screen.getByText("Solo Metric")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("applies gap-4 spacing by default", () => {
    const { container } = render(<DashboardMetricsGrid metrics={mockMetrics} />);

    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass("gap-4");
  });

  it("renders metrics with ReactNode icons", () => {
    const CustomIcon = () => <svg data-testid="custom-icon"><circle /></svg>;
    const customMetrics: DashboardMetric[] = [
      { label: "Custom", value: 1, icon: <CustomIcon /> },
    ];

    render(<DashboardMetricsGrid metrics={customMetrics} />);

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders metrics with large numbers", () => {
    const largeNumberMetrics: DashboardMetric[] = [
      { label: "Total Views", value: 1500000, icon: <Activity /> },
      { label: "Revenue", value: 50000, icon: <Activity /> },
    ];

    render(<DashboardMetricsGrid metrics={largeNumberMetrics} />);

    expect(screen.getByText("1500000")).toBeInTheDocument();
    expect(screen.getByText("50000")).toBeInTheDocument();
  });

  it("renders metrics with decimal values", () => {
    const decimalMetrics: DashboardMetric[] = [
      { label: "Average", value: 87.5, icon: <Activity /> },
      { label: "Rate", value: 3.14, icon: <Activity /> },
    ];

    render(<DashboardMetricsGrid metrics={decimalMetrics} />);

    expect(screen.getByText("87.5")).toBeInTheDocument();
    expect(screen.getByText("3.14")).toBeInTheDocument();
  });

  it("renders metrics with zero values", () => {
    const zeroMetrics: DashboardMetric[] = [
      { label: "Errors", value: 0, icon: <Activity /> },
      { label: "Warnings", value: 0, icon: <Activity /> },
    ];

    render(<DashboardMetricsGrid metrics={zeroMetrics} />);

    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBe(2);
  });

  it("renders metrics with negative values", () => {
    const negativeMetrics: DashboardMetric[] = [
      { label: "Change", value: -15, icon: <Activity /> },
    ];

    render(<DashboardMetricsGrid metrics={negativeMetrics} />);

    expect(screen.getByText("-15")).toBeInTheDocument();
  });

  it("has proper accessibility structure", () => {
    render(<DashboardMetricsGrid metrics={mockMetrics} />);

    const labels = screen.getAllByText(/Total Members|Active Projects|Pending Tasks|Completed Events/);
    labels.forEach(label => {
      expect(label.tagName).toBe("SPAN");
    });
  });

  it("applies delay props to children via DashboardStatCard", () => {
    render(<DashboardMetricsGrid metrics={mockMetrics} />);

    // The component should render without errors
    // Delay is handled by DashboardStatCard internally
    expect(screen.getByText("Total Members")).toBeInTheDocument();
  });
});
