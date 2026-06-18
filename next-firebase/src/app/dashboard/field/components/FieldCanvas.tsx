"use client";

import React, { useRef, useEffect, useState } from "react";
import { Compass, Info } from "lucide-react";

export interface FieldObstacle {
  id: string;
  name: string;
  x: number;      // EKF X in meters (centroid for polygons)
  y: number;      // EKF Y in meters (centroid for polygons)
  width: number;  // Width in meters
  height: number; // Height in meters
  isBlocking: boolean;
  obstacleType: "blocking" | "ramp";
  rampDirection?: "up" | "down" | "left" | "right";
  shape?: "rectangle" | "polygon";
  points?: { x: number; y: number }[];
}

export interface ElementType {
  id: string;
  name: string;
  shape: "box" | "cylinder" | "sphere";
  width: number;       // For box (width along Y axis)
  height: number;      // For box (height along X axis)
  depth: number;       // Z axis height/thickness
  diameter?: number;   // For cylinder / sphere
  color: string;       // Hex color
  massKg: number;      // weight in kg
  movable: boolean;    // true = dynamic physics, false = static
}

export interface FieldElementInstance {
  id: string;
  elementTypeId: string; // references ElementType.id
  x: number;             // EKF X
  y: number;             // EKF Y
  rotation: number;      // rotation in degrees
}

export interface FieldAprilTag {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number; // in degrees
}

interface FieldCanvasProps {
  fieldType: "ftc" | "frc";
  bgImage: HTMLImageElement | null;
  showGrid: boolean;
  showAllianceZones: boolean;
  showCoordinateAxes: boolean;
  xAxisDirection: "up" | "down" | "left" | "right";
  yAxisDirection: "up" | "down" | "left" | "right";
  redDriverStation: "north" | "south" | "east" | "west";
  blueDriverStation: "north" | "south" | "east" | "west";

  obstacles: FieldObstacle[];
  setObstacles: React.Dispatch<React.SetStateAction<FieldObstacle[]>>;
  selectedObstacleId: string | null;
  setSelectedObstacleId: (id: string | null) => void;

  elements: FieldElementInstance[];
  setElements: React.Dispatch<React.SetStateAction<FieldElementInstance[]>>;
  elementTypes: ElementType[];
  selectedElementInstanceId: string | null;
  setSelectedElementInstanceId: (id: string | null) => void;

  apriltags: FieldAprilTag[];
  setApriltags: React.Dispatch<React.SetStateAction<FieldAprilTag[]>>;
  selectedTagId: number | null;
  setSelectedTagId: (id: number | null) => void;

  isDrawingPolygon: boolean;
  setIsDrawingPolygon: (val: boolean) => void;
  drawingPoints: { x: number; y: number }[];
  setDrawingPoints: React.Dispatch<React.SetStateAction<{ x: number; y: number }[]>>;
  hoverPoint: { x: number; y: number } | null;
  setHoverPoint: (pt: { x: number; y: number } | null) => void;
}

