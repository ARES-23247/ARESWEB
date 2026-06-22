import express from "express";
import { BigQuery } from "@google-cloud/bigquery";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { ensureTeamMember } from "../middleware/auth";

const router = express.Router();
const bqProject = process.env.GCP_PROJECT_ID || "ares-web-preview";
const bigquery = new BigQuery({ projectId: bqProject });

// GET /api/replay/:runId/summary
router.get("/:runId/summary", ensureTeamMember, asyncHandler(async (req, res) => {
  const { runId } = req.params;
  
  // Try Firestore first
  const runDoc = await adminDb.collection("telemetry_runs").doc(runId).get();
  if (runDoc.exists) {
    res.status(200).json(runDoc.data());
    return;
  }

  // Fallback: Query BigQuery metadata
  try {
    const query = `
      SELECT MIN(timestamp_ms) as startTime, MAX(timestamp_ms) as endTime, COUNT(*) as ticks, robot_id, match_number, alliance
      FROM \`telemetry.robot_states\`
      WHERE run_id = @runId
      GROUP BY robot_id, match_number, alliance
    `;
    const [rows] = await bigquery.query({
      query,
      params: { runId }
    });
    
    if (rows.length === 0) {
      throw new ApiError(404, `Run ${runId} not found in BigQuery.`);
    }

    const row = rows[0];
    const durationSeconds = (row.endTime - row.startTime) / 1000.0;
    const summary = {
      runId,
      robotId: row.robot_id,
      matchNumber: row.match_number,
      alliance: row.alliance,
      durationSeconds: parseFloat(durationSeconds.toFixed(1)),
      totalTicks: row.ticks,
      createdAt: new Date(row.startTime).toISOString()
    };
    res.status(200).json(summary);
  } catch (err: any) {
    throw new ApiError(500, `Failed to query BigQuery summary: ${err.message}`);
  }
}));

// GET /api/replay/:runId/states
router.get("/:runId/states", ensureTeamMember, asyncHandler(async (req, res) => {
  const { runId } = req.params;
  const start = parseInt(req.query.start as string) || 0;
  const end = parseInt(req.query.end as string) || 7500;

  try {
    const query = `
      SELECT state_json, tick_index, timestamp_ms FROM \`telemetry.robot_states\`
      WHERE run_id = @runId
      AND tick_index >= @start AND tick_index <= @end
      ORDER BY tick_index ASC
    `;
    const [rows] = await bigquery.query({
      query,
      params: { runId, start, end }
    });
    
    const states = rows.map(r => JSON.parse(r.state_json));
    res.status(200).json(states);
  } catch (err: any) {
    throw new ApiError(500, `Failed to query states: ${err.message}`);
  }
}));

// GET /api/replay/:runId/actions
router.get("/:runId/actions", ensureTeamMember, asyncHandler(async (req, res) => {
  const { runId } = req.params;
  try {
    const query = `
      SELECT action_type, payload_json, timestamp_us FROM \`telemetry.robot_actions\`
      WHERE run_id = @runId
      ORDER BY timestamp_us ASC
    `;
    const [rows] = await bigquery.query({
      query,
      params: { runId }
    });

    const actions = rows.map(r => ({
      type: r.action_type,
      timestampUs: r.timestamp_us,
      payload: JSON.parse(r.payload_json)
    }));
    res.status(200).json(actions);
  } catch (err: any) {
    throw new ApiError(500, `Failed to query actions: ${err.message}`);
  }
}));

// GET /api/replay/:runId/inputs
// Serves JSONL back to local desktop replay runner
router.get("/:runId/inputs", ensureTeamMember, asyncHandler(async (req, res) => {
  const { runId } = req.params;
  try {
    const query = `
      SELECT timestamp_ms, odometry_json, imu_json, vision_json, swerve_json, run_id, robot_id
      FROM \`telemetry.robot_inputs\`
      WHERE run_id = @runId
      ORDER BY timestamp_ms ASC
    `;
    const [rows] = await bigquery.query({
      query,
      params: { runId }
    });

    res.setHeader("Content-Type", "application/x-jsonlines");
    res.setHeader("Transfer-Encoding", "chunked");

    for (const row of rows) {
      const frame = {
        runId: row.run_id,
        robotId: row.robot_id,
        timestampMs: row.timestamp_ms,
        odometryInputs: JSON.parse(row.odometry_json || "{}"),
        imuInputs: JSON.parse(row.imu_json || "{}"),
        visionInputs: JSON.parse(row.vision_json || "{}"),
        swerveInputs: JSON.parse(row.swerve_json || "[]")
      };
      res.write(JSON.stringify(frame) + "\n");
    }
    res.end();
  } catch (err: any) {
    throw new ApiError(500, `Failed to stream inputs: ${err.message}`);
  }
}));

// GET /api/replay/:runId/motors
router.get("/:runId/motors", ensureTeamMember, asyncHandler(async (req, res) => {
  const { runId } = req.params;
  const motorId = req.query.motorId as string;
  try {
    let query = `
      SELECT timestamp_ms, motor_id, voltage, current, temperature, position, velocity
      FROM \`telemetry.motor_telemetry\`
      WHERE run_id = @runId
    `;
    const params: any = { runId };
    
    if (motorId) {
      query += " AND motor_id = @motorId";
      params.motorId = motorId;
    }
    
    query += " ORDER BY timestamp_ms ASC";

    const [rows] = await bigquery.query({ query, params });
    res.status(200).json(rows);
  } catch (err: any) {
    throw new ApiError(500, `Failed to query motor telemetry: ${err.message}`);
  }
}));

// GET /api/replay/:runId/vision
router.get("/:runId/vision", ensureTeamMember, asyncHandler(async (req, res) => {
  const { runId } = req.params;
  try {
    const query = `
      SELECT timestamp_ms, tag_id, camera_id, raw_pose_json, accepted, rejection_reason, covariance_json
      FROM \`telemetry.vision_events\`
      WHERE run_id = @runId
      ORDER BY timestamp_ms ASC
    `;
    const [rows] = await bigquery.query({
      query,
      params: { runId }
    });

    const events = rows.map(r => ({
      timestampMs: r.timestamp_ms,
      tagId: r.tag_id,
      cameraId: r.camera_id,
      rawPose: JSON.parse(r.raw_pose_json || "{}"),
      accepted: r.accepted,
      rejectionReason: r.rejection_reason,
      covariance: JSON.parse(r.covariance_json || "{}")
    }));
    res.status(200).json(events);
  } catch (err: any) {
    throw new ApiError(500, `Failed to query vision events: ${err.message}`);
  }
}));

export default router;
