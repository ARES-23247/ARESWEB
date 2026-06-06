"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const node_crypto_1 = require("node:crypto");
const subtle = node_crypto_1.webcrypto.subtle;
async function getCryptoKey(secret, saltHex) {
    const enc = new TextEncoder();
    const keyMaterial = await subtle.importKey("raw", enc.encode(secret), { name: "PBKDF2" }, false, ["deriveKey"]);
    let salt;
    if (saltHex) {
        salt = new Uint8Array(saltHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    }
    else {
        salt = enc.encode("aresweb-pii-salt-v1");
    }
    return await subtle.deriveKey({
        name: "PBKDF2",
        salt: salt.buffer,
        iterations: 100000,
        hash: "SHA-256",
    }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encrypt(text, secret) {
    if (!text)
        return "";
    const saltArray = node_crypto_1.webcrypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(saltArray).map((b) => b.toString(16).padStart(2, "0")).join("");
    const key = await getCryptoKey(secret, saltHex);
    const iv = node_crypto_1.webcrypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encoded);
    const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
    const cipherHex = Array.from(new Uint8Array(ciphertext)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${saltHex}:${ivHex}:${cipherHex}`;
}
async function decrypt(encryptedText, secret) {
    if (!encryptedText || !encryptedText.includes(":"))
        return encryptedText;
    try {
        const parts = encryptedText.split(":");
        let saltHex;
        let ivHex;
        let cipherHex;
        if (parts.length === 3) {
            [saltHex, ivHex, cipherHex] = parts;
        }
        else if (parts.length === 2) {
            [ivHex, cipherHex] = parts;
        }
        else {
            return encryptedText;
        }
        if (!ivHex || !cipherHex)
            return encryptedText;
        const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
        const ciphertext = new Uint8Array(cipherHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
        const key = await getCryptoKey(secret, saltHex);
        const decrypted = await subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
        return new TextDecoder().decode(decrypted);
    }
    catch (err) {
        console.error("[Crypto] Decryption failed:", err);
        return "[Decryption Failed]";
    }
}
//# sourceMappingURL=crypto.js.map