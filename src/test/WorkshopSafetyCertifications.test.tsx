import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SafetyPage from "../app/safety/page";
import {
  WORKSHOP_MACHINES,
  EMERGENCY_PROCEDURES,
  verifyQuizAnswers,
  generateCertificationRecord,
  verifyCertificationChecksum,
  sanitizeCallsign,
} from "@/lib/safetyMatrixData";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => <div data-testid="greek-meander" /> }));

describe("Workshop Safety Data Model & Zero-PII Certification Helper", () => {
  it("contains complete protocols and quizzes for all 6 required workshop machines", () => {
    expect(WORKSHOP_MACHINES).toHaveLength(6);
    const machineIds = WORKSHOP_MACHINES.map((m) => m.id);
    expect(machineIds).toContain("cnc-router");
    expect(machineIds).toContain("3d-printers");
    expect(machineIds).toContain("drill-press");
    expect(machineIds).toContain("horizontal-bandsaw");
    expect(machineIds).toContain("soldering-station");
    expect(machineIds).toContain("lipo-depot");

    for (const machine of WORKSHOP_MACHINES) {
      expect(machine.name).toBeTruthy();
      expect(machine.requiredPPE.length).toBeGreaterThan(0);
      expect(machine.prohibitedItems.length).toBeGreaterThan(0);
      expect(machine.preOperationalChecks.length).toBeGreaterThan(0);
      expect(machine.operatingRules.length).toBeGreaterThan(0);
      expect(machine.postOperationalCleanup.length).toBeGreaterThan(0);
      expect(machine.emergencyShutdown).toBeTruthy();
      expect(machine.quizQuestions.length).toBeGreaterThan(0);
    }
  });

  it("contains comprehensive emergency procedures for eyewash, fire, lipo, and injuries", () => {
    expect(EMERGENCY_PROCEDURES).toHaveLength(4);
    const procIds = EMERGENCY_PROCEDURES.map((p) => p.id);
    expect(procIds).toContain("eyewash");
    expect(procIds).toContain("fire-extinguishers");
    expect(procIds).toContain("lipo-thermal-runaway");
    expect(procIds).toContain("injury-reporting");
  });

  it("evaluates quiz answers correctly and enforces 100% score for qualification", () => {
    const cncMachine = WORKSHOP_MACHINES.find((m) => m.id === "cnc-router")!;
    
    // Correct answers for all questions
    const perfectAnswers: Record<string, number> = {};
    cncMachine.quizQuestions.forEach((q) => {
      perfectAnswers[q.id] = q.correctIndex;
    });

    const perfectResult = verifyQuizAnswers("cnc-router", perfectAnswers);
    expect(perfectResult.passed).toBe(true);
    expect(perfectResult.score).toBe(cncMachine.quizQuestions.length);
    expect(perfectResult.incorrectQuestionIds).toHaveLength(0);

    // Imperfect answers (one wrong)
    const imperfectAnswers = { ...perfectAnswers };
    const firstQ = cncMachine.quizQuestions[0];
    imperfectAnswers[firstQ.id] = (firstQ.correctIndex + 1) % firstQ.options.length;

    const failResult = verifyQuizAnswers("cnc-router", imperfectAnswers);
    expect(failResult.passed).toBe(false);
    expect(failResult.score).toBe(cncMachine.quizQuestions.length - 1);
    expect(failResult.incorrectQuestionIds).toContain(firstQ.id);

    // Non-existent machine returns safe empty result
    const invalidResult = verifyQuizAnswers("unknown-machine", {});
    expect(invalidResult.passed).toBe(false);
    expect(invalidResult.score).toBe(0);
  });

  it("sanitizes student callsigns and strips PII, emails, phone numbers, and script tags", () => {
    expect(sanitizeCallsign("Mountaineer_23247")).toBe("Mountaineer_23247");
    expect(sanitizeCallsign("john.doe@example.com")).toBe("Mountaineer-Safety-Lead");
    expect(sanitizeCallsign("Call (304) 555-1234")).toBe("Call");
    expect(sanitizeCallsign("<script>alert('xss')</script>SafetyLead")).toBe("alert xss SafetyLead");
    expect(sanitizeCallsign("")).toBe("Mountaineer-Safety-Lead");
  });

  it("generates and verifies tamper-evident certification records", () => {
    const record = generateCertificationRecord("SafetyPilot-7", ["cnc-router", "drill-press"], "2026-08-14T12:00:00Z");
    expect(record.callsign).toBe("SafetyPilot-7");
    expect(record.certifiedMachineIds).toEqual(["cnc-router", "drill-press"]);
    expect(record.totalQualified).toBe(2);
    expect(record.isFullyCertified).toBe(false);
    expect(record.checksum).toContain("ARES-CERT-");

    // Verify valid checksum
    expect(verifyCertificationChecksum(record)).toBe(true);

    // Tampered checksum or payload should fail verification
    const tamperedRecord = { ...record, totalQualified: 6, isFullyCertified: true };
    expect(verifyCertificationChecksum(tamperedRecord)).toBe(false);

    const tamperedCallsignRecord = { ...record, callsign: "Impostor" };
    expect(verifyCertificationChecksum(tamperedCallsignRecord)).toBe(false);

    expect(verifyCertificationChecksum(null as unknown as typeof record)).toBe(false);
  });
});

