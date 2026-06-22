import { CoordinateHelpers, FieldElementInstance, ElementType } from "../types";

interface DrawFieldElementsParams {
  ctx: CanvasRenderingContext2D;
  elements: FieldElementInstance[];
  elementTypes: ElementType[];
  selectedElementInstanceId: string | null;
  scale: number;
  ekfToScreen: CoordinateHelpers["ekfToScreen"];
}

export function drawFieldElements({
  ctx,
  elements,
  elementTypes,
  selectedElementInstanceId,
  scale,
  ekfToScreen
}: DrawFieldElementsParams) {
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
}
