import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { BigQuery } from "@google-cloud/bigquery";
import admin from "@/lib/firebase-admin";
import { runTelemetryDiagnostics } from "@/lib/vertex";

interface CSVRow {
  timestamp_ms: number;
  battery_voltage: number;
  motor_lf_current: number;
  motor_rf_current: number;
  motor_lr_current: number;
  motor_rr_current: number;
  pinpoint_x: number;
  pinpoint_y: number;
  pinpoint_heading: number;
  ekf_drift_x: number;
  ekf_drift_y: number;
  loop_time_ms: number;
}

const bigquery = new BigQuery({
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ares-web-preview"
});

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let csvText = "";
    let opModeName = "AutonomousField";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      opModeName = (formData.get("opMode") as string) || "AutonomousField";
      
      if (!file) {
        return NextResponse.json({ error: "Missing file payload in form data." }, { status: 400 });
      }
      csvText = await file.text();
    } else {
      // Direct raw text upload fallback
      csvText = await req.text();
      const opHeader = req.headers.get("x-opmode");
      if (opHeader) opModeName = opHeader;
    }

    if (!csvText || csvText.trim().length === 0) {
      return NextResponse.json({ error: "Empty CSV data uploaded." }, { status: 400 });
    }

    const runId = `run_${Date.now()}`;
    const lines = csvText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length < 2) {
      return NextResponse.json({ error: "Invalid CSV format: requires header and data." }, { status: 400 });
    }

    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    const dataRows: CSVRow[] = [];

    // Parse CSV lines into timeseries rows
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

    // 1. Calculate Telemetry Run Summary
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

    // 2. Archive CSV to Firebase Cloud Storage (GCS)
    try {
      const bucket = admin.storage().bucket();
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
      console.log(`[Storage] Raw telemetry run saved: ${runId}`);
    } catch (err) {
      console.warn("[Storage] Cloud Storage not active or unconfigured in local sandbox. Proceeding locally.");
    }

    // 3. Stream Rows to Google BigQuery Columnar time-series
    try {
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

      await bigquery
        .dataset("telemetry")
        .table("runs_raw")
        .insert(bqRows);
      console.log(`[BigQuery] Streamed ${bqRows.length} timeseries rows successfully for run: ${runId}`);
    } catch (err) {
      console.warn("[BigQuery] Streaming failed or offline in local sandbox mode. Summary will persist locally in Firestore.");
    }

    // 4. Generate AI Diagnostics Report (Vertex AI Gemini 1.5 Pro)
    const markdownReport = await runTelemetryDiagnostics(summary);

    // 5. Persist Summary and Report in Firestore
    await adminDb.collection("telemetry_runs").doc(runId).set({
      ...summary,
      createdAt: new Date().toISOString()
    });

    await adminDb.collection("telemetry_reports").doc(runId).set({
      runId,
      opModeName,
      report: markdownReport,
      createdAt: new Date().toISOString()
    });

    console.log(`[Firestore] Saved telemetry summary and Gemini diagnostic report for run: ${runId}`);

    return NextResponse.json({
      success: true,
      runId,
      summary,
      report: markdownReport
    }, { status: 201 });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Telemetry upload route error:", msg);
    return NextResponse.json({ error: `Server failed to process telemetry upload: ${msg}` }, { status: 500 });
  }
}
