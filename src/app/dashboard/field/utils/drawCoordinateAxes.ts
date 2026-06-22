import { CoordinateHelpers } from "../types";

interface DrawCoordinateAxesParams {
  ctx: CanvasRenderingContext2D;
  showCoordinateAxes: boolean;
  fieldType: "ftc" | "frc";
  canvasW: number;
  canvasH: number;
  centerX: number;
  centerY: number;
  ekfToScreen: CoordinateHelpers["ekfToScreen"];
}

export function drawCoordinateAxes({
  ctx,
  showCoordinateAxes,
  fieldType,
  canvasW,
  canvasH,
  centerX,
  centerY,
  ekfToScreen
}: DrawCoordinateAxesParams) {
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
}
