import { PixelObjectArt as ObjectArt, PixelBee, PixelGround } from "./PixelArt";
import { useId, useMemo, useRef, useState } from "react";
import {
  airflowAt,
  gateState,
  DIRECTIONS,
  UNITS,
  type RunState,
} from "../core/engine";
import { type Direction, type LevelDefinition } from "../core/level";
import { rainZones, sprinklerPhase } from "../core/weather";

export const OBJECT_LABELS = {
  hive: "Hive",
  flowers: "Flower field",
  terrain: "Solid branch",
  water: "Water",
  perch: "Guide perch",
  fan: "Fan",
  shelter: "Shelter leaf",
  switch: "Switch flower",
  gate: "Linked gate",
  rally: "Rally flower",
  sprinkler: "Timed sprinkler",
  pollen: "Pollen",
  dancer: "Dancing bee",
};

interface Props {
  level: LevelDefinition;
  run?: RunState;
  ghostBees?: RunState["bees"];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onPlace?: (x: number, y: number) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onInteract?: () => void;
  onTurn?: (id: string, direction: Direction) => void;
  onDropTool?: (id: string, x: number, y: number) => void;
  onDropPiece?: (kind: string, x: number, y: number) => void;
  overlays?: boolean;
  preview?: Array<{ x: number; y: number }>;
}

export function PieceIcon({ kind }: { kind: keyof typeof OBJECT_LABELS }) {
  return (
    <svg
      className="ww-piece-icon"
      viewBox="-.12 -.12 1.24 1.24"
      aria-hidden="true"
    >
      <ObjectArt object={{ kind, width: 1, height: 1 }} />
    </svg>
  );
}

