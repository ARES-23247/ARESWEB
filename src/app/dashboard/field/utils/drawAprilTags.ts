import { CoordinateHelpers, FieldAprilTag } from "../types";

interface DrawAprilTagsParams {
  ctx: CanvasRenderingContext2D;
  apriltags: FieldAprilTag[];
  selectedTagId: number | null;
  scale: number;
  ekfToScreen: CoordinateHelpers["ekfToScreen"];
}

export function drawAprilTags({
  ctx,
  apriltags,
  selectedTagId,
  scale,
  ekfToScreen
}: DrawAprilTagsParams) {
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
}
