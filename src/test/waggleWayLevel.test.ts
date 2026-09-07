import { describe, expect, it } from "vitest";
import {
  createBlankLevel,
  makeObject,
  MAX_LEVEL_BYTES,
  overlaps,
  parseLevelFile,
  serializeLevel,
  validateLevel,
} from "@ares/waggle-way/level";

describe("Waggle Way level boundary", () => {
  it("round-trips canonical data and detaches it from the input", () => {
    const level = createBlankLevel();
    level.objects.push(
      makeObject("guide", "perch", 5, 7),
      makeObject("fan", "fan", 8, 10),
    );
    const encoded = serializeLevel(level);
    const loaded = parseLevelFile(encoded);
    expect(serializeLevel(loaded)).toBe(encoded);
    loaded.objects[0].x = 0;
    expect(
      level.objects.find((object) => object.id === loaded.objects[0].id)?.x,
    ).not.toBe(0);
    expect(createBlankLevel().schemaVersion).toBe(5);
  });

  it.each([null, [], "garden", { ...createBlankLevel(), surprise: true }])(
    "rejects invalid top-level data %#",
    (value) => {
      expect(() => validateLevel(value)).toThrow();
    },
  );

  it.each([
    ["schemaVersion", 999],
    ["rulesVersion", 999],
    ["width", 7],
    ["height", 73],
    ["population", 101],
    ["population", NaN],
    ["rescueTarget", 9],
    ["rescueTarget", 0],
    ["releaseInterval", 1.5],
    ["guideLimit", -1],
    ["title", ""],
    ["title", "a".repeat(81)],
    ["instructions", "a".repeat(501)],
    ["instructions", "bad\u0000text"],
    ["id", "unsafe/id"],
    ["objects", []],
    ["objects", {}],
    ["objects", Array(513).fill({})],
  ])("rejects invalid %s", (field, value) => {
    expect(() =>
      validateLevel({ ...createBlankLevel(), [field]: value }),
    ).toThrow();
  });

  it.each([
    { kind: "script" },
    { permission: "admin" },
    { permission: "movable" },
    { direction: 8 },
    { strength: 0 },
    { range: 17 },
    { x: -1 },
    { y: 14 },
    { width: 128 },
    { height: 72 },
    { id: "bad space" },
    { script: "run()" },
  ])("rejects invalid object properties %j", (patch) => {
    const level = createBlankLevel();
    Object.assign(level.objects[0], patch);
    expect(() => validateLevel(level)).toThrow();
  });

  it("requires exactly one hive and destination and unique IDs", () => {
    const level = createBlankLevel();
    level.objects.push(makeObject("hive", "fan", 4, 4));
    expect(() => validateLevel(level)).toThrow("Duplicate");
    level.objects[2].id = "another-hive";
    level.objects[2].kind = "hive";
    level.objects[2].permission = "fixed";
    expect(() => validateLevel(level)).toThrow("exactly one hive");
    level.objects = level.objects.filter((object) => object.kind !== "flowers");
    level.objects[2 - 1].kind = "fan";
    expect(() => validateLevel(level)).toThrow("flower field");
  });

  it("rejects object overlap but permits touching edges", () => {
    const level = createBlankLevel();
    const water = makeObject("water", "water", 21, 7);
    level.objects.push(water);
    expect(() => validateLevel(level)).toThrow("overlaps");
    water.x = 20;
    expect(validateLevel(level).objects).toHaveLength(3);
    expect(overlaps(level.objects[0], water)).toBe(false);
  });

  it("bounds UTF-8 input before parsing and reports invalid JSON and unsupported versions", () => {
    expect(() => parseLevelFile("x".repeat(MAX_LEVEL_BYTES + 1))).toThrow(
      "256 KiB",
    );
    expect(() => parseLevelFile("🌼".repeat(MAX_LEVEL_BYTES / 3))).toThrow(
      "256 KiB",
    );
    expect(() => parseLevelFile("{oops}")).toThrow("not valid JSON");
    expect(() => parseLevelFile('{"schemaVersion":999}')).toThrow(
      "unsupported",
    );
    const level = createBlankLevel();
    level.objects.push(null as never);
    expect(() => validateLevel(level)).toThrow("must be an object");
  });
});