describe("Workshop Safety Page UI & Interactive Workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the hero section, tab switcher, and initial CNC Router protocol", () => {
    render(
      <MemoryRouter initialEntries={["/safety"]}>
        <Routes>
          <Route path="/safety" element={<SafetyPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Workshop Safety & Tool Certifications/i })).toBeInTheDocument();
    expect(screen.getByText(/Strict Zero-PII Architecture/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Machine Protocols/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qualification Quiz/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Emergency & First Aid/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Certification Card/i })).toBeInTheDocument();

    // Default machine is CNC Router
    expect(screen.getByRole("heading", { name: /Computer Numerical Control \(CNC\) Router/i })).toBeInTheDocument();
    expect(screen.getByText(/ANSI Z87.1 Approved Eye Protection with Side Shields/i)).toBeInTheDocument();
    expect(screen.getByText(/NO Gloves of ANY type/i)).toBeInTheDocument();
  });

  it("allows switching machine protocols and toggling pre-operational checklist items", () => {
    render(
      <MemoryRouter initialEntries={["/safety"]}>
        <Routes>
          <Route path="/safety" element={<SafetyPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Switch to LiPo Depot
    const lipoButton = screen.getByRole("button", { name: /LiPo Depot/i });
    fireEvent.click(lipoButton);

    expect(screen.getByRole("heading", { name: /LiPo Battery Charging & Power Depot/i })).toBeInTheDocument();
    expect(screen.getByText(/Fire-Resistant LiPo Safe Charging Bags/i)).toBeInTheDocument();
    expect(screen.getByText(/NO Exceeding manufacturer C-rate/i)).toBeInTheDocument();

    // Toggle pre-operational check
    const check1 = screen.getByText(/Inspect battery pack casing/i);
    fireEvent.click(check1);
    expect(screen.getByText(/1 of 4 Verified/i)).toBeInTheDocument();
  });

  it("filters machines by search query", () => {
    render(
      <MemoryRouter initialEntries={["/safety"]}>
        <Routes>
          <Route path="/safety" element={<SafetyPage />} />
        </Routes>
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search machines, PPE, hazards.../i);
    fireEvent.change(searchInput, { target: { value: "Bandsaw" } });

    expect(screen.getByRole("button", { name: /Metal Bandsaw/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /3D Printers/i })).not.toBeInTheDocument();
  });

  it("completes a machine qualification quiz, awards badge, and updates certification record", () => {
    render(
      <MemoryRouter initialEntries={["/safety"]}>
        <Routes>
          <Route path="/safety" element={<SafetyPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Navigate to Quiz Tab
    const quizTab = screen.getByRole("button", { name: /Qualification Quiz/i });
    fireEvent.click(quizTab);

    expect(screen.getByRole("heading", { name: /Machine Tool Qualification Quizzes/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Student Callsign/i)).toBeInTheDocument();

    // Switch to 3D Printers quiz
    const printerQuizBtn = screen.getByRole("button", { name: /3D Printers/i });
    fireEvent.click(printerQuizBtn);

    expect(screen.getByRole("heading", { name: /3D Printers \(FDM & SLA Resin\)/i })).toBeInTheDocument();

    // Select correct answers for 3D Printers:
    // Q1: Nitrile gloves and ANSI Z87.1 safety glasses with side shields (Option B, index 1)
    const q1OptionB = screen.getByText(/Nitrile gloves and ANSI Z87.1 safety glasses/i);
    fireEvent.click(q1OptionB);

    // Q2: Always scrape away from your body and keep your free hand behind the cutting edge (Option C, index 2)
    const q2OptionC = screen.getByText(/Always scrape away from your body/i);
    fireEvent.click(q2OptionC);

    // Submit Quiz
    const submitButton = screen.getByRole("button", { name: /Submit & Evaluate/i });
    fireEvent.click(submitButton);

    // Verify 100% passing state
    expect(screen.getByText(/100% Score! Machine Qualification Earned./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View Badge Card/i })).toBeInTheDocument();

    // Reset Quiz
    const resetBtn = screen.getByRole("button", { name: /Reset Quiz/i });
    fireEvent.click(resetBtn);
    expect(screen.queryByText(/100% Score! Machine Qualification Earned./i)).not.toBeInTheDocument();
  });

  it("renders emergency procedures and first aid reference guidelines", () => {
    render(
      <MemoryRouter initialEntries={["/safety"]}>
        <Routes>
          <Route path="/safety" element={<SafetyPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Navigate to Emergency Tab
    const emergTab = screen.getByRole("button", { name: /Emergency & First Aid/i });
    fireEvent.click(emergTab);

    expect(screen.getByRole("heading", { name: /Emergency & First Aid Quick Reference/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Emergency Eyewash Station Protocol/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Fire Extinguisher Classes & P.A.S.S. Method/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Lithium Battery Thermal Runaway Emergency/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Zero-PII Incident Reporting & First Aid/i })).toBeInTheDocument();

    expect(screen.getByText(/FLUSH CONTINUOUSLY FOR A FULL 15 MINUTES/i)).toBeInTheDocument();
    expect(screen.getByText(/P — PULL the safety pin/i)).toBeInTheDocument();
  });

  it("renders printable certification record card and verifies authenticity offline", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/safety"]}>
        <Routes>
          <Route path="/safety" element={<SafetyPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Navigate to Certification Card Tab
    const certTab = screen.getByRole("button", { name: /Certification Card/i });
    fireEvent.click(certTab);

    expect(screen.getByRole("heading", { name: /Workshop Safety Record Card/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Workshop Tool Operator Card/i })).toBeInTheDocument();
    expect(screen.getByText(/Student Callsign/i)).toBeInTheDocument();

    // Trigger Print
    const printBtn = screen.getByRole("button", { name: /Print Record Card/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();

    // Test Offline Authenticity Verification Tool
    const verifyInput = screen.getByPlaceholderText(/Paste JSON record or checksum/i);
    const verifyBtn = screen.getByRole("button", { name: /Verify Authenticity/i });

    // Invalid checksum test
    fireEvent.change(verifyInput, { target: { value: "INVALID-CHECKSUM-XYZ" } });
    fireEvent.click(verifyBtn);
    expect(screen.getByText(/Invalid or tampered checksum record./i)).toBeInTheDocument();

    // Valid JSON record test
    const validRecord = generateCertificationRecord("TestLead", ["cnc-router"]);
    fireEvent.change(verifyInput, { target: { value: JSON.stringify(validRecord) } });
    fireEvent.click(verifyBtn);
    expect(screen.getByText(/Authentic ARES 23247 Safety Certification Record verified./i)).toBeInTheDocument();
  });
});
