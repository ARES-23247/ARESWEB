import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardStatCard from "./DashboardStatCard";

describe("DashboardStatCard Component", () => {
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

  it("renders label and value correctly", () => {
    render(
      <DashboardStatCard
        label="Total Members"
        value={42}
        icon={<span data-testid="test-icon">Icon</span>}
      />
    );

    expect(screen.getByText("Total Members")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("renders string value correctly", () => {
    render(
      <DashboardStatCard
        label="Status"
        value="Active"
        icon={<span>Icon</span>}
      />
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders number value correctly", () => {
    render(
      <DashboardStatCard
        label="Count"
        value={123.45}
        icon={<span>Icon</span>}
      />
    );

    expect(screen.getByText("123.45")).toBeInTheDocument();
  });

  it("renders zero value", () => {
    render(
      <DashboardStatCard
        label="Errors"
        value={0}
        icon={<span>Icon</span>}
      />
    );

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders large numbers correctly", () => {
    render(
      <DashboardStatCard
        label="Total Views"
        value={1500000}
        icon={<span>Icon</span>}
      />
    );

    expect(screen.getByText("1500000")).toBeInTheDocument();
  });

  it("applies custom delay prop", () => {
    render(
      <DashboardStatCard
        label="Delayed Card"
        value="Test"
        icon={<span>Icon</span>}
        delay={0.5}
      />
    );

    // The component should render regardless of delay
    expect(screen.getByText("Delayed Card")).toBeInTheDocument();
  });

  it("defaults delay to 0 when not provided", () => {
    render(
      <DashboardStatCard
        label="No Delay"
        value="Test"
        icon={<span>Icon</span>}
      />
    );

    expect(screen.getByText("No Delay")).toBeInTheDocument();
  });

  it("renders icon in the label section", () => {
    render(
      <DashboardStatCard
        label="With Icon"
        value="100"
        icon={<span data-testid="custom-icon">★</span>}
      />
    );

    const icon = screen.getByTestId("custom-icon");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveTextContent("★");
  });

  it("renders ReactElement icon", () => {
    const TestIcon = () => <svg data-testid="svg-icon"><circle /></svg>;

    render(
      <DashboardStatCard
        label="SVG Icon"
        value="Test"
        icon={<TestIcon />}
      />
    );

    expect(screen.getByTestId("svg-icon")).toBeInTheDocument();
  });

  it("has proper ARES styling classes", () => {
    const { container } = render(
      <DashboardStatCard
        label="Styled Card"
        value="Value"
        icon={<span>Icon</span>}
      />
    );

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("bg-black/40");
    expect(card).toHaveClass("border");
    expect(card).toHaveClass("ares-cut-lg");
  });

  it("has proper text styling for label", () => {
    render(
      <DashboardStatCard
        label="Label Text"
        value="Value"
        icon={<span>Icon</span>}
      />
    );

    const labelElement = screen.getByText("Label Text");
    // The label text is in a span, but the styling is on the parent div
    const parentElement = labelElement.parentElement;
    expect(parentElement).toHaveClass("text-marble/60");
    expect(parentElement).toHaveClass("uppercase");
    expect(parentElement).toHaveClass("tracking-widest");
  });

  it("has proper text styling for value", () => {
    render(
      <DashboardStatCard
        label="Label"
        value="123"
        icon={<span>Icon</span>}
      />
    );

    const valueElement = screen.getByText("123");
    expect(valueElement).toHaveClass("text-white");
    expect(valueElement).toHaveClass("font-black");
  });

  it("renders icon and label in the same row", () => {
    render(
      <DashboardStatCard
        label="Label"
        value="Value"
        icon={<span data-testid="row-icon">I</span>}
      />
    );

    const icon = screen.getByTestId("row-icon");
    const label = screen.getByText("Label");

    // Both should be in the same flex container (icon's grandparent)
    const container = icon.parentElement?.parentElement;
    expect(container).toContainElement(icon);
    expect(container).toContainElement(label);
  });

  it("handles negative numbers", () => {
    render(
      <DashboardStatCard
        label="Change"
        value={-15}
        icon={<span>Icon</span>}
      />
    );

    expect(screen.getByText("-15")).toBeInTheDocument();
  });

  it("handles decimal values", () => {
    render(
      <DashboardStatCard
        label="Percentage"
        value={87.5}
        icon={<span>Icon</span>}
      />
    );

    expect(screen.getByText("87.5")).toBeInTheDocument();
  });

  it("handles very long label text", () => {
    render(
      <DashboardStatCard
        label="This is a very long label that should still render properly"
        value="Value"
        icon={<span>Icon</span>}
      />
    );

    expect(screen.getByText("This is a very long label that should still render properly")).toBeInTheDocument();
  });

  it("renders percentage as string", () => {
    render(
      <DashboardStatCard
        label="Completion"
        value="75%"
        icon={<span>Icon</span>}
      />
    );

    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("renders currency as string", () => {
    render(
      <DashboardStatCard
        label="Revenue"
        value="$12,345"
        icon={<span>Icon</span>}
      />
    );

    expect(screen.getByText("$12,345")).toBeInTheDocument();
  });
});
