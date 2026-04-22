import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './security';

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
