const admin = require("firebase-admin");

// Default to local Firestore emulator host if not set
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

admin.initializeApp({
  projectId: "ares-web-preview"
});

const db = admin.firestore();

async function seed() {
  console.log("🌱 Starting Firestore emulator seeding...");

  const users = [
    { email: "coach.david@gmail.com", role: "admin", name: "David Coach" },
    { email: "student.lead@gmail.com", role: "member", name: "Lead Student" },
    { email: "mentor.expert@gmail.com", role: "mentor", name: "Expert Mentor" },
    { email: "anonymous", role: "guest", name: "Anonymous Guest" }
  ];

  for (const u of users) {
    const docId = u.email;
    await db.collection("authorized_users").doc(docId).set({
      email: u.email,
      role: u.role,
      name: u.name
    });
    console.log(`  ✅ Seeded: ${u.email} ➔ ${u.role}`);
  }

  console.log("🌱 Seeding successfully completed!");
}

seed().catch(err => {
  console.error("❌ Seeding failed:", err);
});
