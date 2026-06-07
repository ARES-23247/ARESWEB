import express from "express";
import { adminDb } from "../lib/firebase-admin";
import { ensureAuth } from "../middleware/auth";

const router = express.Router();

// GET /api/profiles/about-roster (public-facing roster)
router.get("/about-roster", async (req, res) => {
  try {
    const snapshot = await adminDb.collection("user_profiles").where("showOnAbout", "==", true).get();
    const members = snapshot.docs.map(doc => {
      const data = doc.data();
      // Parents should be filtered out
      if (data.memberType === "parent") return null;
      
      const memberType = data.memberType || "student";
      const isStudent = memberType === "student";

      return {
        userId: doc.id,
        // PRI-F02: Fallback strictly to 'ARES Member' instead of legal first name for youth privacy
        nickname: data.nickname || "ARES Member",
        pronouns: data.pronouns || "",
        subteams: data.subteams || [],
        memberType,
        avatar: data.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${doc.id}`,
        bio: data.bio || "",
        // PRI-F01: Redact colleges list for student accounts
        colleges: isStudent ? [] : (data.colleges || [])
      };
    }).filter(m => m !== null);
    
    res.json({ members });
  } catch (error: any) {
    console.error("Error fetching about-roster:", error);
    res.status(500).json({ error: "Failed to fetch team roster." });
  }
});

// GET /api/profiles/team-roster (requires authentication, for dashboard assignees picker)
router.get("/team-roster", ensureAuth, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("user_profiles").get();
    const members = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        nickname: data.nickname || data.firstName || "Team Member",
        avatar: data.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${doc.id}`
      };
    });
    res.json({ members });
  } catch (error: any) {
    console.error("Error fetching team-roster:", error);
    res.status(500).json({ error: "Failed to fetch team profiles." });
  }
});

export default router;
