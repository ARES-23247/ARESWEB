import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../crypto";

describe("Crypto PII module", () => {
  const secret = "test-encryption-secret-with-32-chars-long";

  it("should encrypt and decrypt a string successfully", async () => {
    const originalText = "FTC Robot 23247";
    const encrypted = await encrypt(originalText, secret);
    
    expect(encrypted).toBeDefined();
    expect(encrypted).toContain(":");
    
    const decrypted = await decrypt(encrypted, secret);
    expect(decrypted).toBe(originalText);
  });

  it("should fail decryption with incorrect secret", async () => {
    const originalText = "Secret message";
    const encrypted = await encrypt(originalText, secret);
    
    const decrypted = await decrypt(encrypted, "wrong-encryption-secret-32-chars-long");
    expect(decrypted).toBe("[Decryption Failed]");
  });

  it("should return empty string for empty input text", async () => {
    const encrypted = await encrypt("", secret);
    expect(encrypted).toBe("");
  });

  it("should return input text back if it does not contain a colon", async () => {
    const plain = "randomPlaintext";
    const decrypted = await decrypt(plain, secret);
    expect(decrypted).toBe(plain);
  });

  it("should handle invalid format", async () => {
    const decrypted = await decrypt("a:b", secret);
    expect(decrypted).toBe("[Decryption Failed]");
  });
});
