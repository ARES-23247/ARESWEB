// Keep simulation time independent of the display's refresh rate. A bounded
// catch-up avoids a burst of physics work after a background tab or long frame.
class PollenPhysicsClock {
  constructor() {
    this.stepMs = 1000 / 120;
    this.reset();
  }

  reset() {
    this.accumulator = 0;
    this.alpha = 0;
  }

  advance(elapsedMs, step) {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
    this.accumulator += Math.min(elapsedMs, 100);
    while (this.accumulator + 1e-7 >= this.stepMs) {
      step(this.stepMs);
      this.accumulator = Math.max(0, this.accumulator - this.stepMs);
    }
    this.alpha = this.accumulator / this.stepMs;
  }
}

window.PollenPhysicsClock = PollenPhysicsClock;
