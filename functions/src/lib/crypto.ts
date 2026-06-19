import { webcrypto } from "node:crypto";

const subtle = webcrypto.subtle;

async function getCryptoKey(secret: string, saltHex?: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  let salt: Uint8Array;
  if (saltHex) {
    salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  } else {
    salt = enc.encode("aresweb-pii-salt-v1");
  }

  return await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
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
  
  const saltArray = webcrypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(saltArray).map((b) => b.toString(16).padStart(2, "0")).join("");
  
  const key = await getCryptoKey(secret, saltHex);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoded
  );
  
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
  const cipherHex = Array.from(new Uint8Array(ciphertext)).map((b) => b.toString(16).padStart(2, "0")).join("");
  
  return `${saltHex}:${ivHex}:${cipherHex}`;
}

const decryptionCache = new Map<string, string>();

export async function decrypt(encryptedText: string, secret: string): Promise<string> {
  if (!encryptedText || !encryptedText.includes(":")) return encryptedText;
  
  const cached = decryptionCache.get(encryptedText);
  if (cached) return cached;
  
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
    
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
    const ciphertext = new Uint8Array(cipherHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
    
    const key = await getCryptoKey(secret, saltHex);
    
    const decrypted = await subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    
    const result = new TextDecoder().decode(decrypted);
    decryptionCache.set(encryptedText, result);
    return result;
  } catch (err) {
    console.error("[Crypto] Decryption failed:", err);
    return "[Decryption Failed]";
  }
}
