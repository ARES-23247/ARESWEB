"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const firebase_admin_1 = require("../lib/firebase-admin");
const crypto_1 = require("../lib/crypto");
const zulip_1 = require("../lib/zulip");
const router = express_1.default.Router();
const inquiryLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 5, // limit each IP to 5 submissions per hour
    message: { success: false, error: "Too many submissions from this IP, please try again after an hour." },
    standardHeaders: true,
    legacyHeaders: false,
});
function getEncryptionSecret() {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret || secret === "01234567890123456789012345678901" || secret === "test-encryption-secret-with-32-chars-long") {
        const isProd = process.env.NODE_ENV === "production" || !process.env.FUNCTIONS_EMULATOR;
        if (isProd) {
            throw new Error("Fatal: ENCRYPTION_SECRET must be configured with a strong secret in production environment.");
        }
    }
    return secret || "01234567890123456789012345678901";
}
// POST /api/inquiries
router.post("/", inquiryLimiter, async (req, res) => {
    try {
        const { type, name, email, metadata, recaptchaToken } = req.body;
        if (!type || !name || !email || !recaptchaToken) {
            res.status(400).json({ success: false, error: "Missing required fields." });
            return;
        }
        // Disable reCAPTCHA bypass token in production environment
        const isProd = process.env.NODE_ENV === "production" || !process.env.FUNCTIONS_EMULATOR;
        const isBypass = recaptchaToken === "test-bypass-token" && !isProd;
        if (!isBypass) {
            const secretKey = process.env.RECAPTCHA_SECRET_KEY || "6LeIxAcTAAAAAGG-vFI1TnFTxWb0Ncczb12qycWb";
            const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(recaptchaToken)}`,
            });
            const verifyData = (await verifyRes.json());
            if (!verifyData.success) {
                res.status(400).json({ success: false, error: "Spam check verification failed. Please try again." });
                return;
            }
        }
        const secret = getEncryptionSecret();
        const encryptedName = await (0, crypto_1.encrypt)(name.trim(), secret);
        const encryptedEmail = await (0, crypto_1.encrypt)(email.trim().toLowerCase(), secret);
        const inquiryId = `inq_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const newInquiry = {
            id: inquiryId,
            type,
            name: encryptedName,
            email: encryptedEmail,
            status: "pending",
            metadata: metadata || {},
            createdAt: new Date().toISOString(),
        };
        await firebase_admin_1.adminDb.collection("inquiries").doc(inquiryId).set(newInquiry);
        try {
            const messageBody = `**Name:** ${name.trim()}
**Email:** ${email.trim()}
**Type:** ${type}
**Message:** ${metadata?.message || "(no message payload)"}
[Open Command Center](https://aresfirst.org/dashboard)`;
            // Await Zulip Sync
            await (0, zulip_1.sendZulipAlert)("Applicant", `New ${type} Submission`, messageBody);
        }
        catch (e) {
            console.error("[Zulip Inquiries Alert] error:", e);
        }
        res.json({
            success: true,
            message: "Application submitted successfully.",
            id: inquiryId,
        });
    }
    catch (error) {
        console.error("Error submitting inquiry API:", error);
        res.status(500).json({ success: false, error: "Internal server error." });
    }
});
exports.default = router;
//# sourceMappingURL=inquiries.js.map