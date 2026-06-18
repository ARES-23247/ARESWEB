const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "aresfirst-portal",
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

async function run() {
  console.log("Searching authorized_users for 'david'...");
  const snapshot = await db.collection("authorized_users").get();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.email && data.email.toLowerCase().includes("david")) {
      console.log(`UID: ${doc.id}, Email: ${data.email}, Role: ${data.role}, Name: ${data.name}`);
    }
  });
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
