import { useEffect, useRef, useState } from "react";
import type { LevelDefinition } from "../core/level";
import type { RunReplay } from "../core/replay";
import type { GhostResponse } from "./ghost.worker";

/** Coalesce requests: at most one calculation is in flight, and never display an older tick. */
export function useGhostReplay(
  level: LevelDefinition,
  replay: RunReplay | null,
  enabled: boolean,
  tick: number,
) {
  const desired = useRef(tick);
  const request = useRef<(() => void) | null>(null);
  const [result, setResult] = useState<
    (GhostResponse & { source: RunReplay }) | null
  >(null);
  useEffect(() => {
    desired.current = tick;
    request.current?.();
  }, [tick]);
  useEffect(() => {
    if (!enabled || !replay) return;
    let worker: Worker | undefined;
    let disposed = false;
    let failed = false;
    let busy = true;
    let lastRequested = desired.current;
    const fail = () => {
      if (disposed) return;
      failed = true;
      setResult({
        source: replay,
        requestedTick: desired.current,
        frame: null,
        error: "Ghost comparison is unavailable. You can continue playing.",
      });
    };
    const send = () => {
      if (busy || failed || disposed || lastRequested === desired.current)
        return;
      busy = true;
      lastRequested = desired.current;
      try {
        worker!.postMessage({ tick: lastRequested });
      } catch {
        fail();
      }
    };
    request.current = send;
    try {
      worker = new Worker(new URL("./ghost.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<GhostResponse>) => {
        if (disposed) return;
        busy = false;
        failed = Boolean(event.data.error);
        setResult({ ...event.data, source: replay });
        if (event.data.pending) lastRequested = -1;
        send();
      };
      worker.onerror = fail;
      worker.postMessage({ level, replay, tick: lastRequested });
    } catch {
      fail();
    }
    return () => {
      disposed = true;
      request.current = null;
      worker?.terminate();
    };
  }, [level, replay, enabled]);
  const active = enabled && replay !== null;
  const matching = active && result?.source === replay;
  return {
    frame: matching && result.requestedTick === tick ? result.frame : null,
    error: matching ? result.error : "",
    loading:
      active &&
      (!matching ||
        (!result.error && (result.pending || result.requestedTick !== tick))),
  };
}
