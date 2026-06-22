import { CoordinateHelpers, FieldObstacle } from "../types";

interface DrawObstaclesParams {
  ctx: CanvasRenderingContext2D;
  obstacles: FieldObstacle[];
  selectedObstacleId: string | null;
  scale: number;
  ekfToScreen: CoordinateHelpers["ekfToScreen"];
  isDrawingPolygon: boolean;
  drawingPoints: { x: number; y: number }[];
  hoverPoint: { x: number; y: number } | null;
}

export function drawObstacles({
  ctx,
  obstacles,
  selectedObstacleId,
  scale,
  ekfToScreen,
  isDrawingPolygon,
  drawingPoints,
  hoverPoint
}: DrawObstaclesParams) {
  // 1. Draw Obstacles
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
    const widthText = obs.width.toFixed(2);
    const heightText = obs.height.toFixed(2);

    if (isPolygon && obs.points && obs.points.length > 0) {
      ctx.beginPath();
      obs.points.forEach((pt: { x: number; y: number }, idx: number) => {
        const p = ekfToScreen(pt.x, pt.y);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();

      ctx.fillStyle = isSelected ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.07)";
      ctx.fill();
      ctx.stroke();

      cx = obs.points.reduce((acc: number, pt: { x: number; y: number }) => acc + pt.x, 0) / obs.points.length;
      cy = obs.points.reduce((acc: number, pt: { x: number; y: number }) => acc + pt.y, 0) / obs.points.length;
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
        obs.points.forEach((pt: { x: number; y: number }) => {
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

  // 2. Draw polygon in-progress
  if (isDrawingPolygon && drawingPoints.length > 0) {
    ctx.save();
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    drawingPoints.forEach((pt: { x: number; y: number }, idx: number) => {
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

    drawingPoints.forEach((pt: { x: number; y: number }) => {
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
}
