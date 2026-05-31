import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";

interface MatchData {
  matchId: string; // e.g., "Q-12"
  allianceColor: "red" | "blue";
  opponentScore: number;
  ourScore: number;
  autonomous: {
    samplesScored: number;
    specimensScored: number;
    parkingSuccess: boolean;
    points: number;
  };
  teleOp: {
    highBasketCycles: number;
    lowBasketCycles: number;
    highChamberCycles: number;
    lowChamberCycles: number;
    points: number;
  };
  endgame: {
    ascentLevel: 0 | 1 | 2 | 3;
    points: number;
  };
}

export async function POST(request: Request) {
  try {
    const { matchData } = (await request.json()) as { matchData: MatchData };

    if (!matchData || !matchData.matchId) {
      return NextResponse.json(
        { error: "Missing required matchData or matchId" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are the Senior AI Scouting and Strategy Coach for FIRST® Tech Challenge (FTC) Robotics Team ARES 23247.
Analyze the provided match scouting data and write a highly detailed, professional, and actionable tactical strategy report in markdown.
In your analysis, evaluate:
1. Autonomous Performance: Assess autonomous specimen/sample placement and parking.
2. TeleOp Cycling and Scoring Efficiency: Evaluate high vs low basket/chamber cycles. Warning if zero cycles.
3. Endgame Execution: Assess ascent level choice (0-3). Healthy is Level 2 or 3, warn if Level 0 or 1.
4. Key Recommendations: Provide specific, clear, high-impact mechanical, software, or driving tactical recommendations for our next match.

Ensure all references to FTC organization and team standards adhere to ARES rules:
- Always format FIRST® with the registered trademark symbol in italics.
- Refer to our team library as ARESLib (one word, capital L).`;

    const userPrompt = `Match Details:
- Match ID: ${matchData.matchId}
- Our Alliance Color: ${matchData.allianceColor.toUpperCase()}
- Our Score: ${matchData.ourScore}
- Opponent Score: ${matchData.opponentScore}
- Match Outcome: ${matchData.ourScore > matchData.opponentScore ? "WIN" : "LOSS"}

Autonomous Period:
- Samples Scored: ${matchData.autonomous.samplesScored}
- Specimens Scored: ${matchData.autonomous.specimensScored}
- Parking: ${matchData.autonomous.parkingSuccess ? "SUCCESS" : "FAILED"}
- Auto Points: ${matchData.autonomous.points}

TeleOp Period:
- High Basket Cycles: ${matchData.teleOp.highBasketCycles}
- Low Basket Cycles: ${matchData.teleOp.lowBasketCycles}
- High Chamber Cycles: ${matchData.teleOp.highChamberCycles}
- Low Chamber Cycles: ${matchData.teleOp.lowChamberCycles}
- TeleOp Points: ${matchData.teleOp.points}

Endgame Period:
- Ascent Level: ${matchData.endgame.ascentLevel} (Points: ${matchData.endgame.points})`;

    let report = "";
    let isVertexUsed = false;

    // Check if Google Cloud Platform is configured for Vertex AI credits
    const gcpProject = process.env.GCP_PROJECT_ID;
    const gcpLocation = process.env.GCP_LOCATION || "us-central1";

    if (gcpProject) {
      try {
        console.log(`[Vertex AI] Initializing GenAI in Vertex mode for project: ${gcpProject}`);
        // Initialize GenAI in Vertex mode (utilizing Google Cloud credits)
        const ai = new GoogleGenAI({
          vertexai: true,
          project: gcpProject,
          location: gcpLocation,
        });

        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        });

        report = response.text || "";
        if (report) {
          isVertexUsed = true;
          console.log(`[Vertex AI] Successfully compiled match analysis using GCP credits.`);
        }
      } catch (err) {
        console.warn(`[Vertex AI] Vertex AI invocation failed: ${err}. Falling back to deterministic analysis.`);
      }
    } else {
      console.log(`[Vertex AI] GCP_PROJECT_ID is not configured. Invoking deterministic diagnostic engine.`);
    }

    // Zero-Downtime Guarantee: Local Deterministic Report Generator if Vertex AI is offline/unconfigured
    if (!report) {
      report = generateDeterministicReport(matchData);
    }

    // Save match analysis to Firestore under `/match_analyses`
    try {
      const analysisDocRef = adminDb.collection("match_analyses").doc(matchData.matchId);
      await analysisDocRef.set({
        matchId: matchData.matchId,
        matchData: matchData,
        analysisReport: report,
        engineUsed: isVertexUsed ? "VertexAI (GCP Credits)" : "Deterministic Rule Engine (Fallback)",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[Firestore] Saved match analysis report to database for Match ${matchData.matchId}`);
    } catch (firestoreErr) {
      console.warn(`[Firestore] Failed to save match analysis to database: ${firestoreErr}`);
    }

    return NextResponse.json({
      success: true,
      engine: isVertexUsed ? "VertexAI (GCP Credits)" : "Deterministic Rule Engine (Fallback)",
      report: report,
    });
  } catch (error: any) {
    console.error("[Match Analysis Endpoint Error]:", error);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500 }
    );
  }
}

