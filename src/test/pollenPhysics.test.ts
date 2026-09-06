import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

interface Clock {
  alpha: number;
  reset(): void;
  advance(elapsedMs: number, step: (ms: number) => void): void;
}
// This is a classic script in the opaque game, imported here for instrumentation.
const clockModule = "../../packages/pollinator/public/js/physics.js";
await import(clockModule);
const ClockClass = (window as unknown as { PollenPhysicsClock: new () => Clock }).PollenPhysicsClock;

function simulation(width = 800) {
  const context = createContext({ window: { addEventListener() {} } });
  for (const file of ["lib/matter.min.js", "js/flower.js", "js/pollinators.js", "js/physics.js", "js/game.js"]) {
    runInContext(readFileSync(resolve("packages/pollinator/public", file), "utf8"), context);
  }
  runInContext(`
    window.audioManager = new Proxy({}, { get: () => () => {} });
    const game = Object.create(PollenGame.prototype);
    Object.assign(game, {
      width: ${width}, height: 800, dropY: 85, landedBodies: [], activeBody: null,
      physicsClock: new window.PollenPhysicsClock(),
      ui: { updateHUD() {}, drawPreview() {}, showGameOver() {} },
      background: { setTimeTarget() {}, update() {} }, rangerDave: { isThinking: false }
    });
    game.initPhysics(); game.startMode('solo');
    game.currentPollinator = window.POLLINATOR_TYPES.BEE;
    game.nextPollinator = window.POLLINATOR_TYPES.BEE;
    game.dropPollinator();
  `, context);
  return (code: string) => runInContext(code, context);
}

