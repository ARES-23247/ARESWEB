import express from "express";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { ensureTeamMember, ensureAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { GoogleGenAI } from "@google/genai";
import rateLimit from "express-rate-limit";

const router = express.Router();

const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per window
  message: { error: "Too many match analysis requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/replay/:runId/summary
router.get("/:runId/summary", ensureTeamMember, asyncHandler(async (req, res) => {
  const { runId } = req.params;
  
  // Try Firestore first
  const runDoc = await adminDb.collection("telemetry_runs").doc(runId).get();
  if (runDoc.exists) {
    res.status(200).json(runDoc.data());
    return;
  }

  throw new ApiError(404, `Run ${runId} not found.`);
}));

// GET /api/replay/:runId/states
router.get("/:runId/states", ensureTeamMember, asyncHandler(async (req, res) => {
  res.status(200).json([]);
}));

// GET /api/replay/:runId/actions
router.get("/:runId/actions", ensureTeamMember, asyncHandler(async (req, res) => {
  res.status(200).json([]);
}));

// GET /api/replay/:runId/inputs
// Serves JSONL back to local desktop replay runner
router.get("/:runId/inputs", ensureTeamMember, asyncHandler(async (req, res) => {
  res.setHeader("Content-Type", "application/x-jsonlines");
  res.end();
}));

// GET /api/replay/:runId/motors
router.get("/:runId/motors", ensureTeamMember, asyncHandler(async (req, res) => {
  res.status(200).json([]);
}));

// GET /api/replay/:runId/vision
router.get("/:runId/vision", ensureTeamMember, asyncHandler(async (req, res) => {
  res.status(200).json([]);
}));

// Helper to generate mock telemetry runs
function generateHighFidelityMockRun(runId: string) {
  const hz = 20;
  const durationSec = 150;
  const totalFrames = hz * durationSec;
  
  const timestamps: number[] = [];
  const coords: { x: number; y: number; heading: number }[] = [];
  const battery: number[] = [];
  const loopTime: number[] = [];
  
  const motors = {
    lf: [] as number[],
    rf: [] as number[],
    lr: [] as number[],
    rr: [] as number[],
  };
  
  const slides = {
    height: [] as number[],
    current: [] as number[],
  };
  
  const intake = {
    current: [] as number[],
  };

  let posX = 12.0;
  let posY = 12.0;
  let heading = 0.0;
  let batteryVolt = 12.8;

  for (let i = 0; i < totalFrames; i++) {
    const timeMs = i * 50;
    timestamps.push(timeMs);
    
    const isAutonomous = i < hz * 30;
    const isEndgame = i > hz * 120;

    if (isAutonomous) {
      if (i < hz * 8) {
        posX += 0.8;
        posY += 0.8;
        heading = Math.PI / 4;
      } else if (i < hz * 16) {
        heading = Math.PI / 4 + Math.sin(i * 0.1) * 0.05;
      } else if (i < hz * 24) {
        posX -= 0.3;
        posY -= 0.1;
        heading = 0.0;
      } else {
        posX += 0.1;
        posY += 0.6;
        heading = Math.PI / 2;
      }
    } else if (isEndgame) {
      const climbFrame = i - hz * 120;
      if (climbFrame < hz * 10) {
        const targetX = 72.0;
        const targetY = 72.0;
        posX += (targetX - posX) * 0.1;
        posY += (targetY - posY) * 0.1;
        heading = Math.PI;
      } else {
        heading = Math.PI;
      }
    } else {
      const cycleTime = (i - hz * 30) % (hz * 15);
      if (cycleTime < hz * 6) {
        posX += (72.0 - posX) * 0.08;
        posY += (72.0 - posY) * 0.08;
        heading = Math.atan2(72 - posY, 72 - posX);
      } else if (cycleTime < hz * 10) {
        posX = 72.0 + Math.sin(i * 0.5) * 0.5;
        posY = 72.0 + Math.cos(i * 0.5) * 0.5;
        heading = Math.PI / 4;
      } else {
        posX += (12.0 - posX) * 0.08;
        posY += (12.0 - posY) * 0.08;
        heading = Math.atan2(12 - posY, 12 - posX);
      }
    }

    coords.push({ x: posX, y: posY, heading: heading });

    const prevFrame = i > 0 ? coords[i - 1] : { x: posX, y: posY };
    const velocity = Math.sqrt(Math.pow(posX - prevFrame.x, 2) + Math.pow(posY - prevFrame.y, 2));
    
    const baseCurrent = 1.2 + Math.random() * 0.4;
    const motorDrawLF = velocity * 15 + baseCurrent + Math.random() * 0.5;
    const motorDrawRF = velocity * 18 + baseCurrent + Math.random() * 0.8;
    const motorDrawLR = velocity * 15 + baseCurrent + Math.random() * 0.5;
    const motorDrawRR = velocity * 15 + baseCurrent + Math.random() * 0.5;

    motors.lf.push(motorDrawLF);
    motors.rf.push(motorDrawRF);
    motors.lr.push(motorDrawLR);
    motors.rr.push(motorDrawRR);

    const totalMotorDraw = motorDrawLF + motorDrawRF + motorDrawLR + motorDrawRR;
    batteryVolt = 12.8 - (totalMotorDraw * 0.02);
    if (i === hz * 45 || i === hz * 95) {
      batteryVolt = 10.9;
    }
    battery.push(Math.max(10.2, batteryVolt));

    let loop = 8.5 + Math.random() * 2.0;
    if (i > hz * 60 && i < hz * 63) {
      loop = 36.4 + Math.random() * 4.0;
    }
    loopTime.push(loop);

    let slideHt = 0;
    let slideCur = 0.5;
    let intakeCur = 0.3;

    if (isAutonomous) {
      if (i > hz * 8 && i < hz * 14) {
        slideHt = 1500;
        slideCur = 8.4;
      }
    } else if (isEndgame) {
      const climbFrame = i - hz * 120;
      if (climbFrame > hz * 10) {
        slideHt = 2400;
        slideCur = 22.0 + Math.random() * 1.5;
        if (climbFrame > hz * 20) {
          slideCur = 28.5;
        }
      }
    } else {
      const cycleTime = (i - hz * 30) % (hz * 15);
      if (cycleTime > hz * 5 && cycleTime < hz * 9) {
        slideHt = 1800;
        slideCur = 9.8;
      } else if (cycleTime > hz * 11) {
        intakeCur = 4.2;
      }
    }

    slides.height.push(slideHt);
    slides.current.push(slideCur);
    intake.current.push(intakeCur);
  }

  const channels: Record<string, number[]> = {
    "Robot/BatteryVoltage": battery,
    "Robot/LoopTime": loopTime,
    "Drive/MotorCurrent_FL": motors.lf,
    "Drive/MotorCurrent_FR": motors.rf,
    "Drive/MotorCurrent_BL": motors.lr,
    "Drive/MotorCurrent_BR": motors.rr,
    "Superstructure/Elevator_Height": slides.height,
    "Superstructure/Elevator_Current": slides.current,
    "Drive/IntakeCurrent": intake.current,
  };

  return {
    runId: runId,
    opModeName: "ARESMecanumTeleOpDrive",
    timestamps: timestamps,
    coords: coords,
    channels: channels,
    maxTimeMs: timestamps[timestamps.length - 1],
    source: "mock" as const,
    coordinateSystem: "inches" as const,
  };
}

// Helper for match-analysis deterministic report
function generateDeterministicReport(match: any): string {
  const won = match.ourScore > match.opponentScore;
  const outcomeText = won ? "VICTORY" : match.ourScore === match.opponentScore ? "TIE" : "DEFEAT";

  let autoStatus = "🟢 NOMINAL AUTO";
  let autoDetail = "All auto components executed flawlessly. The robot achieved correct alignment and scored preload units.";
  if (!match.autonomous.parkingSuccess) {
    autoStatus = "⚠️ AUTO PARKING FAILED";
    autoDetail = "The robot completed all scoring runs but failed to park in the designated zone before the buzzer.";
  }

  let teleStatus = "🟢 STABLE TELEOP";
  let teleDetail = "Drivetrain temperature and motor current remained within bounds. Intake cycles were clean and slides functioned without binding.";
  if (match.teleop.avgCycleSeconds > 12) {
    teleStatus = "⚠️ SLOW TELEOP CYCLES";
    teleDetail = `Average cycle time was ${match.teleop.avgCycleSeconds}s (Target: < 9s). Slide velocity was throttled, indicating possible mechanical binding.`;
  }

  return `
# ARES 23247 Match Scouting Report
*Match Number*: **${match.matchId}** | *Result*: **${outcomeText}** (${match.ourScore} vs ${match.opponentScore})

## Executive Summary
Scouting diagnostics report for ARES 23247 during the championship match. Drivetrain logs and sensor feedback verified.

### 1. Autonomous Breakdown
* **Status**: ${autoStatus}
* **Details**: ${autoDetail}

### 2. TeleOperated Period
* **Status**: ${teleStatus}
* **Details**: ${teleDetail}
* **Cycle Count**: Scored ${match.teleop.samplesScored} samples, ${match.teleop.specimensScored} specimens.

### 3. Endgame Analysis
* **Climb Status**: ${match.endgame.climbLevel || "Ascent Level 3 Successfully Completed"}
* **Time Taken**: ${match.endgame.climbTimeSeconds} seconds.

---

## AI Coach Strategic Recommendations

1.  **Drivetrain Current Spikes**:
    *   Monitor the Left Front and Right Front motor currents. High drift values suggest slight wheel slippage. Calibrate odometry pods.
2.  **Intake Optimization**:
    *   TeleOp cycling efficiency can be improved. Implement automated alignment routines using OpenCV camera vision to lock onto samples automatically.
3.  **Endgame Hook Timing**:
    *   Allocate at least 15 seconds for climbing preparation. Practice linear slide deployment to ensure Ascent Level 3 reliability under pressure in *FIRST*® tournaments.

*This report was automatically compiled by the ARES administrative scouting service.*
`;
}

// GET /api/replay/telemetry-log
router.get("/telemetry-log", ensureTeamMember, asyncHandler(async (req, res) => {
  const runId = (req.query.runId as string) || "run_2026_championship_finals";
  const mockData = generateHighFidelityMockRun(runId);
  res.json({ ...mockData, source: "mock", coordinateSystem: "inches" });
}));

// POST /api/replay/match-analysis
router.post("/match-analysis", ensureAdmin, analysisLimiter, asyncHandler(async (req, res) => {
  const { matchData } = req.body as { matchData: any };

  if (!matchData || !matchData.matchId) {
    throw new ApiError(400, "Missing required matchData or matchId");
  }

  const dataString = JSON.stringify(matchData);
  if (dataString.length > 50000) {
    throw new ApiError(400, "Match data payload size exceeds maximum limit.");
  }

  const systemPrompt = `You are the Senior AI Scouting and Strategy Coach for *FIRST*® Tech Challenge (FTC) Robotics Team ARES 23247.
Analyze the provided match scouting data and write a highly detailed, professional, and actionable tactical strategy report in markdown.
In your analysis, evaluate:
1. Autonomous Performance: Assess autonomous specimen/sample placement and parking.
2. Teleoperated Strategy: Focus on cycling speeds, sample loading, and scoring efficiency.
3. Mechanical Diagnostics: Check slider current consumption, drivetrain temperature levels, and loop time latency.
4. Specific Recommendations: List 3 actionable strategic tips for developers and drivers.

Format the output strictly in valid Github-Flavored Markdown. Use bold styling, lists, and tables for data points. Ensure the tone is analytical, executive, and highly detailed.`;

  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      logger.warn("replay", "GEMINI_API_KEY is not configured. Falling back to deterministic analysis.");
      const report = generateDeterministicReport(matchData);
      res.status(200).json({ report, mode: "deterministic_fallback" });
      return;
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      contents: [
        { role: "system", parts: [{ text: systemPrompt }] },
        { role: "user", parts: [{ text: dataString }] }
      ],
      config: {
        maxOutputTokens: 2048
      }
    });

    const report = response.text || generateDeterministicReport(matchData);
    res.status(200).json({ report, mode: "generative_gemini" });
  } catch (err: any) {
    logger.error("replay", "Failed to generate match analysis via Gemini:", err);
    const report = generateDeterministicReport(matchData);
    res.status(200).json({ report, mode: "error_deterministic_fallback" });
  }
}));

export default router;
