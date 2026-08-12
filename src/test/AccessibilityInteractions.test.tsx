import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { useState } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { Cpu } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AccessibleTabs, {
  tabElementId,
  tabPanelId,
} from "@/components/AccessibleTabs";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import AutoSim from "@/sims/auto";
import PhysicsSim from "@/sims/physics";
import BeeSim from "@/sims/bee";
import { NavLinkItem } from "@/components/navigation/NavLinkItem";

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/SkipLink", () => ({ default: () => null }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("accessible tab interactions", () => {
  it("uses roving focus and supports the standard arrow/Home/End keys", () => {
    function TabsHarness() {
      const [active, setActive] = useState<"one" | "two" | "three">("one");
      return (
        <>
          <AccessibleTabs
            id="example"
            label="Example views"
            tabs={[
              { value: "one", label: "One" },
              { value: "two", label: "Two" },
              { value: "three", label: "Three" },
            ]}
            activeTab={active}
            onChange={setActive}
          />
          <div
            id={tabPanelId("example", active)}
            role="tabpanel"
            aria-labelledby={tabElementId("example", active)}
          >
            {active}
          </div>
        </>
      );
    }

    render(<TabsHarness />);
    const first = screen.getByRole("tab", { name: "One" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(screen.getByRole("tab", { name: "Two" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Three" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Three" }), {
      key: "Home",
    });
    expect(first).toHaveFocus();
  });
});

describe("client-side route transitions", () => {
  it("focuses and announces the new page heading", async () => {
    function RouteHarness() {
      const navigate = useNavigate();
      const { pathname } = useLocation();
      return (
        <LayoutWrapper>
          <button type="button" onClick={() => navigate("/second")}>
            Go to second page
          </button>
          <h1>{pathname === "/second" ? "Second page" : "First page"}</h1>
        </LayoutWrapper>
      );
    }

    render(
      <MemoryRouter initialEntries={["/first"]}>
        <RouteHarness />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Go to second page" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Second page" }),
      ).toHaveFocus(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Second page loaded");
  });

  it("exposes the active public navigation destination", () => {
    render(
      <MemoryRouter initialEntries={["/robots/season-robot"]}>
        <NavLinkItem
          variant="mobile-drawer"
          item={{
            label: "Robots",
            to: "/robots",
            icon: Cpu,
            iconColor: "text-white",
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Robots" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("simulation keyboard alternatives", () => {
  it("keeps the simulation registry free of pointer-only graphical interactions", () => {
    const simsRoot = join(process.cwd(), "src", "sims");
    const pointerSimulations = readdirSync(simsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => existsSync(join(simsRoot, entry.name, "index.tsx")))
      .map((entry) => ({
        name: entry.name,
        source: readFileSync(join(simsRoot, entry.name, "index.tsx"), "utf8"),
      }))
      .filter(({ source }) =>
        /on(?:Pointer|Mouse)Down|addEventListener\(["'](?:pointer|mouse)down/.test(
          source,
        ),
      );

    expect(pointerSimulations.length).toBeGreaterThan(0);
    for (const simulation of pointerSimulations) {
      expect(
        /<(?:input|select|fieldset)\b|aria-pressed=/.test(simulation.source),
        `${simulation.name} needs a native keyboard alternative`,
      ).toBe(true);
      expect(
        /aria-hidden=["']true["']/.test(simulation.source),
        `${simulation.name} must hide its equivalent graphical surface from assistive technology`,
      ).toBe(true);
    }
  });

  it("updates autonomous path waypoints through native coordinate inputs", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<AutoSim />);

    const xInput = screen.getByRole("spinbutton", { name: "X coordinate" });
    fireEvent.change(xInput, { target: { value: "120" } });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Waypoint 1: X 120, Y 300",
    );
  });

  it("moves the physics robot with named directional buttons", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.useFakeTimers();
    render(<PhysicsSim />);
    act(() => vi.runOnlyPendingTimers());

    fireEvent.click(screen.getByRole("button", { name: "Move robot left" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Robot at X 350, Y 170",
    );
  });

  it("lets keyboard users choose a bee and destination flower", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<BeeSim />);
    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    expect(screen.getByLabelText("Bee to guide")).toBeInTheDocument();
    const destination = screen.getAllByRole("button", {
      name: /Guide bee 1 to/i,
    })[0];
    destination.focus();
    fireEvent.click(destination);
    expect(destination).toHaveFocus();
  });
});
