import { CoordinateHelpers } from "../types";

interface DrawAllianceZonesParams {
  ctx: CanvasRenderingContext2D;
  fieldType: "ftc" | "frc";
  bgImage: HTMLImageElement | null;
  showAllianceZones: boolean;
  scale: number;
  ekfToScreen: CoordinateHelpers["ekfToScreen"];
}

export function drawAllianceZones({
  ctx,
  fieldType,
  bgImage,
  showAllianceZones,
  scale,
  ekfToScreen
}: DrawAllianceZonesParams) {
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
}
