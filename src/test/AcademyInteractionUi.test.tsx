import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AcademyDatum,
  AcademyChecklistLab,
  AcademyLabShell,
  AcademyMetric,
  AcademyModelLimit,
  AcademyNumberControl,
  AcademyRangeControl,
  AcademySelectControl,
} from "@/sims/shared/academy-interaction-ui";

describe("AcademyLabShell", () => {
  it("connects the section title and exposes the optional reset action", () => {
    let resets = 0;
    render(
      <AcademyLabShell
        titleId="signal-lab-title"
        eyebrow="Practice lab"
        title="Read the signal"
        description="Change one input and compare the result."
        resetLabel="Reset trace"
        onReset={() => { resets += 1; }}
      >
        <p>Lab controls</p>
      </AcademyLabShell>,
    );

    const title = screen.getByRole("heading", { name: "Read the signal" });
    expect(title).toHaveAttribute("id", "signal-lab-title");
    expect(screen.getByRole("region", { name: "Read the signal" })).toBeVisible();
    expect(screen.getByText("Practice lab")).toBeVisible();
    expect(screen.getByText("Change one input and compare the result.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset trace" }));
    expect(resets).toBe(1);
  });

  it("renders a simple titled region without optional controls", () => {
    render(
      <AcademyLabShell titleId="simple-lab-title" title="Simple lab">
        <p>One bounded activity</p>
      </AcademyLabShell>,
    );

    expect(screen.getByRole("region", { name: "Simple lab" })).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("AcademyModelLimit", () => {
  it("marks a model warning as an accessible note", () => {
    render(<AcademyModelLimit>This activity cannot inspect a physical robot.</AcademyModelLimit>);

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Model limit:");
    expect(note).toHaveTextContent("This activity cannot inspect a physical robot.");
  });

  it("supports an alternate evidence-limit label", () => {
    render(<AcademyModelLimit label="Evidence limit">Only recorded checks are represented.</AcademyModelLimit>);
    expect(screen.getByRole("note")).toHaveTextContent("Evidence limit: Only recorded checks are represented.");
  });
});

describe("AcademyChecklistLab", () => {
  it("provides native checks, live ordered feedback, summary content, and deterministic reset", () => {
    const initial = { source: false, boundary: false };
    const checks = [
      { key: "source" as const, label: "Source recorded" },
      { key: "boundary" as const, label: "Boundary recorded" },
    ];
    const review = (values: typeof initial) => {
      const complete = Object.values(values).filter(Boolean).length;
      const firstMissing = checks.find((check) => !values[check.key]);
      return firstMissing
        ? { ready: false, title: `Missing ${firstMissing.label}`, nextAction: "Record the next fact.", complete }
        : { ready: true, title: "Ready for review", nextAction: "Preserve the record.", complete };
    };

    render(
      <AcademyChecklistLab
        titleId="evidence-lab-title"
        title="Evidence lab"
        eyebrow="Self-check"
        description="Record both represented facts."
        initialValues={initial}
        checks={checks}
        legend="Recorded facts"
        resultHeading="Review"
        review={review}
        renderSummary={(result) => <p>Recorded: {result.complete} of 2</p>}
        limitLabel="Evidence limit"
        limit="This activity reads only the boxes you select."
      />,
    );

    expect(screen.getByRole("region", { name: "Evidence lab" })).toBeVisible();
    expect(screen.getByText("Missing Source recorded")).toBeVisible();
    expect(screen.getByText("Recorded: 0 of 2")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Source recorded" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Boundary recorded" }));
    expect(screen.getByText("Ready for review")).toBeVisible();
    expect(screen.getByText("Recorded: 2 of 2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Missing Source recorded")).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent("Evidence limit");
  });
});

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

describe("AcademyNumberControl", () => {
  it("exposes native numeric bounds while keeping the unit visible", () => {
    let selected = 0;
    render(
      <AcademyNumberControl
        id="wheel-speed"
        label="Wheel speed"
        unit="m/s"
        value={1}
        min={-2}
        max={2}
        step={0.1}
        onChange={(value) => { selected = value; }}
      />,
    );

    const control = screen.getByRole("spinbutton", { name: "Wheel speed" });
    expect(control).toHaveAttribute("min", "-2");
    expect(control).toHaveAttribute("max", "2");
    expect(screen.getByText("m/s")).toBeVisible();
    fireEvent.change(control, { target: { value: "1.5" } });
    expect(selected).toBe(1.5);
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

  it("supports explicit labels and disabled explanatory text", () => {
    render(
      <>
        <AcademySelectControl
          id="evidence-source"
          label="Evidence source"
          value="paired-runtime"
          options={[
            { value: "compile", label: "Compile result" },
            { value: "paired-runtime", label: "Paired runtime result" },
          ]}
          onChange={() => undefined}
          disabled
          describedBy="evidence-help"
        />
        <p id="evidence-help">Available after a paired run.</p>
      </>,
    );

    const control = screen.getByRole("combobox", { name: "Evidence source" });
    expect(control).toBeDisabled();
    expect(control).toHaveAccessibleDescription("Available after a paired run.");
    expect(screen.getByRole("option", { name: "Paired runtime result" })).toBeVisible();
  });
});
