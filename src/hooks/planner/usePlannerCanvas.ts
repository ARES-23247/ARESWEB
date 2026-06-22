import React, { useEffect } from "react";
import { Waypoint, EventMarker, ConstraintZone, RotationTarget } from "../../types/planner";
import { getInterpolatedRobotHeading } from "../../lib/planner/headingInterpolation";

interface UsePlannerCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasDim: number;
  season: string;
  customBgImage: HTMLImageElement | null;
  selectedWaypointIdx: number | null;
  selectedMarkerId: string | null;
  selectedConstraintZoneId: string | null;
  selectedRotationTargetId: string | null;
  decodeDarkImage: HTMLImageElement | null;
  decodeLightImage: HTMLImageElement | null;
  waypointsRef: React.RefObject<Waypoint[]>;
  markersRef: React.RefObject<EventMarker[]>;
  constraintZonesRef: React.RefObject<ConstraintZone[]>;
  rotationTargetsRef: React.RefObject<RotationTarget[]>;
  pathRef: React.RefObject<{ x: number; y: number }[]>;
  robotRef: React.RefObject<{ progress: number; x: number; y: number; heading: number }>;
  isPlaying: boolean;
  isPlayingRef: React.RefObject<boolean>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  lockedWaypointsRef: React.RefObject<Record<number, boolean>>;
  trajectoryAnalyticsRef: React.RefObject<{ length: number; duration: number; velocities: number[] }>;
  maxVelocity: number;
  startHeading: number;
  endHeading: number;
}

