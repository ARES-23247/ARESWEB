import React, { useRef } from "react";
import { Waypoint, EventMarker, ConstraintZone, RotationTarget } from "../../types/planner";

interface UsePlannerDragProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasDim: number;
  waypoints: Waypoint[];
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
  markers: EventMarker[];
  setMarkers: React.Dispatch<React.SetStateAction<EventMarker[]>>;
  constraintZones: ConstraintZone[];
  setConstraintZones: React.Dispatch<React.SetStateAction<ConstraintZone[]>>;
  rotationTargets: RotationTarget[];
  setRotationTargets: React.Dispatch<React.SetStateAction<RotationTarget[]>>;
  lockedWaypoints: Record<number, boolean>;
  isAddingMarker: boolean;
  setIsAddingMarker: React.Dispatch<React.SetStateAction<boolean>>;
  pathRef: React.RefObject<{ x: number; y: number }[]>;
  setSelectedWaypointIdx: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedMarkerId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedRotationTargetId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedConstraintZoneId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePlannerDrag({
  canvasRef,
  canvasDim,
  waypoints,
  setWaypoints,
  markers,
  setMarkers,
  constraintZones,
  setConstraintZones,
  rotationTargets,
  setRotationTargets,
  lockedWaypoints,
  isAddingMarker,
  setIsAddingMarker,
  pathRef,
  setSelectedWaypointIdx,
  setSelectedMarkerId,
  setSelectedRotationTargetId,
  setSelectedConstraintZoneId,
  setIsPlaying,
}: UsePlannerDragProps) {
  const dragInfo = useRef<{
    type:
      | "anchor"
      | "prev"
      | "next"
      | "rotationTarget"
      | "constraintZoneMove"
      | "constraintZoneResize";
    index: number;
  } | null>(null);

  // Pointer position helper (translates client coordinates to 0-144 field inches)
  const getFieldPosFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Scale client pixels to 0-144 inches
    const x = (clientX / canvas.width) * 144;
    const y = 144 - (clientY / canvas.height) * 144;
    return { x: Math.max(0, Math.min(144, x)), y: Math.max(0, Math.min(144, y)) };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getFieldPosFromEvent(e);

    // If in "Adding Marker" mode, insert marker at closest path point
    if (isAddingMarker && pathRef.current.length > 0) {
      let minDist = Infinity;
      let minIdx = 0;
      pathRef.current.forEach((pt, idx) => {
        const d = Math.hypot(pt.x - pos.x, pt.y - pos.y);
        if (d < minDist) {
          minDist = d;
          minIdx = idx;
        }
      });

      if (minDist < 15) {
        // Threshold to match path
        const progress = minIdx / (pathRef.current.length - 1);
        const newMarker: EventMarker = {
          id: String(Date.now()),
          name: `Action @ ${Math.round(progress * 100)}%`,
          progress,
          actions: ["CustomAction"],
        };
        setMarkers([...markers, newMarker]);
        setSelectedMarkerId(newMarker.id);
        setSelectedWaypointIdx(null);
        setSelectedRotationTargetId(null);
        setSelectedConstraintZoneId(null);
      }
      setIsAddingMarker(false);
      return;
    }

    // Check hit on Waypoints/handles
    const hitRadius = 8; // in inches
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];

      // Check Anchor
      if (Math.hypot(wp.anchor.x - pos.x, wp.anchor.y - pos.y) < hitRadius) {
        setSelectedWaypointIdx(i);
        setSelectedMarkerId(null);
        setSelectedRotationTargetId(null);
        setSelectedConstraintZoneId(null);
        setIsPlaying(false);
        if (lockedWaypoints[i]) return;
        dragInfo.current = { type: "anchor", index: i };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      // Check Next Control handle
      if (
        wp.nextControl &&
        Math.hypot(wp.nextControl.x - pos.x, wp.nextControl.y - pos.y) < hitRadius
      ) {
        setSelectedWaypointIdx(i);
        setSelectedMarkerId(null);
        setSelectedRotationTargetId(null);
        setSelectedConstraintZoneId(null);
        setIsPlaying(false);
        if (lockedWaypoints[i]) return;
        dragInfo.current = { type: "next", index: i };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      // Check Prev Control handle
      if (
        wp.prevControl &&
        Math.hypot(wp.prevControl.x - pos.x, wp.prevControl.y - pos.y) < hitRadius
      ) {
        setSelectedWaypointIdx(i);
        setSelectedMarkerId(null);
        setSelectedRotationTargetId(null);
        setSelectedConstraintZoneId(null);
        setIsPlaying(false);
        if (lockedWaypoints[i]) return;
        dragInfo.current = { type: "prev", index: i };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Check hit on Event Markers
    if (pathRef.current.length > 0) {
      for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        const idx = Math.floor(m.progress * (pathRef.current.length - 1));
        const mPos = pathRef.current[idx];
        if (mPos && Math.hypot(mPos.x - pos.x, mPos.y - pos.y) < hitRadius) {
          setSelectedMarkerId(m.id);
          setSelectedWaypointIdx(null);
          setSelectedRotationTargetId(null);
          setSelectedConstraintZoneId(null);
          setIsPlaying(false);
          return;
        }
      }
    }

    // Check hit on Rotation Targets
    for (let i = 0; i < rotationTargets.length; i++) {
      const rot = rotationTargets[i];
      if (Math.hypot(rot.x - pos.x, rot.y - pos.y) < hitRadius) {
        dragInfo.current = { type: "rotationTarget", index: i };
        setSelectedRotationTargetId(rot.id);
        setSelectedWaypointIdx(null);
        setSelectedMarkerId(null);
        setSelectedConstraintZoneId(null);
        setIsPlaying(false);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Check hit on Constraint Zones
    for (let i = 0; i < constraintZones.length; i++) {
      const zone = constraintZones[i];
      const brX = zone.x + zone.width / 2;
      const brY = zone.y - zone.height / 2;
      if (Math.hypot(brX - pos.x, brY - pos.y) < hitRadius) {
        dragInfo.current = { type: "constraintZoneResize", index: i };
        setSelectedConstraintZoneId(zone.id);
        setSelectedWaypointIdx(null);
        setSelectedMarkerId(null);
        setSelectedRotationTargetId(null);
        setIsPlaying(false);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (Math.hypot(zone.x - pos.x, zone.y - pos.y) < hitRadius) {
        dragInfo.current = { type: "constraintZoneMove", index: i };
        setSelectedConstraintZoneId(zone.id);
        setSelectedWaypointIdx(null);
        setSelectedMarkerId(null);
        setSelectedRotationTargetId(null);
        setIsPlaying(false);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Clicked empty space
    setSelectedWaypointIdx(null);
    setSelectedMarkerId(null);
    setSelectedRotationTargetId(null);
    setSelectedConstraintZoneId(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragInfo.current) return;
    const pos = getFieldPosFromEvent(e);
    const { type, index } = dragInfo.current;

    if (type === "rotationTarget") {
      setRotationTargets((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], x: pos.x, y: pos.y };
        return next;
      });
    } else if (type === "constraintZoneMove") {
      setConstraintZones((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], x: pos.x, y: pos.y };
        return next;
      });
    } else if (type === "constraintZoneResize") {
      setConstraintZones((prev) => {
        const next = [...prev];
        const zone = next[index];
        const halfWidth = Math.max(4, Math.abs(pos.x - zone.x));
        const halfHeight = Math.max(4, Math.abs(pos.y - zone.y));
        next[index] = {
          ...zone,
          width: halfWidth * 2,
          height: halfHeight * 2,
        };
        return next;
      });
    } else {
      setWaypoints((prev) => {
        const nextWps = [...prev];
        const wp = { ...nextWps[index] };

        if (type === "anchor") {
          const dx = pos.x - wp.anchor.x;
          const dy = pos.y - wp.anchor.y;

          // Move anchor and shift control points together
          wp.anchor = pos;
          if (wp.prevControl) {
            wp.prevControl = { x: wp.prevControl.x + dx, y: wp.prevControl.y + dy };
          }
          if (wp.nextControl) {
            wp.nextControl = { x: wp.nextControl.x + dx, y: wp.nextControl.y + dy };
          }
        } else if (type === "next") {
          wp.nextControl = pos;

          // Mirror to prevControl for C1 continuity
          if (wp.prevControl) {
            const dx = pos.x - wp.anchor.x;
            const dy = pos.y - wp.anchor.y;
            wp.prevControl = { x: wp.anchor.x - dx, y: wp.anchor.y - dy };
          }
        } else if (type === "prev") {
          wp.prevControl = pos;

          // Mirror to nextControl for C1 continuity
          if (wp.nextControl) {
            const dx = pos.x - wp.anchor.x;
            const dy = pos.y - wp.anchor.y;
            wp.nextControl = { x: wp.anchor.x - dx, y: wp.anchor.y - dy };
          }
        }

        nextWps[index] = wp;
        return nextWps;
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragInfo.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragInfo.current = null;
    }
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getFieldPosFromEvent,
  };
}
