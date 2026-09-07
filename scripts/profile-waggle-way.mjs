import { createServer } from "vite";
import { performance } from "node:perf_hooks";

// Reproducible local engine measurement, not a device-independent performance claim.
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
const rainProfile = process.argv.includes("--rain");
try {
  const { createRun, applyCommand, stepRun, airflowAt, previewRoute } =
    await server.ssrLoadModule("/packages/waggle-way/src/core/engine.ts");
  const { createBlankLevel, makeObject, validateLevel } =
    await server.ssrLoadModule("/packages/waggle-way/src/core/level.ts");
  const objects = [
    makeObject("hive", "hive", 0, 35),
    makeObject("flowers", "flowers", 127, 35),
  ];
  for (let index = 0; index < 510; index++) {
    const x = 2 + (index % 120);
    const y = (rainProfile ? 38 : 28) + Math.floor(index / 120) * 2;
    const fan = makeObject(
      `piece-${index}`,
      index % 5 === 0
        ? "terrain"
        : rainProfile && index % 2 === 0
          ? "sprinkler"
          : "fan",
      x,
      y,
    );
    fan.range = 16;
    fan.strength = 3;
    if (fan.kind === "sprinkler")
      fan.cycle = {
        dryTicks: 30,
        warningTicks: 30,
        wetTicks: 1800,
        offsetTicks: 60,
      };
    objects.push(fan);
  }
  const level = validateLevel({
    ...createBlankLevel(),
    width: 128,
    height: 72,
    population: 100,
    rescueTarget: 100,
    objects,
  });
  const initial = applyCommand(level, createRun(level), { type: "start" });
  // Put all 100 bees in the active corridor to measure maximum simultaneous flight.
  initial.bees.forEach((bee, index) =>
    Object.assign(bee, { status: "flying", x: 1000 + index * 900, y: 35500 }),
  );
  const samples = [];
  for (let index = 0; index < 250; index++) {
    const started = performance.now();
    stepRun(level, initial);
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const overlayStart = performance.now();
  let overlayPoints = 0;
  for (let y = 0.5; y < 72; y += 6)
    for (let x = 0.5; x < 128; x += 6) {
      airflowAt(objects, x * 1000, y * 1000);
      overlayPoints++;
    }
  const overlayMs = performance.now() - overlayStart;
  const previewStart = performance.now();
  previewRoute(level, initial, 0);
  const previewMs = performance.now() - previewStart;
  console.log(
    JSON.stringify(
      {
        node: process.version,
        scenario: rainProfile
          ? "mixed rain/fan field below the flight corridor"
          : "dense fan corridor",
        sprinklers: objects.filter((object) => object.kind === "sprinkler")
          .length,
        objects: objects.length,
        activeBees: 100,
        ticksMeasured: samples.length,
        medianTickMs: samples[125],
        p95TickMs: samples[237],
        maximumTickMs: samples.at(-1),
        overlayPoints,
        overlayMs,
        threeSecondPreviewMs: previewMs,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
