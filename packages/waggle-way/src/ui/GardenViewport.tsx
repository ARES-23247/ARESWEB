import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@ares/ui/button";
import type { LevelDefinition } from "../core/level";
import type { RunState } from "../core/engine";

/** Camera state is presentation only; placement still uses the scene's SVG matrix. */
export default function GardenViewport({
  level,
  run,
  children,
  enabled = true,
}: {
  enabled?: boolean;
  level: LevelDefinition;
  run?: RunState;
  children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const [panning, setPanning] = useState(false);
  const [zoom, setZoom] = useState<number | null>(
    level.width > 20 || level.height > 14 ? 1 : null,
  );
  const [target, setTarget] = useState<{ x: number; y: number } | null>(() => {
    const hive = level.objects.find((object) => object.kind === "hive")!;
    return { x: hive.x + hive.width / 2, y: hive.y + hive.height / 2 };
  });
  const [helperIndex, setHelperIndex] = useState(0);
  const helpers =
    run?.bees.filter(
      (bee) => bee.status === "assigned" || bee.status === "waiting",
    ) ?? [];
  const center = (kind: "hive" | "flowers") => {
    const object = level.objects.find((item) => item.kind === kind)!;
    setZoom((previous) => previous ?? 1);
    setTarget({
      x: object.x + object.width / 2,
      y: object.y + object.height / 2,
    });
  };
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !target || zoom === null) return;
    element.scrollLeft = target.x * 32 * zoom - element.clientWidth / 2;
    element.scrollTop = target.y * 32 * zoom - element.clientHeight / 2;
  }, [target, zoom]);
  if (!enabled) return children;
  return (
    <div className="ww-camera">
      <div className="ww-camera-tools" role="group" aria-label="Board camera">
        <Button
          variant="secondary"
          aria-pressed={panning}
          onClick={() => setPanning(!panning)}
        >
          Pan board
        </Button>
        <Button
          variant="secondary"
          aria-pressed={zoom === null}
          onClick={() => setZoom(null)}
        >
          Fit
        </Button>
        <Button
          variant="secondary"
          aria-label="Zoom in on board"
          disabled={zoom === 2}
          onClick={() => setZoom(zoom === null ? 1 : Math.min(2, zoom + 0.5))}
        >
          +
        </Button>
        <Button
          variant="secondary"
          aria-label="Zoom out on board"
          disabled={zoom === null}
          onClick={() =>
            setZoom(zoom === 1 ? null : Math.max(1, (zoom ?? 1) - 0.5))
          }
        >
          −
        </Button>
        <Button variant="secondary" onClick={() => center("hive")}>
          Hive
        </Button>
        <Button variant="secondary" onClick={() => center("flowers")}>
          Flowers
        </Button>
        {helpers.length > 0 && (
          <Button
            variant="secondary"
            onClick={() => {
              const bee = helpers[helperIndex % helpers.length];
              setZoom((previous) => previous ?? 1);
              setTarget({ x: bee.x / 1000, y: bee.y / 1000 });
              setHelperIndex(helperIndex + 1);
            }}
          >
            Find helper ({helpers.length})
          </Button>
        )}
      </div>
      <div
        ref={viewport}
        className="ww-camera-viewport"
        tabIndex={0}
        role="region"
        aria-label="Garden viewport; arrow keys scroll, Pan board enables dragging"
        data-panning={panning}
        onPointerDown={(event) => {
          if (!panning || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          event.currentTarget.scrollLeft =
            drag.current.left + drag.current.x - event.clientX;
          event.currentTarget.scrollTop =
            drag.current.top + drag.current.y - event.clientY;
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        <div
          className="ww-camera-world"
          style={
            zoom === null
              ? { width: "100%", height: "100%" }
              : {
                  width: level.width * 32 * zoom,
                  height: level.height * 32 * zoom,
                }
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
