"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bigquery_1 = require("@google-cloud/bigquery");
const firebase_admin_1 = require("../lib/firebase-admin");
const auth_1 = require("../middleware/auth");
const vertex_1 = require("../lib/vertex");
const router = express_1.default.Router();
// POST /api/upload
router.post("/", auth_1.ensureAdmin, async (req, res) => {
    try {
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
                    }
                    else if (part.includes('name="file"')) {
                        const headerEndIndex = part.indexOf("\r\n\r\n");
                        if (headerEndIndex !== -1) {
                            csvText = part.slice(headerEndIndex + 4, part.lastIndexOf("\r\n")).trim();
                        }
                    }
                }
            }
        }
        else {
            csvText = req.body.toString();
            const opHeader = req.headers["x-opmode"];
            if (opHeader)
                opModeName = Array.isArray(opHeader) ? opHeader[0] : opHeader;
        }
        if (!csvText || csvText.trim().length === 0) {
            res.status(400).json({ error: "Empty CSV data uploaded." });
            return;
        }
        const runId = `run_${Date.now()}`;
        const lines = csvText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) {
            res.status(400).json({ error: "Invalid CSV format: requires header and data." });
            return;
        }
        const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
        const dataRows = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map(v => parseFloat(v.trim()) || 0);
            const row = {};
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
            if (row.battery_voltage < minBatteryVoltage)
                minBatteryVoltage = row.battery_voltage;
            const driftCm = Math.sqrt(row.ekf_drift_x * row.ekf_drift_x + row.ekf_drift_y * row.ekf_drift_y);
            if (driftCm > maxEkfDriftCm)
                maxEkfDriftCm = driftCm;
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
        // SCA-F02 Optimization: Return 202 Accepted immediately, do background processing!
        res.status(202).json({
            success: true,
            runId,
            summary,
            message: "Telemetry uploaded. Parsing, archiving, and Vertex diagnostics running in background."
        });
        // Background Ingestion Flow
        (async () => {
            try {
                // 1. Archive CSV to GCS
                try {
                    const bucket = firebase_admin_1.adminStorage.bucket();
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
                    console.log(`[Storage Background] Raw telemetry run saved: ${runId}`);
                }
                catch (err) {
                    console.warn("[Storage Background] Cloud Storage GCS save failed.");
                }
                // 2. BigQuery logging
                try {
                    const bqProject = process.env.GCP_PROJECT_ID || "ares-web-preview";
                    const bigquery = new bigquery_1.BigQuery({ projectId: bqProject });
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
                    console.log(`[BigQuery Background] Streamed timeseries rows for run: ${runId}`);
                }
                catch (err) {
                    console.warn("[BigQuery Background] Streaming failed or bypassed.");
                }
                // 3. Gemini analysis
                const markdownReport = await (0, vertex_1.runTelemetryDiagnostics)(summary);
                // 4. Save to Firestore runs index
                await firebase_admin_1.adminDb.collection("telemetry_runs").doc(runId).set({
                    ...summary,
                    createdAt: new Date().toISOString()
                });
                // 5. Save report to Firestore reports collection
                await firebase_admin_1.adminDb.collection("telemetry_reports").doc(runId).set({
                    runId,
                    opModeName,
                    report: markdownReport,
                    createdAt: new Date().toISOString()
                });
                console.log(`[Firestore Background] Telemetry runs and diagnostic report saved for ${runId}`);
            }
            catch (bgErr) {
                console.error("[Telemetry Ingestion Background Error]:", bgErr);
            }
        })();
    }
    catch (error) {
        console.error("Telemetry upload error:", error);
        res.status(500).json({ error: "Server failed to process telemetry upload." });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map