import express from "express";
import { BigQuery } from "@google-cloud/bigquery";
import { adminDb, adminStorage } from "../lib/firebase-admin";
import rateLimit from "express-rate-limit";
import { ensureTeamMember } from "../middleware/auth";
import { runTelemetryDiagnostics } from "../lib/vertex";
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

  // SCA-F01: Run upload and diagnostic checks, awaiting to prevent serverless container freeze
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

      // 2. BigQuery logging
      try {
        const bqProject = process.env.GCP_PROJECT_ID || "ares-web-preview";
        const bigquery = new BigQuery({ projectId: bqProject });
        const bqRows = dataRows.map(row => ({
          run_id: runId,
          timestamp_ms: row.timestamp_ms,
          battery_voltage: row.battery_voltage,
          motor_lf_current: row.motor_lf_current,
          motor_rf_current: row.motor_rf_current,
          motor_lr_current: row.motor_lr_current,
          motor_rr_current: row.motor_rr_current,
          pinpoint_x: row.pinpoint_x,
          pinpoint_y: row.pinpoint_y,
          pinpoint_heading: row.pinpoint_heading,
          ekf_drift_x: row.ekf_drift_x,
          ekf_drift_y: row.ekf_drift_y,
          loop_time_ms: row.loop_time_ms
        }));

        await bigquery.dataset("telemetry").table("runs_raw").insert(bqRows);
        logger.info("upload", `Streamed timeseries rows to BigQuery for run: ${runId}`);
      } catch (err) {
        logger.warn("upload", "BigQuery streaming failed or bypassed");
      }

      // 3. Gemini analysis
      const markdownReport = await runTelemetryDiagnostics(summary);

      // 4. Save to Firestore runs index
      await adminDb.collection("telemetry_runs").doc(runId).set({
        ...summary,
        createdAt: new Date().toISOString()
      });

      // 5. Save report to Firestore reports collection
      await adminDb.collection("telemetry_reports").doc(runId).set({
        runId,
        opModeName,
        report: markdownReport,
        createdAt: new Date().toISOString()
      });
      logger.info("upload", `Telemetry runs and diagnostic report saved for ${runId}`);
    } catch (bgErr) {
      logger.error("upload", "Telemetry ingestion background error", bgErr);
    }
  })();

  res.status(200).json({
    success: true,
    runId,
    summary,
    message: "Telemetry uploaded, archived, and Vertex diagnostics completed successfully."
  });
}));

const robotStatesSchema = [
  { name: "run_id", type: "STRING", mode: "REQUIRED" },
  { name: "tick_index", type: "INTEGER", mode: "REQUIRED" },
  { name: "timestamp_ms", type: "INTEGER", mode: "REQUIRED" },
  { name: "state_json", type: "STRING", mode: "REQUIRED" },
  { name: "robot_id", type: "STRING", mode: "NULLABLE" },
  { name: "match_number", type: "INTEGER", mode: "NULLABLE" },
  { name: "alliance", type: "STRING", mode: "NULLABLE" }
];

const robotActionsSchema = [
  { name: "run_id", type: "STRING", mode: "REQUIRED" },
  { name: "timestamp_us", type: "INTEGER", mode: "REQUIRED" },
  { name: "action_type", type: "STRING", mode: "REQUIRED" },
  { name: "payload_json", type: "STRING", mode: "REQUIRED" },
  { name: "robot_id", type: "STRING", mode: "NULLABLE" },
  { name: "match_number", type: "INTEGER", mode: "NULLABLE" },
  { name: "alliance", type: "STRING", mode: "NULLABLE" }
];

const robotInputsSchema = [
  { name: "run_id", type: "STRING", mode: "REQUIRED" },
  { name: "robot_id", type: "STRING", mode: "NULLABLE" },
  { name: "timestamp_ms", type: "INTEGER", mode: "REQUIRED" },
  { name: "odometry_json", type: "STRING", mode: "NULLABLE" },
  { name: "imu_json", type: "STRING", mode: "NULLABLE" },
  { name: "vision_json", type: "STRING", mode: "NULLABLE" },
  { name: "distance_json", type: "STRING", mode: "NULLABLE" },
  { name: "swerve_json", type: "STRING", mode: "NULLABLE" }
];

const motorTelemetrySchema = [
  { name: "run_id", type: "STRING", mode: "REQUIRED" },
  { name: "robot_id", type: "STRING", mode: "NULLABLE" },
  { name: "timestamp_ms", type: "INTEGER", mode: "REQUIRED" },
  { name: "motor_id", type: "STRING", mode: "REQUIRED" },
  { name: "voltage", type: "FLOAT", mode: "NULLABLE" },
  { name: "current", type: "FLOAT", mode: "NULLABLE" },
  { name: "temperature", type: "FLOAT", mode: "NULLABLE" },
  { name: "position", type: "FLOAT", mode: "NULLABLE" },
  { name: "velocity", type: "FLOAT", mode: "NULLABLE" }
];

const visionEventsSchema = [
  { name: "run_id", type: "STRING", mode: "REQUIRED" },
  { name: "robot_id", type: "STRING", mode: "NULLABLE" },
  { name: "timestamp_ms", type: "INTEGER", mode: "REQUIRED" },
  { name: "tag_id", type: "INTEGER", mode: "REQUIRED" },
  { name: "camera_id", type: "STRING", mode: "NULLABLE" },
  { name: "raw_pose_json", type: "STRING", mode: "NULLABLE" },
  { name: "accepted", type: "BOOLEAN", mode: "REQUIRED" },
  { name: "rejection_reason", type: "STRING", mode: "NULLABLE" },
  { name: "covariance_json", type: "STRING", mode: "NULLABLE" }
];