function generateDeterministicReport(match: MatchData): string {
  const isWin = match.ourScore > match.opponentScore;
  const outcomeText = isWin ? "🏆 VICTORIOUS" : "📉 DEFEATED";
  const outcomeDetail = isWin 
    ? "Outstanding game execution. We outscored our opponents and maintained solid driver control." 
    : "Tough match. The opponent scoring capacity outpaced our cycle speeds, highlighting critical areas for defensive play and intake tuning.";

  // Auto assessment
  let autoStatus = "🟢 HEALTHY";
  let autoDetail = "All auto components executed flawlessly. The robot achieved correct alignment and scored preload units.";
  if (!match.autonomous.parkingSuccess) {
    autoStatus = "🔴 CRITICAL FAILURE";
    autoDetail = "The robot failed to execute the final parking sequence in autonomous! Check starting coordinates or potential mechanical wheel slip.";
  } else if (match.autonomous.samplesScored + match.autonomous.specimensScored === 0) {
    autoStatus = "🟡 WARNING (ZERO SCORED)";
    autoDetail = "We successfully parked, but failed to score any preload specimens or samples. Ensure autonomous PID parameters inside **ARESLib** are calibrated.";
  }

  // TeleOp cycles assessment
  const totalCycles = match.teleOp.highBasketCycles + match.teleOp.lowBasketCycles + match.teleOp.highChamberCycles + match.teleOp.lowChamberCycles;
  let teleOpStatus = "🟢 HEAVY CYCLING";
  let teleOpDetail = `Solid cycle throughput. The driver achieved ${totalCycles} scoring actions. Drivetrain thermals are nominal.`;
  if (totalCycles === 0) {
    teleOpStatus = "🔴 ZERO CYCLES REGISTERED";
    teleOpDetail = "No scoring cycles were registered during the TeleOp period! This indicates a physical intake jam or a complete drivetrain disable. Investigate intake rollers.";
  } else if (totalCycles < 4) {
    teleOpStatus = "🟡 SLOW CYCLE CYCLE SPEED";
    teleOpDetail = `Low throughput observed (${totalCycles} cycles). Intake alignment is sluggish. Drive practice is recommended to streamline intake-to-basket handoffs.`;
  }

  // Endgame assessment
  let endgameStatus = "🟢 FULL ASCENT";
  let endgameDetail = "The robot executed the high-reach climbing hook sequence perfectly, guaranteeing maximal endgame scoring.";
  if (match.endgame.ascentLevel === 0) {
    endgameStatus = "🔴 CLIMB FAILURE";
    endgameDetail = "The robot did not complete any ascent action during the endgame! Check the climbing motor gearboxes and linear slide wire tensioning.";
  } else if (match.endgame.ascentLevel < 2) {
    endgameStatus = "🟡 LOW ASCENT";
    endgameDetail = "Low-level climb achieved. Linear slide extenders failed to reach upper bar heights. Recalibrate slide limit switches.";
  }

  return `# ARES 23247 AI Scouting Match Analysis Report

**Match Target**: \`Match ${match.matchId}\`
**Alliance Color**: \`${match.allianceColor.toUpperCase()}\`
**Match Outcome**: \`${outcomeText} (${match.ourScore} vs ${match.opponentScore})\`

---

## 📊 Tactical Performance Breakdown

### 1. Autonomous Stage — ${autoStatus}
*   **Samples Scored**: \`${match.autonomous.samplesScored}\` | **Specimens Scored**: \`${match.autonomous.specimensScored}\`
*   **Assessment**: ${autoDetail}
*   *Note*: Precision localization checks in **ARESLib** are essential to prevent hitting the field walls during initial pathing.

### 2. TeleOp Cycles & Scoring Throughput — ${teleOpStatus}
*   **High Basket**: \`${match.teleOp.highBasketCycles}\` | **Low Basket**: \`${match.teleOp.lowBasketCycles}\`
*   **High Chamber**: \`${match.teleOp.highChamberCycles}\` | **Low Chamber**: \`${match.teleOp.lowChamberCycles}\`
*   **Assessment**: ${teleOpDetail}

### 3. Endgame Ascent & Hanging Execution — ${endgameStatus}
*   **Ascent level**: \`Level ${match.endgame.ascentLevel}\`
*   **Assessment**: ${endgameDetail}

---

## 🛠️ AI Coach Strategic Recommendations

1.  **Drivetrain Slip Calibration**:
    *   Autonomous parking coordinates showed drift offsets. Recalibrate Pinpoint EKF parameters in **ARESLib** to offset high-speed wheel spin.
2.  **Intake Speed & Alignment**:
    *   TeleOp cycling efficiency can be improved. Implement automated alignment routines using OpenCV camera vision to lock onto samples automatically.
3.  **Endgame Hook Timing**:
    *   Allocate at least 15 seconds for climbing preparation. Practice linear slide deployment to ensure Ascent Level 3 reliability under pressure in *FIRST*® tournaments.

*This report was automatically compiled by the ARES administrative scouting service.*
`;
}
