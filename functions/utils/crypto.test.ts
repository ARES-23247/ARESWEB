import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Web Crypto API
const mockEncrypt = vi.fn();
const mockDecrypt = vi.fn();
const mockImportKey = vi.fn();
const mockDeriveKey = vi.fn();

vi.stubGlobal('crypto', {
  subtle: {
    importKey: mockImportKey,
    deriveKey: mockDeriveKey,
    encrypt: mockEncrypt,
    decrypt: mockDecrypt,
  },
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i + 1;
    return arr;
  },
});

// Import after mocking
const { encrypt, decrypt } = await import('./crypto');

describe('crypto PII encryption utility', () => {
  const TEST_SECRET = 'test-encryption-key-2024';

  beforeEach(() => {
    vi.clearAllMocks();
    mockImportKey.mockResolvedValue('mock-key-material');
    mockDeriveKey.mockResolvedValue('mock-derived-key');
  });

  describe('encrypt()', () => {
    it('returns empty string for empty input', async () => {
      const result = await encrypt('', TEST_SECRET);
      expect(result).toBe('');
    });

    it('returns empty string for falsy input', async () => {
      const result = await encrypt(null as unknown as string, TEST_SECRET);
      expect(result).toBe('');
    });

    it('calls crypto.subtle.encrypt with AES-GCM', async () => {
      const mockCiphertext = new Uint8Array([0xab, 0xcd, 0xef]).buffer;
      mockEncrypt.mockResolvedValueOnce(mockCiphertext);

      await encrypt('test@example.com', TEST_SECRET);

      expect(mockImportKey).toHaveBeenCalledWith(
        'raw',
        expect.anything(),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      expect(mockDeriveKey).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'PBKDF2', iterations: 100000, hash: 'SHA-256' }),
        'mock-key-material',
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      expect(mockEncrypt).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'AES-GCM' }),
        'mock-derived-key',
        expect.anything()
      );
    });

    it('returns salt:iv:ciphertext format', async () => {
      const mockCiphertext = new Uint8Array([0xab, 0xcd]).buffer;
      mockEncrypt.mockResolvedValueOnce(mockCiphertext);

      const result = await encrypt('Hello', TEST_SECRET);
      const parts = result.split(':');

      expect(parts.length).toBe(3);
      // Salt is 16 bytes = 32 hex chars
      expect(parts[0].length).toBe(32);
      // IV is 12 bytes = 24 hex chars
      expect(parts[1].length).toBe(24);
      // Ciphertext hex
      expect(parts[2].length).toBeGreaterThan(0);
    });
  });

  describe('decrypt()', () => {
    it('returns input unchanged if no colon separator', async () => {
      const result = await decrypt('plaintext-value', TEST_SECRET);
      expect(result).toBe('plaintext-value');
    });

    it('returns input unchanged for empty string', async () => {
      const result = await decrypt('', TEST_SECRET);
      expect(result).toBe('');
    });

    it('returns input unchanged for null/falsy', async () => {
      const result = await decrypt(null as unknown as string, TEST_SECRET);
      expect(result).toBe(null);
    });

    it('handles 3-part format (salt:iv:ciphertext)', async () => {
      const mockDecrypted = new TextEncoder().encode('decrypted@email.com').buffer;
      mockDecrypt.mockResolvedValueOnce(mockDecrypted);

      const encrypted = 'aabbccdd11223344aabbccdd11223344:aabbccdd1122334455667788:ffee1234';
      const result = await decrypt(encrypted, TEST_SECRET);

      expect(result).toBe('decrypted@email.com');
      expect(mockDecrypt).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'AES-GCM' }),
        'mock-derived-key',
        expect.anything()
      );
    });

    it('handles legacy 2-part format (iv:ciphertext)', async () => {
      const mockDecrypted = new TextEncoder().encode('legacy-value').buffer;
      mockDecrypt.mockResolvedValueOnce(mockDecrypted);

      const encrypted = 'aabbccdd1122334455667788:ffee1234';
      const result = await decrypt(encrypted, TEST_SECRET);

      expect(result).toBe('legacy-value');
      // Verify deriveKey was called without a dynamic salt (legacy path uses fixed salt)
      expect(mockDeriveKey).toHaveBeenCalled();
    });

    it('returns sentinel on decryption failure (SEC-02)', async () => {
      mockDecrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      const result = await decrypt('bad:encrypted:data', TEST_SECRET);
      expect(result).toBe('[Decryption Failed]');
    });

    it('returns input for single-part strings with no colon', async () => {
      const result = await decrypt('no-colons-here', TEST_SECRET);
      expect(result).toBe('no-colons-here');
    });

    it('returns input when parts are empty after split', async () => {
      const result = await decrypt('a:', TEST_SECRET);
      // Only 2 parts, second is empty — should not crash
      expect(result).toBeDefined();
    });
  });
});