export function usePlannerCanvas({
  canvasRef,
  canvasDim,
  season,
  customBgImage,
  selectedWaypointIdx,
  selectedMarkerId,
  selectedConstraintZoneId,
  selectedRotationTargetId,
  decodeDarkImage,
  decodeLightImage,
  waypointsRef,
  markersRef,
  constraintZonesRef,
  rotationTargetsRef,
  pathRef,
  robotRef,
  isPlaying,
  isPlayingRef,
  setIsPlaying,
  lockedWaypointsRef,
  trajectoryAnalyticsRef,
  maxVelocity,
  startHeading,
  endHeading,
}: UsePlannerCanvasProps) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;

    const drawField = () => {
      const w = canvas.width;
      const h = canvas.height;
      const scale = w / 144;

      ctx.clearRect(0, 0, w, h);

      // Draw custom background or season draw routines
      const isDark =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark");
      const decodeBg = isDark ? decodeDarkImage : decodeLightImage;

      if (season === "custom" && customBgImage) {
        ctx.drawImage(customBgImage, 0, 0, w, h);
      } else if (season === "decode" && decodeBg) {
        ctx.drawImage(decodeBg, 0, 0, w, h);
      } else {
        // Draw standard tiles (6x6 grid of 24" squares)
        ctx.fillStyle = "#161618";
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.lineWidth = 1.5;
        const tileSize = 24 * scale;
        for (let i = 0; i <= 6; i++) {
          ctx.beginPath();
          ctx.moveTo(i * tileSize, 0);
          ctx.lineTo(i * tileSize, h);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(0, i * tileSize);
          ctx.lineTo(w, i * tileSize);
          ctx.stroke();
        }

        // Season Specific Renderings
        if (season === "decode") {
          // Red Base Zone (Bottom-Left)
          ctx.strokeStyle = "rgba(192, 0, 0, 0.7)";
          ctx.lineWidth = 3;
          ctx.strokeRect(0, h - 24 * scale, 24 * scale, 24 * scale);
          ctx.fillStyle = "rgba(192, 0, 0, 0.08)";
          ctx.fillRect(0, h - 24 * scale, 24 * scale, 24 * scale);
          ctx.fillStyle = "rgba(192, 0, 0, 0.8)";
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("RED BASE", 12 * scale, h - 10 * scale);

          // Blue Base Zone (Top-Right)
          ctx.strokeStyle = "rgba(0, 136, 255, 0.7)";
          ctx.lineWidth = 3;
          ctx.strokeRect(w - 24 * scale, 0, 24 * scale, 24 * scale);
          ctx.fillStyle = "rgba(0, 136, 255, 0.08)";
          ctx.fillRect(w - 24 * scale, 0, 24 * scale, 24 * scale);
          ctx.fillStyle = "rgba(0, 136, 255, 0.8)";
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("BLUE BASE", w - 12 * scale, 15 * scale);

          // Red Ramp (Center-Left centered at x=36, y=72)
          const rRampX = 36 * scale - 12 * scale;
          const rRampY = h - 72 * scale - 12 * scale;
          const rRampSize = 24 * scale;
          const redGrad = ctx.createLinearGradient(rRampX, rRampY, rRampX + rRampSize, rRampY);
          redGrad.addColorStop(0, "rgba(192, 0, 0, 0.4)");
          redGrad.addColorStop(1, "rgba(255, 51, 68, 0.85)");
          ctx.fillStyle = redGrad;
          ctx.fillRect(rRampX, rRampY, rRampSize, rRampSize);
          ctx.strokeStyle = "rgba(255, 51, 68, 0.7)";
          ctx.lineWidth = 2;
          ctx.strokeRect(rRampX, rRampY, rRampSize, rRampSize);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = 1.5;
          for (let offset = 4 * scale; offset < rRampSize; offset += 6 * scale) {
            ctx.beginPath();
            ctx.moveTo(rRampX + offset - 2 * scale, rRampY + 6 * scale);
            ctx.lineTo(rRampX + offset, rRampY + 12 * scale);
            ctx.lineTo(rRampX + offset - 2 * scale, rRampY + 18 * scale);
            ctx.stroke();
          }
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("RED RAMP", rRampX + rRampSize / 2, rRampY + 14 * scale);

          // Blue Ramp (Center-Right centered at x=108, y=72)
          const bRampX = 108 * scale - 12 * scale;
          const bRampY = h - 72 * scale - 12 * scale;
          const bRampSize = 24 * scale;
          const blueGrad = ctx.createLinearGradient(bRampX + bRampSize, bRampY, bRampX, bRampY);
          blueGrad.addColorStop(0, "rgba(0, 88, 192, 0.4)");
          blueGrad.addColorStop(1, "rgba(0, 136, 255, 0.85)");
          ctx.fillStyle = blueGrad;
          ctx.fillRect(bRampX, bRampY, bRampSize, bRampSize);
          ctx.strokeStyle = "rgba(0, 136, 255, 0.7)";
          ctx.lineWidth = 2;
          ctx.strokeRect(bRampX, bRampY, bRampSize, bRampSize);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = 1.5;
          for (let offset = 4 * scale; offset < bRampSize; offset += 6 * scale) {
            ctx.beginPath();
            ctx.moveTo(bRampX + offset + 2 * scale, bRampY + 6 * scale);
            ctx.lineTo(bRampX + offset, bRampY + 12 * scale);
            ctx.lineTo(bRampX + offset + 2 * scale, bRampY + 18 * scale);
            ctx.stroke();
          }
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("BLUE RAMP", bRampX + bRampSize / 2, bRampY + 14 * scale);

          // Gates
          const tGateX = 72 * scale - 12 * scale;
          const tGateY = 0;
          const tGateW = 24 * scale;
          const tGateH = 12 * scale;
          ctx.fillStyle = "rgba(45, 45, 50, 0.75)";
          ctx.fillRect(tGateX, tGateY, tGateW, tGateH);
          ctx.strokeStyle = "rgba(255, 184, 28, 0.5)"; // ARES Gold
          ctx.lineWidth = 1.5;
          ctx.strokeRect(tGateX, tGateY, tGateW, tGateH);
          ctx.beginPath();
          ctx.moveTo(tGateX, tGateY);
          ctx.lineTo(tGateX + tGateW / 2, tGateY + tGateH);
          ctx.moveTo(tGateX + tGateW / 2, tGateY);
          ctx.lineTo(tGateX, tGateY + tGateH);
          ctx.moveTo(tGateX + tGateW / 2, tGateY);
          ctx.lineTo(tGateX + tGateW, tGateY + tGateH);
          ctx.moveTo(tGateX + tGateW, tGateY);
          ctx.lineTo(tGateX + tGateW / 2, tGateY + tGateH);
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("GATE 1", tGateX + tGateW / 2, tGateY + 8 * scale);

          const bGateX = 72 * scale - 12 * scale;
          const bGateY = h - 12 * scale;
          const bGateW = 24 * scale;
          const bGateH = 12 * scale;
          ctx.fillStyle = "rgba(45, 45, 50, 0.75)";
          ctx.fillRect(bGateX, bGateY, bGateW, bGateH);
          ctx.strokeStyle = "rgba(255, 184, 28, 0.5)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bGateX, bGateY, bGateW, bGateH);
          ctx.beginPath();
          ctx.moveTo(bGateX, bGateY);
          ctx.lineTo(bGateX + bGateW / 2, bGateY + bGateH);
          ctx.moveTo(bGateX + bGateW / 2, bGateY);
          ctx.lineTo(bGateX, bGateY + bGateH);
          ctx.moveTo(bGateX + bGateW / 2, bGateY);
          ctx.lineTo(bGateX + bGateW, bGateY + bGateH);
          ctx.moveTo(bGateX + bGateW, bGateY);
          ctx.lineTo(bGateX + bGateW / 2, bGateY + bGateH);
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("GATE 2", bGateX + bGateW / 2, bGateY + 8 * scale);
        } else if (season === "into_the_deep") {
          // Submersible
          ctx.strokeStyle = "#FFB81C"; // ARES Gold
          ctx.lineWidth = 3;
          ctx.strokeRect(w / 2 - tileSize / 2, h / 2 - tileSize / 2, tileSize, tileSize);
          ctx.fillStyle = "rgba(255, 184, 28, 0.05)";
          ctx.fillRect(w / 2 - tileSize / 2, h / 2 - tileSize / 2, tileSize, tileSize);

          ctx.strokeStyle = "rgba(255, 184, 28, 0.4)";
          ctx.beginPath();
          ctx.moveTo(w / 2 - tileSize / 2, h / 2);
          ctx.lineTo(w / 2 + tileSize / 2, h / 2);
          ctx.stroke();

          // Observation Zones
          ctx.strokeStyle = "rgba(0, 162, 232, 0.5)"; // Blue
          ctx.strokeRect(0, h - tileSize, tileSize, tileSize);
          ctx.fillStyle = "rgba(0, 162, 232, 0.04)";
          ctx.fillRect(0, h - tileSize, tileSize, tileSize);

          ctx.strokeStyle = "rgba(192, 0, 0, 0.5)"; // Red
          ctx.strokeRect(w - tileSize, 0, tileSize, tileSize);
          ctx.fillStyle = "rgba(192, 0, 0, 0.04)";
          ctx.fillRect(w - tileSize, 0, tileSize, tileSize);
        } else if (season === "centerstage") {
          // Backdrops
          ctx.strokeStyle = "rgba(0, 162, 232, 0.5)";
          ctx.strokeRect(2 * scale, h / 2 - 12 * scale, 10 * scale, 24 * scale);

          ctx.strokeStyle = "rgba(192, 0, 0, 0.5)";
          ctx.strokeRect(w - 12 * scale, h / 2 - 12 * scale, 10 * scale, 24 * scale);

          // Truss Bars
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(w / 2 - 24 * scale, h / 2);
          ctx.lineTo(w / 2 + 24 * scale, h / 2);
          ctx.stroke();
        } else if (season === "powerplay") {
          ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
          const offsets = [24, 48, 72, 96, 120];
          offsets.forEach((ox) => {
            offsets.forEach((oy) => {
              ctx.beginPath();
              ctx.arc(ox * scale, oy * scale, 3, 0, Math.PI * 2);
              ctx.fill();
            });
          });
        }
      }

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, w, h);
    };

    const drawPathAndHandles = () => {
      const w = canvas.width;
      const h = canvas.height;
      const scale = w / 144;
      const pts = pathRef.current;

      if (pts.length > 0) {
        const { velocities } = trajectoryAnalyticsRef.current;
        ctx.lineWidth = 3.5;
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const vel = velocities[i] ?? maxVelocity;
          const ratio = maxVelocity > 0 ? Math.min(1, vel / maxVelocity) : 0;

          const r = Math.round(192 + (255 - 192) * ratio);
          const g = Math.round(0 + (184 - 0) * ratio);
          const b = Math.round(0 + (28 - 0) * ratio);

          ctx.beginPath();
          ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.moveTo(p1.x * scale, h - p1.y * scale);
          ctx.lineTo(p2.x * scale, h - p2.y * scale);
          ctx.stroke();
        }
      }

      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1.2;
      waypointsRef.current.forEach((wp) => {
        const ax = wp.anchor.x * scale;
        const ay = h - wp.anchor.y * scale;

        if (wp.nextControl) {
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(wp.nextControl.x * scale, h - wp.nextControl.y * scale);
          ctx.stroke();
        }
        if (wp.prevControl) {
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(wp.prevControl.x * scale, h - wp.prevControl.y * scale);
          ctx.stroke();
        }
      });

      waypointsRef.current.forEach((wp, idx) => {
        const ax = wp.anchor.x * scale;
        const ay = h - wp.anchor.y * scale;

        ctx.beginPath();
        ctx.arc(ax, ay, 6, 0, Math.PI * 2);
        const isLocked = lockedWaypointsRef.current[idx];
        ctx.fillStyle = isLocked
          ? "rgba(100, 100, 100, 0.85)"
          : selectedWaypointIdx === idx
          ? "#C00000"
          : "rgba(192, 0, 0, 0.85)";
        ctx.fill();
        ctx.strokeStyle = isLocked ? "#aaaaaa" : "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(idx + 1), ax, ay);

        if (wp.nextControl) {
          const cx = wp.nextControl.x * scale;
          const cy = h - wp.nextControl.y * scale;
          ctx.beginPath();
          ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = "#00A2E8";
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }

        if (wp.prevControl) {
          const cx = wp.prevControl.x * scale;
          const cy = h - wp.prevControl.y * scale;
          ctx.beginPath();
          ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = "#00A2E8";
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }
      });

      markersRef.current.forEach((m) => {
        if (pts.length === 0) return;
        const ptIdx = Math.floor(m.progress * (pts.length - 1));
        const pos = pts[ptIdx];
        if (!pos) return;
        const mx = pos.x * scale;
        const my = h - pos.y * scale;

        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(Math.PI / 4);

        ctx.fillStyle = selectedMarkerId === m.id ? "#FFD700" : "#FFB81C";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.5;
        ctx.fillRect(-5.5, -5.5, 11, 11);
        ctx.strokeRect(-5.5, -5.5, 11, 11);

        ctx.restore();
      });

      constraintZonesRef.current.forEach((zone) => {
        const cx = zone.x * scale;
        const cy = h - zone.y * scale;
        const zw = zone.width * scale;
        const zh = zone.height * scale;
        const isSelected = selectedConstraintZoneId === zone.id;

        ctx.save();
        ctx.fillStyle = isSelected ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.12)";
        ctx.fillRect(cx - zw / 2, cy - zh / 2, zw, zh);

        ctx.strokeStyle = isSelected ? "rgba(245, 158, 11, 0.9)" : "rgba(245, 158, 11, 0.55)";
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(cx - zw / 2, cy - zh / 2, zw, zh);
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#f59e0b";
        ctx.fill();

        if (isSelected) {
          const brX = cx + zw / 2;
          const brY = cy + zh / 2;
          ctx.beginPath();
          ctx.arc(brX, brY, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${zone.name} (${zone.maxVelocity.toFixed(1)} m/s)`, cx, cy - zh / 2 - 4);
        ctx.restore();
      });

      rotationTargetsRef.current.forEach((rot) => {
        const tx = rot.x * scale;
        const ty = h - rot.y * scale;
        const isSelected = selectedRotationTargetId === rot.id;

        const wp = waypointsRef.current[rot.waypointIndex];
        if (wp) {
          const ax = wp.anchor.x * scale;
          const ay = h - wp.anchor.y * scale;

          ctx.save();
          ctx.strokeStyle = "rgba(168, 85, 247, 0.55)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(tx, ty);

        ctx.strokeStyle = isSelected ? "#a855f7" : "rgba(168, 85, 247, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(14, 0);
        ctx.moveTo(0, -14);
        ctx.lineTo(0, 14);
        ctx.stroke();

        ctx.restore();

        ctx.fillStyle = "#c084fc";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`Target: ${rot.name}`, tx + 16, ty + 3);
      });
    };

    const drawRobot = () => {
      const w = canvas.width;
      const h = canvas.height;
      const scale = w / 144;
      const pts = pathRef.current;

      if (isPlayingRef.current && pts.length > 0) {
        const r = robotRef.current;
        r.progress += 0.003;
        if (r.progress >= 1.0) {
          r.progress = 0;
          setIsPlaying(false);
        } else {
          const idx = Math.floor(r.progress * (pts.length - 1));
          const p1 = pts[idx];

          r.x = p1.x;
          r.y = p1.y;
          r.heading = getInterpolatedRobotHeading(
            r.progress,
            waypointsRef.current,
            rotationTargetsRef.current,
            startHeading,
            endHeading
          );
        }
      } else if (!isPlayingRef.current && pts.length > 0) {
        robotRef.current.progress = 0;
        robotRef.current.x = pts[0].x;
        robotRef.current.y = pts[0].y;
        robotRef.current.heading = getInterpolatedRobotHeading(
          0,
          waypointsRef.current,
          rotationTargetsRef.current,
          startHeading,
          endHeading
        );
      }

      if (pts.length === 0) return;

      const rx = robotRef.current.x * scale;
      const ry = h - robotRef.current.y * scale;
      const rh = robotRef.current.heading;
      const rbSize = 18 * scale;

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(-rh);

      ctx.fillStyle = "rgba(10, 10, 10, 0.75)";
      ctx.strokeStyle = "#FFB81C";
      ctx.lineWidth = 2.5;
      ctx.fillRect(-rbSize / 2, -rbSize / 2, rbSize, rbSize);
      ctx.strokeRect(-rbSize / 2, -rbSize / 2, rbSize, rbSize);

      ctx.strokeStyle = "#C00000";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(rbSize / 2 + 5, 0);
      ctx.stroke();

      ctx.restore();
    };

    const loop = () => {
      drawField();
      drawPathAndHandles();
      drawRobot();
      animFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [
    canvasDim,
    season,
    customBgImage,
    selectedWaypointIdx,
    selectedMarkerId,
    selectedConstraintZoneId,
    selectedRotationTargetId,
    decodeDarkImage,
    decodeLightImage,
    startHeading,
    endHeading,
    maxVelocity,
    // Add isPlaying so that the loop transitions correctly when sim starts/stops
    isPlaying,
  ]);
}
