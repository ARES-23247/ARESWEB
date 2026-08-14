import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RobotBomPage from "../app/robots/bom/page";
import {
  DEFAULT_ROBOT_BOM_ITEMS,
  FTC_ROBOT_WEIGHT_LIMIT_LBS,
  SUBSYSTEM_CATEGORIES,
  VENDORS,
  calculateSubsystemWeight,
  calculateTotalWeight,
  exportBomToCsv,
  filterBomItems,
  type BomItem,
} from "@/lib/robotBomData";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => <div data-testid="greek-meander" /> }));

describe("Robot Bill of Materials (BOM) & Inventory Subsystem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Weight Tallies and FTC Compliance Calculations", () => {
    it("calculates default robot BOM within legal FTC 42.0 lb weight limit", () => {
      const tally = calculateTotalWeight(DEFAULT_ROBOT_BOM_ITEMS);
      expect(tally.lbs).toBeGreaterThan(10);
      expect(tally.lbs).toBeLessThanOrEqual(FTC_ROBOT_WEIGHT_LIMIT_LBS);
      expect(tally.isLegal).toBe(true);
      expect(tally.marginLbs).toBeGreaterThan(0);
      expect(tally.percentOfLimit).toBeLessThanOrEqual(100);
      expect(tally.totalCost).toBeGreaterThan(0);
      expect(tally.totalParts).toBeGreaterThan(0);
    });

    it("detects robot weight violation when mass exceeds 42.0 lbs", () => {
      const heavyItems: BomItem[] = [
        {
          id: "heavy-lead",
          name: "Heavy Steel Ballast",
          partNumber: "BLST-999",
          subsystem: "Chassis & Drivetrain",
          vendor: "McMaster-Carr",
          category: "Raw Material",
          quantity: 1,
          unitWeightGrams: 25000,
          unitCostUsd: 100,
          description: "Overweight ballast for testing",
        },
      ];
      const tally = calculateTotalWeight(heavyItems);
      expect(tally.lbs).toBeGreaterThan(FTC_ROBOT_WEIGHT_LIMIT_LBS);
      expect(tally.isLegal).toBe(false);
      expect(tally.marginLbs).toBeLessThan(0);
      expect(tally.percentOfLimit).toBeGreaterThan(100);
    });

    it("calculates subsystem weight breakdown accurately", () => {
      SUBSYSTEM_CATEGORIES.forEach((subsystem) => {
        const subTally = calculateSubsystemWeight(DEFAULT_ROBOT_BOM_ITEMS, subsystem);
        expect(subTally.grams).toBeGreaterThanOrEqual(0);
        expect(subTally.lbs).toBeGreaterThanOrEqual(0);
        expect(subTally.itemCount).toBeGreaterThanOrEqual(0);
        expect(subTally.cost).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("BOM Filtering and Search", () => {
    it("filters items by vendor", () => {
      VENDORS.forEach((vendor) => {
        const filtered = filterBomItems(DEFAULT_ROBOT_BOM_ITEMS, { vendor });
        filtered.forEach((item) => {
          expect(item.vendor).toBe(vendor);
        });
      });
    });

    it("filters items by subsystem", () => {
      SUBSYSTEM_CATEGORIES.forEach((subsystem) => {
        const filtered = filterBomItems(DEFAULT_ROBOT_BOM_ITEMS, { subsystem });
        filtered.forEach((item) => {
          expect(item.subsystem).toBe(subsystem);
        });
      });
    });

    it("filters items by category class and search query", () => {
      const actuators = filterBomItems(DEFAULT_ROBOT_BOM_ITEMS, { category: "Actuator" });
      expect(actuators.length).toBeGreaterThan(0);
      actuators.forEach((item) => expect(item.category).toBe("Actuator"));

      const searchYellowjacket = filterBomItems(DEFAULT_ROBOT_BOM_ITEMS, { searchQuery: "Yellowjacket" });
      expect(searchYellowjacket.length).toBeGreaterThan(0);
      searchYellowjacket.forEach((item) => {
        const matches =
          item.name.toLowerCase().includes("yellowjacket") ||
          item.partNumber.toLowerCase().includes("yellowjacket") ||
          item.description.toLowerCase().includes("yellowjacket");
        expect(matches).toBe(true);
      });
    });
  });

  describe("RFC-4180 CSV Export and Formula Injection Defense", () => {
    it("generates valid RFC-4180 CSV with escaped formulas", () => {
      const mockItems: BomItem[] = [
        {
          id: "formula-test",
          name: "=cmd|' /C calc'!'A0'",
          partNumber: "+123-DDE",
          subsystem: "Chassis & Drivetrain",
          vendor: "REV Robotics",
          category: "Mechanical",
          quantity: 2,
          unitWeightGrams: 150,
          unitCostUsd: 25.5,
          description: "Malicious formula test item, with comma",
        },
      ];

      const csv = exportBomToCsv(mockItems);
      expect(csv).toContain("Part Name");
      expect(csv).toContain("Part Number");
      expect(csv).toContain("Vendor");
      expect(csv).toContain("Subsystem");
      expect(csv).toContain("REV Robotics");

      expect(csv).not.toMatch(/(^|,)=cmd\|/m);
      expect(csv).toContain("'=cmd|");
      expect(csv).toContain("'+123-DDE");
    });
  });

  describe("RobotBomPage UI Component and Interactions", () => {
    it("renders BOM page with compliance gauge, table, and stats", () => {
      render(
        <MemoryRouter>
          <RobotBomPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: /Subsystem BOM & Weight Inspector/i })).toBeInTheDocument();
      expect(screen.getByText(/FTC Legal Weight Limit Status/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Export BOM \(CSV\)/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Add Custom Part/i })).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Filter part, number, description.../i);
      expect(searchInput).toBeInTheDocument();
      fireEvent.change(searchInput, { target: { value: "Motor" } });
      expect(searchInput).toHaveValue("Motor");
    });
  });
});
