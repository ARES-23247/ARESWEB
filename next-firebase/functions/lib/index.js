"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const photos_1 = __importDefault(require("./routes/photos"));
const inquiries_1 = __importDefault(require("./routes/inquiries"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const upload_1 = __importDefault(require("./routes/upload"));
const profiles_1 = __importDefault(require("./routes/profiles"));
const app = (0, express_1.default)();
// Enable trust proxy for rate limiting behind Cloud Functions hosting proxy
app.set("trust proxy", 1);
// Middleware
app.use((0, cors_1.default)({ origin: true }));
// Use raw body parsing for the upload endpoint, and json for everything else
app.use((req, res, next) => {
    if (req.path === "/api/upload") {
        express_1.default.raw({ type: "*/*", limit: "50mb" })(req, res, next);
    }
    else {
        express_1.default.json({ limit: "10mb" })(req, res, next);
    }
});
// Mount Sub-Routers
app.use("/api/photos", photos_1.default);
app.use("/api/inquiries", inquiries_1.default);
app.use("/api/tasks", tasks_1.default);
app.use("/api/analytics", analytics_1.default);
app.use("/api/webhooks", webhooks_1.default);
app.use("/api/upload", upload_1.default);
app.use("/api/profiles", profiles_1.default);
// Export Cloud Function
exports.api = (0, https_1.onRequest)({ cors: true, maxInstances: 10 }, app);
//# sourceMappingURL=index.js.map