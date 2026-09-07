import { useRef, useState, type ReactNode } from "react";
import { Button } from "@ares/ui/button";
import { PieceIcon, OBJECT_LABELS } from "./GardenScene";

/** Pointer capture works on touch browsers that do not expose HTML drag/drop. */
export default function ToolTrayButton({
  kind,
  disabled,
  selected,
  children,
  onSelect,
  onDrop,
  onDragBegin,
  label,
  ariaLabel,
}: {
  kind: keyof typeof OBJECT_LABELS;
  disabled?: boolean;
  selected?: boolean;
  children?: ReactNode;
  onSelect: () => void;
  onDrop: (x: number, y: number) => void;
  onDragBegin?: () => void;
  label?: string;
  ariaLabel?: string;
}) {
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  return (
    <Button
      className="ww-tray-button"
      variant="secondary"
      disabled={disabled}
      aria-pressed={selected}
      aria-label={ariaLabel}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        suppressClick.current = false;
        drag.current = { x: event.clientX, y: event.clientY, active: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current) return;
        if (
          !current.active &&
          Math.hypot(event.clientX - current.x, event.clientY - current.y) < 8
        )
          return;
        if (!current.active) onDragBegin?.();
        current.active = true;
        suppressClick.current = true;
        setGhost({ x: event.clientX, y: event.clientY });
      }}
      onPointerUp={(event) => {
        const current = drag.current;
        drag.current = null;
        setGhost(null);
        if (!current?.active) return;
        const svg = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<SVGSVGElement>("svg.ww-scene");
        const matrix = svg?.getScreenCTM();
        if (!svg || !matrix) return;
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const local = point.matrixTransform(matrix.inverse());
        onDrop(Math.floor(local.x), Math.floor(local.y));
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          drag.current = null;
          setGhost(null);
          suppressClick.current = true;
        } else suppressClick.current = false;
      }}
      onPointerCancel={() => {
        drag.current = null;
        setGhost(null);
        suppressClick.current = true;
      }}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onSelect();
      }}
    >
      <PieceIcon kind={kind} />
      {label ?? OBJECT_LABELS[kind]}
      {children}
      {ghost && (
        <span
          aria-hidden="true"
          className="ww-drag-ghost"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <PieceIcon kind={kind} />
        </span>
      )}
    </Button>
  );
}
