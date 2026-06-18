const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "aresfirst-portal"
});

const db = admin.firestore();
const auth = admin.auth();

async function runCleanup() {
  console.log("🚀 Starting Championship Roster Deduplication and Cleanup...");
  
  // 1. Fetch all profiles
  const snapshot = await db.collection("user_profiles").get();
  console.log(`Fetched ${snapshot.size} profiles from user_profiles.`);
  
  const profiles = snapshot.docs.map(doc => ({
    id: doc.id,
    data: doc.data()
  }));
  
  // 2. Group by email (if present) or fallback to nickname
  const groups = {};
  profiles.forEach(p => {
    const email = p.data.contactEmail ? p.data.contactEmail.trim().toLowerCase() : "";
    const nickname = p.data.nickname ? p.data.nickname.trim().toLowerCase() : "";
    
    // Grouping key
    const key = email || `nick:${nickname}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(p);
  });
  
  let deletedCount = 0;
  let migratedCount = 0;
  
  for (const [key, group] of Object.entries(groups)) {
    const isEmailGroup = !key.startsWith("nick:");
    const email = isEmailGroup ? key : "";
    
    console.log(`\nProcessing group: ${key} (contains ${group.length} profiles)`);
    
    let authUser = null;
    if (isEmailGroup && email) {
      try {
        authUser = await auth.getUserByEmail(email);
        console.log(`  - Found Firebase Auth user for ${email} -> UID: ${authUser.uid}`);
      } catch (err) {
        if (err.code !== "auth/user-not-found") {
          console.error(`  - Error looking up email ${email} in Auth:`, err);
        }
      }
    }
    
    if (authUser) {
      const authUid = authUser.uid;
      
      // Look for the profile that is under the Auth UID
      const authProfile = group.find(p => p.id === authUid);
      
      // If it doesn't exist, we will create it using the data from the first legacy profile
      let targetProfileData = authProfile ? authProfile.data : null;
      if (!targetProfileData) {
        // Find a legacy profile to copy from
        const legacyProfile = group[0];
        console.log(`  - Auth UID profile document does not exist. Creating one from legacy profile ${legacyProfile.id}`);
        targetProfileData = { ...legacyProfile.data };
        await db.collection("user_profiles").doc(authUid).set(targetProfileData);
        
        // Also copy authorized_users entry
        const legacyAuthDoc = await db.collection("authorized_users").doc(legacyProfile.id).get();
        if (legacyAuthDoc.exists) {
          await db.collection("authorized_users").doc(authUid).set(legacyAuthDoc.data());
        } else {
          // Create default authorized_users entry
          await db.collection("authorized_users").doc(authUid).set({
            email: email,
            role: "member",
            name: targetProfileData.nickname || "ARES Member"
          });
        }
        migratedCount++;
      } else {
        // If it does exist, merge any fields from the legacy profiles that are missing in the auth profile
        let merged = false;
        group.forEach(p => {
          if (p.id === authUid) return;
          for (const [field, val] of Object.entries(p.data)) {
            if (val && !targetProfileData[field]) {
              targetProfileData[field] = val;
              merged = true;
            }
          }
        });
        if (merged) {
          console.log(`  - Merged legacy profile data into Auth UID profile document ${authUid}`);
          await db.collection("user_profiles").doc(authUid).set(targetProfileData, { merge: true });
        }
      }
      
      // Now delete all other profile documents in the group that are NOT under the Auth UID
      for (const p of group) {
        if (p.id === authUid) continue;
        console.log(`  - Deleting legacy duplicate user_profiles document: ${p.id}`);
        await db.collection("user_profiles").doc(p.id).delete();
        
        // Also delete from authorized_users
        const authDoc = await db.collection("authorized_users").doc(p.id).get();
        if (authDoc.exists) {
          console.log(`  - Deleting legacy duplicate authorized_users document: ${p.id}`);
          await db.collection("authorized_users").doc(p.id).delete();
        }
        deletedCount++;
      }
      
    } else {
      // No Auth User exists for this group (either nickname group or email that hasn't signed up yet)
      // If there are duplicates in this group, keep the "best" one and delete the rest
      if (group.length > 1) {
        // Sort group to find the best one:
        // Priority: legacy UUID (length 32) > email-based ID (contains @)
        const sortedGroup = [...group].sort((a, b) => {
          const getPriority = (id) => {
            if (id.length === 32 && !id.includes("@")) return 2;
            if (id.includes("@")) return 1;
            return 0;
          };
          return getPriority(b.id) - getPriority(a.id);
        });
        
        const bestProfile = sortedGroup[0];
        console.log(`  - No Auth user found. Keeping best legacy profile: ${bestProfile.id}`);
        
        // Merge others into the best profile
        let merged = false;
        const targetData = { ...bestProfile.data };
        for (let i = 1; i < sortedGroup.length; i++) {
          const p = sortedGroup[i];
          for (const [field, val] of Object.entries(p.data)) {
            if (val && !targetData[field]) {
              targetData[field] = val;
              merged = true;
            }
          }
        }
        
        if (merged) {
          await db.collection("user_profiles").doc(bestProfile.id).set(targetData, { merge: true });
        }
        
        // Delete others
        for (let i = 1; i < sortedGroup.length; i++) {
          const p = sortedGroup[i];
          console.log(`  - Deleting duplicate legacy profile document: ${p.id}`);
          await db.collection("user_profiles").doc(p.id).delete();
          await db.collection("authorized_users").doc(p.id).delete();
          deletedCount++;
        }
      }
    }
  }
  
  console.log(`\n🎉 Cleanup completed!`);
  console.log(`- Legacy profiles migrated to Auth UIDs: ${migratedCount}`);
  console.log(`- Duplicate legacy profile documents deleted: ${deletedCount}`);
}

runCleanup().catch(err => {
  console.error("Cleanup script failed:", err);
  process.exit(1);
});
