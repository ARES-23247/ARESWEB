/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { sanitizeHtml, signTutorialProgress, verifyTutorialProgress, validateUrlParam, validateIdParam } from './security';

describe('security utility - sanitizeHtml', () => {
  it('returns an empty string if input is empty', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('allows safe HTML tags', () => {
    const input = '<b>Bold</b> <i>Italic</i> <p>Paragraph</p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('removes unsafe tags like <script>', () => {
    const input = 'Hello <script>alert("xss")</script> world';
    const output = sanitizeHtml(input);
    expect(output).not.toContain('<script>');
    expect(output).toBe('Hello  world');
  });

  it('removes unsafe attributes like onclick', () => {
    const input = '<button onclick="alert(\'xss\')">Click me</button>';
    const output = sanitizeHtml(input);
    expect(output).not.toContain('onclick');
    expect(output).toBe('Click me');
  });

  it('allows safe attributes like href', () => {
    const input = '<a href="https://ares23247.com" target="_blank">ARES Website</a>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('allows image tags and safe attributes', () => {
    const input = '<img src="test.jpg" alt="test" width="100" height="100" />';
    const output = sanitizeHtml(input);
    expect(output).toContain('src="test.jpg"');
    expect(output).toContain('alt="test"');
  });
});

describe('security utility - HMAC tutorial progress', () => {
  it('should sign and verify valid tutorial progress', async () => {
    const progress = ['step1', 'step2', 'step3'];
    const signed = await signTutorialProgress(progress);
    expect(signed.progress).toEqual(progress);
    expect(signed.signature).toBeTruthy();
    expect(typeof signed.signature).toBe('string');
  });

  it('should verify valid signed data', async () => {
    const progress = ['step1', 'step2'];
    const signed = await signTutorialProgress(progress);
    const verified = await verifyTutorialProgress(signed);
    expect(verified).toEqual(progress);
  });

  it('should reject tampered progress', async () => {
    const progress = ['step1'];
    const signed = await signTutorialProgress(progress);
    signed.progress.push('step2'); // Tamper with data
    const verified = await verifyTutorialProgress(signed);
    expect(verified).toBeNull();
  });

  it('should reject null input', async () => {
    const verified = await verifyTutorialProgress(null);
    expect(verified).toBeNull();
  });

  it('should reject data without progress', async () => {
    const verified = await verifyTutorialProgress({ signature: 'abc' } as any);
    expect(verified).toBeNull();
  });

  it('should reject data without signature', async () => {
    const verified = await verifyTutorialProgress({ progress: ['step1'] } as any);
    expect(verified).toBeNull();
  });

  it('should handle empty progress array', async () => {
    const progress: string[] = [];
    const signed = await signTutorialProgress(progress);
    const verified = await verifyTutorialProgress(signed);
    expect(verified).toEqual([]);
  });
});

describe('security utility - validateUrlParam', () => {
  it('should accept safe alphanumeric parameters', () => {
    expect(validateUrlParam('valid-param-123')).toBe('valid-param-123');
  });

  it('should accept parameters with special safe characters', () => {
    expect(validateUrlParam('user_name~test')).toBe('user_name~test');
    expect(validateUrlParam('file.name.txt')).toBe('file.name.txt');
  });

  it('should reject undefined', () => {
    expect(validateUrlParam(undefined)).toBeNull();
  });

  it('should reject empty string', () => {
    expect(validateUrlParam('')).toBeNull();
  });

  it('should reject directory traversal', () => {
    expect(validateUrlParam('../etc/passwd')).toBeNull();
    expect(validateUrlParam('....//')).toBeNull();
  });

  it('should reject script tags', () => {
    expect(validateUrlParam('<script>alert(\'xss\')</script>')).toBeNull();
  });

  it('should reject javascript protocol', () => {
    expect(validateUrlParam('javascript:alert(\'xss\')')).toBeNull();
    expect(validateUrlParam('JAVASCRIPT:alert(\'xss\')')).toBeNull();
  });

  it('should reject event handlers', () => {
    expect(validateUrlParam('test onerror=alert(\'xss\')')).toBeNull();
    expect(validateUrlParam('test onload=alert(\'xss\')')).toBeNull();
  });

  it('should reject parameters over 256 characters', () => {
    const longParam = 'a'.repeat(257);
    expect(validateUrlParam(longParam)).toBeNull();
  });
});

describe('security utility - validateIdParam', () => {
  it('should accept UUID format', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(validateIdParam(uuid)).toBe(uuid);
  });

  it('should accept numeric IDs', () => {
    expect(validateIdParam('123')).toBe('123');
    expect(validateIdParam('0')).toBe('0');
  });

  it('should accept slug-like format', () => {
    expect(validateIdParam('my-slug')).toBe('my-slug');
    expect(validateIdParam('test-post-123')).toBe('test-post-123');
  });

  it('should reject slugs starting with hyphen', () => {
    expect(validateIdParam('-invalid')).toBeNull();
  });

  it('should reject slugs ending with hyphen', () => {
    expect(validateIdParam('invalid-')).toBeNull();
  });

  it('should reject slugs with double hyphens', () => {
    expect(validateIdParam('test--slug')).toBeNull();
  });

  it('should reject uppercase in slugs', () => {
    expect(validateIdParam('Test-Slug')).toBeNull();
  });

  it('should reject undefined', () => {
    expect(validateIdParam(undefined)).toBeNull();
  });

  it('should reject empty string', () => {
    expect(validateIdParam('')).toBeNull();
  });

  it('should reject parameters over 128 characters', () => {
    const longParam = 'a'.repeat(129);
    expect(validateIdParam(longParam)).toBeNull();
  });

  it('should reject negative numbers', () => {
    expect(validateIdParam('-1')).toBeNull();
  });

  it('should reject decimal numbers', () => {
    expect(validateIdParam('12.34')).toBeNull();
  });
});
