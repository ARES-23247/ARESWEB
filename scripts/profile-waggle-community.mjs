import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

// Run `pnpm --filter functions build` first. No network, credentials or database access.
const require = createRequire(import.meta.url);
const {
  createBlankLevel,
  makeObject,
  validateLevel,
  serializeLevel,
} = require("../functions/lib/generated/games/waggle-way/level.js");
const {
  createRun,
  applyCommand,
  stepRun,
} = require("../functions/lib/generated/games/waggle-way/engine.js");
const {
  captureReplay,
} = require("../functions/lib/generated/games/waggle-way/replay.js");
const {
  verifyWaggleSubmission,
} = require("../functions/lib/lib/waggleVerification.js");
const buzzello = require("../functions/lib/lib/buzzelloGame.js");

const small = createBlankLevel();
let run = applyCommand(small, createRun(small), { type: "start" });
while (run.phase !== "finished" && run.tick < 1800) run = stepRun(small, run);
const objects = [
  makeObject("hive", "hive", 0, 35),
  makeObject("flowers", "flowers", 127, 35),
];
for (let n = 0; n < 510; n++) {
  const object = makeObject(
    `piece-${n}`,
    n % 5 === 0 ? "terrain" : n % 2 === 0 ? "sprinkler" : "fan",
    2 + (n % 120),
    38 + Math.floor(n / 120) * 2,
  );
  object.range = 16;
  object.strength = 3;
  if (object.kind === "sprinkler")
    object.cycle = {
      dryTicks: 30,
      warningTicks: 30,
      wetTicks: 1800,
      offsetTicks: 60,
    };
  objects.push(object);
}
const dense = validateLevel({
  ...small,
  width: 128,
  height: 72,
  population: 100,
  rescueTarget: 100,
  objects,
});
const denseReplay = {
  version: 1,
  rulesVersion: dense.rulesVersion,
  levelDefinition: serializeLevel(dense),
  endTick: 54000,
  commands: [{ tick: 0, command: { type: "start" } }],
};
const scenarios = [
  {
    name: "winning blank garden",
    level: small,
    replays: [captureReplay(small, run)],
  },
  {
    name: "512 objects, 100 bees, maximum replay duration",
    level: dense,
    replays: [denseReplay],
  },
  {
    name: "three distinct maximum-duration witnesses",
    level: dense,
    replays: [
      denseReplay,
      { ...denseReplay, endTick: 53999 },
      { ...denseReplay, endTick: 53998 },
    ],
  },
];
for (const scenario of scenarios) {
  const payload = JSON.stringify({
    level: scenario.level,
    replays: scenario.replays,
  });
  let board = buzzello.createBuzzelloInitialBoard();
  let player = "yellow";
  const moveSamples = [];
  const gaps = [];
  let last = performance.now();
  let peakRss = process.memoryUsage().rss;
  const timer = setInterval(() => {
    const started = performance.now();
    gaps.push(started - last);
    last = started;
    const moves = buzzello.getBuzzelloLegalMoves(board, player);
    if (moves.length) {
      board = buzzello.applyBuzzelloMove(board, player, moves[0].index).board;
      const turn = buzzello.resolveBuzzelloTurn(board, player);
      player = turn.currentPlayer;
      if (turn.gameOver) board = buzzello.createBuzzelloInitialBoard();
    } else {
      board = buzzello.createBuzzelloInitialBoard();
      player = "yellow";
    }
    moveSamples.push(performance.now() - started);
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 25);
  const started = performance.now();
  let outcome;
  try {
    await verifyWaggleSubmission(payload);
    outcome = "verified";
  } catch (error) {
    outcome = error.code ?? "unexpected-error";
    if (!error.code) throw error;
  } finally {
    clearInterval(timer);
  }
  console.log(
    JSON.stringify({
      scenario: scenario.name,
      node: process.version,
      bytes: Buffer.byteLength(payload),
      outcome,
      elapsedMs: performance.now() - started,
      peakProcessRssMiB: peakRss / 1024 / 1024,
      concurrentBuzzelloMoves: moveSamples.length,
      maxBuzzelloMoveMs: Math.max(0, ...moveSamples),
      maximum25msTimerGapMs: Math.max(0, ...gaps),
    }),
  );
}
