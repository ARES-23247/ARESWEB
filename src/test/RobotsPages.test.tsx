import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RobotsFeedPage from "../app/robots/page";
import RobotDetailPage from "../app/robots/[id]/page";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import type { RobotItem } from "../app/robots/types";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  authenticatedFetch: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const mockRobots: RobotItem[] = [
  {
    id: "ares-prime-2026",
    name: "ARES Prime",
    seasonName: "2026–2027",
    challengeName: "DEEP SPACE",
    weightLbs: 34.5,
    drivetrainType: "4-Wheel Mecanum Drive",
    programmingLanguage: "Kotlin / FTC SDK",
    primaryMechanism: "Continuous Servo Multi-Stage Claw",
    revealVideoId: "dQw4w9WgXcQ",
    onshapeUrl: "https://cad.onshape.com/documents/test-cad",
    cadViewerUrl: "https://cad.onshape.com/documents/test-cad/embed",
    content: "ARES Prime is our championship robot designed for high-velocity scoring and precise autonomous pathing.",
    isDeleted: 0,
    versions: [
      {
        name: "V2 - Lightweight Chassis",
        weightLbs: 29.8,
        drivetrainType: "Custom Belt-Driven Mecanum",
        primaryMechanism: "Telescoping Carbon Fiber Arm",
        content: "Optimized for speed and rapid intake cycling.",
      },
    ],
  },
  {
    id: "ares-legacy-2025",
    name: "ARES Velocity",
    seasonName: "2025–2026",
    challengeName: "INTO THE DEEP",
    weightLbs: 38.0,
    drivetrainType: "6-Wheel Drop-Center Traction",
    programmingLanguage: "Java / RoadRunner",
    primaryMechanism: "Linear Slide Bucket",
    content: "State championship finalist chassis.",
    isDeleted: 1,
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("Robots Feed & Detail Pages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      authorizedUser: null,
      role: null,
      loading: false,
      error: null,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("renders public fleet catalog with technical specs and reveal thumbnails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, robots: [mockRobots[0]] })));
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <MemoryRouter initialEntries={["/robots"]}>
          <Routes>
            <Route path="/robots" element={<RobotsFeedPage />} />
          </Routes>
        </MemoryRouter>
      </Wrapper>
    );

    expect(await screen.findByRole("heading", { name: "ARES Prime" })).toBeInTheDocument();
    expect(screen.getByText(/34.5 lbs/i)).toBeInTheDocument();
    expect(screen.getByText("4-Wheel Mecanum Drive")).toBeInTheDocument();
    expect(screen.getByText("Kotlin / FTC SDK")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /deploy new robot/i })).not.toBeInTheDocument();
  });

  it("shows editor actions and decommission status when authorized as coach/mentor/admin", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: "test-coach" },
      authorizedUser: { uid: "test-coach", role: "coach", email: "coach@aresfirst.org", nickname: "Coach" },
      role: "coach",
      loading: false,
      error: null,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(authenticatedFetch).mockResolvedValue(jsonResponse({ success: true, robots: mockRobots }));
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <MemoryRouter initialEntries={["/robots"]}>
          <Routes>
            <Route path="/robots" element={<RobotsFeedPage />} />
          </Routes>
        </MemoryRouter>
      </Wrapper>
    );

    expect(await screen.findByRole("button", { name: /deploy new robot/i })).toBeInTheDocument();
    expect(await screen.findByText("ARES Velocity")).toBeInTheDocument();
    expect(screen.getByText("Decommissioned")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /restore robot/i })).toBeInTheDocument();
  });

  it("renders robot detail page with version switching and dynamic tech specs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, robot: mockRobots[0] })));
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <MemoryRouter initialEntries={["/robots/ares-prime-2026"]}>
          <Routes>
            <Route path="/robots/:id" element={<RobotDetailPage />} />
          </Routes>
        </MemoryRouter>
      </Wrapper>
    );

    expect(await screen.findByRole("heading", { name: "ARES Prime" })).toBeInTheDocument();
    expect(screen.getByText(/34.5 lbs/i)).toBeInTheDocument();
    expect(screen.getByText(/Continuous Servo Multi-Stage Claw/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view cad workspace/i })).toHaveAttribute("href", "https://cad.onshape.com/documents/test-cad");

    const versionSelect = screen.getByLabelText(/select robot version/i);
    expect(versionSelect).toBeInTheDocument();

    fireEvent.change(versionSelect, { target: { value: "0" } });

    await waitFor(() => {
      expect(screen.getByText(/29.8 lbs/i)).toBeInTheDocument();
      expect(screen.getByText(/Custom Belt-Driven Mecanum/i)).toBeInTheDocument();
      expect(screen.getByText(/Telescoping Carbon Fiber Arm/i)).toBeInTheDocument();
      expect(screen.getByText(/Optimized for speed and rapid intake cycling/i)).toBeInTheDocument();
    });
  });

  it("renders 404 not found state gracefully when robot ID does not exist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "Robot not found" }, 404, "Not Found")));
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <MemoryRouter initialEntries={["/robots/unknown-robot"]}>
          <Routes>
            <Route path="/robots/:id" element={<RobotDetailPage />} />
          </Routes>
        </MemoryRouter>
      </Wrapper>
    );

    expect(await screen.findByRole("heading", { name: /robot not found/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to fleet/i })).toHaveAttribute("href", "/robots");
  });
});
