/**
 * ARES WEB - PII Encryption Utility
 * Uses Web Crypto API (AES-GCM) for authenticated encryption.
 * Output Format: "salt_hex:iv_hex:ciphertext_hex"
 **/

async function getCryptoKey(secret: string, saltHex?: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // SEC-H02: Use PBKDF2 with a dynamic salt for deterministic but hardened key derivation
  let salt: Uint8Array;
  if (saltHex) {
    salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  } else {
    // Legacy fixed salt for backwards compatibility
    salt = enc.encode("aresweb-pii-salt-v1");
  }

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      salt: salt as any,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(text: string, secret: string): Promise<string> {
  if (!text) return "";
  
  const saltArray = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(saltArray).map(b => b.toString(16).padStart(2, "0")).join("");
  
  const key = await getCryptoKey(secret, saltHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  
  const ciphertext = await crypto.subtle.encrypt(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { name: "AES-GCM", iv: iv as any },
    key,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    encoded as any
  );
  
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");
  const cipherHex = Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, "0")).join("");
  
  return `${saltHex}:${ivHex}:${cipherHex}`;
}

export async function decrypt(encryptedText: string, secret: string): Promise<string> {
  if (!encryptedText || !encryptedText.includes(":")) return encryptedText;
  
  try {
    const parts = encryptedText.split(":");
    let saltHex: string | undefined;
    let ivHex: string;
    let cipherHex: string;

    if (parts.length === 3) {
      [saltHex, ivHex, cipherHex] = parts;
    } else if (parts.length === 2) {
      [ivHex, cipherHex] = parts;
    } else {
      return encryptedText;
    }

    if (!ivHex || !cipherHex) return encryptedText;
    
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const ciphertext = new Uint8Array(cipherHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    const key = await getCryptoKey(secret, saltHex);
    
    const decrypted = await crypto.subtle.decrypt(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { name: "AES-GCM", iv: iv as any },
      key,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ciphertext as any
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error("[Crypto] Decryption failed:", err);
    // SEC-02: Do not leak raw ciphertext on failure
    return "[Decryption Failed]";
  }
}