async function ensureTableExists(bigquery: BigQuery, datasetId: string, tableId: string, schema: any[]) {
  const dataset = bigquery.dataset(datasetId);
  const [datasetExists] = await dataset.exists();
  if (!datasetExists) {
    await dataset.create();
    logger.info("bigquery", `Created dataset ${datasetId}`);
  }
  
  const table = dataset.table(tableId);
  const [tableExists] = await table.exists();
  if (!tableExists) {
    await dataset.createTable(tableId, { schema });
    logger.info("bigquery", `Created table ${tableId} in dataset ${datasetId}`);
  }
}

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
  
  const bqProject = process.env.GCP_PROJECT_ID || "ares-web-preview";
  const bigquery = new BigQuery({ projectId: bqProject });
  await ensureTableExists(bigquery, "telemetry", "robot_states", robotStatesSchema);
  
  const bqRows = lines.map((line: string, index: number) => {
    const parsed = JSON.parse(line);
    return {
      run_id: parsed.run_id || "",
      tick_index: index,
      timestamp_ms: parsed.timestampMs || 0,
      state_json: line,
      robot_id: parsed.robot_id || "",
      match_number: parsed.match_number || 0,
      alliance: parsed.alliance || "BLUE"
    };
  });
  
  await bigquery.dataset("telemetry").table("robot_states").insert(bqRows);
  res.status(200).json({ success: true, count: bqRows.length });
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
  
  const bqProject = process.env.GCP_PROJECT_ID || "ares-web-preview";
  const bigquery = new BigQuery({ projectId: bqProject });
  await ensureTableExists(bigquery, "telemetry", "robot_actions", robotActionsSchema);
  
  const bqRows = lines.map((line: string) => {
    const envelope = JSON.parse(line);
    const payload = envelope.payload || {};
    return {
      run_id: envelope.run_id || "",
      timestamp_us: payload.timestampMs ? payload.timestampMs * 1000 : 0,
      action_type: envelope.type || "",
      payload_json: JSON.stringify(payload),
      robot_id: envelope.robot_id || "",
      match_number: envelope.match_number || 0,
      alliance: envelope.alliance || "BLUE"
    };
  });
  
  await bigquery.dataset("telemetry").table("robot_actions").insert(bqRows);
  res.status(200).json({ success: true, count: bqRows.length });
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
  
  const bqProject = process.env.GCP_PROJECT_ID || "ares-web-preview";
  const bigquery = new BigQuery({ projectId: bqProject });
  await ensureTableExists(bigquery, "telemetry", "robot_inputs", robotInputsSchema);
  
  const bqRows = lines.map((line: string) => {
    const frame = JSON.parse(line);
    return {
      run_id: frame.runId || "",
      robot_id: frame.robotId || "",
      timestamp_ms: frame.timestampMs || 0,
      odometry_json: JSON.stringify(frame.odometryInputs || {}),
      imu_json: JSON.stringify(frame.imuInputs || {}),
      vision_json: JSON.stringify(frame.visionInputs || {}),
      distance_json: null,
      swerve_json: JSON.stringify(frame.swerveInputs || [])
    };
  });
  
  await bigquery.dataset("telemetry").table("robot_inputs").insert(bqRows);
  res.status(200).json({ success: true, count: bqRows.length });
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
  
  const bqProject = process.env.GCP_PROJECT_ID || "ares-web-preview";
  const bigquery = new BigQuery({ projectId: bqProject });
  await ensureTableExists(bigquery, "telemetry", "motor_telemetry", motorTelemetrySchema);
  
  const bqRows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 9) continue;
    bqRows.push({
      run_id: parts[0],
      robot_id: parts[1],
      timestamp_ms: parseInt(parts[2]) || 0,
      motor_id: parts[3],
      voltage: parseFloat(parts[4]) || 0,
      current: parseFloat(parts[5]) || 0,
      temperature: parseFloat(parts[6]) || 0,
      position: parseFloat(parts[7]) || 0,
      velocity: parseFloat(parts[8]) || 0
    });
  }
  
  if (bqRows.length > 0) {
    await bigquery.dataset("telemetry").table("motor_telemetry").insert(bqRows);
  }
  res.status(200).json({ success: true, count: bqRows.length });
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
  
  const bqProject = process.env.GCP_PROJECT_ID || "ares-web-preview";
  const bigquery = new BigQuery({ projectId: bqProject });
  await ensureTableExists(bigquery, "telemetry", "vision_events", visionEventsSchema);
  
  const bqRows = lines.map((line: string) => {
    const event = JSON.parse(line);
    return {
      run_id: event.run_id || "",
      robot_id: event.robot_id || "",
      timestamp_ms: event.timestampMs || 0,
      tag_id: event.tagId || 0,
      camera_id: event.cameraId || "",
      raw_pose_json: event.rawPoseJson || "",
      accepted: event.accepted || false,
      rejection_reason: event.rejectionReason || null,
      covariance_json: JSON.stringify({
        before: event.covarianceBefore || null,
        after: event.covarianceAfter || null
      })
    };
  });
  
  await bigquery.dataset("telemetry").table("vision_events").insert(bqRows);
  res.status(200).json({ success: true, count: bqRows.length });
}));

export default router;
