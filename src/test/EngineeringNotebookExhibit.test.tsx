import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EngineeringNotebookPage from "../app/notebook/page";
import {
  calculateNotebookMetrics,
  filterNotebookEntries,
  getAllNotebookTags,
  getAllAuthorRoles,
  getSubsystemTimeline,
  verifyZeroPiiCompliance,
  NOTEBOOK_ENTRIES,
  SUBSYSTEM_ITERATIONS,
  type NotebookEntry,
} from "@/lib/engineeringNotebookData";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => <div data-testid="greek-meander" /> }));

describe("Engineering Notebook Data Model & Utilities", () => {
  it("calculates comprehensive notebook metrics accurately", () => {
    const metrics = calculateNotebookMetrics(NOTEBOOK_ENTRIES, SUBSYSTEM_ITERATIONS);
    expect(metrics.totalIterations).toBeGreaterThanOrEqual(6);
    expect(metrics.cadPartsDesigned).toBeGreaterThanOrEqual(120);
    expect(metrics.totalHoursLogged).toBeGreaterThanOrEqual(950);
    expect(metrics.prototypeTestsCompleted).toBeGreaterThanOrEqual(200);
    expect(metrics.totalEntriesCount).toBe(NOTEBOOK_ENTRIES.length);
    expect(metrics.averageSuccessRate).toBeGreaterThan(70);
    expect(metrics.activeSubsystemsCount).toBeGreaterThanOrEqual(2);
  });

  it("filters entries by search query across titles, rationales, and calculations", () => {
    const feaResults = filterNotebookEntries(NOTEBOOK_ENTRIES, { query: "FEA" });
    expect(feaResults.length).toBeGreaterThan(0);
    expect(feaResults.some((e) => e.tags.includes("FEA"))).toBe(true);

    const odometryResults = filterNotebookEntries(NOTEBOOK_ENTRIES, { query: "Odometry" });
    expect(odometryResults.length).toBeGreaterThan(0);
    expect(odometryResults[0].title).toContain("Odometry");

    const nonExistent = filterNotebookEntries(NOTEBOOK_ENTRIES, { query: "nonexistent-query-xyz-999" });
    expect(nonExistent.length).toBe(0);
  });

  it("filters entries by chapterId, stageId, tag, and authorRole", () => {
    const strategyEntries = filterNotebookEntries(NOTEBOOK_ENTRIES, { chapterId: "strategy" });
    expect(strategyEntries.every((e) => e.chapterId === "strategy")).toBe(true);

    const controlsEntries = filterNotebookEntries(NOTEBOOK_ENTRIES, { stageId: "controls" });
    expect(controlsEntries.every((e) => e.stageId === "controls")).toBe(true);

    const esdEntries = filterNotebookEntries(NOTEBOOK_ENTRIES, { tag: "ESD" });
    expect(esdEntries.every((e) => e.tags.includes("ESD"))).toBe(true);

    const designerEntries = filterNotebookEntries(NOTEBOOK_ENTRIES, { authorRole: "ARES Lead Mechanical Designer" });
    expect(designerEntries.every((e) => e.authorRole === "ARES Lead Mechanical Designer")).toBe(true);
  });

  it("extracts unique sorted tags and author roles", () => {
    const tags = getAllNotebookTags(NOTEBOOK_ENTRIES);
    expect(tags.length).toBeGreaterThan(0);
    expect(tags).toContain("CAD");
    expect(tags).toContain("Controls");
    expect(tags).toContain("Mechanisms");

    const roles = getAllAuthorRoles(NOTEBOOK_ENTRIES);
    expect(roles.length).toBeGreaterThan(0);
    expect(roles).toContain("ARES Lead Mechanical Designer");
    expect(roles).toContain("ARES Controls & Autonomous Engineer");
  });

  it("retrieves subsystem timelines sorted chronologically by version number", () => {
    const intakeTimeline = getSubsystemTimeline("Intake Mechanism", SUBSYSTEM_ITERATIONS);
    expect(intakeTimeline.length).toBe(4);
    expect(intakeTimeline[0].versionNumber).toBe(1);
    expect(intakeTimeline[3].versionNumber).toBe(4);
    expect(intakeTimeline[3].status).toBe("Field Verified");

    const liftTimeline = getSubsystemTimeline("Linear Slide Lift", SUBSYSTEM_ITERATIONS);
    expect(liftTimeline.length).toBe(2);
    expect(liftTimeline[0].versionNumber).toBe(1);
    expect(liftTimeline[1].versionNumber).toBe(2);
  });

  it("enforces strict Zero-PII security compliance across all dataset records", () => {
    const compliance = verifyZeroPiiCompliance(NOTEBOOK_ENTRIES);
    expect(compliance.isCompliant).toBe(true);
    expect(compliance.violations).toHaveLength(0);

    // Verify simulated violation detection
    const mockViolatingEntries: NotebookEntry[] = [
      {
        ...NOTEBOOK_ENTRIES[0],
        id: "entry-pii-test",
        summary: "Contact student at minor.student@gmail.com or 555-123-4567 for CAD files.",
      },
    ];

    const taintedCheck = verifyZeroPiiCompliance(mockViolatingEntries);
    expect(taintedCheck.isCompliant).toBe(false);
    expect(taintedCheck.violations.length).toBeGreaterThanOrEqual(2);
    expect(taintedCheck.violations.some((v) => v.includes("email PII"))).toBe(true);
    expect(taintedCheck.violations.some((v) => v.includes("phone PII"))).toBe(true);
  });
});

