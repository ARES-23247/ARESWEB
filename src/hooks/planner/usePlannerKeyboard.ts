import React from "react";
import { Waypoint } from "../../types/planner";

interface UsePlannerKeyboardProps {
  selectedWaypointIdx: number | null;
  setSelectedWaypointIdx: React.Dispatch<React.SetStateAction<number | null>>;
  waypoints: Waypoint[];
  lockedWaypoints: Record<number, boolean>;
  handleUpdateWaypointAnchor: (idx: number, field: "x" | "y", valStr: string) => void;
}

export function usePlannerKeyboard({
  selectedWaypointIdx,
  setSelectedWaypointIdx,
  waypoints,
  lockedWaypoints,
  handleUpdateWaypointAnchor,
}: UsePlannerKeyboardProps) {
  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (selectedWaypointIdx === null) {
      if (e.key === "Enter" || e.key === " ") {
        if (waypoints.length > 0) {
          setSelectedWaypointIdx(0);
          e.preventDefault();
        }
      }
      return;
    }

    const stepInches = e.shiftKey ? 5.0 : 1.0;
    const wp = waypoints[selectedWaypointIdx];
    if (!wp) return;
    if (lockedWaypoints[selectedWaypointIdx]) return;

    if (e.key === "ArrowUp") {
      handleUpdateWaypointAnchor(selectedWaypointIdx, "y", (wp.anchor.y - stepInches).toString());
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      handleUpdateWaypointAnchor(selectedWaypointIdx, "y", (wp.anchor.y + stepInches).toString());
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      handleUpdateWaypointAnchor(selectedWaypointIdx, "x", (wp.anchor.x - stepInches).toString());
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      handleUpdateWaypointAnchor(selectedWaypointIdx, "x", (wp.anchor.x + stepInches).toString());
      e.preventDefault();
    } else if (e.key === "Escape") {
      setSelectedWaypointIdx(null);
      e.preventDefault();
    } else if (e.key === "Tab") {
      const nextIdx = (selectedWaypointIdx + 1) % waypoints.length;
      setSelectedWaypointIdx(nextIdx);
      e.preventDefault();
    }
  };

  return { handleCanvasKeyDown };
}
