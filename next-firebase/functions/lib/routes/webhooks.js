"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const firebase_admin_1 = __importStar(require("../lib/firebase-admin"));
const router = express_1.default.Router();
function timingSafeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string")
        return false;
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length)
        return false;
    let result = 0;
    for (let i = 0; i < aBuf.length; i++) {
        result |= aBuf[i] ^ bBuf[i];
    }
    return result === 0;
}
// POST /api/webhooks/zulip
router.post("/zulip", async (req, res) => {
    try {
        const expectedToken = process.env.ZULIP_WEBHOOK_TOKEN;
        if (!expectedToken) {
            console.error("[Zulip Webhook] Server lacks ZULIP_WEBHOOK_TOKEN config.");
            res.status(500).json({ error: "Webhook token not configured." });
            return;
        }
        const { message, trigger, token } = req.body;
        if (!token || !timingSafeEqual(token, expectedToken)) {
            res.status(401).json({ error: "Unauthorized: Invalid webhook token." });
            return;
        }
        if (!message || (trigger !== "message" && trigger !== "private_message" && trigger !== "mention")) {
            res.json({ content: "" });
            return;
        }
        const topic = message.topic || message.subject;
        if (!topic || !topic.startsWith("Task-")) {
            res.json({ content: "" });
            return;
        }
        const taskId = topic.replace("Task-", "").trim();
        const taskRef = firebase_admin_1.adminDb.collection("tasks").doc(taskId);
        const taskSnap = await taskRef.get();
        if (!taskSnap.exists) {
            console.warn(`[Zulip Webhook] Task "${taskId}" does not exist in Firestore.`);
            res.json({ content: "Task card not found." });
            return;
        }
        const cleanContent = (message.content || "").replace(/@\*\*[^*]+\*\*/g, "").trim();
        if (!cleanContent) {
            res.json({ content: "" });
            return;
        }
        const newComment = {
            id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            author: message.sender_full_name || "Zulip User",
            content: cleanContent,
            createdAt: new Date().toISOString(),
            source: "zulip",
        };
        await taskRef.update({
            comments: firebase_admin_1.default.firestore.FieldValue.arrayUnion(newComment),
        });
        console.log(`[Zulip Webhook] Synced comment from Zulip to Task "${taskId}"`);
        res.json({ content: "" });
    }
    catch (error) {
        console.error("[Zulip Webhook] Error processing incoming webhook:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});
exports.default = router;
//# sourceMappingURL=webhooks.js.map