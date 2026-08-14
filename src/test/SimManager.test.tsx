import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SimManager from "@/components/SimManager";
import SimulationsDashboardPage from "@/app/dashboard/simulations/page";

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/SimulationPlayground", () => ({
  default: () => <div data-testid="mock-simulation-playground">Simulation Playground IDE</div>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/generated/sim-registry", () => ({
  SIM_METADATA: [
    {
      id: "armkg",
      name: "Arm Gravity Compensation (Kg)",
      folder: "armkg",
      requiresContext: false,
    },
    {
      id: "elevatorpid",
      name: "Elevator Feedforward & PID",
      folder: "elevatorpid",
      requiresContext: true,
    },
  ],
  SIM_COMPONENTS: {
    armkg: () => <div data-testid="mock-armkg-sim">ArmKg Simulation Interactive View</div>,
    elevatorpid: () => <div data-testid="mock-elevatorpid-sim">ElevatorPid Simulation Interactive View</div>,
  },
}));

const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  writable: true,
  configurable: true,
  value: { writeText: mockWriteText },
});

describe("Simulation Registry & Dashboard UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { uid: "user-1" },
      authorizedUser: { role: "admin" },
    });
  });

  it("renders simulation registry catalog cards, statistics, and copy actions", async () => {
    render(
      <MemoryRouter>
        <SimManager />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Simulation Registry" })).toBeInTheDocument();
    expect(screen.getByText("Arm Gravity Compensation (Kg)")).toBeInTheDocument();
    expect(screen.getByText("Elevator Feedforward & PID")).toBeInTheDocument();

    expect(screen.getByText("Standalone")).toBeInTheDocument();
    expect(screen.getByText("Context")).toBeInTheDocument();

    const copyJsonButton = screen.getByRole("button", { name: /Copy JSON/i });
    fireEvent.click(copyJsonButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled();
    });
  });

  it("opens preview modal when Preview button is clicked", async () => {
    render(
      <MemoryRouter>
        <SimManager />
      </MemoryRouter>
    );

    const previewButtons = screen.getAllByRole("button", { name: /Preview/i });
    fireEvent.click(previewButtons[0]);

    expect(await screen.findByTestId("mock-armkg-sim")).toBeInTheDocument();
    expect(screen.getAllByText("Arm Gravity Compensation (Kg)").length).toBeGreaterThanOrEqual(1);
  });

  it("copies playground share link when Share button is clicked", async () => {
    render(
      <MemoryRouter>
        <SimManager />
      </MemoryRouter>
    );

    const shareButtons = screen.getAllByRole("button", { name: /Share/i });
    fireEvent.click(shareButtons[0]);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining("/academy/playground?simId=github:armkg")
      );
    });
  });

  it("switches tabs between Active Registry and AI Simulation IDE in dashboard", async () => {
    render(
      <MemoryRouter>
        <SimulationsDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Simulations Manager" })).toBeInTheDocument();
    expect(screen.getByText("Arm Gravity Compensation (Kg)")).toBeInTheDocument();

    const ideTab = screen.getByRole("button", { name: /AI Simulation IDE/i });
    fireEvent.click(ideTab);

    expect(await screen.findByTestId("mock-simulation-playground")).toBeInTheDocument();

    const registryTab = screen.getByRole("button", { name: /Active Registry/i });
    fireEvent.click(registryTab);

    expect(screen.getByText("Arm Gravity Compensation (Kg)")).toBeInTheDocument();
  });
});
