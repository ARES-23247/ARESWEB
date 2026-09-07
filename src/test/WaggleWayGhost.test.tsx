import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGhostReplay } from "../../packages/waggle-way/src/ui/useGhostReplay";
import type { GhostResponse } from "../../packages/waggle-way/src/ui/ghost.worker";
import { createBlankLevel } from "@ares/waggle-way/level";
import {
  applyCommand,
  createRun,
  pollenCounts,
  populationCounts,
  stepRun,
} from "@ares/waggle-way/engine";
import { captureReplay } from "@ares/waggle-way/replay";

const level = createBlankLevel();
const initial = applyCommand(level, createRun(level), { type: "start" });
const run = stepRun(level, initial);
const replay = captureReplay(level, run);
const response = (tick: number): GhostResponse => ({
  requestedTick: tick,
  error: "",
  frame: {
    tick,
    endTick: 1,
    bees: run.bees,
    counts: populationCounts(run),
    pollen: pollenCounts(run),
  },
});
function Harness({ tick = 0, enabled = true, recording = replay }) {
  const ghost = useGhostReplay(level, recording, enabled, tick);
  return (
    <output data-loading={ghost.loading}>
      {ghost.error || (ghost.frame ? `Tick ${ghost.frame.tick}` : "No frame")}
    </output>
  );
}
class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent<GhostResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    TestWorker.instances.push(this);
  }
  respond(data: GhostResponse) {
    act(() => this.onmessage?.({ data } as MessageEvent<GhostResponse>));
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  TestWorker.instances = [];
});

describe("ghost worker lifecycle", () => {
  it("coalesces ticks, hides stale frames and discards callbacks after cancellation", () => {
    vi.stubGlobal("Worker", TestWorker);
    const view = render(<Harness enabled={false} />);
    expect(TestWorker.instances).toHaveLength(0);
    view.rerender(<Harness />);
    const worker = TestWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledWith({ level, replay, tick: 0 });
    expect(screen.getByRole("status")).toHaveAttribute("data-loading", "true");
    worker.respond(response(0));
    expect(screen.getByRole("status")).toHaveTextContent("Tick 0");
    view.rerender(<Harness tick={1} />);
    expect(worker.postMessage).toHaveBeenLastCalledWith({ tick: 1 });
    view.rerender(<Harness tick={2} />);
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    worker.respond(response(1));
    expect(screen.getByRole("status")).toHaveTextContent("No frame");
    expect(worker.postMessage).toHaveBeenLastCalledWith({ tick: 2 });
    worker.respond({ requestedTick: 2, frame: null, error: "", pending: true });
    expect(screen.getByRole("status")).toHaveAttribute("data-loading", "true");
    expect(worker.postMessage).toHaveBeenCalledTimes(4);
    worker.respond(response(2));
    expect(screen.getByRole("status")).toHaveTextContent("Tick 2");
    view.rerender(<Harness tick={0} />);
    expect(worker.postMessage).toHaveBeenLastCalledWith({ tick: 0 });
    view.rerender(<Harness enabled={false} />);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    worker.respond(response(0));
    act(() => worker.onerror?.());
    expect(screen.getByRole("status")).toHaveTextContent("No frame");
    view.rerender(<Harness recording={{ ...replay }} />);
    expect(TestWorker.instances).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("No frame");
    view.unmount();
    expect(TestWorker.instances[1].terminate).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable workers and calculation errors without requesting more work", () => {
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("unavailable");
        }
      },
    );
    const failed = render(<Harness />);
    expect(screen.getByRole("status")).toHaveTextContent("unavailable");
    failed.unmount();
    vi.stubGlobal("Worker", TestWorker);
    const view = render(<Harness />);
    const worker = TestWorker.instances[0];
    worker.respond({
      requestedTick: 0,
      frame: null,
      error: "Cannot replay this attempt",
    });
    view.rerender(<Harness tick={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cannot replay");
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    view.unmount();
    const active = render(<Harness />);
    const crashed = TestWorker.instances[1];
    act(() => crashed.onerror?.());
    expect(screen.getByRole("status")).toHaveTextContent("unavailable");
    active.unmount();
    const sending = render(<Harness />);
    const sender = TestWorker.instances[2];
    sender.respond(response(0));
    sender.postMessage.mockImplementation(() => {
      throw new Error("closed");
    });
    sending.rerender(<Harness tick={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("unavailable");
  });
});

it("the real worker reconstructs, clamps the recording end, and reports invalid commands", async () => {
  const surface = {
    onmessage: null as null | ((event: MessageEvent) => void),
    postMessage: vi.fn(),
  };
  vi.stubGlobal("self", surface);
  await import("../../packages/waggle-way/src/ui/ghost.worker");
  const send = (data: unknown) => surface.onmessage!({ data } as MessageEvent);
  send({ tick: 0 });
  expect(surface.postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({
      frame: null,
      error: expect.stringContaining("could not"),
    }),
  );
  send({ level, replay, tick: 1 });
  expect(surface.postMessage).toHaveBeenLastCalledWith(response(1));
  send({ tick: 50 });
  expect(surface.postMessage).toHaveBeenLastCalledWith({
    ...response(1),
    requestedTick: 50,
  });
  send({ tick: 0 });
  expect(surface.postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({
      frame: expect.objectContaining({ tick: 0, bees: initial.bees }),
    }),
  );
  send({ tick: -1 });
  expect(surface.postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ frame: null }),
  );
  let longer = run;
  while (longer.tick < 150) longer = stepRun(level, longer);
  send({ level, replay: captureReplay(level, longer), tick: 150 });
  expect(surface.postMessage).toHaveBeenLastCalledWith({
    requestedTick: 150,
    frame: null,
    error: "",
    pending: true,
  });
  send({ tick: 0 });
  expect(surface.postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ frame: expect.objectContaining({ tick: 0 }) }),
  );
  send({ tick: 150 });
  send({ tick: 150 });
  expect(surface.postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({
      frame: expect.objectContaining({ tick: 150, bees: longer.bees }),
    }),
  );
  send({ level: { ...level, title: "A new revision" }, replay, tick: 0 });
  expect(surface.postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ frame: null }),
  );
});
