import { describe, it, expect } from "vitest";
import { migrateLayoutCoordinates, LayoutItem } from "../app/dashboard/scope/page";

describe("migrateLayoutCoordinates", () => {
  it("should preserve existing grid coordinates", () => {
    const layout: LayoutItem[] = [
      {
        id: "visualizer",
        type: "visualizer",
        title: "3D Field Visualizer",
        visible: true,
        colSpan: 1,
        height: "tall",
        order: 1,
        x: 0,
        y: 2,
        w: 6,
        h: 4,
      },
    ];

    const migrated = migrateLayoutCoordinates(layout);
    expect(migrated[0].x).toBe(0);
    expect(migrated[0].y).toBe(2);
    expect(migrated[0].w).toBe(6);
    expect(migrated[0].h).toBe(4);
  });

  it("should assign sequential grid coordinates to legacy items lacking them", () => {
    const legacyLayout: LayoutItem[] = [
      {
        id: "visualizer",
        type: "visualizer",
        title: "3D Field Visualizer",
        visible: true,
        colSpan: 1, // mapping width -> 4
        height: "tall", // mapping height -> 5
        order: 1,
      },
      {
        id: "diagnostics",
        type: "diagnostics",
        title: "Health & Diagnostics",
        visible: true,
        colSpan: 2, // mapping width -> 8
        height: "medium", // mapping height -> 3
        order: 2,
      },
      {
        id: "charts-1",
        type: "charts",
        title: "Telemetry Chart",
        visible: true,
        colSpan: 3, // mapping width -> 12
        height: "short", // mapping height -> 2
        order: 3,
      },
    ];

    const migrated = migrateLayoutCoordinates(legacyLayout);

    // 1st item: should start at (0, 1) with size (4, 5)
    expect(migrated[0].x).toBe(0);
    expect(migrated[0].y).toBe(1);
    expect(migrated[0].w).toBe(4);
    expect(migrated[0].h).toBe(5);

    // 2nd item: fits in the remaining space of row 1 (x + w = 4 + 8 <= 12).
    // So it should start at (4, 1) with size (8, 3)
    expect(migrated[1].x).toBe(4);
    expect(migrated[1].y).toBe(1);
    expect(migrated[1].w).toBe(8);
    expect(migrated[1].h).toBe(3);

    // 3rd item: does not fit in row 1 (4 + 8 + 12 > 12).
    // It should wrap to next row y = 5, starting at x = 0 with size (12, 2)
    expect(migrated[2].x).toBe(0);
    expect(migrated[2].y).toBe(5);
    expect(migrated[2].w).toBe(12);
    expect(migrated[2].h).toBe(2);
  });
});
