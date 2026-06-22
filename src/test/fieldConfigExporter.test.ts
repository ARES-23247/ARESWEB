import { describe, it, expect } from "vitest";
import { exportToRobotConfig } from "../app/dashboard/field/utils/fieldConfigExporter";
import { FieldConfig } from "../app/dashboard/field/page";

describe("fieldConfigExporter", () => {
  it("converts a full field configuration correctly", () => {
    const input: FieldConfig = {
      id: "test-config-1",
      name: "Championship Field",
      updatedAt: 1719000000000,
      fieldType: "frc",
      gameYear: "2024-2025",
      xAxisDirection: "right",
      yAxisDirection: "down",
      redDriverStation: "east",
      blueDriverStation: "west",
      obstacles: [
        {
          id: "obs-1",
          name: "Staged Block",
          x: 2.5,
          y: 1.2,
          width: 0.5,
          height: 0.5,
          isBlocking: true,
          obstacleType: "blocking",
          shape: "rectangle",
          friction: 0.6,
          restitution: 0.15,
          rotation: 45,
        },
        {
          id: "obs-2",
          name: "Ramp Block",
          x: -1.0,
          y: 0.5,
          width: 1.0,
          height: 0.8,
          isBlocking: false,
          obstacleType: "ramp",
          rampDirection: "up",
          // shape, points, friction, restitution, rotation are omitted to test defaults
        }
      ],
      elementTypes: [
        {
          id: "el-type-1",
          name: "Game Ball",
          shape: "sphere",
          width: 0.24,
          height: 0.24,
          depth: 0.24,
          diameter: 0.24,
          color: "#FF5500",
          massKg: 0.15,
          movable: true
        }
      ],
      elements: [
        {
          id: "el-inst-1",
          elementTypeId: "el-type-1",
          x: 0.0,
          y: 0.0,
          rotation: 0
        }
      ],
      apriltags: [
        {
          id: 7,
          x: 8.0,
          y: 4.0,
          z: 1.5,
          yaw: 180
        }
      ]
    };

    const output = exportToRobotConfig(input);

    expect(output.id).toBe("test-config-1");
    expect(output.name).toBe("Championship Field");
    expect(output.fieldType).toBe("frc");
    expect(output.gameYear).toBe("2024-2025");
    expect(output.xAxisDirection).toBe("right");
    expect(output.yAxisDirection).toBe("down");
    expect(output.redDriverStation).toBe("east");
    expect(output.blueDriverStation).toBe("west");

    // Obstacles
    expect(output.obstacles).toHaveLength(2);
    
    // Check first obstacle values
    const obs1 = output.obstacles[0];
    expect(obs1.id).toBe("obs-1");
    expect(obs1.name).toBe("Staged Block");
    expect(obs1.x).toBe(2.5);
    expect(obs1.y).toBe(1.2);
    expect(obs1.width).toBe(0.5);
    expect(obs1.height).toBe(0.5);
    expect(obs1.isBlocking).toBe(true);
    expect(obs1.obstacleType).toBe("blocking");
    expect(obs1.shape).toBe("rectangle");
    expect(obs1.friction).toBe(0.6);
    expect(obs1.restitution).toBe(0.15);
    expect(obs1.rotation).toBe(45);

    // Check second obstacle defaults
    const obs2 = output.obstacles[1];
    expect(obs2.id).toBe("obs-2");
    expect(obs2.shape).toBe("rectangle");
    expect(obs2.points).toEqual([]);
    expect(obs2.friction).toBe(0.5);
    expect(obs2.restitution).toBe(0.3);
    expect(obs2.rotation).toBe(0.0);

    // Element types
    expect(output.elementTypes).toHaveLength(1);
    expect(output.elementTypes[0].id).toBe("el-type-1");
    expect(output.elementTypes[0].movable).toBe(true);

    // Element instances
    expect(output.elements).toHaveLength(1);
    expect(output.elements[0].id).toBe("el-inst-1");
    expect(output.elements[0].elementTypeId).toBe("el-type-1");

    // AprilTags
    expect(output.apriltags).toHaveLength(1);
    expect(output.apriltags[0].id).toBe(7);
    expect(output.apriltags[0].yaw).toBe(180);
  });
});
