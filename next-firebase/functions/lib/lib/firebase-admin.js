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
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminStorage = exports.adminAuth = exports.adminDb = void 0;
const admin = __importStar(require("firebase-admin"));
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;
if (!admin.apps.length) {
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ares-web-preview"}.appspot.com`
        });
    }
    else {
        // Fall back to local emulator credentials or default credentials
        admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ares-web-preview",
            storageBucket: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ares-web-preview"}.appspot.com`
        });
    }
}
const adminDb = admin.firestore();
exports.adminDb = adminDb;
const adminAuth = admin.auth();
exports.adminAuth = adminAuth;
const adminStorage = admin.storage();
exports.adminStorage = adminStorage;
exports.default = admin;
//# sourceMappingURL=firebase-admin.js.map