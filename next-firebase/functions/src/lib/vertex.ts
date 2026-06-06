import { GoogleGenAI } from "@google/genai";

interface TelemetrySummary {
  runId: string;
  opModeName: string;
  durationSeconds: number;
  minBatteryVoltage: number;
  maxEkfDriftCm: number;
  avgLoopTimeMs: number;
  avgMotorCurrentAmps: {
    lf: number;
    rf: number;
    lr: number;
    rr: number;
  };
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy-gemini-key"
});

/**
 * Runs hardware and sensor diagnostics on robot run telemetry.
 * Leverages Gemini 1.5 Pro, falling back to a deterministic local rule engine if offline.
 */
export async function runTelemetryDiagnostics(summary: TelemetrySummary): Promise<string> {
  const systemPrompt = `You are a Senior FIRST® Tech Challenge (FTC) Robotics Hardware & Software Diagnostics engineer. 
Analyze telemetry run summaries from our robot and provide a highly detailed, professional engineering report in markdown.
In your analysis, evaluate:
1. Battery Health: Assess voltage sags. Warning if under 11.5V, critical if under 11.0V.
2. Sensor Drift (Odometry): Check maximum GoBilda Pinpoint EKF drift. Warning if over 1.5cm, critical if over 3.0cm.
3. Drivetrain Motor Draws: Look for currents imbalances between Mecanum motors (lf, rf, lr, rr). Imbalances > 15% indicate binding.
4. Loop Performance: Assess average loop times. Healthy is < 20ms, warning is > 30ms.

Ensure that all team and organizational references follow the ARES branding guidelines:
- Always refer to FIRST® (italicized with registered trademark symbol).
- Refer to our software library as ARESLib (one word, capital L).`;

  const userPrompt = `Robot Telemetry Run: ${summary.runId}
- OpMode: ${summary.opModeName}
- Duration: ${summary.durationSeconds} seconds
- Minimum Battery Voltage: ${summary.minBatteryVoltage}V
- Maximum EKF Odometry Drift: ${summary.maxEkfDriftCm} cm
- Average Loop Time: ${summary.avgLoopTimeMs} ms
- Drivetrain Motor Current Averages (Amps):
  * Left Front (LF): ${summary.avgMotorCurrentAmps.lf}A
  * Right Front (RF): ${summary.avgMotorCurrentAmps.rf}A
  * Left Rear (LR): ${summary.avgMotorCurrentAmps.lr}A
  * Right Rear (RR): ${summary.avgMotorCurrentAmps.rr}A`;

  try {
    // If the API key is a dummy or not set, skip directly to fallback to prevent slow network timeouts
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "dummy-gemini-key") {
      throw new Error("No valid GEMINI_API_KEY configured.");
    }

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
      ]
    });

    const report = response.text || "";
    if (!report) throw new Error("Empty response from Gemini.");
    
    return report;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Vertex AI] Gemini diagnostics offline/failed: ${errorMsg}. Invoking local seeder fallback.`);
    
    // Deterministic Rule-Based Fallback Engine (Zero-Downtime Guarantee)
    return generateDeterministicReport(summary);
  }
}

/**
 * Deterministic local analytics generator simulating Gemini 1.5 Pro diagnostic reports.
 * Ensures the platform is fully testable and compile-safe offline.
 */
function generateDeterministicReport(summary: TelemetrySummary): string {
  const currentDraws = summary.avgMotorCurrentAmps;
  const avgCurrent = (currentDraws.lf + currentDraws.rf + currentDraws.lr + currentDraws.rr) / 4;
  
  // Calculate motor drawing imbalances relative to average
  const lfDiff = Math.abs(currentDraws.lf - avgCurrent) / avgCurrent;
  const rfDiff = Math.abs(currentDraws.rf - avgCurrent) / avgCurrent;
  const lrDiff = Math.abs(currentDraws.lr - avgCurrent) / avgCurrent;
  const rrDiff = Math.abs(currentDraws.rr - avgCurrent) / avgCurrent;
  const maxImbalance = Math.max(lfDiff, rfDiff, lrDiff, rrDiff) * 100;

  // Evaluate battery sag status
  let batteryStatus = "🟢 HEALTHY";
  let batteryDetail = "Excellent voltage retention. No sign of cell degradation or excessive motor stalling.";
  if (summary.minBatteryVoltage < 11.0) {
    batteryStatus = "🔴 CRITICAL SAG";
    batteryDetail = `Significant battery sag detected (${summary.minBatteryVoltage}V). This indicates severe cell strain under acceleration, risking a Control Hub brownout. Immediately swap this battery.`;
  } else if (summary.minBatteryVoltage < 11.5) {
    batteryStatus = "🟡 WARNING";
    batteryDetail = `Moderate battery sag observed (${summary.minBatteryVoltage}V). Retain this battery for testing, but do not use it in official match simulations.`;
  }

  // Evaluate sensor drift
  let driftStatus = "🟢 HEALTHY";
  let driftDetail = "GoBilda Pinpoint EKF odometry tracks coordinate paths with outstanding precision. Localization error is minimal.";
  if (summary.maxEkfDriftCm > 3.0) {
    driftStatus = "🔴 SEVERE DRIFT";
    driftDetail = `Sensor drift reached ${summary.maxEkfDriftCm} cm! Verify wheel encoder pods are properly spring-loaded and check I2C I/O lines for heading signal noise.`;
  } else if (summary.maxEkfDriftCm > 1.5) {
    driftStatus = "🟡 MODERATE DRIFT";
    driftDetail = `Slight odometry drift detected (${summary.maxEkfDriftCm} cm). Ensure that the EKF covariance matrix settings in **ARESLib** are calibrated.`;
  }

  // Evaluate drivetrain current draws
  let drivetrainStatus = "🟢 BALANCED";
  let drivetrainDetail = "All four motors draw symmetrical currents. Drive assemblies run smoothly without physical binding.";
  if (maxImbalance > 15) {
    drivetrainStatus = "🟡 IMBLANCED BINDING";
    drivetrainDetail = `Drivetrain current draw imbalance peaked at ${maxImbalance.toFixed(1)}%. Motor draws are asymmetrical. Check structural alignments on high-drawing wheels to prevent gear shaving.`;
  }

  // Evaluate software loop speed
  let loopStatus = "🟢 FAST";
  let loopDetail = "Software cycle time is optimal, providing steady velocity updates.";
  if (summary.avgLoopTimeMs > 30) {
    loopStatus = "🔴 OVERRUN WARNING";
    loopDetail = `Average loop cycle reached ${summary.avgLoopTimeMs} ms. CPU cycles are overloaded. Refactor telemetry write operations inside telemetry loops in **ARESLib** to prevent control lag.`;
  }

  return `# ARES 23247 Automated Telemetry Diagnostic Report

