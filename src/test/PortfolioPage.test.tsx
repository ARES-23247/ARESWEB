import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import DashboardPortfolioPage from "@/app/dashboard/portfolio/page";
import { authenticatedFetch } from "@/lib/api";
import { escapeSpreadsheetCsvCell } from "@/lib/outreachExport";

vi.mock("@/lib/api", () => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "student_ada" },
    authorizedUser: { role: "member" },
    loading: false,
  }),
}));

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

const sampleWorkspacePayload = {
  seasonKey: "2026-2027",
  workspace: {
    updatedAt: "2026-11-10T18:00:00.000Z",
    updatedByNickname: "AdaLovelace",
    awards: [
      {
        awardId: "inspire",
        name: "Inspire Award",
        criteria: "Role-model FIRST Tech Challenge team.",
        claimSummary: "",
        linkedArtifactIds: [],
        verifiedArtifactCount: 0,
        needsEvidence: true,
      },
      {
        awardId: "think",
        name: "Think Award",
        criteria: "Engineering notebook math & physics.",
        claimSummary: "Documented turret gear ratio trade-offs.",
        linkedArtifactIds: ["post:studio_1"],
        verifiedArtifactCount: 1,
        needsEvidence: false,
      },
      {
        awardId: "connect",
        name: "Connect Award",
        criteria: "Connecting with STEM professionals.",
        claimSummary: "",
        linkedArtifactIds: [],
        verifiedArtifactCount: 0,
        needsEvidence: true,
      },
      {
        awardId: "innovate",
        name: "Innovate Award",
        criteria: "Creative hardware design.",
        claimSummary: "",
        linkedArtifactIds: [],
        verifiedArtifactCount: 0,
        needsEvidence: true,
      },
      {
        awardId: "control",
        name: "Control Award",
        criteria: "Sensors, kinematics, and autonomous control.",
        claimSummary: "Closed-loop turret + Pinpoint odometry.",
        linkedArtifactIds: ["post:studio_1"],
        verifiedArtifactCount: 1,
        needsEvidence: false,
        controlSheet: {
          autonomousRoutines: "4-specimen autonomous + park",
          sensorsUsed: "Pinpoint Odometry, Limelight 3A",
          algorithmsSummary: "Feedforward + PID + state machine",
        },
      },
      {
        awardId: "motivate",
        name: "Motivate Award",
        criteria: "Team spirit and FIRST outreach.",
        claimSummary: "",
        linkedArtifactIds: [],
        verifiedArtifactCount: 0,
        needsEvidence: true,
      },
      {
        awardId: "design",
        name: "Design Award",
        criteria: "Industrial design and CAD modularity.",
        claimSummary: "",
        linkedArtifactIds: [],
        verifiedArtifactCount: 0,
        needsEvidence: true,
      },
    ],
    pages: Array.from({ length: 15 }, (_, idx) => ({
      pageNumber: idx + 1,
      title: idx === 0 ? "Cover Page & Executive Team Summary" : `Page ${idx + 1} Blueprint`,
      section: idx === 0 ? "cover" : "hardware_cad",
      status: idx === 0 ? "verified" : "missing",
      ownerNickname: idx === 0 ? "AdaLovelace" : "",
      summaryNotes: idx === 0 ? "Ready for print review" : "",
      linkedArtifactIds: idx === 0 ? ["robot:ares_mk4"] : [],
    })),
  },
  candidates: [
    {
      id: "post:studio_1",
      kind: "studio_notebook",
      title: "Turret PID Trade-Off Study",
      subtitle: "ARES Studio Engineering Notebook",
      date: "2026-10-12",
      href: "/dashboard/blog",
    },
    {
      id: "robot:ares_mk4",
      kind: "robot",
      title: "ARES MK-IV",
      subtitle: "2026-2027 • Onshape CAD Linked",
      date: "2026-10-20",
      href: "/robots/ares_mk4",
    },
  ],
};

describe("Phase 3 — Dashboard Engineering Portfolio & Awards Hub UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the 7-Award Rubric Matrix with truthful gap flags, switches to the 15-Page Storyboard, and saves edits", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(jsonResponse(sampleWorkspacePayload))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          seasonKey: "2026-2027",
          workspace: sampleWorkspacePayload.workspace,
        }),
      );

    render(
      <HelmetProvider>
        <MemoryRouter>
          <DashboardPortfolioPage />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(await screen.findByText("Inspire Award")).toBeInTheDocument();
    expect(screen.getAllByText(/Unverified — Needs Evidence/i).length).toBe(5);
    expect(screen.getByDisplayValue("Pinpoint Odometry, Limelight 3A")).toBeInTheDocument();

    // Switch to 15-Page Storyboard tab
    fireEvent.click(
      screen.getByRole("tab", { name: /15-Page Portfolio Storyboard/i }),
    );

    expect(
      await screen.findByDisplayValue("Cover Page & Executive Team Summary"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Page 15 Blueprint")).toBeInTheDocument();

    // Save Workspace
    fireEvent.click(screen.getByRole("button", { name: /Save Workspace/i }));

    await waitFor(() => {
      expect(authenticatedFetch).toHaveBeenCalledWith(
        "/api/content-admin/portfolio/2026-2027",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    expect(await screen.findByText(/Portfolio workspace saved/i)).toBeInTheDocument();
  });

  it("surfaces an explicit error alert with retry when the backend fails", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(
      jsonResponse({ error: "Service unavailable" }, 503),
    );

    render(
      <HelmetProvider>
        <MemoryRouter>
          <DashboardPortfolioPage />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/Service unavailable/i);
  });

  it("neutralizes spreadsheet formula prefixes in exported CSV cells", () => {
    expect(escapeSpreadsheetCsvCell('=HYPERLINK("https://evil.example","Click")')).toBe(
      `"'=HYPERLINK(""https://evil.example"",""Click"")"`,
    );
    expect(escapeSpreadsheetCsvCell("+SUM(1,2)")).toBe(`"'+SUM(1,2)"`);
    expect(escapeSpreadsheetCsvCell("-2+3")).toBe(`"'-2+3"`);
    expect(escapeSpreadsheetCsvCell("@A1")).toBe(`"'@A1"`);
    expect(escapeSpreadsheetCsvCell("\t=1")).toBe(`"'\t=1"`);
    expect(escapeSpreadsheetCsvCell("\r=1")).toBe(`"' =1"`);
    expect(escapeSpreadsheetCsvCell("Normal note")).toBe(`"Normal note"`);
  });
});