export default function GardenScene({
  level,
  run,
  ghostBees,
  selectedId,
  onSelect,
  onPlace,
  onMove,
  onTurn,
  onInteract,
  onDropTool,
  onDropPiece,
  overlays = true,
  preview = [],
}: Props) {
  const unique = useId().replace(/:/g, "");
  const turning = useRef<{
    id: string;
    x: number;
    y: number;
    direction: Direction;
  } | null>(null);
  const [turnPreview, setTurnPreview] = useState<{
    id: string;
    direction: Direction;
  } | null>(null);
  const moving = useRef<{
    id: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    nextX: number;
    nextY: number;
  } | null>(null);
  const [movePreview, setMovePreview] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const objects = run?.objects ?? level.objects;
  const selected = objects.find((object) => object.id === selectedId);
  const openGateKey = run
    ? objects
        .filter(
          (object) =>
            object.kind === "gate" && gateState(run, object) !== "closed",
        )
        .map((object) => object.id)
        .join("|")
    : "";
  const windSamples = useMemo(() => {
    const samples: Array<{ x: number; y: number; dx: number; dy: number }> = [];
    if (overlays) {
      const stride = Math.max(
        1,
        Math.ceil(level.width / 24),
        Math.ceil(level.height / 16),
      );
      for (let y = 0.5; y < level.height; y += stride)
        for (let x = 0.5; x < level.width; x += stride) {
          const wind = airflowAt(
            objects,
            x * UNITS,
            y * UNITS,
            openGateKey.split("|"),
          );
          if (wind.x || wind.y)
            samples.push({ x, y, dx: wind.x / 160, dy: wind.y / 160 });
        }
    }
    return samples;
  }, [objects, overlays, level.width, level.height, openGateKey]);
  const sprinklers = useMemo(
    () =>
      objects
        .filter((object) => object.kind === "sprinkler")
        .map((object) => ({
          object,
          zones: rainZones(objects, object, openGateKey.split("|")),
        })),
    [objects, openGateKey],
  );
  return (
    <svg
      className="ww-scene"
      viewBox={`0 0 ${level.width} ${level.height}`}
      role="img"
      aria-label={`${level.title}. ${level.width} columns by ${level.height} rows. Drag pieces to move and arrows to turn. Direction buttons and precise position controls are also available below.`}
      onPointerMove={(event) => {
        if (moving.current) {
          const matrix = event.currentTarget.getScreenCTM();
          if (!matrix) return;
          const p = event.currentTarget.createSVGPoint();
          p.x = event.clientX;
          p.y = event.clientY;
          const local = p.matrixTransform(matrix.inverse());
          const drag = moving.current;
          drag.nextX = Math.round(drag.x + local.x - drag.startX);
          drag.nextY = Math.round(drag.y + local.y - drag.startY);
          setMovePreview({ id: drag.id, x: drag.nextX, y: drag.nextY });
          return;
        }
        const drag = turning.current;
        const matrix = event.currentTarget.getScreenCTM();
        if (!drag || !matrix) return;
        const point = event.currentTarget.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const local = point.matrixTransform(matrix.inverse());
        if (Math.hypot(local.x - drag.x, local.y - drag.y) < 0.35) return;
        drag.direction = ((Math.round(
          Math.atan2(local.y - drag.y, local.x - drag.x) / (Math.PI / 4),
        ) +
          8) %
          8) as Direction;
        setTurnPreview({ id: drag.id, direction: drag.direction });
      }}
      onPointerUp={() => {
        const move = moving.current;
        if (move) {
          moving.current = null;
          setMovePreview(null);
          if (move.nextX !== move.x || move.nextY !== move.y)
            onMove?.(move.id, move.nextX, move.nextY);
        }
        if (turning.current)
          onTurn?.(turning.current.id, turning.current.direction);
        turning.current = null;
        setTurnPreview(null);
      }}
      onPointerCancel={() => {
        moving.current = null;
        setMovePreview(null);
        turning.current = null;
        setTurnPreview(null);
      }}
      onDragOver={(event) => {
        if (onDropTool || onDropPiece) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const matrix = event.currentTarget.getScreenCTM();
        if (!matrix) return;
        const point = event.currentTarget.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const local = point.matrixTransform(matrix.inverse());
        const tool = event.dataTransfer.getData("application/x-waggle-tool");
        const piece = event.dataTransfer.getData("application/x-waggle-piece");
        if (tool) onDropTool?.(tool, Math.floor(local.x), Math.floor(local.y));
        if (piece)
          onDropPiece?.(piece, Math.floor(local.x), Math.floor(local.y));
      }}
      onClick={(event) => {
        if (
          !onPlace ||
          event.target !==
            event.currentTarget.querySelector(".ww-scene-background")
        )
          return;
        const point = event.currentTarget.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const matrix = event.currentTarget.getScreenCTM();
        if (matrix) {
          const local = point.matrixTransform(matrix.inverse());
          onPlace(Math.floor(local.x), Math.floor(local.y));
        }
      }}
    >
      <defs>
        <pattern
          id={`rain-${unique}`}
          width=".5"
          height=".5"
          patternUnits="userSpaceOnUse"
        >
          <path d="M .2 .05 V .3" className="ww-rain-streak" />
        </pattern>
        <pattern
          id={`grid-${unique}`}
          width="1"
          height="1"
          patternUnits="userSpaceOnUse"
        >
          <path d="M 1 0 H 0 V 1" className="ww-grid-line" />
        </pattern>
        <marker
          id={`arrow-${unique}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="3"
          markerHeight="3"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" className="ww-honey-fill" />
        </marker>
      </defs>
      <rect
        className="ww-scene-background"
        width={level.width}
        height={level.height}
      />

      <PixelGround
        id={unique}
        width={level.width}
        height={level.height}
        theme={level.theme ?? level.id.split("-")[0]}
      />
      <rect
        width={level.width}
        height={level.height}
        fill={onPlace && !run ? `url(#grid-${unique})` : "none"}
        pointerEvents="none"
      />
      {windSamples.map((sample) => (
        <path
          key={`${sample.x}-${sample.y}`}
          className="ww-wind"
          pointerEvents="none"
          markerEnd={`url(#arrow-${unique})`}
          d={`M ${sample.x} ${sample.y} l ${sample.dx} ${sample.dy}`}
        />
      ))}
      {sprinklers.map(({ object, zones }) => {
        const { phase } = sprinklerPhase(object, run?.tick ?? 0);
        return (
          <g
            key={`rain-${object.id}`}
            className={`ww-rain-zone ww-weather-${phase}`}
            pointerEvents="none"
          >
            {zones.map((zone, index) => (
              <rect
                key={index}
                {...zone}
                fill={phase === "rain" ? `url(#rain-${unique})` : "none"}
              />
            ))}
          </g>
        );
      })}
      {overlays &&
        (selected?.kind === "perch" || selected?.kind === "dancer") && (
          <circle
            className="ww-influence"
            pointerEvents="none"
            cx={selected.x + selected.width / 2}
            cy={selected.y + selected.height / 2}
            r={selected.range}
          />
        )}
      {preview.length > 1 && (
        <polyline
          className="ww-preview"
          pointerEvents="none"
          points={preview
            .map((point) => `${point.x / UNITS},${point.y / UNITS}`)
            .join(" ")}
        />
      )}
      {overlays &&
        objects
          .filter((object) => object.kind === "gate")
          .map((gate) => {
            const linked = objects.find(
              (object) => object.id === gate.switchId,
            )!;
            return (
              <path
                key={`link-${gate.id}`}
                className="ww-gate-link"
                pointerEvents="none"
                d={`M ${gate.x + gate.width / 2} ${gate.y + gate.height / 2} L ${linked.x + linked.width / 2} ${linked.y + linked.height / 2}`}
              />
            );
          })}
      {objects
        .filter(
          (object) =>
            object.kind !== "pollen" ||
            !run?.pollen?.some(
              (token) =>
                token.objectId === object.id &&
                (token.delivered || token.carrierId !== null),
            ),
        )
        .map((object) => (
          <g
            key={object.id}
            transform={`translate(${movePreview?.id === object.id ? movePreview.x : object.x} ${movePreview?.id === object.id ? movePreview.y : object.y})`}
            className={selectedId === object.id ? "ww-selected" : ""}
            onClick={(event) => {
              event.stopPropagation();
              onSelect?.(object.id);
            }}
            onPointerDown={(event) => {
              if (
                !onMove ||
                (run &&
                  (object.permission !== "movable" || run.phase === "finished"))
              )
                return;
              const svg = event.currentTarget.ownerSVGElement;
              const matrix = svg?.getScreenCTM();
              if (!svg || !matrix) return;
              const p = svg.createSVGPoint();
              p.x = event.clientX;
              p.y = event.clientY;
              const local = p.matrixTransform(matrix.inverse());
              onInteract?.();
              onSelect?.(object.id);
              moving.current = {
                id: object.id,
                startX: local.x,
                startY: local.y,
                x: object.x,
                y: object.y,
                nextX: object.x,
                nextY: object.y,
              };
              svg.setPointerCapture(event.pointerId);
            }}
          >
            <title>
              {OBJECT_LABELS[object.kind]}: {object.id}, column {object.x}, row{" "}
              {object.y}
            </title>
            {/* Empty pixels still belong to the object's selectable footprint. */}
            <rect
              width={object.width}
              height={object.height}
              fill="transparent"
              pointerEvents="all"
            />
            <ObjectArt
              object={object}
              state={
                object.kind === "dancer" &&
                run?.bees.some((bee) => bee.perchId === object.id)
                  ? "assigned"
                  : object.kind === "sprinkler"
                    ? sprinklerPhase(object, run?.tick ?? 0).phase
                    : object.kind === "gate" && run
                      ? gateState(run, object)
                      : object.kind === "rally"
                        ? (run?.rallies.find(
                            (rally) => rally.objectId === object.id,
                          )?.mode ?? "hold")
                        : "closed"
              }
            />
            {object.kind === "dancer" && object.dance !== "point" && (
              <g
                transform="translate(.12 -.7)"
                pointerEvents="none"
                data-dance-badge={object.dance}
              >
                <title>
                  {object.dance === "reverse"
                    ? "Reverse 180 degrees"
                    : `Turn ${object.dance} 90 degrees`}
                  .{" "}
                  {level.rulesVersion >= 7
                    ? "The helper follows the last bee it guided when released."
                    : "The straight arrow is the helper's release heading."}
                </title>
                <rect
                  width=".76"
                  height=".6"
                  fill="#172a2b"
                  stroke="#fff4d2"
                  strokeWidth=".05"
                />
                <path
                  d={
                    object.dance === "left"
                      ? "M.57 .48V.2H.2M.32 .08L.2 .2L.32 .32"
                      : object.dance === "right"
                        ? "M.19 .48V.2H.56M.44 .08L.56 .2L.44 .32"
                        : "M.2 .48V.14H.56V.48M.44 .36L.56 .48L.68 .36"
                  }
                  fill="none"
                  stroke="#efb84a"
                  strokeWidth=".09"
                  strokeLinejoin="miter"
                />
              </g>
            )}
            {selectedId === object.id && (
              <rect
                className="ww-selection-outline"
                x="-.08"
                y="-.08"
                width={object.width + 0.16}
                height={object.height + 0.16}
                rx=".16"
              />
            )}
            {!(
              level.rulesVersion >= 7 &&
              object.kind === "dancer" &&
              object.dance !== "point"
            ) &&
              (object.kind === "fan" ||
                object.kind === "perch" ||
                object.kind === "dancer" ||
                object.kind === "switch" ||
                object.kind === "rally" ||
                object.kind === "hive") && (
                <path
                  className="ww-direction"
                  pointerEvents="none"
                  markerEnd={`url(#arrow-${unique})`}
                  d={`M ${object.width / 2} ${object.height / 2} l ${(DIRECTIONS[turnPreview?.id === object.id ? turnPreview.direction : object.direction][0] / 1000) * 1.15} ${(DIRECTIONS[turnPreview?.id === object.id ? turnPreview.direction : object.direction][1] / 1000) * 1.15}`}
                />
              )}
            {onTurn &&
              !(
                level.rulesVersion >= 7 &&
                object.kind === "dancer" &&
                object.dance !== "point"
              ) &&
              run?.phase !== "finished" &&
              selectedId === object.id &&
              (!run || object.permission !== "fixed") &&
              ["hive", "perch", "dancer", "fan", "switch", "rally"].includes(
                object.kind,
              ) && (
                <g
                  className="ww-turn-handle"
                  data-turn-handle={object.id}
                  transform={`translate(${object.width / 2 + (DIRECTIONS[turnPreview?.id === object.id ? turnPreview.direction : object.direction][0] / 1000) * 1.15} ${object.height / 2 + (DIRECTIONS[turnPreview?.id === object.id ? turnPreview.direction : object.direction][1] / 1000) * 1.15})`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    onInteract?.();
                    turning.current = {
                      id: object.id,
                      x: object.x + object.width / 2,
                      y: object.y + object.height / 2,
                      direction: object.direction,
                    };
                    event.currentTarget.ownerSVGElement!.setPointerCapture(
                      event.pointerId,
                    );
                  }}
                >
                  <title>
                    {object.kind === "dancer" && object.dance !== "point"
                      ? "Drag to set the helper's release heading"
                      : `Drag to turn ${OBJECT_LABELS[object.kind]}`}
                  </title>
                  <circle r=".5" fill="transparent" />
                  <circle r=".2" className="ww-turn-knob" />
                </g>
              )}
          </g>
        ))}
      <g className="ww-ghost-bees" pointerEvents="none" aria-hidden="true">
        {ghostBees
          ?.filter(
            (bee) =>
              bee.status === "flying" ||
              bee.status === "assigned" ||
              bee.status === "waiting",
          )
          .map((bee) => (
            <g
              key={bee.id}
              data-ghost-bee={bee.id}
              transform={`translate(${bee.x / UNITS} ${bee.y / UNITS})`}
            >
              <g transform={`rotate(${bee.direction * 45})`}>
                <ellipse className="ww-ghost-outline" rx=".4" ry=".3" />
                <path
                  className="ww-ghost-heading"
                  d="M .36 -.12 L .52 0 .36 .12"
                />
              </g>
              <text
                className="ww-ghost-label"
                x="0"
                y="-.4"
                textAnchor="middle"
              >
                G{bee.id + 1}
              </text>
            </g>
          ))}
      </g>
      {run?.bees
        .filter(
          (bee) =>
            bee.status === "flying" ||
            bee.status === "assigned" ||
            bee.status === "waiting",
        )
        .map((bee) => (
          <g
            className={`ww-bee${bee.status === "assigned" ? " ww-bee-guiding" : ""}`}
            key={bee.id}
            transform={`translate(${bee.x / UNITS} ${bee.y / UNITS}) rotate(${bee.direction * 45})`}
            pointerEvents="none"
          >
            <PixelBee />
            {run.pollen?.some((token) => token.carrierId === bee.id) && (
              <rect
                className="ww-carried-pollen"
                x="-.4"
                y=".15"
                width=".16"
                height=".16"
                fill="#ffe09a"
                stroke="#172a2b"
                strokeWidth=".03"
              />
            )}
          </g>
        ))}
      {run?.won && (
        <text
          className="ww-win-label"
          x={level.width / 2}
          y="1.2"
          textAnchor="middle"
        >
          The garden is blooming!
        </text>
      )}
    </svg>
  );
}
