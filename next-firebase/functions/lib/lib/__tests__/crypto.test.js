"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const crypto_1 = require("../crypto");
(0, vitest_1.describe)("Crypto PII module", () => {
    const secret = "test-encryption-secret-with-32-chars-long";
    (0, vitest_1.it)("should encrypt and decrypt a string successfully", async () => {
        const originalText = "FTC Robot 23247";
        const encrypted = await (0, crypto_1.encrypt)(originalText, secret);
        (0, vitest_1.expect)(encrypted).toBeDefined();
        (0, vitest_1.expect)(encrypted).toContain(":");
        const decrypted = await (0, crypto_1.decrypt)(encrypted, secret);
        (0, vitest_1.expect)(decrypted).toBe(originalText);
    });
    (0, vitest_1.it)("should fail decryption with incorrect secret", async () => {
        const originalText = "Secret message";
        const encrypted = await (0, crypto_1.encrypt)(originalText, secret);
        const decrypted = await (0, crypto_1.decrypt)(encrypted, "wrong-encryption-secret-32-chars-long");
        (0, vitest_1.expect)(decrypted).toBe("[Decryption Failed]");
    });
    (0, vitest_1.it)("should return empty string for empty input text", async () => {
        const encrypted = await (0, crypto_1.encrypt)("", secret);
        (0, vitest_1.expect)(encrypted).toBe("");
    });
    (0, vitest_1.it)("should return input text back if it does not contain a colon", async () => {
        const plain = "randomPlaintext";
        const decrypted = await (0, crypto_1.decrypt)(plain, secret);
        (0, vitest_1.expect)(decrypted).toBe(plain);
    });
    (0, vitest_1.it)("should handle invalid format", async () => {
        const decrypted = await (0, crypto_1.decrypt)("a:b", secret);
        (0, vitest_1.expect)(decrypted).toBe("[Decryption Failed]");
    });
});
//# sourceMappingURL=crypto.test.js.map