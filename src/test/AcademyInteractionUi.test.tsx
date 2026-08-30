import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AcademyDatum,
  AcademyMetric,
  AcademyRangeControl,
  AcademySelectControl,
} from "@/sims/shared/academy-interaction-ui";

describe("AcademyDatum", () => {
  it("renders a labeled result with the optional wide layout", () => {
    const { rerender } = render(
      <dl>
        <AcademyDatum label="Status" value="Ready" />
      </dl>,
    );

    expect(screen.getByText("Status")).toBeVisible();
    expect(screen.getByText("Ready")).toBeVisible();
    expect(screen.getByText("Ready").parentElement).not.toHaveClass("sm:col-span-2");

    rerender(
      <dl>
        <AcademyDatum label="Next action" value="Run one focused test" wide />
      </dl>,
    );

    expect(screen.getByText("Run one focused test").parentElement).toHaveClass("sm:col-span-2");

    rerender(
      <dl>
        <AcademyDatum label="Ownership" value="Descriptor" accented />
      </dl>,
    );

    expect(screen.getByText("Ownership")).toHaveClass("font-bold", "text-ares-cyan");
    expect(screen.getByText("Descriptor")).toHaveClass("text-sm");
  });
});

describe("AcademyRangeControl", () => {
  it("labels and formats a native range control", () => {
    let selected = 0;
    render(
      <AcademyRangeControl
        label="Robot speed"
        unit="m/s"
        value={1.25}
        min={0}
        max={3}
        step={0.25}
        decimals={1}
        onChange={(value) => { selected = value; }}
      />,
    );

    const control = screen.getByRole("slider", { name: "Robot speed" });
    expect(screen.getByText("1.3 m/s")).toBeVisible();
    fireEvent.change(control, { target: { value: "2" } });
    expect(selected).toBe(2);
  });

  it("omits an empty unit and uses two decimals by default", () => {
    render(
      <AcademyRangeControl
        label="Ambiguity"
        value={0.1}
        min={0}
        max={1}
        step={0.1}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByText("0.10")).toBeVisible();
  });
});

describe("AcademyMetric", () => {
  it("can capitalize a displayed result", () => {
    const { rerender } = render(<AcademyMetric label="Decision" value="blocked" />);
    expect(screen.getByText("blocked")).not.toHaveClass("capitalize");

    rerender(<AcademyMetric label="Decision" value="clear" capitalize />);
    expect(screen.getByText("clear")).toHaveClass("capitalize");
  });
});

describe("AcademySelectControl", () => {
  it("labels a native select and formats enum-style options", () => {
    let selected = "NOT_STARTED";
    render(
      <AcademySelectControl
        id="run-state"
        label="Run state"
        value={selected}
        options={["NOT_STARTED", "RUNNING"]}
        onChange={(value) => { selected = value; }}
      />,
    );

    const control = screen.getByRole("combobox", { name: "Run state" });
    expect(screen.getByRole("option", { name: "not started" })).toBeVisible();
    fireEvent.change(control, { target: { value: "RUNNING" } });
    expect(selected).toBe("RUNNING");
  });
});
