import { CoordinateHelpers } from "../types";

interface DrawGridParams {
  ctx: CanvasRenderingContext2D;
  showGrid: boolean;
  fieldType: "ftc" | "frc";
  bgImage: HTMLImageElement | null;
  ekfToScreen: CoordinateHelpers["ekfToScreen"];
  fieldW: number;
  fieldH: number;
}

export function drawGrid({
  ctx,
  showGrid,
  fieldType,
  bgImage,
  ekfToScreen,
  fieldW,
  fieldH
}: DrawGridParams) {
  // 1. Draw Grid Lines
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

  // 2. Draw Outer Perimeter Wall
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
}
