import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./crypto";

describe("Crypto Utility", () => {
  const secret = "my-test-super-secret-key-32-chars!!";
  const plaintext = "Hello ARES Robotics Team #23247 YPP compliance!";

  it("should encrypt and decrypt a string successfully", async () => {
    const encrypted = await encrypt(plaintext, secret);
    expect(encrypted).toBeDefined();
    expect(encrypted).toContain(":");

    const decrypted = await decrypt(encrypted, secret);
    expect(decrypted).toBe(plaintext);
  });

  it("should return empty string if encrypting empty text", async () => {
    const encrypted = await encrypt("", secret);
    expect(encrypted).toBe("");
  });

  it("should return input string if decrypting a non-encrypted string", async () => {
    const raw = "not-encrypted-string";
    const result = await decrypt(raw, secret);
    expect(result).toBe(raw);
  });

  it("should return failure message if decryption fails due to wrong secret", async () => {
    const encrypted = await encrypt(plaintext, secret);
    const decryptedWithWrongSecret = await decrypt(encrypted, "wrong-secret-key-32-chars-fails!!!");
    expect(decryptedWithWrongSecret).toBe("[Decryption Failed]");
  });
});
