const admin = require("firebase-admin");
const { execSync } = require("child_process");
const path = require("path");

// Initialize Firebase Admin for production project (relying on David's local CLI/ADC credentials)
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

async function migrateEvents() {
  console.log("📅 Migrating events from D1 to Firestore...");

  const events = runWranglerQuery(
    "SELECT id, title, date_start, date_end, location, description, cover_image, category, is_potluck, is_volunteer, meeting_notes, zulip_stream, zulip_topic, is_deleted, status FROM events"
  );

  console.log(`Fetched ${events.length} events from D1.`);

  let count = 0;
  for (const ev of events) {
    if (!ev.id) continue;

    // Map to camelCase properties for next-firebase client usage
    const docData = {
      title: ev.title || "Untitled Event",
      dateStart: ev.date_start || "",
      dateEnd: ev.date_end || "",
      location: ev.location || "TBD",
      description: ev.description || "",
      category: ev.category || "internal",
      isDeleted: ev.is_deleted ?? 0,
      status: ev.status || "published",
      isPotluck: ev.is_potluck ?? 0,
      isVolunteer: ev.is_volunteer ?? 0
    };

    if (ev.cover_image) docData.coverImage = ev.cover_image;
    if (ev.meeting_notes) docData.meetingNotes = ev.meeting_notes;
    if (ev.zulip_stream) docData.zulipStream = ev.zulip_stream;
    if (ev.zulip_topic) docData.zulipTopic = ev.zulip_topic;

    await db.collection("events").doc(ev.id).set(docData);
    count++;
  }

  console.log(`✅ Successfully migrated ${count} events to Firestore 'events' collection.`);
}

migrateEvents().catch(err => {
  console.error("Migration failed:", err);
});