**Report ID**: \`diag_${summary.runId}\`
**OpMode Target**: \`${summary.opModeName}\`
**Run Duration**: \`${summary.durationSeconds}s\`

---

## 📊 Performance Metrics Dashboard

### 1. Battery Health & Sags — ${batteryStatus}
*   **Minimum Recorded Voltage**: \`${summary.minBatteryVoltage}V\`
*   **Assessment**: ${batteryDetail}

### 2. Sensor Fusion & EKF Odometry — ${driftStatus}
*   **Peak Position Drift**: \`${summary.maxEkfDriftCm} cm\`
*   **Assessment**: ${driftDetail}
*   *Note*: The *FIRST*® field-centric control checks in **ARESLib** rely on zero-drift parameters to guarantee pathing accuracy.

### 3. Drivetrain Mechanical Friction — ${drivetrainStatus}
*   **Left Front (LF)**: \`${currentDraws.lf}A\` | **Right Front (RF)**: \`${currentDraws.rf}A\`
*   **Left Rear (LR)**: \`${currentDraws.lr}A\` | **Right Rear (RR)**: \`${currentDraws.rr}A\`
*   **Assessment**: ${drivetrainDetail}

### 4. Software Loop Cycle Times — ${loopStatus}
*   **Average Cycle Time**: \`${summary.avgLoopTimeMs} ms\`
*   **Assessment**: ${loopDetail}

---

## 🛠️ Summary Recommendations
${
  summary.minBatteryVoltage < 11.5 || summary.maxEkfDriftCm > 1.5 || maxImbalance > 15 || summary.avgLoopTimeMs > 30
    ? `⚠️ **Action Required**: Resolve the flagged metrics above to ensure our autonomous and field-centric TeleOp routines perform with championship-level efficiency.`
    : `✨ **System Nominal**: All sensors, software loops, and drivetrain components are performing optimally. Excellent run!`
}
`;
}
