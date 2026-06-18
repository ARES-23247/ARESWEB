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

async function migrateUsers() {
  console.log("👤 Migrating users and profiles from D1 to Firestore...");

  const users = runWranglerQuery(
    "SELECT u.id, u.name, u.email, u.image, u.role, p.first_name, p.last_name, p.nickname, p.phone, p.contact_email, p.show_email, p.show_phone, p.pronouns, p.grade_year, p.subteams, p.member_type, p.bio, p.colleges, p.show_on_about FROM user u LEFT JOIN user_profiles p ON u.id = p.user_id"
  );

  console.log(`Fetched ${users.length} users/profiles from D1.`);

  let authCount = 0;
  let profileCount = 0;

  for (const u of users) {
    if (!u.id) continue;
    const emailKey = u.email ? u.email.trim().toLowerCase() : "";
    let targetUid = u.id;

    if (emailKey) {
      try {
        const authUser = await admin.auth().getUserByEmail(emailKey);
        targetUid = authUser.uid;
        console.log(`Resolved Firebase Auth user for ${emailKey} -> UID: ${targetUid}`);
      } catch (e) {
        // User not found in Firebase Auth, fall back to legacy UUID
      }
    }

    // 1. Seed authorized_users
    await db.collection("authorized_users").doc(targetUid).set({
      email: emailKey,
      role: u.role || "member",
      name: u.name || "ARES Member"
    });
    authCount++;

    // 2. Seed user_profiles
    let subteams = [];
    try {
      if (u.subteams) {
        subteams = JSON.parse(u.subteams);
      }
    } catch (e) {
      console.warn(`Failed to parse subteams for ${targetUid}: ${u.subteams}`);
    }

    let colleges = [];
    try {
      if (u.colleges) {
        colleges = JSON.parse(u.colleges);
      }
    } catch (e) {
      console.warn(`Failed to parse colleges for ${targetUid}: ${u.colleges}`);
    }

    const docData = {
      nickname: u.nickname || u.name || "ARES Member",
      firstName: u.first_name || "",
      lastName: u.last_name || "",
      phone: u.phone || "",
      contactEmail: u.contact_email || u.email || "",
      showEmail: u.show_email === 1,
      showPhone: u.show_phone === 1,
      pronouns: u.pronouns || "",
      gradeYear: u.grade_year || "",
      subteams: subteams,
      memberType: u.member_type || "student",
      bio: u.bio || "",
      colleges: colleges,
      showOnAbout: u.show_on_about !== 0, // default true
      avatar: u.image || `https://api.dicebear.com/9.x/bottts/svg?seed=${targetUid}`
    };

    await db.collection("user_profiles").doc(targetUid).set(docData);
    profileCount++;

    // Clean up legacy/email-based duplicate documents if we resolved a Firebase Auth UID
    if (targetUid !== u.id) {
      try {
        await db.collection("user_profiles").doc(u.id).delete();
        await db.collection("authorized_users").doc(u.id).delete();
        console.log(`[Migration] Cleaned up legacy user_profiles/authorized_users document for ${u.id}`);
      } catch (deleteErr) {
        console.warn(`[Migration] Could not delete legacy document for ${u.id}:`, deleteErr);
      }
    }

    if (emailKey && targetUid !== emailKey) {
      try {
        await db.collection("user_profiles").doc(emailKey).delete();
        await db.collection("authorized_users").doc(emailKey).delete();
        console.log(`[Migration] Cleaned up email-based user_profiles/authorized_users document for ${emailKey}`);
      } catch (deleteErr) {
        console.warn(`[Migration] Could not delete email-based document for ${emailKey}:`, deleteErr);
      }
    }
  }

  console.log(`\n✅ Successfully migrated ${authCount} users to authorized_users.`);
  console.log(`✅ Successfully migrated ${profileCount} profiles to user_profiles.`);
}

migrateUsers().catch(err => {
  console.error("Migration failed:", err);
});
