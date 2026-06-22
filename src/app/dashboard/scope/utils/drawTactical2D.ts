import { TelemetryData, TelemetryFrame, PlannedPathPoint, FieldObstacle } from "../store/scopeStore";
import { getCameraPoses, getSwerveAngles } from "./poseUtils";

export interface DrawTactical2DOptions {
  ctx: CanvasRenderingContext2D;
  parentDimensions: { width: number; height: number };
  bgImage: HTMLImageElement | null;
  bgImageLoaded: boolean;
  fieldObstacles: FieldObstacle[] | null;
  plannedPath: PlannedPathPoint[] | null;
  telemetryData: TelemetryData | null;
  comparisonTelemetryData: TelemetryData | null;
  currentTimeMs: number;
  currentFrame: TelemetryFrame | null;
  comparisonFrame: TelemetryFrame | null;
  driveMode: "mecanum" | "swerve";
  showFov: boolean;
}

/**
 * Draws the 2D Tactical view on the provided canvas context.
 */
export function drawTactical2D(options: DrawTactical2DOptions) {
  const {
    ctx,
    parentDimensions,
    bgImage,
    bgImageLoaded,
    fieldObstacles,
    plannedPath,
    telemetryData,
    comparisonTelemetryData,
    currentTimeMs,
    currentFrame,
    comparisonFrame,
    driveMode,
    showFov,
  } = options;

  const width = parentDimensions.width;
  const height = parentDimensions.height;
  const fieldSizeMeters = 3.6576;
  const padding = 15;
  const mapSize = width - padding * 2;
  const scale = mapSize / fieldSizeMeters; // pixels per meter

  const centerX = width / 2;
  const centerY = height / 2;

  // Center-origin EKF coordinates (X forward, Y left) to canvas pixels
  const toPxX = (y_ekf: number) => centerX - y_ekf * scale; // Left is positive Y, maps to screen left
  const toPxY = (x_ekf: number) => centerY - x_ekf * scale; // Forward is positive X, maps to screen top

  // Background Image or Solid Color
  if (bgImage && bgImageLoaded) {
    ctx.drawImage(bgImage, toPxX(1.8288), toPxY(1.8288), mapSize, mapSize);
  } else {
    ctx.fillStyle = "#0D0D0D";
    ctx.fillRect(0, 0, width, height);
  }

  // 6x6 Grid Tiles (each is 24x24 inches = 0.6096m x 0.6096m)
  ctx.strokeStyle = bgImage && bgImageLoaded ? "rgba(255, 255, 255, 0.015)" : "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    const offset = i * 0.6096;
    // Vertical grid lines (constant Y_ekf)
    ctx.beginPath();
    ctx.moveTo(toPxX(offset), toPxY(-1.8288));
    ctx.lineTo(toPxX(offset), toPxY(1.8288));
    ctx.stroke();

    // Horizontal grid lines (constant X_ekf)
    ctx.beginPath();
    ctx.moveTo(toPxX(-1.8288), toPxY(offset));
    ctx.lineTo(toPxX(1.8288), toPxY(offset));
    ctx.stroke();
  }

  // Outer Perimeter Wall
  ctx.strokeStyle = bgImage && bgImageLoaded ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.rect(toPxX(1.8288), toPxY(1.8288), mapSize, mapSize);
  ctx.stroke();

  if (!bgImage || !bgImageLoaded) {
    // Red Basket Corner (Top-Left on screen, EKF X = 1.8288, Y = 1.8288)
    ctx.fillStyle = "rgba(239, 68, 68, 0.1)";
    ctx.beginPath();
    ctx.arc(toPxX(1.8288), toPxY(1.8288), 0.508 * scale, 0, Math.PI * 2); // 20 inches = 0.508m
    ctx.fill();

    // Blue Basket Corner (Bottom-Right on screen, EKF X = -1.8288, Y = -1.8288)
    ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
    ctx.beginPath();
    ctx.arc(toPxX(-1.8288), toPxY(-1.8288), 0.508 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Substations (Red bottom-left screen, Blue top-right screen)
    ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
    ctx.fillRect(toPxX(1.8288), toPxY(-1.2192), 0.6096 * scale, 0.6096 * scale); // 24 inches = 0.6096m
    ctx.strokeStyle = "rgba(239, 68, 68, 0.2)";
    ctx.strokeRect(toPxX(1.8288), toPxY(-1.2192), 0.6096 * scale, 0.6096 * scale);

    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fillRect(toPxX(-1.2192), toPxY(1.8288), 0.6096 * scale, 0.6096 * scale);
    ctx.strokeStyle = "rgba(59, 130, 246, 0.2)";
    ctx.strokeRect(toPxX(-1.2192), toPxY(1.8288), 0.6096 * scale, 0.6096 * scale);
  }

  // Custom Obstacles from Field Config
  if (fieldObstacles && fieldObstacles.length > 0) {
    ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
    ctx.strokeStyle = "#c00000";
    ctx.lineWidth = 1.5;
    fieldObstacles.forEach((obs) => {
      const obsHalfW = obs.width / 2;
      const obsHalfH = obs.height / 2;
      const leftPx = toPxX(obs.y + obsHalfW);
      const topPx = toPxY(obs.x + obsHalfH);
      const wPx = obs.width * scale;
      const hPx = obs.height * scale;

      ctx.fillRect(leftPx, topPx, wPx, hPx);
      ctx.strokeRect(leftPx, topPx, wPx, hPx);

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(obs.name, leftPx + wPx / 2, topPx + hPx / 2 + 3);
    });
  }

  // Planned Path (Dashed Cyan Spline)
  if (plannedPath && plannedPath.length > 0) {
    ctx.strokeStyle = "rgba(6, 182, 212, 0.75)"; // Cyan-500
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    for (let i = 0; i < plannedPath.length; i++) {
      const pt = plannedPath[i];
      if (i === 0) ctx.moveTo(toPxX(pt.y), toPxY(pt.x));
      else ctx.lineTo(toPxX(pt.y), toPxY(pt.x));
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset dashed line style

    // Start node (green ring)
    ctx.fillStyle = "#22C55E"; // ARES Success
    ctx.beginPath();
    ctx.arc(toPxX(plannedPath[0].y), toPxY(plannedPath[0].x), 4, 0, Math.PI * 2);
    ctx.fill();

    // End node (red ring)
    ctx.fillStyle = "#c00000"; // Red
    ctx.beginPath();
    ctx.arc(toPxX(plannedPath[plannedPath.length - 1].y), toPxY(plannedPath[plannedPath.length - 1].x), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glowing Trail
  if (telemetryData && telemetryData.timestamps.length > 0) {
    const times = telemetryData.timestamps;
    let currentIndex = 0;
    for (let i = 0; i < times.length; i++) {
      if (times[i] <= currentTimeMs) currentIndex = i;
      else break;
    }

    if (currentIndex > 0) {
      ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= currentIndex; i++) {
        const pt = telemetryData.coords[i];
        if (!pt) continue;
        if (i === 0) ctx.moveTo(toPxX(pt.y), toPxY(pt.x));
        else ctx.lineTo(toPxX(pt.y), toPxY(pt.x));
      }
      ctx.stroke();
    }
  }

  // Comparison Trail (Dashed Red Line)
  if (comparisonTelemetryData && comparisonTelemetryData.timestamps.length > 0) {
    const times = comparisonTelemetryData.timestamps;
    let currentIndex = 0;
    for (let i = 0; i < times.length; i++) {
      if (times[i] <= currentTimeMs) currentIndex = i;
      else break;
    }

    if (currentIndex > 0) {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i <= currentIndex; i++) {
        const pt = comparisonTelemetryData.coords[i];
        if (!pt) continue;
        if (i === 0) ctx.moveTo(toPxX(pt.y), toPxY(pt.x));
        else ctx.lineTo(toPxX(pt.y), toPxY(pt.x));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Camera FOV Wedges (drawn under the robot chassis)
  if (showFov && currentFrame) {
    const cameras = getCameraPoses(currentFrame);
    cameras.forEach((cam) => {
      const cx = currentFrame.x + cam.x * Math.cos(currentFrame.heading) - cam.y * Math.sin(currentFrame.heading);
      const cy = currentFrame.y + cam.x * Math.sin(currentFrame.heading) + cam.y * Math.cos(currentFrame.heading);
      const camHeading = currentFrame.heading + cam.yaw;
      
      const pxX = toPxX(cy);
      const pxY = toPxY(cx);
      const rangePx = 4.0 * scale;
      const halfFov = (31.5 * Math.PI) / 180;
      const screenAngle = -camHeading - Math.PI / 2;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pxX, pxY);
      ctx.arc(pxX, pxY, rangePx, screenAngle - halfFov, screenAngle + halfFov);
      ctx.closePath();
      ctx.fillStyle = "rgba(245, 158, 11, 0.05)";
      ctx.fill();

      ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    });
  }

  // Robot Chassis (0.4572m Square = 18")
  if (currentFrame) {
    const pxX = toPxX(currentFrame.y);
    const pxY = toPxY(currentFrame.x);
    const robotSizePx = 0.4572 * scale;

    ctx.save();
    ctx.translate(pxX, pxY);
    ctx.rotate(-currentFrame.heading);

    // Chassis Body
    ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
    ctx.beginPath();
    ctx.rect(-robotSizePx / 2, -robotSizePx / 2, robotSizePx, robotSizePx);
    ctx.fill();

    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Drivetrain Wheels (rotating module vectors if Swerve is active)
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 1;

    const wheelW = 0.1016 * scale; // 4 inches
    const wheelH = 0.2032 * scale; // 8 inches
    const swerveAngles = getSwerveAngles(currentFrame);

    const drawWheel2D = (offsetX: number, offsetY: number, moduleAngle: number) => {
      ctx.save();
      ctx.translate(offsetX, offsetY);
      if (driveMode === "swerve") {
        ctx.rotate(-moduleAngle);
      }
      ctx.fillRect(-wheelH / 2, -wheelW / 2, wheelH, wheelW);
      ctx.strokeRect(-wheelH / 2, -wheelW / 2, wheelH, wheelW);
      ctx.restore();
    };

    // Draw 4 wheels: FL, FR, BL, BR
    drawWheel2D(-robotSizePx / 2 + wheelH / 2, -robotSizePx / 2 - wheelW / 2, swerveAngles.fl);
    drawWheel2D(robotSizePx / 2 - wheelH / 2, -robotSizePx / 2 - wheelW / 2, swerveAngles.fr);
    drawWheel2D(-robotSizePx / 2 + wheelH / 2, robotSizePx / 2 + wheelW / 2, swerveAngles.bl);
    drawWheel2D(robotSizePx / 2 - wheelH / 2, robotSizePx / 2 + wheelW / 2, swerveAngles.br);

    // Heading Arrow
    ctx.strokeStyle = "#FFB81C";
    ctx.fillStyle = "#FFB81C";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -robotSizePx * 0.7);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, -robotSizePx * 0.7);
    ctx.lineTo(-0.04 * scale, -robotSizePx * 0.5);
    ctx.lineTo(0.04 * scale, -robotSizePx * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(pxX, pxY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Comparison Ghost Robot Chassis (dashed red outline)
  if (comparisonFrame) {
    const pxX = toPxX(comparisonFrame.y);
    const pxY = toPxY(comparisonFrame.x);
    const robotSizePx = 0.4572 * scale;

    ctx.save();
    ctx.translate(pxX, pxY);
    ctx.rotate(-comparisonFrame.heading);

    // Chassis Body (dashed red)
    ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
    ctx.beginPath();
    ctx.rect(-robotSizePx / 2, -robotSizePx / 2, robotSizePx, robotSizePx);
    ctx.fill();

    ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Heading Arrow (Dashed Red)
    ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -robotSizePx * 0.7);
    ctx.stroke();

    ctx.restore();
  }
}
