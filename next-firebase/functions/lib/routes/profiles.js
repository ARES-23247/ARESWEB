"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const firebase_admin_1 = require("../lib/firebase-admin");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// GET /api/profiles/about-roster (public-facing roster)
router.get("/about-roster", async (req, res) => {
    try {
        const snapshot = await firebase_admin_1.adminDb.collection("user_profiles").where("showOnAbout", "==", true).get();
        const members = snapshot.docs.map(doc => {
            const data = doc.data();
            // Parents should be filtered out
            if (data.memberType === "parent")
                return null;
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
    }
    catch (error) {
        console.error("Error fetching about-roster:", error);
        res.status(500).json({ error: "Failed to fetch team roster." });
    }
});
// GET /api/profiles/team-roster (requires authentication, for dashboard assignees picker)
router.get("/team-roster", auth_1.ensureAuth, async (req, res) => {
    try {
        const snapshot = await firebase_admin_1.adminDb.collection("user_profiles").get();
        const members = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                uid: doc.id,
                nickname: data.nickname || data.firstName || "Team Member",
                avatar: data.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${doc.id}`
            };
        });
        res.json({ members });
    }
    catch (error) {
        console.error("Error fetching team-roster:", error);
        res.status(500).json({ error: "Failed to fetch team profiles." });
    }
});
exports.default = router;
//# sourceMappingURL=profiles.js.map