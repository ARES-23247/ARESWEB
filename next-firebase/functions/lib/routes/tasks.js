"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const zulip_1 = require("../lib/zulip");
const router = express_1.default.Router();
// POST /api/tasks/comment
router.post("/comment", auth_1.ensureAuth, async (req, res) => {
    try {
        const { taskId, author, content } = req.body;
        if (!taskId || !author || !content) {
            res.status(400).json({ success: false, error: "Missing required fields." });
            return;
        }
        const streamName = process.env.ZULIP_KANBAN_STREAM || "kanban";
        const topic = `Task-${taskId}`;
        const messageContent = `💬 **${author}** (via Web):\n\n${content}`;
        const success = await (0, zulip_1.sendZulipMessage)(streamName, topic, messageContent);
        res.json({
            success,
            message: success ? "Comment forwarded to Zulip." : "Zulip integration is not active or failed.",
        });
    }
    catch (error) {
        console.error("Error in tasks comment proxy:", error);
        res.status(500).json({ success: false, error: "Internal server error." });
    }
});
// POST /api/tasks/notify
router.post("/notify", auth_1.ensureAuth, async (req, res) => {
    try {
        const { taskId, action, title, status, description, subteam, priority } = req.body;
        if (!taskId || !action || !title) {
            res.status(400).json({ success: false, error: "Missing required fields." });
            return;
        }
        const streamName = process.env.ZULIP_KANBAN_STREAM || "kanban";
        const topic = `Task-${taskId}`;
        let content = "";
        if (action === "create") {
            content = [
                `🚀 **New Task Created:** ${title}`,
                description ? `\n${description}` : "",
                `**Priority:** ${priority || "medium"}`,
                `**Subteam:** ${subteam || "software"}`,
                `[Open Kanban Board](https://aresfirst.org/dashboard/tasks)`
            ].filter(Boolean).join("\n");
        }
        else if (action === "move") {
            content = `🔄 **Task Status Updated:** Card is now in **${status || "unknown"}**`;
        }
        else {
            res.status(400).json({ success: false, error: "Invalid action." });
            return;
        }
        const success = await (0, zulip_1.sendZulipMessage)(streamName, topic, content);
        res.json({
            success,
            message: success ? "Notification sent to Zulip." : "Zulip integration is not active or failed.",
        });
    }
    catch (error) {
        console.error("Error in tasks notification endpoint:", error);
        res.status(500).json({ success: false, error: "Internal server error." });
    }
});
exports.default = router;
//# sourceMappingURL=tasks.js.map