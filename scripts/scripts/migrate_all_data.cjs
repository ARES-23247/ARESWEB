const admin = require("firebase-admin");
const { execSync } = require("child_process");
const path = require("path");

// Initialize Firebase Admin for production project
admin.initializeApp({
  projectId: "aresfirst-portal"
});

const db = admin.firestore();

function runWranglerQuery(query) {
  try {
    const cmd = `npx wrangler d1 execute ares-db --remote --json --command="${query.replace(/"/g, '\\"')}"`;
    const stdout = execSync(cmd, { cwd: path.resolve(__dirname, "../../"), encoding: "utf8" });
    const parsed = JSON.parse(stdout);
    if (parsed && parsed[0] && parsed[0].success) {
      return parsed[0].results || [];
    }
    return [];
  } catch (err) {
    console.error(`Wrangler query failed: ${query}`, err);
    return [];
  }
}

async function migrateDocs() {
  console.log("📄 Migrating docs (academy/portfolio lessons) from D1 to Firestore...");
  const rows = runWranglerQuery("SELECT * FROM docs");
  console.log(`Fetched ${rows.length} docs from D1.`);
  let count = 0;
  for (const row of rows) {
    if (!row.slug) continue;
    const docData = {
      title: row.title || "Untitled Document",
      category: row.category || "General",
      sortOrder: row.sort_order ?? 0,
      description: row.description || "",
      content: row.content || "",
      contentDraft: row.content_draft || "",
      cfEmail: row.cf_email || "",
      updatedAt: row.updated_at || new Date().toISOString(),
      isDeleted: row.is_deleted ?? 0,
      status: row.status || "published",
      isPortfolio: row.is_portfolio ?? 0,
      isExecutiveSummary: row.is_executive_summary ?? 0,
      displayInAreslib: row.display_in_areslib ?? 0,
      displayInMathCorner: row.display_in_math_corner ?? 0,
      displayInScienceCorner: row.display_in_science_corner ?? 0,
      revisionOf: row.revision_of || null
    };
    await db.collection("docs").doc(row.slug).set(docData);
    count++;
  }
  console.log(`✅ Successfully migrated ${count} documents.`);
}

async function migrateSeasons() {
  console.log("🏆 Migrating seasons from D1 to Firestore...");
  const rows = runWranglerQuery("SELECT * FROM seasons");
  console.log(`Fetched ${rows.length} seasons from D1.`);
  let count = 0;
  for (const row of rows) {
    if (!row.start_year) continue;
    const docData = {
      startYear: Number(row.start_year),
      endYear: row.end_year ? Number(row.end_year) : null,
      challengeName: row.challenge_name || "",
      robotName: row.robot_name || "",
      robotImage: row.robot_image || "",
      robotDescription: row.robot_description || "",
      robotCadUrl: row.robot_cad_url || "",
      summary: row.summary || "",
      albumUrl: row.album_url || "",
      albumCover: row.album_cover || "",
      status: row.status || "published",
      isDeleted: row.is_deleted ?? 0,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    };
    await db.collection("seasons").doc(row.start_year.toString()).set(docData);
    count++;
  }
  console.log(`✅ Successfully migrated ${count} seasons.`);
}

async function migrateAwards() {
  console.log("🥇 Migrating awards from D1 to Firestore...");
  const rows = runWranglerQuery("SELECT * FROM awards");
  console.log(`Fetched ${rows.length} awards from D1.`);
  let count = 0;
  for (const row of rows) {
    if (!row.id) continue;
    const docData = {
      id: Number(row.id),
      title: row.title || "",
      eventName: row.event_name || "",
      date: row.date || "",
      description: row.description || "",
      iconType: row.icon_type || "trophy",
      isDeleted: row.is_deleted ?? 0,
      seasonId: row.season_id ? Number(row.season_id) : null,
      createdAt: row.created_at || new Date().toISOString()
    };
    await db.collection("awards").doc(row.id.toString()).set(docData);
    count++;
  }
  console.log(`✅ Successfully migrated ${count} awards.`);
}

async function migrateFinanceTransactions() {
  console.log("💰 Migrating finance transactions from D1 to Firestore...");
  const rows = runWranglerQuery("SELECT * FROM finance_transactions");
  console.log(`Fetched ${rows.length} finance transactions from D1.`);
  let count = 0;
  for (const row of rows) {
    if (!row.id) continue;
    const docData = {
      id: row.id,
      amount: Number(row.amount),
      type: row.type || "",
      category: row.category || "",
      date: row.date || "",
      description: row.description || "",
      receiptUrl: row.receipt_url || "",
      seasonId: row.season_id ? Number(row.season_id) : null,
      loggedBy: row.logged_by || ""
    };
    await db.collection("finance_transactions").doc(row.id).set(docData);
    count++;
  }
  console.log(`✅ Successfully migrated ${count} finance transactions.`);
}

async function migrateJudgeAccessCodes() {
  console.log("🔑 Migrating judge access codes from D1 to Firestore...");
  const rows = runWranglerQuery("SELECT * FROM judge_access_codes");
  console.log(`Fetched ${rows.length} judge access codes from D1.`);
  let count = 0;
  for (const row of rows) {
    if (!row.id) continue;
    const docData = {
      id: row.id,
      code: row.code || "",
      label: row.label || "Judge Access",
      createdAt: row.created_at || new Date().toISOString(),
      expiresAt: row.expires_at || null
    };
    await db.collection("judge_access_codes").doc(row.id).set(docData);
    count++;
  }
  console.log(`✅ Successfully migrated ${count} judge access codes.`);
}

async function migrateOutreachLogs() {
  console.log("🤝 Migrating outreach logs from D1 to Firestore...");
  const rows = runWranglerQuery("SELECT * FROM outreach_logs");
  console.log(`Fetched ${rows.length} outreach logs from D1.`);
  let count = 0;
  for (const row of rows) {
    if (!row.id) continue;
    const docData = {
      id: Number(row.id),
      title: row.title || "",
      date: row.date || "",
      location: row.location || "",
      hours: row.hours ? Number(row.hours) : 0,
      peopleReached: row.people_reached ? Number(row.people_reached) : 0,
      studentsCount: row.students_count ? Number(row.students_count) : 0,
      impactSummary: row.impact_summary || "",
      cfEmail: row.cf_email || "",
      isMentoring: row.is_mentoring ?? 0,
      mentoredTeamNumber: row.mentored_team_number || "",
      metadata: row.metadata || "",
      isDeleted: row.is_deleted ?? 0,
      seasonId: row.season_id ? Number(row.season_id) : null,
      createdAt: row.created_at || new Date().toISOString()
    };
    await db.collection("outreach_logs").doc(row.id.toString()).set(docData);
    count++;
  }
  console.log(`✅ Successfully migrated ${count} outreach logs.`);
}

async function main() {
  await migrateDocs();
  await migrateSeasons();
  await migrateAwards();
  await migrateFinanceTransactions();
  await migrateJudgeAccessCodes();
  await migrateOutreachLogs();
  console.log("🎉 All data migrations completed!");
}

main().catch(err => {
  console.error("Migration script failed:", err);
  process.exit(1);
});
