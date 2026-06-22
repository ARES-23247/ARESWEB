interface DrawDriverStationsParams {
  ctx: CanvasRenderingContext2D;
  fieldType: "ftc" | "frc";
  canvasW: number;
  canvasH: number;
  redDriverStation: "north" | "south" | "east" | "west";
  blueDriverStation: "north" | "south" | "east" | "west";
}

export function drawDriverStations({
  ctx,
  fieldType,
  canvasW,
  canvasH,
  redDriverStation,
  blueDriverStation
}: DrawDriverStationsParams) {
  const drawDriverStation = (
    side: "north" | "south" | "east" | "west",
    color: string,
    text: string
  ) => {
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
}
