import { useRef } from "react";
import {
  FieldObstacle,
  FieldElementInstance,
  ElementType,
  FieldAprilTag,
  CoordinateHelpers
} from "../types";
import { isPointInPolygon } from "../utils/geom";

interface UseFieldCanvasDragProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  fieldType: "ftc" | "frc";
  fieldW: number;
  fieldH: number;

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

  ekfToScreen: CoordinateHelpers["ekfToScreen"];
  toEkfX: CoordinateHelpers["toEkfX"];
  toEkfY: CoordinateHelpers["toEkfY"];
}

export function useFieldCanvasDrag({
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
}: UseFieldCanvasDragProps) {
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
          const cx = drawingPoints.reduce((sum: number, p: { x: number; y: number }) => sum + p.x, 0) / drawingPoints.length;
          const cy = drawingPoints.reduce((sum: number, p: { x: number; y: number }) => sum + p.y, 0) / drawingPoints.length;
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

            const nextX = shiftedPoints.reduce((sum: number, p: { x: number; y: number }) => sum + p.x, 0) / shiftedPoints.length;
            const nextY = shiftedPoints.reduce((sum: number, p: { x: number; y: number }) => sum + p.y, 0) / shiftedPoints.length;

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
              const updatedPoints = obsVal.points.map((pt: { x: number; y: number }, idx: number) =>
                idx === vIdx ? { x: Number(nextVx.toFixed(3)), y: Number(nextVy.toFixed(3)) } : pt
              );
              const newCx = updatedPoints.reduce((sum: number, p: { x: number; y: number }) => sum + p.x, 0) / updatedPoints.length;
              const newCy = updatedPoints.reduce((sum: number, p: { x: number; y: number }) => sum + p.y, 0) / updatedPoints.length;
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

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleCanvasKeyDown
  };
}
