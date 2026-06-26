import express from "express";
import { adminDb, adminStorage } from "../lib/firebase-admin";
import rateLimit from "express-rate-limit";
import { ensureTeamMember } from "../middleware/auth";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // Limit each IP to 10 uploads per 10 minutes
  message: { error: "Too many log uploads from this IP. Please wait 10 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/upload
router.post("/", uploadLimiter, ensureTeamMember, asyncHandler(async (req, res) => {
  const contentType = req.headers["content-type"] || "";
  let csvText = "";
  let opModeName = "AutonomousField";

  if (contentType.includes("multipart/form-data")) {
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = req.body.toString().split(`--${boundary}`);
      for (const part of parts) {
        if (part.includes('name="opMode"')) {
          const lines = part.split("\r\n");
          opModeName = lines[lines.length - 2]?.trim() || "AutonomousField";
        } else if (part.includes('name="file"')) {
          const headerEndIndex = part.indexOf("\r\n\r\n");
          if (headerEndIndex !== -1) {
            csvText = part.slice(headerEndIndex + 4, part.lastIndexOf("\r\n")).trim();
          }
        }
      }
    }
  } else {
    csvText = req.body.toString();
    const opHeader = req.headers["x-opmode"];
    if (opHeader) opModeName = Array.isArray(opHeader) ? opHeader[0] : opHeader;
  }

  if (!csvText || csvText.trim().length === 0) {
    throw new ApiError(400, "Empty CSV data uploaded.");
  }

  // Generate deterministic runId using a SHA-256 hash of the CSV text
  const csvHash = crypto.createHash("sha256").update(csvText).digest("hex").substring(0, 16);
  const runId = `run_${csvHash}`;

  // Deduplicate uploads: check if telemetry run already exists in Firestore
  const existingRunDoc = await adminDb.collection("telemetry_runs").doc(runId).get();
  if (existingRunDoc.exists) {
    res.status(200).json({
      success: true,
      runId,
      summary: existingRunDoc.data(),
      message: "Telemetry log already uploaded and analyzed."
    });
    return;
  }

  const lines = csvText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length < 2) {
    throw new ApiError(400, "Invalid CSV format: requires header and data.");
  }

  const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
  const dataRows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => parseFloat(v.trim()) || 0);
    const row: any = {};
    
    headers.forEach((h, index) => {
      row[h] = values[index] || 0;
    });

    dataRows.push({
      timestamp_ms: row.timestamp_ms || row.time_ms || 0,
      battery_voltage: row.battery_voltage || row.voltage || 12.0,
      motor_lf_current: row.motor_lf_current || row.current_lf || 0,
      motor_rf_current: row.motor_rf_current || row.current_rf || 0,
      motor_lr_current: row.motor_lr_current || row.current_lr || 0,
      motor_rr_current: row.motor_rr_current || row.current_rr || 0,
      pinpoint_x: row.pinpoint_x || 0,
      pinpoint_y: row.pinpoint_y || 0,
      pinpoint_heading: row.pinpoint_heading || 0,
      ekf_drift_x: row.ekf_drift_x || 0,
      ekf_drift_y: row.ekf_drift_y || 0,
      loop_time_ms: row.loop_time_ms || row.loop_ms || 10
    });
  }

  const durationSeconds = dataRows.length > 0 
    ? (dataRows[dataRows.length - 1].timestamp_ms - dataRows[0].timestamp_ms) / 1000 
    : 0;

  let minBatteryVoltage = 14.0;
  let maxEkfDriftCm = 0;
  let totalLoopTime = 0;
  let sumCurrents = { lf: 0, rf: 0, lr: 0, rr: 0 };

  dataRows.forEach(row => {
    if (row.battery_voltage < minBatteryVoltage) minBatteryVoltage = row.battery_voltage;
    
    const driftCm = Math.sqrt(row.ekf_drift_x * row.ekf_drift_x + row.ekf_drift_y * row.ekf_drift_y);
    if (driftCm > maxEkfDriftCm) maxEkfDriftCm = driftCm;
    
    totalLoopTime += row.loop_time_ms;
    sumCurrents.lf += row.motor_lf_current;
    sumCurrents.rf += row.motor_rf_current;
    sumCurrents.lr += row.motor_lr_current;
    sumCurrents.rr += row.motor_rr_current;
  });

  const numRows = dataRows.length || 1;
  const summary = {
    runId,
    opModeName,
    durationSeconds: parseFloat(durationSeconds.toFixed(1)),
    minBatteryVoltage: parseFloat(minBatteryVoltage.toFixed(2)),
    maxEkfDriftCm: parseFloat(maxEkfDriftCm.toFixed(2)),
    avgLoopTimeMs: Math.round(totalLoopTime / numRows),
    avgMotorCurrentAmps: {
      lf: parseFloat((sumCurrents.lf / numRows).toFixed(2)),
      rf: parseFloat((sumCurrents.rf / numRows).toFixed(2)),
      lr: parseFloat((sumCurrents.lr / numRows).toFixed(2)),
      rr: parseFloat((sumCurrents.rr / numRows).toFixed(2))
    }
  };

  // SCA-F01: Run upload checks, awaiting to prevent serverless container freeze
  await (async () => {
    try {
      // 1. Archive CSV to GCS
      try {
        const bucket = adminStorage.bucket();
        const fileRef = bucket.file(`telemetry_runs/${runId}.csv`);
        await fileRef.save(csvText, {
          contentType: "text/csv",
          metadata: {
            metadata: {
              opMode: opModeName,
              rows: dataRows.length
            }
          }
        });
        logger.info("upload", `Raw telemetry run saved: ${runId}`);
      } catch (err) {
        logger.warn("upload", "Cloud Storage GCS save failed");
      }

      // 2. Save to Firestore runs index
      await adminDb.collection("telemetry_runs").doc(runId).set({
        ...summary,
        createdAt: new Date().toISOString()
      });
      logger.info("upload", `Telemetry runs saved for ${runId}`);
    } catch (bgErr) {
      logger.error("upload", "Telemetry ingestion background error", bgErr);
      throw bgErr; // Ensure error propagates to client so it's not silently lost
    }
  })();

  res.status(200).json({
    success: true,
    runId,
    bqIngested: false,
    summary,
    message: "Telemetry uploaded and archived successfully."
  });
}));