export default function FieldCanvas({
  fieldType,
  bgImage,
  showGrid,
  showAllianceZones,
  showCoordinateAxes,
  xAxisDirection,
  yAxisDirection,
  redDriverStation,
  blueDriverStation,
  obstacles,
  setObstacles,
  selectedObstacleId,
  setSelectedObstacleId,
  elements,
  setElements,
  elementTypes,
  selectedElementInstanceId,
  setSelectedElementInstanceId,
  apriltags,
  setApriltags,
  selectedTagId,
  setSelectedTagId,
  isDrawingPolygon,
  setIsDrawingPolygon,
  drawingPoints,
  setDrawingPoints,
  hoverPoint,
  setHoverPoint
}: FieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<number>(450);

  // Dragging interaction state
  const dragModeRef = useRef<"none" | "dragging" | "dragging_vertex" | "resizing" | "dragging_tag">("none");
  const dragStartRef = useRef<{
    mx: number;
    my: number;
    ox: number;
    oy: number;
    ow?: number;
    oh?: number;
    fixedX?: number;
    fixedY?: number;
    originalPoints?: { x: number; y: number }[];
    vertexIndex?: number;
    tagId?: number;
  }>({ mx: 0, my: 0, ox: 0, oy: 0 });

  // Field size constants in meters
  const fieldW = fieldType === "ftc" ? 3.6576 : 8.211; // 12ft FTC vs 27ft FRC
  const fieldH = fieldType === "ftc" ? 3.6576 : 16.541; // 12ft FTC vs 54.27ft FRC

  // Dynamic canvas size calculations
  const canvasW = fieldType === "ftc" ? canvasSize : canvasSize * (8.211 / 16.541);
  const canvasH = fieldType === "ftc" ? canvasSize : canvasSize;
  const scale = canvasH / fieldH;
  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  // Set canvas size dynamically to fit container
  useEffect(() => {
    const handleResize = () => {
      const parent = canvasRef.current?.parentElement?.parentElement;
      if (parent) {
        // Fit width of parent
        const w = parent.clientWidth - 48; // padding
        setCanvasSize(Math.max(300, Math.min(800, w)));
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Coordinate conversion helper functions
  const ekfToScreen = (x_ekf: number, y_ekf: number) => {
    if (fieldType === "frc") {
      const px = canvasW - y_ekf * scale;
      const py = canvasH - x_ekf * scale;
      return { x: px, y: py };
    }

    let px = centerX;
    let py = centerY;

    if (xAxisDirection === "right") px += x_ekf * scale;
    else if (xAxisDirection === "left") px -= x_ekf * scale;
    else if (xAxisDirection === "down") py += x_ekf * scale;
    else if (xAxisDirection === "up") py -= x_ekf * scale;

    if (yAxisDirection === "right") px += y_ekf * scale;
    else if (yAxisDirection === "left") px -= y_ekf * scale;
    else if (yAxisDirection === "down") py += y_ekf * scale;
    else if (yAxisDirection === "up") py -= y_ekf * scale;

    return { x: px, y: py };
  };

  const toEkfX = (pxX: number, pxY: number) => {
    if (fieldType === "frc") {
      return (canvasH - pxY) / scale;
    }
    if (xAxisDirection === "right") {
      return (pxX - centerX) / scale;
    } else if (xAxisDirection === "left") {
      return (centerX - pxX) / scale;
    } else if (xAxisDirection === "down") {
      return (pxY - centerY) / scale;
    } else {
      return (centerY - pxY) / scale;
    }
  };

  const toEkfY = (pxX: number, pxY: number) => {
    if (fieldType === "frc") {
      return (canvasW - pxX) / scale;
    }
    if (yAxisDirection === "right") {
      return (pxX - centerX) / scale;
    } else if (yAxisDirection === "left") {
      return (centerX - pxX) / scale;
    } else if (yAxisDirection === "down") {
      return (pxY - centerY) / scale;
    } else {
      return (centerY - pxY) / scale;
    }
  };

  const isPointInPolygon = (x: number, y: number, polygon: { x: number; y: number }[]) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x,
        yi = polygon[i].y;
      const xj = polygon[j].x,
        yj = polygon[j].y;
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.scale(dpr, dpr);

    // 1. Draw Field Background
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, canvasW, canvasH);
    } else {
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // 2. Draw Grid Lines
    if (showGrid) {
      ctx.strokeStyle = bgImage ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;

      if (fieldType === "ftc") {
        for (let i = -3; i <= 3; i++) {
          const offset = i * 0.6096;
          const pV1 = ekfToScreen(-1.8288, offset);
          const pV2 = ekfToScreen(1.8288, offset);
          ctx.beginPath();
          ctx.moveTo(pV1.x, pV1.y);
          ctx.lineTo(pV2.x, pV2.y);
          ctx.stroke();

          const pH1 = ekfToScreen(offset, -1.8288);
          const pH2 = ekfToScreen(offset, 1.8288);
          ctx.beginPath();
          ctx.moveTo(pH1.x, pH1.y);
          ctx.lineTo(pH2.x, pH2.y);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = bgImage ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.02)";
        for (let x = 0; x <= 16.541; x += 1.0) {
          const p1 = ekfToScreen(x, 0);
          const p2 = ekfToScreen(x, 8.211);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        for (let y = 0; y <= 8.211; y += 1.0) {
          const p1 = ekfToScreen(0, y);
          const p2 = ekfToScreen(16.541, y);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }

        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 1.5;
        const pC1 = ekfToScreen(8.2705, 0);
        const pC2 = ekfToScreen(8.2705, 8.211);
        ctx.beginPath();
        ctx.moveTo(pC1.x, pC1.y);
        ctx.lineTo(pC2.x, pC2.y);
        ctx.stroke();
      }
    }

    // 3. Draw Outer Perimeter Wall
    ctx.strokeStyle = bgImage ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    const minX = fieldType === "frc" ? 0 : -fieldH / 2;
    const maxX = fieldType === "frc" ? fieldH : fieldH / 2;
    const minY = fieldType === "frc" ? 0 : -fieldW / 2;
    const maxY = fieldType === "frc" ? fieldW : fieldW / 2;
    const c1 = ekfToScreen(minX, minY);
    const c2 = ekfToScreen(maxX, maxY);
    const minWallX = Math.min(c1.x, c2.x);
    const maxWallX = Math.max(c1.x, c2.x);
    const minWallY = Math.min(c1.y, c2.y);
    const maxWallY = Math.max(c1.y, c2.y);
    ctx.strokeRect(minWallX, minWallY, maxWallX - minWallX, maxWallY - minWallY);

    // 4. Draw Center Origin Crosshair & EKF Axes Indicators
    if (showCoordinateAxes) {
      if (fieldType === "frc") {
        const originX = canvasW - 24;
        const originY = canvasH - 24;

        ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(originX - 8, originY);
        ctx.lineTo(originX + 8, originY);
        ctx.moveTo(originX, originY - 8);
        ctx.lineTo(originX, originY + 8);
        ctx.stroke();

        ctx.strokeStyle = "#C00000"; // ares-red
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX, originY - 40);
        ctx.stroke();

        ctx.fillStyle = "#C00000";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText("+X", originX, originY - 46);

        ctx.strokeStyle = "#00E5FF"; // ares-cyan
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX - 40, originY);
        ctx.stroke();

        ctx.fillStyle = "#00E5FF";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "right";
        ctx.fillText("+Y", originX - 46, originY + 3);
      } else {
        ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - 8, centerY);
        ctx.lineTo(centerX + 8, centerY);
        ctx.moveTo(centerX, centerY - 8);
        ctx.lineTo(centerX, centerY + 8);
        ctx.stroke();

        const pXEnd = ekfToScreen(0.4, 0);
        ctx.strokeStyle = "#C00000"; // ares-red
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(pXEnd.x, pXEnd.y);
        ctx.stroke();

        ctx.fillStyle = "#C00000";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        const xTextOffset = 8;
        let tx = pXEnd.x;
        let ty = pXEnd.y;
        if (pXEnd.x > centerX) tx += xTextOffset;
        else if (pXEnd.x < centerX) tx -= xTextOffset;
        if (pXEnd.y > centerY) ty += xTextOffset;
        else if (pXEnd.y < centerY) ty -= xTextOffset;
        ctx.fillText("+X", tx, ty + 3);

        const pYEnd = ekfToScreen(0, 0.4);
        ctx.strokeStyle = "#00E5FF"; // ares-cyan
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(pYEnd.x, pYEnd.y);
        ctx.stroke();

        ctx.fillStyle = "#00E5FF";
        ctx.fillText(
          "+Y",
          pYEnd.x + (pYEnd.x > centerX ? 8 : pYEnd.x < centerX ? -8 : 0),
          pYEnd.y + (pYEnd.y > centerY ? 8 : pYEnd.y < centerY ? -8 : 0) + 3
        );
      }
    }

    // 5. Draw Driver's Stations
    const drawDriverStation = (side: "north" | "south" | "east" | "west", color: string, text: string) => {
      ctx.fillStyle = color;
      ctx.save();
      if (side === "north") {
        ctx.fillRect(0, 0, canvasW, 12);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(text, canvasW / 2, 9);
      } else if (side === "south") {
        ctx.fillRect(0, canvasH - 12, canvasW, 12);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(text, canvasW / 2, canvasH - 3);
      } else if (side === "west") {
        ctx.fillRect(0, 0, 12, canvasH);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.translate(9, canvasH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(text, 0, 0);
      } else if (side === "east") {
        ctx.fillRect(canvasW - 12, 0, 12, canvasH);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.translate(canvasW - 9, canvasH / 2);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(text, 0, 0);
      }
      ctx.restore();
    };

    const redDS = fieldType === "frc" ? "north" : redDriverStation;
    const blueDS = fieldType === "frc" ? "south" : blueDriverStation;
    drawDriverStation(redDS, "rgba(192, 0, 0, 0.7)", "RED DRIVER STATION");
    drawDriverStation(blueDS, "rgba(59, 130, 246, 0.7)", "BLUE DRIVER STATION");

    // 6. Draw red and blue zones/substations
    if (fieldType === "ftc" && !bgImage && showAllianceZones) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.05)";
      ctx.beginPath();
      const pRedCenter = ekfToScreen(1.8288, 1.8288);
      ctx.arc(pRedCenter.x, pRedCenter.y, 0.508 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(59, 130, 246, 0.05)";
      ctx.beginPath();
      const pBlueCenter = ekfToScreen(-1.8288, -1.8288);
      ctx.arc(pBlueCenter.x, pBlueCenter.y, 0.508 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Draw Obstacles
    obstacles.forEach((obs) => {
      const isSelected = obs.id === selectedObstacleId;
      const isPolygon = obs.shape === "polygon";

      ctx.save();
      if (!obs.isBlocking || obs.obstacleType === "ramp") {
        ctx.setLineDash([4, 4]);
      }

      ctx.strokeStyle = isSelected
        ? "#F59E0B"
        : obs.obstacleType === "ramp"
        ? "rgba(245, 158, 11, 0.35)"
        : "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = isSelected ? 2 : 1;

      let cx = obs.x;
      let cy = obs.y;
      let widthText = obs.width.toFixed(2);
      let heightText = obs.height.toFixed(2);

      if (isPolygon && obs.points && obs.points.length > 0) {
        ctx.beginPath();
        obs.points.forEach((pt, idx) => {
          const p = ekfToScreen(pt.x, pt.y);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();

        ctx.fillStyle = isSelected ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.07)";
        ctx.fill();
        ctx.stroke();

        cx = obs.points.reduce((acc, pt) => acc + pt.x, 0) / obs.points.length;
        cy = obs.points.reduce((acc, pt) => acc + pt.y, 0) / obs.points.length;
      } else {
        const obsHalfW = obs.width / 2;
        const obsHalfH = obs.height / 2;
        const p1 = ekfToScreen(obs.x - obsHalfH, obs.y - obsHalfW);
        const p2 = ekfToScreen(obs.x + obsHalfH, obs.y + obsHalfW);
        const leftPx = Math.min(p1.x, p2.x);
        const topPx = Math.min(p1.y, p2.y);
        const wPx = Math.abs(p1.x - p2.x);
        const hPx = Math.abs(p1.y - p2.y);

        if (obs.obstacleType === "ramp" && obs.rampDirection) {
          let grad;
          if (obs.rampDirection === "up") {
            grad = ctx.createLinearGradient(leftPx, topPx + hPx, leftPx, topPx);
          } else if (obs.rampDirection === "down") {
            grad = ctx.createLinearGradient(leftPx, topPx, leftPx, topPx + hPx);
          } else if (obs.rampDirection === "left") {
            grad = ctx.createLinearGradient(leftPx + wPx, topPx, leftPx, topPx);
          } else {
            grad = ctx.createLinearGradient(leftPx, topPx, leftPx + wPx, topPx);
          }
          grad.addColorStop(0, isSelected ? "rgba(245, 158, 11, 0.05)" : "rgba(255, 255, 255, 0.02)");
          grad.addColorStop(1, isSelected ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.15)");
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = isSelected ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.07)";
        }
        ctx.fillRect(leftPx, topPx, wPx, hPx);
        ctx.strokeRect(leftPx, topPx, wPx, hPx);

        if (obs.obstacleType === "ramp" && obs.rampDirection) {
          ctx.save();
          ctx.strokeStyle = isSelected ? "#F59E0B" : "rgba(245, 158, 11, 0.5)";
          ctx.lineWidth = 1.5;
          const ccx = leftPx + wPx / 2;
          const ccy = topPx + hPx / 2;
          ctx.beginPath();
          if (obs.rampDirection === "up") {
            ctx.moveTo(ccx, ccy + 8);
            ctx.lineTo(ccx, ccy - 8);
            ctx.lineTo(ccx - 3, ccy - 5);
            ctx.moveTo(ccx, ccy - 8);
            ctx.lineTo(ccx + 3, ccy - 5);
          } else if (obs.rampDirection === "down") {
            ctx.moveTo(ccx, ccy - 8);
            ctx.lineTo(ccx, ccy + 8);
            ctx.lineTo(ccx - 3, ccy + 5);
            ctx.moveTo(ccx, ccy + 8);
            ctx.lineTo(ccx + 3, ccy + 5);
          } else if (obs.rampDirection === "left") {
            ctx.moveTo(ccx + 8, ccy);
            ctx.lineTo(ccx - 8, ccy);
            ctx.lineTo(ccx - 5, ccy - 3);
            ctx.moveTo(ccx - 8, ccy);
            ctx.lineTo(ccx - 5, ccy + 3);
          } else {
            ctx.moveTo(ccx - 8, ccy);
            ctx.lineTo(ccx + 8, ccy);
            ctx.lineTo(ccx + 5, ccy - 3);
            ctx.moveTo(ccx + 8, ccy);
            ctx.lineTo(ccx + 5, ccy + 3);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();

      const pCenter = ekfToScreen(cx, cy);

      ctx.fillStyle = isSelected ? "#F59E0B" : "rgba(255, 255, 255, 0.6)";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(obs.name, pCenter.x, pCenter.y - 3);

      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "8px monospace";
      if (isPolygon) {
        ctx.fillText(`Polygon (${obs.points?.length || 0} vertices)`, pCenter.x, pCenter.y + 7);
      } else {
        ctx.fillText(`${widthText}m x ${heightText}m`, pCenter.x, pCenter.y + 7);
      }

      if (obs.obstacleType === "ramp") {
        ctx.fillStyle = "rgba(245, 158, 11, 0.5)";
        ctx.fillText("RAMP", pCenter.x, pCenter.y + 16);
      }

      if (isSelected) {
        if (isPolygon && obs.points) {
          obs.points.forEach((pt) => {
            const pv = ekfToScreen(pt.x, pt.y);
            ctx.fillStyle = "#F59E0B";
            ctx.beginPath();
            ctx.arc(pv.x, pv.y, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1;
            ctx.stroke();
          });
        } else {
          const obsHalfW = obs.width / 2;
          const obsHalfH = obs.height / 2;
          const p1 = ekfToScreen(obs.x - obsHalfH, obs.y - obsHalfW);
          const p2 = ekfToScreen(obs.x + obsHalfH, obs.y + obsHalfW);
          const leftPx = Math.min(p1.x, p2.x);
          const topPx = Math.min(p1.y, p2.y);
          const wPx = Math.abs(p1.x - p2.x);
          const hPx = Math.abs(p1.y - p2.y);

          ctx.fillStyle = "#F59E0B";
          ctx.beginPath();
          ctx.arc(leftPx + wPx, topPx + hPx, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    });

    // 8. Draw Field Elements
    elements.forEach((el) => {
      const type = elementTypes.find((t) => t.id === el.elementTypeId);
      if (!type) return;

      const isSelected = el.id === selectedElementInstanceId;
      const sizeMeters = type.shape === "box" ? Math.max(type.width, type.height) : type.diameter || 0.15;

      const pEl = ekfToScreen(el.x, el.y);
      const pxX = pEl.x;
      const pxY = pEl.y;

      ctx.save();
      ctx.translate(pxX, pxY);
      ctx.rotate((-el.rotation * Math.PI) / 180);

      ctx.fillStyle = type.color;
      ctx.strokeStyle = isSelected ? "#00E5FF" : "rgba(255,255,255,0.4)";
      ctx.lineWidth = isSelected ? 2.5 : 1;

      const sizePx = sizeMeters * scale;
      if (type.shape === "box") {
        ctx.fillRect(-sizePx / 2, -sizePx / 2, sizePx, sizePx);
        ctx.strokeRect(-sizePx / 2, -sizePx / 2, sizePx, sizePx);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, sizePx / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(sizePx / 2, 0);
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();

      ctx.fillStyle = isSelected ? "#00E5FF" : "rgba(255, 255, 255, 0.7)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(type.name, pxX, pxY + (sizeMeters * scale) / 2 + 10);
    });

    // 9. Draw AprilTags
    apriltags.forEach((tag) => {
      const isSelected = tag.id === selectedTagId;
      const p = ekfToScreen(tag.x, tag.y);
      const tagSizePx = 0.16 * scale;

      ctx.save();
      const yawRad = (tag.yaw * Math.PI) / 180;
      const arrowX = tag.x + Math.cos(yawRad) * 0.18;
      const arrowY = tag.y + Math.sin(yawRad) * 0.18;
      const pArrow = ekfToScreen(arrowX, arrowY);

      ctx.strokeStyle = isSelected ? "#F59E0B" : "#10B981";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(pArrow.x, pArrow.y);
      ctx.stroke();

      const headlen = 5;
      const angle = Math.atan2(pArrow.y - p.y, pArrow.x - p.x);
      ctx.fillStyle = isSelected ? "#F59E0B" : "#10B981";
      ctx.beginPath();
      ctx.moveTo(pArrow.x, pArrow.y);
      ctx.lineTo(
        pArrow.x - headlen * Math.cos(angle - Math.PI / 6),
        pArrow.y - headlen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        pArrow.x - headlen * Math.cos(angle + Math.PI / 6),
        pArrow.y - headlen * Math.sin(angle + Math.PI / 6)
      );
      ctx.fill();

      ctx.translate(p.x, p.y);
      ctx.rotate(yawRad);

      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(-tagSizePx / 2, -tagSizePx / 2, tagSizePx, tagSizePx);

      ctx.strokeStyle = isSelected ? "#F59E0B" : "#10B981";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(-tagSizePx / 2, -tagSizePx / 2, tagSizePx, tagSizePx);

      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(-tagSizePx / 3, -tagSizePx / 3, (tagSizePx * 2) / 3, (tagSizePx * 2) / 3);

      ctx.restore();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tag.id.toString(), p.x, p.y);
    });

    // 10. Draw polygon in-progress
    if (isDrawingPolygon && drawingPoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      drawingPoints.forEach((pt, idx) => {
        const p = ekfToScreen(pt.x, pt.y);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      if (hoverPoint) {
        ctx.beginPath();
        const lastPt = drawingPoints[drawingPoints.length - 1];
        const lastP = ekfToScreen(lastPt.x, lastPt.y);
        const hoverP = ekfToScreen(hoverPoint.x, hoverPoint.y);
        ctx.moveTo(lastP.x, lastP.y);
        ctx.lineTo(hoverP.x, hoverP.y);
        ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
        ctx.stroke();
      }

      drawingPoints.forEach((pt) => {
        const p = ekfToScreen(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#F59E0B";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      });
      ctx.restore();
    }
  }, [
    obstacles,
    selectedObstacleId,
    canvasSize,
    bgImage,
    elements,
    elementTypes,
    selectedElementInstanceId,
    fieldType,
    xAxisDirection,
    yAxisDirection,
    redDriverStation,
    blueDriverStation,
    showGrid,
    showAllianceZones,
    showCoordinateAxes,
    canvasW,
    canvasH,
    fieldW,
    fieldH,
    scale,
    apriltags,
    selectedTagId,
    isDrawingPolygon,
    drawingPoints,
    hoverPoint
  ]);

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mx = toEkfX(mouseX, mouseY);
    const my = toEkfY(mouseX, mouseY);

    if (isDrawingPolygon) {
      if (drawingPoints.length >= 3) {
        const firstPt = drawingPoints[0];
        const firstPx = ekfToScreen(firstPt.x, firstPt.y);
        const dist = Math.hypot(mouseX - firstPx.x, mouseY - firstPx.y);
        if (dist <= 10) {
          const cx = drawingPoints.reduce((sum, p) => sum + p.x, 0) / drawingPoints.length;
          const cy = drawingPoints.reduce((sum, p) => sum + p.y, 0) / drawingPoints.length;
          const newObs: FieldObstacle = {
            id: Math.random().toString(36).substring(2, 9),
            name: `Polygon Obstacle ${obstacles.length + 1}`,
            x: Number(cx.toFixed(3)),
            y: Number(cy.toFixed(3)),
            width: 0.5,
            height: 0.5,
            isBlocking: true,
            obstacleType: "blocking",
            shape: "polygon",
            points: [...drawingPoints]
          };
          setObstacles([...obstacles, newObs]);
          setSelectedObstacleId(newObs.id);
          setIsDrawingPolygon(false);
          setDrawingPoints([]);
          setHoverPoint(null);
          return;
        }
      }
      setDrawingPoints([...drawingPoints, { x: Number(mx.toFixed(3)), y: Number(my.toFixed(3)) }]);
      return;
    }

    if (selectedObstacleId) {
      const obs = obstacles.find((o) => o.id === selectedObstacleId);
      if (obs && obs.shape === "polygon" && obs.points) {
        for (let idx = 0; idx < obs.points.length; idx++) {
          const pt = obs.points[idx];
          const pv = ekfToScreen(pt.x, pt.y);
          const dist = Math.hypot(mouseX - pv.x, mouseY - pv.y);
          if (dist <= 10) {
            dragModeRef.current = "dragging_vertex";
            dragStartRef.current = {
              mx,
              my,
              ox: pt.x,
              oy: pt.y,
              vertexIndex: idx
            };
            return;
          }
        }
      }
    }

    for (let i = 0; i < apriltags.length; i++) {
      const tag = apriltags[i];
      const pv = ekfToScreen(tag.x, tag.y);
      const dist = Math.hypot(mouseX - pv.x, mouseY - pv.y);
      if (dist <= 12) {
        setSelectedTagId(tag.id);
        setSelectedObstacleId(null);
        setSelectedElementInstanceId(null);
        dragModeRef.current = "dragging_tag";
        dragStartRef.current = {
          mx,
          my,
          ox: tag.x,
          oy: tag.y,
          tagId: tag.id
        };
        return;
      }
    }

    if (selectedObstacleId) {
      const obs = obstacles.find((o) => o.id === selectedObstacleId);
      if (obs && obs.shape !== "polygon") {
        const obsHalfW = obs.width / 2;
        const obsHalfH = obs.height / 2;
        const p1 = ekfToScreen(obs.x - obsHalfH, obs.y - obsHalfW);
        const p2 = ekfToScreen(obs.x + obsHalfH, obs.y + obsHalfW);
        const leftPx = Math.min(p1.x, p2.x);
        const topPx = Math.min(p1.y, p2.y);
        const wPx = Math.abs(p1.x - p2.x);
        const hPx = Math.abs(p1.y - p2.y);

        const handleX = leftPx + wPx;
        const handleY = topPx + hPx;
        const dist = Math.hypot(mouseX - handleX, mouseY - handleY);

        if (dist <= 10) {
          dragModeRef.current = "resizing";
          dragStartRef.current = {
            mx,
            my,
            ox: obs.x,
            oy: obs.y,
            ow: obs.width,
            oh: obs.height,
            fixedX: toEkfX(leftPx, topPx),
            fixedY: toEkfY(leftPx, topPx)
          };
          return;
        }
      }
    }

    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      const type = elementTypes.find((t) => t.id === el.elementTypeId);
      if (!type) continue;

      const radius = type.shape === "box" ? Math.max(type.width, type.height) / 2 : (type.diameter || 0.15) / 2;
      const dist = Math.hypot(mx - el.x, my - el.y);

      if (dist <= radius + 0.08) {
        setSelectedElementInstanceId(el.id);
        setSelectedObstacleId(null);
        setSelectedTagId(null);
        dragModeRef.current = "dragging";
        dragStartRef.current = {
          mx,
          my,
          ox: el.x,
          oy: el.y
        };
        return;
      }
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      const isPolygon = obs.shape === "polygon";

      let clickedInside = false;
      if (isPolygon && obs.points && obs.points.length > 0) {
        clickedInside = isPointInPolygon(mx, my, obs.points);
      } else {
        const halfW = obs.width / 2;
        const halfH = obs.height / 2;
        clickedInside =
          mx >= obs.x - halfH && mx <= obs.x + halfH && my >= obs.y - halfW && my <= obs.y + halfW;
      }

      if (clickedInside) {
        setSelectedObstacleId(obs.id);
        setSelectedElementInstanceId(null);
        setSelectedTagId(null);
        dragModeRef.current = "dragging";
        dragStartRef.current = {
          mx,
          my,
          ox: obs.x,
          oy: obs.y,
          originalPoints: obs.points ? [...obs.points] : undefined
        };
        return;
      }
    }

    setSelectedObstacleId(null);
    setSelectedElementInstanceId(null);
    setSelectedTagId(null);
    dragModeRef.current = "none";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mx = toEkfX(mouseX, mouseY);
    const my = toEkfY(mouseX, mouseY);

    if (isDrawingPolygon) {
      setHoverPoint({ x: mx, y: my });
      return;
    }

    if (dragModeRef.current === "none") return;

    const limitMinX = fieldType === "frc" ? 0 : -fieldH / 2;
    const limitMaxX = fieldType === "frc" ? fieldH : fieldH / 2;
    const limitMinY = fieldType === "frc" ? 0 : -fieldW / 2;
    const limitMaxY = fieldType === "frc" ? fieldW : fieldW / 2;

    if (dragModeRef.current === "dragging") {
      if (selectedObstacleId) {
        const diffX = mx - dragStartRef.current.mx;
        const diffY = my - dragStartRef.current.my;

        const obs = obstacles.find((o) => o.id === selectedObstacleId);
        if (obs) {
          if (obs.shape === "polygon" && obs.points && dragStartRef.current.originalPoints) {
            const origPts = dragStartRef.current.originalPoints;
            const shiftedPoints = origPts.map((p) => ({
              x: Number(Math.max(limitMinX, Math.min(limitMaxX, p.x + diffX)).toFixed(3)),
              y: Number(Math.max(limitMinY, Math.min(limitMaxY, p.y + diffY)).toFixed(3))
            }));

            const nextX = shiftedPoints.reduce((sum, p) => sum + p.x, 0) / shiftedPoints.length;
            const nextY = shiftedPoints.reduce((sum, p) => sum + p.y, 0) / shiftedPoints.length;

            setObstacles(
              obstacles.map((o) => {
                if (o.id === selectedObstacleId) {
                  return {
                    ...o,
                    x: Number(nextX.toFixed(3)),
                    y: Number(nextY.toFixed(3)),
                    points: shiftedPoints
                  };
                }
                return o;
              })
            );
          } else {
            const nextX = Math.max(limitMinX, Math.min(limitMaxX, dragStartRef.current.ox + diffX));
            const nextY = Math.max(limitMinY, Math.min(limitMaxY, dragStartRef.current.oy + diffY));

            setObstacles(
              obstacles.map((obsVal) => {
                if (obsVal.id === selectedObstacleId) {
                  return {
                    ...obsVal,
                    x: Number(nextX.toFixed(3)),
                    y: Number(nextY.toFixed(3))
                  };
                }
                return obsVal;
              })
            );
          }
        }
      } else if (selectedElementInstanceId) {
        const diffX = mx - dragStartRef.current.mx;
        const diffY = my - dragStartRef.current.my;

        const nextX = Math.max(limitMinX, Math.min(limitMaxX, dragStartRef.current.ox + diffX));
        const nextY = Math.max(limitMinY, Math.min(limitMaxY, dragStartRef.current.oy + diffY));

        setElements(
          elements.map((el) => {
            if (el.id === selectedElementInstanceId) {
              return {
                ...el,
                x: Number(nextX.toFixed(3)),
                y: Number(nextY.toFixed(3))
              };
            }
            return el;
          })
        );
      }
    } else if (dragModeRef.current === "dragging_vertex" && selectedObstacleId) {
      const diffX = mx - dragStartRef.current.mx;
      const diffY = my - dragStartRef.current.my;
      const vIdx = dragStartRef.current.vertexIndex;

      if (vIdx !== undefined) {
        const nextVx = Math.max(limitMinX, Math.min(limitMaxX, dragStartRef.current.ox + diffX));
        const nextVy = Math.max(limitMinY, Math.min(limitMaxY, dragStartRef.current.oy + diffY));

        setObstacles(
          obstacles.map((obsVal) => {
            if (obsVal.id === selectedObstacleId && obsVal.points) {
              const updatedPoints = obsVal.points.map((pt, idx) =>
                idx === vIdx ? { x: Number(nextVx.toFixed(3)), y: Number(nextVy.toFixed(3)) } : pt
              );
              const newCx = updatedPoints.reduce((sum, p) => sum + p.x, 0) / updatedPoints.length;
              const newCy = updatedPoints.reduce((sum, p) => sum + p.y, 0) / updatedPoints.length;
              return {
                ...obsVal,
                x: Number(newCx.toFixed(3)),
                y: Number(newCy.toFixed(3)),
                points: updatedPoints
              };
            }
            return obsVal;
          })
        );
      }
    } else if (dragModeRef.current === "dragging_tag" && selectedTagId !== null) {
      const diffX = mx - dragStartRef.current.mx;
      const diffY = my - dragStartRef.current.my;

      const nextX = Math.max(limitMinX, Math.min(limitMaxX, dragStartRef.current.ox + diffX));
      const nextY = Math.max(limitMinY, Math.min(limitMaxY, dragStartRef.current.oy + diffY));

      setApriltags(
        apriltags.map((tag) => {
          if (tag.id === selectedTagId) {
            return {
              ...tag,
              x: Number(nextX.toFixed(3)),
              y: Number(nextY.toFixed(3))
            };
          }
          return tag;
        })
      );
    } else if (dragModeRef.current === "resizing" && selectedObstacleId) {
      const drag = dragStartRef.current;
      if (
        drag.fixedX === undefined ||
        drag.fixedY === undefined ||
        drag.ow === undefined ||
        drag.oh === undefined
      )
        return;

      const newHeight = Math.max(0.1, Math.abs(drag.fixedX - mx));
      const newWidth = Math.max(0.1, Math.abs(drag.fixedY - my));

      const newX = (drag.fixedX + mx) / 2;
      const newY = (drag.fixedY + my) / 2;

      setObstacles(
        obstacles.map((obsVal) => {
          if (obsVal.id === selectedObstacleId) {
            return {
              ...obsVal,
              width: Number(newWidth.toFixed(3)),
              height: Number(newHeight.toFixed(3)),
              x: Number(newX.toFixed(3)),
              y: Number(newY.toFixed(3))
            };
          }
          return obsVal;
        })
      );
    }
  };

  const handleMouseUp = () => {
    dragModeRef.current = "none";
  };

  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!selectedObstacleId) {
      if (e.key === "Enter" || e.key === " ") {
        if (obstacles.length > 0) {
          setSelectedObstacleId(obstacles[0].id);
          e.preventDefault();
        }
      }
      return;
    }

    const step = e.shiftKey ? 0.5 : 0.05;
    const obs = obstacles.find((o) => o.id === selectedObstacleId);
    if (!obs) return;

    const pCenter = ekfToScreen(obs.x, obs.y);
    const pXPlus = ekfToScreen(obs.x + step, obs.y);
    const pYPlus = ekfToScreen(obs.x, obs.y + step);

    const screenDX_for_ekfX = pXPlus.x - pCenter.x;
    const screenDY_for_ekfX = pXPlus.y - pCenter.y;
    const screenDX_for_ekfY = pYPlus.x - pCenter.x;
    const screenDY_for_ekfY = pYPlus.y - pCenter.y;

    let nextX = obs.x;
    let nextY = obs.y;

    if (e.key === "ArrowUp") {
      if (Math.abs(screenDY_for_ekfX) > Math.abs(screenDY_for_ekfY)) {
        nextX += screenDY_for_ekfX < 0 ? step : -step;
      } else {
        nextY += screenDY_for_ekfY < 0 ? step : -step;
      }
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      if (Math.abs(screenDY_for_ekfX) > Math.abs(screenDY_for_ekfY)) {
        nextX += screenDY_for_ekfX > 0 ? step : -step;
      } else {
        nextY += screenDY_for_ekfY > 0 ? step : -step;
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      if (Math.abs(screenDX_for_ekfX) > Math.abs(screenDX_for_ekfY)) {
        nextX += screenDX_for_ekfX < 0 ? step : -step;
      } else {
        nextY += screenDX_for_ekfY < 0 ? step : -step;
      }
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      if (Math.abs(screenDX_for_ekfX) > Math.abs(screenDX_for_ekfY)) {
        nextX += screenDX_for_ekfX > 0 ? step : -step;
      } else {
        nextY += screenDX_for_ekfY > 0 ? step : -step;
      }
      e.preventDefault();
    }

    if (nextX !== obs.x || nextY !== obs.y) {
      setObstacles(
        obstacles.map((o) =>
          o.id === obs.id ? { ...o, x: Number(nextX.toFixed(3)), y: Number(nextY.toFixed(3)) } : o
        )
      );
    }

    if (e.key === "Escape") {
      setSelectedObstacleId(null);
      e.preventDefault();
    } else if (e.key === "Tab") {
      const idx = obstacles.findIndex((o) => o.id === selectedObstacleId);
      if (idx !== -1) {
        const nextIdx = (idx + 1) % obstacles.length;
        setSelectedObstacleId(obstacles[nextIdx].id);
        e.preventDefault();
      }
    }
  };

  return (
    <div className="lg:col-span-2 flex flex-col gap-4">
      <div className="glass-card p-6 border border-white/10 bg-black/60 shadow-2xl flex flex-col items-center justify-center">
        <div className="flex items-center justify-between w-full mb-4 border-b border-white/5 pb-3">
          <span className="text-[10px] uppercase font-black tracking-widest text-ares-gold flex items-center gap-1.5">
            <Compass size={12} />{" "}
            {fieldType === "frc" ? "Interactive 2D Map View (FRC Field)" : "Interactive 2D Map View (12ft Grid)"}
          </span>
          <span className="text-[9px] font-mono text-marble/35 uppercase">
            {fieldType === "frc" ? "Origin: Blue Wall Right Corner (0, 0)" : "EKF Origin: Center (0, 0)"}
          </span>
        </div>

        <div className="relative border border-white/10 bg-neutral-950 rounded-xl overflow-hidden shadow-inner cursor-crosshair">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onKeyDown={handleCanvasKeyDown}
            tabIndex={0}
            role="img"
            aria-label="Interactive 2D Field Map. Use Arrow keys to move the selected obstacle, Tab to cycle obstacles, and Escape to deselect."
            style={{ width: `${canvasW}px`, height: `${canvasH}px` }}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          />
        </div>

        <div className="flex items-center gap-2.5 mt-4 text-[10px] leading-relaxed text-marble/40 font-mono">
          <Info size={11} className="text-ares-gold shrink-0 mt-0.5" />
          <span>
            Click empty space to deselect. Drag obstacles to move. Drag the gold corner handle to resize.
          </span>
        </div>
      </div>
    </div>
  );
}