describe("Engineering Notebook Exhibit Component & Interactions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the interactive exhibit header, metrics summary, and initial stages tab", () => {
    render(
      <MemoryRouter initialEntries={["/notebook"]}>
        <Routes>
          <Route path="/notebook" element={<EngineeringNotebookPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Header & title
    expect(screen.getByRole("heading", { name: /Engineering Notebook/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/FTC Championship Engineering Exhibit/i)).toBeInTheDocument();

    // Metrics cards
    expect(screen.getAllByText(/Subsystem Iterations/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/CAD Parts Designed/i)).toBeInTheDocument();
    expect(screen.getByText(/Engineering Hours Logged/i)).toBeInTheDocument();
    expect(screen.getByText(/Bench & Match Trials/i)).toBeInTheDocument();

    // Default Tab (Design Process Stages)
    expect(screen.getByRole("heading", { name: /Iterative Engineering Design Process/i })).toBeInTheDocument();
    expect(screen.getByText("STAGE 01")).toBeInTheDocument();
    expect(screen.getByText("STAGE 06")).toBeInTheDocument();
  });

  it("allows switching milestone stages to inspect stage-specific engineering deep dives", () => {
    render(
      <MemoryRouter initialEntries={["/notebook"]}>
        <Routes>
          <Route path="/notebook" element={<EngineeringNotebookPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial stage 1 deep dive
    expect(screen.getByText("Stage 1 Deep-Dive")).toBeInTheDocument();

    // Click Stage 3 button (CAD & FEA Simulations)
    const stage3Button = screen.getByText("STAGE 03").closest("button");
    expect(stage3Button).not.toBeNull();
    fireEvent.click(stage3Button!);

    expect(screen.getByText("Stage 3 Deep-Dive")).toBeInTheDocument();
    expect(screen.getByText(/Parametric 3D assemblies in Onshape and finite element stress analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Core Engineering Principles Applied/i)).toBeInTheDocument();
    expect(screen.getByText(/Technical Deliverables & Milestones/i)).toBeInTheDocument();
  });

  it("switches to Subsystem Iterations tab and compares mechanism evolution from v1 to v4", () => {
    render(
      <MemoryRouter initialEntries={["/notebook"]}>
        <Routes>
          <Route path="/notebook" element={<EngineeringNotebookPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Click Subsystem Iterations tab
    const subsystemsTab = screen.getByRole("tab", { name: /2\. Subsystem Iterations/i });
    fireEvent.click(subsystemsTab);

    expect(screen.getByRole("heading", { name: /Subsystem Evolution & Prototyping Timeline/i })).toBeInTheDocument();
    expect(screen.getByText(/v1\.0 - Passive Flap Ingestion/i)).toBeInTheDocument();
    expect(screen.getByText(/v4\.0 - Active Multi-Axis Spinner/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Compliant Spinner with Optical Indexing & ESD Grounding/i)).toBeInTheDocument();

    // Change subsystem selector to Linear Slide Lift
    const subsystemSelect = screen.getByLabelText(/Subsystem:/i);
    fireEvent.change(subsystemSelect, { target: { value: "Linear Slide Lift" } });

    expect(screen.getByText(/v1\.0 - Single Stage String Rigging/i)).toBeInTheDocument();
    expect(screen.getByText(/v2\.0 - Cascading Continuous 3-Stage Slide/i)).toBeInTheDocument();
  });

  it("switches to Chapter & Entry Reader, filters entries by search query, and toggles accordion deep dives", () => {
    render(
      <MemoryRouter initialEntries={["/notebook"]}>
        <Routes>
          <Route path="/notebook" element={<EngineeringNotebookPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Click Reader Tab
    const readerTab = screen.getByRole("tab", { name: /3\. Chapter & Entry Reader/i });
    fireEvent.click(readerTab);

    expect(screen.getByRole("heading", { name: /Searchable Chapter & Technical Entry Reader/i })).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/Search engineering notebook entries/i);
    expect(searchInput).toBeInTheDocument();

    // Type search query
    fireEvent.change(searchInput, { target: { value: "Electrostatic" } });
    expect(screen.getByText(/Competition Incident RCFA: Electrostatic Discharge Mitigation/i)).toBeInTheDocument();
    expect(screen.queryByText(/Strategic Game Decomposition & Cycle-Time Modeling/i)).not.toBeInTheDocument();

    // Clear search
    const clearButton = screen.getByText("Clear");
    fireEvent.click(clearButton);
    expect(screen.getByText(/Strategic Game Decomposition & Cycle-Time Modeling/i)).toBeInTheDocument();

    // Test chapter filter
    const chapterSelect = screen.getByLabelText(/^Chapter$/i);
    fireEvent.change(chapterSelect, { target: { value: "cad-fea" } });
    expect(screen.getByText(/Drivetrain Sideplate FEA Simulation & Isogrid Pocketing/i)).toBeInTheDocument();

    // Reset filters
    const resetButton = screen.getByText(/Reset all filters/i);
    fireEvent.click(resetButton);
    expect(screen.getByText(/Strategic Game Decomposition & Cycle-Time Modeling/i)).toBeInTheDocument();

    // Entry 1 is expanded by default, check rationale and math formulas
    expect(screen.getByText(/Design Decision Rationale & Trade-Study/i)).toBeInTheDocument();
    expect(screen.getByText(/Mathematical Model & Physics Calculations/i)).toBeInTheDocument();
    expect(screen.getByText(/Points-Per-Second \(PPS\) Scoring Ratio/i)).toBeInTheDocument();

    // Collapse entry 1 by clicking its button
    const firstEntryButton = screen.getByText(/Strategic Game Decomposition & Cycle-Time Modeling/i).closest("button");
    expect(firstEntryButton).not.toBeNull();
    fireEvent.click(firstEntryButton!);

    // Verify it is collapsed
    expect(screen.queryByText(/Design Decision Rationale & Trade-Study/i)).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(firstEntryButton!);
    expect(screen.getByText(/Design Decision Rationale & Trade-Study/i)).toBeInTheDocument();
  });

  it("switches to Portfolio Binder view and triggers print action handler", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/notebook"]}>
        <Routes>
          <Route path="/notebook" element={<EngineeringNotebookPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Click Portfolio Binder View tab
    const portfolioTab = screen.getByRole("tab", { name: /4\. Portfolio Binder View/i });
    fireEvent.click(portfolioTab);

    expect(screen.getByText(/I\. Executive Engineering Metrics/i)).toBeInTheDocument();
    expect(screen.getByText(/II\. Subsystem Prototyping Evolution Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/III\. Key Design Decisions & Physical Equations/i)).toBeInTheDocument();
    expect(screen.getByText(/Official Judge Copy/i)).toBeInTheDocument();

    // Test Print button
    const printButton = screen.getByRole("button", { name: /Print or download Engineering Design Portfolio/i });
    fireEvent.click(printButton);
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
    expect(screen.getByText(/Official Judge Copy/i)).toBeInTheDocument();
  });
});