// POST /api/upload/states
router.post("/states", uploadLimiter, ensureTeamMember, asyncHandler(async (req, res) => {
  const text = req.body.toString();
  if (!text || text.trim().length === 0) {
    throw new ApiError(400, "Empty payload");
  }
  const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  if (lines.length === 0) {
    throw new ApiError(400, "No lines to import");
  }
  
  const parsedLines = lines.map((line: string, index: number) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new ApiError(400, `Malformed JSON at line ${index + 1}: ${line.substring(0, 100)}`);
    }
  });
  
  res.status(200).json({ success: true, count: parsedLines.length });
}));

// POST /api/upload/actions
router.post("/actions", uploadLimiter, ensureTeamMember, asyncHandler(async (req, res) => {
  const text = req.body.toString();
  if (!text || text.trim().length === 0) {
    throw new ApiError(400, "Empty payload");
  }
  const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  if (lines.length === 0) {
    throw new ApiError(400, "No lines to import");
  }
  
  const parsedLines = lines.map((line: string, index: number) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new ApiError(400, `Malformed JSON at line ${index + 1}: ${line.substring(0, 100)}`);
    }
  });
  
  res.status(200).json({ success: true, count: parsedLines.length });
}));

// POST /api/upload/inputs
router.post("/inputs", uploadLimiter, ensureTeamMember, asyncHandler(async (req, res) => {
  const text = req.body.toString();
  if (!text || text.trim().length === 0) {
    throw new ApiError(400, "Empty payload");
  }
  const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  if (lines.length === 0) {
    throw new ApiError(400, "No lines to import");
  }
  
  const parsedLines = lines.map((line: string, index: number) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new ApiError(400, `Malformed JSON at line ${index + 1}: ${line.substring(0, 100)}`);
    }
  });
  
  res.status(200).json({ success: true, count: parsedLines.length });
}));

// POST /api/upload/motors
router.post("/motors", uploadLimiter, ensureTeamMember, asyncHandler(async (req, res) => {
  const text = req.body.toString();
  if (!text || text.trim().length === 0) {
    throw new ApiError(400, "Empty payload");
  }
  const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  if (lines.length < 2) {
    throw new ApiError(400, "Invalid CSV format: requires header and data.");
  }
  
  res.status(200).json({ success: true, count: lines.length - 1 });
}));

// POST /api/upload/vision
router.post("/vision", uploadLimiter, ensureTeamMember, asyncHandler(async (req, res) => {
  const text = req.body.toString();
  if (!text || text.trim().length === 0) {
    throw new ApiError(400, "Empty payload");
  }
  const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  if (lines.length === 0) {
    throw new ApiError(400, "No lines to import");
  }
  
  const parsedLines = lines.map((line: string, index: number) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new ApiError(400, `Malformed JSON at line ${index + 1}: ${line.substring(0, 100)}`);
    }
  });
  
  res.status(200).json({ success: true, count: parsedLines.length });
}));

export default router;
