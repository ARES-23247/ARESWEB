import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import KotlinExpressionLab, {
  traceDeadband,
} from "@/sims/kotlin-expression-lab";

describe("KotlinExpressionLab", () => {
  it("models the current ARES deadband test cases", () => {
    expect(traceDeadband(0.04, 0.05)).toMatchObject({
      branch: "inside-deadband",
      result: 0,
    });
    expect(traceDeadband(-0.04, 0.05)).toMatchObject({
      branch: "inside-deadband",
      result: 0,
    });
    expect(traceDeadband(0.55, 0.1).branch).toBe("rescale");
    expect(traceDeadband(0.55, 0.1).result).toBeCloseTo(0.5);
    expect(traceDeadband(-0.55, 0.1).branch).toBe("rescale");
    expect(traceDeadband(-0.55, 0.1).result).toBeCloseTo(-0.5);
    expect(traceDeadband(1, 0.1).result).toBe(1);
    expect(traceDeadband(-1, 0.1).result).toBe(-1);
  });

  it("guards a nearly zero denominator inside the documented range", () => {
    expect(traceDeadband(1, 0.9999999)).toMatchObject({
      branch: "denominator-guard",
      result: 0,
    });
  });

  it("loads source test presets, explains the branch, and resets", () => {
    render(<KotlinExpressionLab />);

    fireEvent.click(
      screen.getByRole("button", { name: "Inside deadband test" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Inside the quiet area",
    );
    expect(
      screen.getByRole("spinbutton", { name: "Joystick value" }),
    ).toHaveValue(0.04);
    expect(screen.getByRole("spinbutton", { name: "Deadband" })).toHaveValue(
      0.05,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Negative rescale test" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "rescale the active range",
    );
    expect(screen.getByText("-0.500")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reset values" }));
    expect(
      screen.getByRole("spinbutton", { name: "Joystick value" }),
    ).toHaveValue(0.55);
    expect(screen.getByRole("spinbutton", { name: "Deadband" })).toHaveValue(
      0.1,
    );
  });

  it("provides native input bounds, intermediate values, and explicit limits", () => {
    render(<KotlinExpressionLab />);

    expect(
      screen.getByRole("spinbutton", { name: "Joystick value" }),
    ).toHaveAttribute("min", "-1");
    expect(
      screen.getByRole("spinbutton", { name: "Deadband" }),
    ).toHaveAttribute("max", "0.99");
    expect(screen.getByText("0.900")).toBeVisible();
    expect(screen.getByText("0.450")).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent(
      "does not compile Kotlin",
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "prove physical robot behavior",
    );
  });
});
