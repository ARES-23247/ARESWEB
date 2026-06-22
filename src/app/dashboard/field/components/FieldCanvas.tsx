"use client";

import React, { useRef, useEffect, useState } from "react";
import { Compass, Info } from "lucide-react";
import {
  FieldObstacle,
  ElementType,
  FieldElementInstance,
  FieldAprilTag
} from "../types";
import { useFieldCanvasDrag } from "../hooks/useFieldCanvasDrag";
import { drawGrid } from "../utils/drawGrid";
import { drawAllianceZones } from "../utils/drawAllianceZones";
import { drawCoordinateAxes } from "../utils/drawCoordinateAxes";
import { drawDriverStations } from "../utils/drawDriverStations";
import { drawObstacles } from "../utils/drawObstacles";
import { drawFieldElements } from "../utils/drawFieldElements";
import { drawAprilTags } from "../utils/drawAprilTags";

export type { FieldObstacle, ElementType, FieldElementInstance, FieldAprilTag };

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

  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleCanvasKeyDown
  } = useFieldCanvasDrag({
    canvasRef,
    fieldType,
    fieldW,
    fieldH,
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
    setHoverPoint,
    ekfToScreen,
    toEkfX,
    toEkfY
  });

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

    // 2 & 3. Draw Grid Lines and Wall
    drawGrid({
      ctx,
      showGrid,
      fieldType,
      bgImage,
      ekfToScreen,
      fieldW,
      fieldH
    });

    // 4. Draw Center Origin Crosshair & EKF Axes Indicators
    drawCoordinateAxes({
      ctx,
      showCoordinateAxes,
      fieldType,
      canvasW,
      canvasH,
      centerX,
      centerY,
      ekfToScreen
    });

    // 5. Draw Driver's Stations
    drawDriverStations({
      ctx,
      fieldType,
      canvasW,
      canvasH,
      redDriverStation,
      blueDriverStation
    });

    // 6. Draw red and blue zones/substations
    drawAllianceZones({
      ctx,
      fieldType,
      bgImage,
      showAllianceZones,
      scale,
      ekfToScreen
    });

    // 7 & 10. Draw Obstacles
    drawObstacles({
      ctx,
      obstacles,
      selectedObstacleId,
      scale,
      ekfToScreen,
      isDrawingPolygon,
      drawingPoints,
      hoverPoint
    });

    // 8. Draw Field Elements
    drawFieldElements({
      ctx,
      elements,
      elementTypes,
      selectedElementInstanceId,
      scale,
      ekfToScreen
    });

    // 9. Draw AprilTags
    drawAprilTags({
      ctx,
      apriltags,
      selectedTagId,
      scale,
      ekfToScreen
    });
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