describe("Pollen simulation timing and settling", () => {
  it.each([30, 60, 90, 120, 144])("advances one second at %i Hz and retains fractional frames", (hz) => {
    const clock = new ClockClass();
    let elapsed = 0;
    for (let i = 0; i < hz; i++) clock.advance(1000 / hz, ms => { elapsed += ms; });
    expect(elapsed).toBeCloseTo(1000, 7);
    clock.advance(2, () => { throw new Error("fractional frame stepped early"); });
    expect(clock.alpha).toBeCloseTo(0.24, 7);
  });

  it("bounds catch-up, ignores invalid time, and resets cleanly after a tab pause", () => {
    const clock = new ClockClass();
    let elapsed = 0;
    const step = (ms: number) => { elapsed += ms; };
    for (const invalid of [NaN, Infinity, -10, 0]) clock.advance(invalid, step);
    expect(elapsed).toBe(0);
    clock.advance(60000, step);
    expect(elapsed).toBeCloseTo(100, 7);
    clock.advance(4, step);
    clock.reset();
    expect(clock.alpha).toBe(0);
    clock.advance(5, step);
    expect(elapsed).toBeCloseTo(100, 7);
  });

  it("produces the same real Matter.js landing and score at 30, 60, 120, and 144 Hz", () => {
    const outcomes = [30, 60, 120, 144].map(hz => {
      const run = simulation();
      return JSON.parse(run(`
        for (let i = 0; i < ${hz * 8}; i++) game.physicsClock.advance(${1000 / hz}, ms => game.update(ms / (1000 / 60)));
        JSON.stringify({ count: game.crittersLanded, score: game.score, state: game.state,
          y: game.landedBodies[0]?.position.y, tilt: game.flower.head.angle });
      `));
    });
    expect(outcomes[0]).toMatchObject({ count: 1, score: 10, state: "aiming" });
    for (const outcome of outcomes.slice(1)) expect(outcome).toEqual(outcomes[0]);
  });

  it("does not award a moving or unsupported piece, and waits for sustained stable contact", () => {
    const run = simulation();
    expect(run(`
      const body = game.activeBody;
      body.speed = 0; body.angularSpeed = 0;
      game.updateLanding(1000);
      game.crittersLanded;
    `)).toBe(0);
    expect(run(`
      game.engine.pairs.list = [{ isActive: true, bodyA: body, bodyB: game.flower.head }];
      body.speed = 2; game.updateLanding(1000);
      game.crittersLanded;
    `)).toBe(0);
    expect(run(`
      body.speed = 0; game.updateLanding(300);
      game.engine.pairs.list[0].isActive = false; game.updateLanding(10);
      game.engine.pairs.list[0].isActive = true; game.updateLanding(300);
      game.crittersLanded;
    `)).toBe(0);
    expect(run("game.updateLanding(60); game.crittersLanded;")).toBe(1);
  });

  it("keeps a resting stack below one pixel of vertical vibration while allowing a missed drop to lose", () => {
    const run = simulation();
    const motion = run(`
      for (let count = 1; count <= 3; count++) {
        for (let i = 0; i < 120 * 8 && game.crittersLanded < count; i++) game.update(0.5);
        if (game.crittersLanded !== count) throw new Error('Centered stack did not settle');
        if (count < 3) {
          game.currentPollinator = window.POLLINATOR_TYPES.BEE;
          game.dropX = 400 + (count % 2 ? 12 : -12); game.dropPollinator();
        }
      }
      const samples = [];
      for (let i = 0; i < 120 * 12; i++) {
        game.update(0.5);
        if (i > 120 * 10) samples.push(game.landedBodies[0].position.y);
      }
      Math.max(...samples) - Math.min(...samples);
    `);
    expect(motion).toBeLessThan(1);
    expect(run(`
      game.dropX = 60; game.dropPollinator();
      for (let i = 0; i < 120 * 10; i++) game.update(0.5);
      game.state;
    `)).toBe("gameover");
  });

  it.each(["BEE", "BUTTERFLY", "LUNA_MOTH", "BAT", "MOTHMAN"])("can land and restart with %s", (type) => {
    const run = simulation();
    expect(run(`
      game.restart(); game.currentPollinator = window.POLLINATOR_TYPES.${type};
      game.dropPollinator();
      for (let i = 0; i < 120 * 12; i++) game.update(0.5);
      game.crittersLanded;
    `)).toBe(1);
    expect(run("game.restart(); game.landedBodies.length + game.score + game.landingStableMs;")).toBe(0);
  });

  it("uses roster weight ratios and lets Mothman settle beside a landed moth", () => {
    const run = simulation();
    expect(run(`
      game.restart(); game.currentPollinator = window.POLLINATOR_TYPES.LUNA_MOTH; game.dropPollinator();
      for (let i = 0; i < 120 * 6; i++) game.update(0.5);
      game.currentPollinator = window.POLLINATOR_TYPES.MOTHMAN; game.dropX = 380; game.dropPollinator();
      const heavy = game.activeBody;
      for (let i = 0; i < 120 * 12; i++) game.update(0.5);
      game.crittersLanded;
    `)).toBe(2);
    expect(run("heavy.mass / game.landedBodies[0].mass;")).toBeCloseTo(5 / 1.8);
    expect(run("game.state;")).toBe("aiming");
  });

  it("supports drops on the broader petals and keeps the resized flower inside the canvas", () => {
    const run = simulation();
    expect(run("game.flower.headWidth")).toBe(360);
    expect(run(`
      game.restart(); game.currentPollinator = window.POLLINATOR_TYPES.BEE;
      game.dropX = 545; game.dropPollinator();
      for (let i = 0; i < 120 * 8; i++) game.update(0.5);
      game.crittersLanded;
    `)).toBe(1);
    expect(run(`
      const previousAngle = game.flower.head.angle;
      game.flower.resize(260);
      Math.abs(game.flower.head.angle - previousAngle);
    `)).toBeLessThan(1e-10);
    expect(run("game.flower.headWidth")).toBe(228);
    expect(run("game.flower.head.bounds.max.x - game.flower.head.bounds.min.x")).toBeLessThan(240);
    expect(run("game.flower.resize(800); game.flower.headWidth")).toBe(360);
  });

  it("leans toward off-center weight, with heavier critters causing a larger sustained tilt", () => {
    const tilt = (type: string, offset: number) => {
      const run = simulation();
      const result = JSON.parse(run(`
        game.restart(); game.currentPollinator = window.POLLINATOR_TYPES.${type};
        game.dropX = 400 + ${offset}; game.dropPollinator();
        for (let i = 0; i < 120 * 8; i++) game.update(0.5);
        JSON.stringify({ angle: game.flower.head.angle, count: game.crittersLanded, state: game.state });
      `));
      expect(result).toMatchObject({ count: 1, state: "aiming" });
      return result.angle as number;
    };
    expect(Math.abs(tilt("BEE", 0))).toBeLessThan(0.005);
    const right = tilt("BEE", 110);
    expect(right).toBeGreaterThan(0.025);
    expect(tilt("BEE", -110)).toBeLessThan(-0.025);
    expect(tilt("MOTHMAN", 110)).toBeGreaterThan(right * 3);
  });

  it("recovers toward level when the player counterbalances the load and resets the tilt", () => {
    const run = simulation();
    const result = JSON.parse(run(`
      game.restart(); game.currentPollinator = window.POLLINATOR_TYPES.BEE;
      game.dropX = 510; game.dropPollinator();
      for (let i = 0; i < 120 * 8; i++) game.update(0.5);
      const unbalanced = game.flower.head.angle;
      game.currentPollinator = window.POLLINATOR_TYPES.BEE;
      game.dropX = 290; game.dropPollinator();
      for (let i = 0; i < 120 * 8; i++) game.update(0.5);
      JSON.stringify({ unbalanced, balanced: game.flower.head.angle, count: game.crittersLanded });
    `));
    expect(result.count).toBe(2);
    expect(Math.abs(result.balanced)).toBeLessThan(result.unbalanced * 0.6);
    expect(run("game.restart(); game.flower.getDangerFactor()")).toBe(0);
  });

  it.each([240, 260, 320])("allows a heavy off-center critter to settle on a %ipx phone canvas", (width) => {
    const run = simulation(width);
    const result = JSON.parse(run(`
      game.restart(); game.currentPollinator = window.POLLINATOR_TYPES.MOTHMAN;
      game.dropX = game.width / 2 + Math.floor(game.flower.headWidth * 0.3 / 15) * 15;
      game.dropPollinator();
      for (let i = 0; i < 120 * 8; i++) game.update(0.5);
      JSON.stringify({ count: game.crittersLanded, state: game.state, angle: game.flower.head.angle });
    `));
    expect(result).toMatchObject({ count: 1, state: "aiming" });
    expect(result.angle).toBeGreaterThan(0.02);
    expect(result.angle).toBeLessThan(0.2);
  });
});
