import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import React from "react";
import GreekMeander from "../components/GreekMeander";

describe("GreekMeander Component", () => {
  it("renders correctly with default props", () => {
    const { container } = render(<GreekMeander />);
    const div = container.firstChild as HTMLElement;
    expect(div).toBeInTheDocument();
    expect(div).toHaveClass("meander-border");
    expect(div).toHaveClass("opacity-80");
  });

  it("applies thick variant classes", () => {
    const { container } = render(<GreekMeander variant="thick" />);
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveClass("meander-divider");
    expect(div).not.toHaveClass("meander-border");
  });

  it("applies custom opacity and class names", () => {
    const { container } = render(
      <GreekMeander opacity="opacity-40" className="custom-class" />
    );
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveClass("opacity-40");
    expect(div).toHaveClass("custom-class");
  });

  it("is marked as aria-hidden", () => {
    const { container } = render(<GreekMeander />);
    const div = container.firstChild as HTMLElement;
    expect(div.getAttribute("aria-hidden")).toBe("true");
  });
});
